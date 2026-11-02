-- Snapshot dokumen historis: tidak mengarang item/harga/resep yang tidak ada pada sumber.
alter table public.transaksi add column if not exists sumber_penjualan jsonb;
alter table public.transaksi add constraint transaksi_sumber_penjualan_object check(sumber_penjualan is null or (jsonb_typeof(sumber_penjualan)='object' and (sumber_penjualan->>'qty')::int>0));
create unique index transaksi_sumber_ref on public.transaksi(outlet_id,(sumber_penjualan->>'sha256'),(sumber_penjualan->>'ref')) where sumber_penjualan is not null;
alter type public.metode_bayar add value if not exists 'grabfood';
alter type public.metode_bayar add value if not exists 'shopeepay';
comment on column public.transaksi.sumber_penjualan is 'Snapshot dokumen historis; qty/produk gabungan. Tidak menyatakan HPP atau alokasi item diketahui.';

CREATE OR REPLACE FUNCTION public.laporan_operasional(p_jenis text, p_outlet uuid, p_dari date, p_sampai date, p_mode mode_data DEFAULT 'asli'::mode_data, p_bahan uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ta timestamptz := (p_dari::timestamp at time zone 'Asia/Jakarta');
  tb timestamptz := ((p_sampai + 1)::timestamp at time zone 'Asia/Jakarta');
  r jsonb;
begin
  if p_sampai < p_dari then raise exception 'Tanggal akhir sebelum tanggal awal'; end if;
  if p_sampai - p_dari > 400 then raise exception 'Rentang maksimal 400 hari'; end if;
  if p_outlet is null then
    if not punya_peran('{owner,admin_pusat,finance,admin_gudang,hrd}') then raise exception 'Tidak diizinkan'; end if;
  elsif not (punya_peran('{owner,admin_pusat,finance,admin_gudang,manajer_area,hrd}') and boleh_outlet(p_outlet) or peran_di_outlet(p_outlet, '{spv}')) then
    raise exception 'Tidak diizinkan';
  end if;

  if p_jenis in ('ringkasan','harian','transaksi','produk','kategori','tipe','metode','jam','void','modifier','kasir','stok_keluar','ikhtisar','void_orang') and p_outlet is null then
    raise exception 'Pilih outlet untuk laporan penjualan';
  end if;

  if p_jenis in ('ringkasan','ikhtisar') then
    with t as (select * from transaksi where outlet_id = p_outlet and mode = p_mode and created_at >= ta and created_at < tb),
    l as (select * from t where status = 'lunas'),
    b as (select coalesce(sum(jumlah), 0) j, coalesce(sum(jumlah) filter (where kb.grup = 'hpp'), 0) hpp_biaya
            from biaya_outlet bo join kategori_biaya kb on kb.id = bo.kategori_id
           where bo.outlet_id = p_outlet and bo.mode = p_mode and bo.deleted_at is null and bo.tanggal between p_dari and p_sampai)
    select jsonb_build_array(jsonb_build_object(
      'transaksi', (select count(*) from l),
      'kotor', (select coalesce(sum(subtotal), 0) from l),
      'diskon', (select coalesce(sum(diskon), 0) from l),
      'bersih', (select coalesce(sum(total), 0) from l),
      'hpp', (select coalesce(sum(hpp_teoritis), 0) from l),
      'laba_kotor', (select coalesce(sum(total - hpp_teoritis), 0) from l),
      'rata', (select coalesce(round(avg(total)), 0) from l),
      'item', (select coalesce(sum(coalesce((l.sumber_penjualan->>'qty')::int, (select sum(i.qty) from item_transaksi i where i.transaksi_id=l.id))),0) from l),
      'void', (select count(*) from t where status = 'void'),
      'nilai_void', (select coalesce(sum(total), 0) from t where status = 'void'),
      'pengeluaran', (select j from b),
      'laba_bersih_kas', (select coalesce(sum(total - hpp_teoritis), 0) from l) - (select j - hpp_biaya from b),
      'impor_tanpa_rincian', (select count(*) from l where sumber_penjualan is not null), 'hari', p_sampai - p_dari + 1)) into r;

  elsif p_jenis = 'harian' then
    select coalesce(jsonb_agg(x order by x->>'tanggal'), '[]') into r from (
      select jsonb_build_object('tanggal', d::date,
        'transaksi', count(t.id), 'kotor', coalesce(sum(t.subtotal), 0), 'diskon', coalesce(sum(t.diskon), 0),
        'bersih', coalesce(sum(t.total), 0), 'hpp', coalesce(sum(t.hpp_teoritis), 0), 'laba_kotor', coalesce(sum(t.total - t.hpp_teoritis), 0),
        'impor_tanpa_rincian', count(t.id) filter(where t.sumber_penjualan is not null), 'rata', coalesce(round(avg(t.total)), 0)) x
      from generate_series(p_dari, p_sampai, interval '1 day') d
      left join transaksi t on t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas' and (t.created_at at time zone 'Asia/Jakarta')::date = d::date
      group by d) s;

  elsif p_jenis = 'transaksi' or p_jenis = 'void' then
    select coalesce(jsonb_agg(x order by x->>'waktu' desc), '[]') into r from (
      select jsonb_build_object('waktu', t.created_at, 'nomor', t.nomor, 'kanal', t.kanal, 'tipe', t.tipe, 'kasir', s.nama_kasir,
        'pelanggan', t.pelanggan, 'item', coalesce(t.sumber_penjualan->>'products', (select string_agg(i.qty || 'x ' || i.nama, ', ') from item_transaksi i where i.transaksi_id = t.id)),
        'outlet', (select nama from outlet where id=t.outlet_id),
        'ref', coalesce(t.sumber_penjualan->>'ref', 'POS-'||to_char(t.created_at at time zone 'Asia/Jakarta','DDMMYY')||'-'||t.nomor),
        'nomor_sumber', t.sumber_penjualan->>'no',
        'qty', coalesce((t.sumber_penjualan->>'qty')::int, (select coalesce(sum(i.qty),0) from item_transaksi i where i.transaksi_id=t.id)),
        'pajak', coalesce((t.sumber_penjualan->>'pajak')::bigint,0), 'service_charge', coalesce((t.sumber_penjualan->>'service_charge')::bigint,0),
        'penyesuaian', coalesce((t.sumber_penjualan->>'penyesuaian')::bigint,0),
        'dibayar', (select coalesce(sum(p.nominal),0) from pembayaran p where p.transaksi_id=t.id),
        'terakhir_dibayar', case when t.status='lunas' then t.created_at end,
        'sisa', greatest(t.total-(select coalesce(sum(p.nominal),0) from pembayaran p where p.transaksi_id=t.id),0),
        'sumber', t.sumber_penjualan->>'file',
        'metode_sumber', t.sumber_penjualan->>'method',
        'subtotal', t.subtotal, 'diskon', t.diskon, 'total', t.total,
        'metode', (select string_agg(distinct p.metode::text, ' + ') from pembayaran p where p.transaksi_id = t.id),
        'status', t.status, 'alasan', t.void_alasan, 'void_oleh', coalesce(t.void_nama, (select nama from pengguna where id = t.void_oleh)), 'kategori', t.void_kategori, 'void_at', t.void_at) x
      from transaksi t left join sesi_kas s on s.id = t.sesi_kas_id
      where t.outlet_id = p_outlet and t.mode = p_mode and t.created_at >= ta and t.created_at < tb
        and (p_jenis = 'transaksi' or t.status = 'void')) s;

  elsif p_jenis = 'void_orang' then
    select coalesce(jsonb_agg(x order by (x->>'nilai')::bigint desc), '[]') into r from (
      select jsonb_build_object('nama', coalesce(t.void_nama, (select nama from pengguna where id = t.void_oleh), '-'),
        'jumlah', count(*), 'nilai', coalesce(sum(t.total), 0),
        'alasan_utama', (select t2.void_kategori from transaksi t2 where t2.outlet_id = p_outlet and t2.mode = p_mode and t2.status = 'void'
                           and t2.created_at >= ta and t2.created_at < tb and coalesce(t2.void_nama, '') = coalesce(t.void_nama, '') and t2.void_kategori is not null
                         group by t2.void_kategori order by count(*) desc limit 1),
        'terakhir', max(t.void_at)) x
      from transaksi t
      where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'void' and t.created_at >= ta and t.created_at < tb
      group by coalesce(t.void_nama, (select nama from pengguna where id = t.void_oleh), '-'), t.void_nama) s;

  elsif p_jenis = 'produk' then
    select coalesce(jsonb_agg(x order by (x->>'kotor')::bigint desc), '[]') into r from (
      select jsonb_build_object('menu', coalesce(m.nama, i.nama), 'kategori', km.nama, 'qty', sum(i.qty),
        'kotor', sum(i.qty * i.harga), 'hpp', sum(i.qty * i.hpp_teoritis), 'laba', sum(i.qty * (i.harga - i.hpp_teoritis))) x
      from item_transaksi i join transaksi t on t.id = i.transaksi_id
      left join menu m on m.id = i.menu_id left join kategori_menu km on km.id = m.kategori_id
      where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas' and t.created_at >= ta and t.created_at < tb
      group by coalesce(m.nama, i.nama), km.nama) s;

  elsif p_jenis = 'kategori' then
    select coalesce(jsonb_agg(x order by (x->>'kotor')::bigint desc), '[]') into r from (
      select jsonb_build_object('kategori', coalesce(km.nama, 'Tanpa kategori'), 'qty', sum(i.qty), 'kotor', sum(i.qty * i.harga),
        'hpp', sum(i.qty * i.hpp_teoritis), 'laba', sum(i.qty * (i.harga - i.hpp_teoritis))) x
      from item_transaksi i join transaksi t on t.id = i.transaksi_id
      left join menu m on m.id = i.menu_id left join kategori_menu km on km.id = m.kategori_id
      where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas' and t.created_at >= ta and t.created_at < tb
      group by km.nama) s;

  elsif p_jenis = 'tipe' then
    select coalesce(jsonb_agg(x order by (x->>'bersih')::bigint desc), '[]') into r from (
      select jsonb_build_object('kanal', t.kanal, 'tipe', t.tipe, 'transaksi', count(*), 'kotor', sum(t.subtotal), 'diskon', sum(t.diskon), 'bersih', sum(t.total)) x
      from transaksi t where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas' and t.created_at >= ta and t.created_at < tb
      group by t.kanal, t.tipe) s;

  elsif p_jenis = 'metode' then
    select coalesce(jsonb_agg(x order by (x->>'nominal')::bigint desc), '[]') into r from (
      select jsonb_build_object('metode', p.metode, 'transaksi', count(distinct t.id), 'nominal', sum(p.nominal)) x
      from pembayaran p join transaksi t on t.id = p.transaksi_id
      where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas' and t.created_at >= ta and t.created_at < tb
      group by p.metode) s;

  elsif p_jenis = 'jam' then
    select coalesce(jsonb_agg(x order by (x->>'jam')::int), '[]') into r from (
      select jsonb_build_object('jam', h, 'transaksi', count(t.id), 'bersih', coalesce(sum(t.total), 0), 'impor_tanpa_rincian', count(t.id) filter(where t.sumber_penjualan is not null), 'rata', coalesce(round(avg(t.total)), 0)) x
      from generate_series(0, 23) h
      left join transaksi t on t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas' and t.created_at >= ta and t.created_at < tb
        and extract(hour from t.created_at at time zone 'Asia/Jakarta') = h
      group by h) s;

  elsif p_jenis = 'modifier' then
    select coalesce(jsonb_agg(x order by (x->>'qty')::bigint desc), '[]') into r from (
      select jsonb_build_object('grup', v.grup, 'varian', v.nama, 'qty', sum(i.qty), 'tambahan', sum(i.qty * v.tambahan_harga)) x
      from item_transaksi i join transaksi t on t.id = i.transaksi_id join varian v on v.id = any(i.varian_ids)
      where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas' and t.created_at >= ta and t.created_at < tb
      group by v.grup, v.nama) s;

  elsif p_jenis = 'kasir' then
    select coalesce(jsonb_agg(x order by (x->>'bersih')::bigint desc), '[]') into r from (
      select jsonb_build_object('kasir', coalesce(s.nama_kasir, '-'), 'shift', count(distinct s.id),
        'transaksi', count(t.id) filter (where t.status = 'lunas'), 'bersih', coalesce(sum(t.total) filter (where t.status = 'lunas'), 0),
        'void', count(t.id) filter (where t.status = 'void'),
        'selisih', (select coalesce(sum(s2.selisih), 0) from sesi_kas s2 where s2.outlet_id = p_outlet and s2.mode = p_mode and s2.kasir_id = s.kasir_id and s2.dibuka_at >= ta and s2.dibuka_at < tb)) x
      from sesi_kas s left join transaksi t on t.sesi_kas_id = s.id
      where s.outlet_id = p_outlet and s.mode = p_mode and s.dibuka_at >= ta and s.dibuka_at < tb
      group by s.kasir_id, s.nama_kasir) s;

  elsif p_jenis = 'stok_keluar' then
    select coalesce(jsonb_agg(x order by x->>'bahan'), '[]') into r from (
      select jsonb_build_object('bahan', b.nama, 'kategori', b.kategori, 'satuan', b.satuan_pakai, 'jumlah', -sum(m.jumlah), 'nilai', round(-sum(m.jumlah) * nilai_bahan(b))) x
      from mutasi_stok m join bahan b on b.id = m.bahan_id
      where m.outlet_id = p_outlet and m.mode = p_mode and m.jenis in ('pemakaian','void') and m.created_at >= ta and m.created_at < tb
      group by b.id) s;

  elsif p_jenis in ('persediaan','stok_rendah') then
    select coalesce(jsonb_agg(x order by x->>'kategori', x->>'bahan'), '[]') into r from (
      select jsonb_build_object('bahan', b.nama, 'kategori', b.kategori, 'satuan', b.satuan_pakai,
        'stok', q.stok, 'stok_min', b.stok_min, 'harga', round(nilai_bahan(b)), 'nilai', round(q.stok * nilai_bahan(b)),
        'status', case when q.stok <= 0 then 'habis' when q.stok < coalesce(b.stok_min, 0) then 'menipis' else 'aman' end) x
      from bahan b
      cross join lateral (select coalesce((select s.jumlah from stok s where s.bahan_id = b.id and s.mode = p_mode and s.outlet_id is not distinct from p_outlet), 0)
                               - coalesce((select sum(m.jumlah) from mutasi_stok m where m.bahan_id = b.id and m.mode = p_mode and m.outlet_id is not distinct from p_outlet and m.created_at >= tb), 0) stok) q
      where b.mode = 'asli' and b.deleted_at is null
        and (p_jenis = 'persediaan' or q.stok < coalesce(b.stok_min, 0))) s;

  elsif p_jenis = 'mutasi_persediaan' then
    select coalesce(jsonb_agg(x order by x->>'kategori', x->>'bahan'), '[]') into r from (
      select jsonb_build_object('bahan', b.nama, 'kategori', b.kategori, 'satuan', b.satuan_pakai,
        'awal', q.akhir - q.gerak,
        'masuk', q.masuk, 'pemakaian', q.pakai, 'waste', q.waste, 'transfer', q.transfer, 'penyesuaian', q.sesuai,
        'akhir', q.akhir, 'nilai_akhir', round(q.akhir * nilai_bahan(b))) x
      from bahan b
      cross join lateral (
        select coalesce((select s.jumlah from stok s where s.bahan_id = b.id and s.mode = p_mode and s.outlet_id is not distinct from p_outlet), 0)
                 - coalesce((select sum(m.jumlah) from mutasi_stok m where m.bahan_id = b.id and m.mode = p_mode and m.outlet_id is not distinct from p_outlet and m.created_at >= tb), 0) akhir,
               coalesce(sum(m.jumlah), 0) gerak,
               coalesce(sum(m.jumlah) filter (where m.jenis in ('pembelian','kiriman_masuk','transfer_masuk','kiriman_batal')), 0) masuk,
               coalesce(-sum(m.jumlah) filter (where m.jenis in ('pemakaian','void','marketing')), 0) pakai,
               coalesce(-sum(m.jumlah) filter (where m.jenis = 'waste'), 0) waste,
               coalesce(-sum(m.jumlah) filter (where m.jenis in ('transfer_keluar','kiriman_keluar')), 0) transfer,
               coalesce(sum(m.jumlah) filter (where m.jenis in ('opname','koreksi')), 0) sesuai
          from mutasi_stok m where m.bahan_id = b.id and m.mode = p_mode and m.outlet_id is not distinct from p_outlet and m.created_at >= ta and m.created_at < tb) q
      where b.mode = 'asli' and b.deleted_at is null) s;

  elsif p_jenis = 'mutasi_barang' then
    select coalesce(jsonb_agg(x order by x->>'waktu' desc), '[]') into r from (
      select jsonb_build_object('waktu', m.created_at, 'bahan', b.nama, 'satuan', b.satuan_pakai, 'jenis', m.jenis,
        'masuk', greatest(m.jumlah, 0), 'keluar', greatest(-m.jumlah, 0), 'keterangan', m.keterangan, 'oleh', u.nama) x
      from mutasi_stok m join bahan b on b.id = m.bahan_id left join pengguna u on u.id = m.dibuat_oleh
      where m.mode = p_mode and m.outlet_id is not distinct from p_outlet and m.created_at >= ta and m.created_at < tb
        and (p_bahan is null or m.bahan_id = p_bahan)
      order by m.created_at desc limit 5000) s;

  elsif p_jenis = 'kartu_stok' then
    if p_bahan is null then return '[]'; end if;
    with awal as (
      select coalesce((select s.jumlah from stok s where s.bahan_id = p_bahan and s.mode = p_mode and s.outlet_id is not distinct from p_outlet), 0)
           - coalesce((select sum(m.jumlah) from mutasi_stok m where m.bahan_id = p_bahan and m.mode = p_mode and m.outlet_id is not distinct from p_outlet and m.created_at >= ta), 0) v),
    g as (select m.*, u.nama oleh, sum(m.jumlah) over (order by m.created_at, m.id) kum from mutasi_stok m left join pengguna u on u.id = m.dibuat_oleh
           where m.bahan_id = p_bahan and m.mode = p_mode and m.outlet_id is not distinct from p_outlet and m.created_at >= ta and m.created_at < tb)
    select jsonb_build_array(jsonb_build_object('waktu', ta, 'jenis', 'saldo_awal', 'keterangan', 'Saldo awal', 'masuk', null, 'keluar', null, 'saldo', (select v from awal)))
        || coalesce((select jsonb_agg(jsonb_build_object('waktu', created_at, 'jenis', jenis, 'keterangan', keterangan, 'oleh', oleh,
               'masuk', greatest(jumlah, 0), 'keluar', greatest(-jumlah, 0),
               'saldo', (select v from awal) + kum) order by created_at, id) from g), '[]')
      into r;

  elsif p_jenis = 'produk_menu' then
    select coalesce(jsonb_agg(x order by x->>'kategori', x->>'menu'), '[]') into r from (
      select jsonb_build_object('menu', m.nama, 'kategori', km.nama, 'harga', m.harga_langsung, 'harga_ojol', m.harga_ojol,
        'hpp', q.hpp, 'margin', case when m.harga_langsung > 0 then round(100.0 * (m.harga_langsung - q.hpp) / m.harga_langsung, 1) end,
        'aktif', m.aktif, 'titipan', m.titipan) x
      from menu m left join kategori_menu km on km.id = m.kategori_id
      cross join lateral (select case when m.titipan then coalesce(m.harga_titip, 0)
          else coalesce((select round(sum(rs.takaran * bh.harga_pokok)) from resep rs join bahan bh on bh.id = rs.bahan_id where rs.menu_id = m.id and rs.deleted_at is null and rs.varian_id is null), 0) end hpp) q
      where m.mode = 'asli' and m.deleted_at is null) s;

  elsif p_jenis in ('pembelian','pembelian_bahan','pembelian_supplier') then
    if p_outlet is not null then raise exception 'Pembelian supplier dicatat di gudang pusat — pilih "Gudang Pusat"'; end if;
    if p_jenis = 'pembelian' then
      select coalesce(jsonb_agg(x order by x->>'tanggal' desc), '[]') into r from (
        select jsonb_build_object('tanggal', p.tanggal, 'nomor', p.nomor, 'supplier', s.nama, 'faktur', p.no_faktur, 'status', p.status,
          'item', (select string_agg(i.nama || ' ' || i.qty || ' ' || coalesce(i.satuan, ''), ', ') from item_pembelian i where i.pembelian_id = p.id), 'total', p.total) x
        from pembelian p left join supplier s on s.id = p.supplier_id
        where p.mode = p_mode and p.deleted_at is null and p.tanggal between p_dari and p_sampai) q;
    elsif p_jenis = 'pembelian_bahan' then
      select coalesce(jsonb_agg(x order by (x->>'total')::bigint desc), '[]') into r from (
        select jsonb_build_object('bahan', i.nama, 'satuan', i.satuan, 'qty', sum(i.qty), 'total', sum(i.qty * i.harga), 'harga_rata', round(sum(i.qty * i.harga) / nullif(sum(i.qty), 0)),
          'faktur', count(distinct p.id)) x
        from item_pembelian i join pembelian p on p.id = i.pembelian_id
        where p.mode = p_mode and p.deleted_at is null and p.status <> 'batal' and p.tanggal between p_dari and p_sampai
        group by i.nama, i.satuan) q;
    else
      select coalesce(jsonb_agg(x order by (x->>'total')::bigint desc), '[]') into r from (
        select jsonb_build_object('supplier', coalesce(s.nama, '-'), 'faktur', count(*), 'total', sum(p.total)) x
        from pembelian p left join supplier s on s.id = p.supplier_id
        where p.mode = p_mode and p.deleted_at is null and p.status <> 'batal' and p.tanggal between p_dari and p_sampai
        group by s.nama) q;
    end if;

  elsif p_jenis = 'kiriman' then
    select coalesce(jsonb_agg(x order by x->>'tanggal' desc), '[]') into r from (
      select jsonb_build_object('tanggal', k.tanggal, 'nomor', k.nomor, 'outlet', o.nama, 'status', k.status, 'penerima', k.nama_penerima,
        'item', (select count(*) from item_kiriman i where i.kiriman_id = k.id), 'total', k.total) x
      from kiriman k join outlet o on o.id = k.outlet_id
      where k.mode = p_mode and k.deleted_at is null and k.tanggal between p_dari and p_sampai and (p_outlet is null or k.outlet_id = p_outlet)) q;

  elsif p_jenis in ('pengeluaran','pengeluaran_kategori','pendapatan_lain','marketing_produk') then
    if p_outlet is null then raise exception 'Pilih outlet'; end if;
    if p_jenis = 'pengeluaran' then
      select coalesce(jsonb_agg(x order by x->>'tanggal' desc), '[]') into r from (
        select jsonb_build_object('tanggal', bo.tanggal, 'kategori', kb.nama, 'grup', kb.grup, 'keterangan', bo.keterangan, 'sumber', bo.sumber,
          'oleh', u.nama, 'jumlah', bo.jumlah) x
        from biaya_outlet bo join kategori_biaya kb on kb.id = bo.kategori_id left join pengguna u on u.id = bo.dibuat_oleh
        where bo.outlet_id = p_outlet and bo.mode = p_mode and bo.deleted_at is null and bo.tanggal between p_dari and p_sampai) q;
    elsif p_jenis = 'pengeluaran_kategori' then
      select coalesce(jsonb_agg(x order by (x->>'jumlah')::bigint desc), '[]') into r from (
        select jsonb_build_object('kategori', kb.nama, 'grup', kb.grup, 'catatan', count(*), 'laci', coalesce(sum(bo.jumlah) filter (where bo.sumber = 'laci'), 0),
          'pusat', coalesce(sum(bo.jumlah) filter (where bo.sumber = 'pusat'), 0), 'jumlah', sum(bo.jumlah)) x
        from biaya_outlet bo join kategori_biaya kb on kb.id = bo.kategori_id
        where bo.outlet_id = p_outlet and bo.mode = p_mode and bo.deleted_at is null and bo.tanggal between p_dari and p_sampai
        group by kb.nama, kb.grup) q;
    elsif p_jenis = 'pendapatan_lain' then
      select coalesce(jsonb_agg(x order by x->>'tanggal' desc), '[]') into r from (
        select jsonb_build_object('tanggal', pm.tanggal, 'kanal', pm.kanal, 'jenis', pm.jenis, 'keterangan', pm.keterangan, 'oleh', pm.nama_pembuat, 'jumlah', pm.jumlah) x
        from penjualan_manual pm
        where pm.outlet_id = p_outlet and pm.mode = p_mode and pm.deleted_at is null and pm.tanggal between p_dari and p_sampai) q;
    else
      select coalesce(jsonb_agg(x order by x->>'tanggal' desc), '[]') into r from (
        select jsonb_build_object('tanggal', pk.tanggal, 'jenis', pk.jenis, 'penerima', pk.penerima,
          'item', (select string_agg((e->>'qty') || 'x ' || (e->>'nama'), ', ') from jsonb_array_elements(pk.items) e),
          'oleh', pk.nama_pembuat, 'nilai_jual', pk.nilai_jual, 'hpp', pk.total_hpp) x
        from produk_keluar pk
        where pk.outlet_id = p_outlet and pk.mode = p_mode and pk.deleted_at is null and pk.tanggal between p_dari and p_sampai) q;
    end if;
  else
    raise exception 'Jenis laporan tidak dikenal: %', p_jenis;
  end if;
  return coalesce(r, '[]');
end $function$
