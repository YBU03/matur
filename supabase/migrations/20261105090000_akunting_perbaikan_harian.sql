-- Akunting 5 Nov: (1) pengeluaran di kas final bisa diperbaiki (kategori/keterangan oleh outlet & akunting,
-- nominal/sumber/hapus khusus akunting + geser kas), (2) label rumus HPP bisa diedit, (3) Catatan Harian
-- mengelompokkan penjualan per METODE BAYAR (sama dengan Laporan Penjualan) + tanda transaksi janggal,
-- (4) riwayat perbaikan admin per outlet, (5) koreksi data #27/#30 Kominot 4 Nov.
-- Catatan: dijalankan pemilik lewat SQL Editor 5 Nov. Bagian (3) rekap_harian per metode digantikan
-- 20261105231111_rekap_harian_kanal_janggal (kembali per kanal + tanda janggal) agar rekonsiliasi 2 Nov tetap.

-- (1) izinkan perubahan biaya kas final hanya lewat RPC (flag transaksi lokal)
do $$
declare d text;
begin
  d := pg_get_functiondef('matur_internal.jaga_biaya_tutup()'::regprocedure);
  if position('declare sid uuid;s sesi_kas;' || chr(10) || 'begin' in d) = 0 then raise exception 'pola jaga_biaya_tutup tidak ditemukan'; end if;
  d := replace(d, 'declare sid uuid;s sesi_kas;' || chr(10) || 'begin',
    'declare sid uuid;s sesi_kas;' || chr(10) || 'begin' || chr(10) || ' if current_setting(''matur.biaya_final'', true) = ''1'' then return case when tg_op=''DELETE'' then old else new end; end if;');
  execute d;
end $$;

create or replace function public.koreksi_biaya_final(p_id uuid, p_kategori uuid, p_keterangan text, p_jumlah bigint, p_sumber text, p_hapus boolean, p_alasan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b biaya_outlet; s sesi_kas; akunting boolean := punya_peran('{owner,admin_pusat,finance}');
  v_sumber text := coalesce(nullif(p_sumber, ''), 'laci'); jml bigint; ket text := nullif(left(trim(coalesce(p_keterangan, '')), 200), '');
  als text := nullif(left(trim(coalesce(p_alasan, '')), 300), ''); hapus boolean := coalesce(p_hapus, false);
  laci_lama bigint; laci_baru bigint; berat boolean;
begin
  select * into b from biaya_outlet where id = p_id and deleted_at is null for update;
  if b.id is null then raise exception 'Pengeluaran tidak ditemukan'; end if;
  if not boleh_outlet(b.outlet_id) then raise exception 'Tidak diizinkan'; end if;
  jml := coalesce(p_jumlah, b.jumlah);
  if not hapus and (jml <= 0 or jml > 1000000000000) then raise exception 'Nominal harus lebih dari 0'; end if;
  if v_sumber not in ('laci', 'pusat') then raise exception 'Sumber tidak valid'; end if;
  if not hapus and p_kategori is null then raise exception 'Pilih kategori'; end if;
  if b.sesi_kas_id is not null then select * into s from sesi_kas where id = b.sesi_kas_id for update; end if;
  berat := hapus or jml <> b.jumlah or v_sumber <> b.sumber;
  if berat and not akunting then
    raise exception 'Kas shift sudah final: nominal, sumber dana, atau hapus hanya oleh Akunting (Owner/Admin Pusat/Finance). Kategori & keterangan tetap bisa diubah.';
  end if;
  if berat and coalesce(length(als), 0) < 3 then raise exception 'PERLU_ALASAN: Tulis alasan perbaikan (min. 3 huruf)'; end if;
  if v_sumber = 'laci' and b.sumber = 'pusat' and b.sesi_kas_id is null then raise exception 'Pengeluaran dibayar pusat tidak bisa dipindah ke laci kas yang sudah final'; end if;
  laci_lama := case when b.sumber = 'laci' then b.jumlah else 0 end;
  laci_baru := case when hapus or v_sumber <> 'laci' then 0 else jml end;
  perform set_config('matur.biaya_final', '1', true);
  if hapus then
    update biaya_outlet set deleted_at = now() where id = b.id;
  else
    update biaya_outlet set kategori_id = p_kategori, keterangan = ket, jumlah = jml, sumber = v_sumber,
      sesi_kas_id = case when v_sumber = 'pusat' then null else b.sesi_kas_id end where id = b.id;
  end if;
  perform set_config('matur.biaya_final', '', true);
  if s.id is not null and s.ditutup_at is not null and laci_lama <> laci_baru then
    perform koreksi_internal.geser_kas(s.id, laci_lama - laci_baru);
  end if;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (auth.uid(), case when hapus then 'hapus_biaya_final' else 'koreksi_biaya_final' end, 'biaya_outlet', b.id::text, to_jsonb(b),
    jsonb_build_object('outlet_id', b.outlet_id, 'tanggal', b.tanggal, 'kategori_id', p_kategori, 'keterangan', ket, 'jumlah', jml, 'sumber', v_sumber,
      'hapus', hapus, 'alasan', als, 'geser_kas', laci_lama - laci_baru));
  return jsonb_build_object('ok', case when hapus then 'Pengeluaran dihapus' else 'Perubahan tersimpan' end
    || case when laci_lama <> laci_baru then ' · kas seharusnya shift disesuaikan ' || case when laci_lama > laci_baru then '+' else '−' end || to_char(abs(laci_lama - laci_baru), 'FM999G999G999') else '' end || '.');
end $$;
revoke all on function public.koreksi_biaya_final(uuid, uuid, text, bigint, text, boolean, text) from public, anon;
grant execute on function public.koreksi_biaya_final(uuid, uuid, text, bigint, text, boolean, text) to authenticated;

-- (2) label komponen titipan pada rumus HPP bisa diubah akunting
create or replace function public.atur_rumus_hpp(p_rumus jsonb, p_grup jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; g text;
begin
  if not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Akunting'; end if;
  update perusahaan set rumus_hpp = jsonb_build_object(
    'kiriman_gudang', coalesce((p_rumus->>'kiriman_gudang')::boolean, true),
    'titipan', coalesce((p_rumus->>'titipan')::boolean, true),
    'label_titipan', coalesce(nullif(left(trim(p_rumus->>'label_titipan'), 60), ''), 'Tagihan snack & cheesecake')) where id is not null;
  for k, g in select * from jsonb_each_text(coalesce(p_grup, '{}')) loop
    if g in ('hpp','beban','lain') then update kategori_biaya set grup = g where id = k::uuid; end if;
  end loop;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru) values (auth.uid(), 'atur_rumus_hpp', 'perusahaan', null, jsonb_build_object('rumus', p_rumus, 'grup', p_grup));
end $$;
update perusahaan set rumus_hpp = coalesce(rumus_hpp, '{}') || jsonb_build_object('label_titipan', 'Tagihan snack & cheesecake') where id is not null and not (coalesce(rumus_hpp, '{}') ? 'label_titipan');

-- (3) Catatan Harian per metode bayar (konsisten dengan Laporan Penjualan & mutasi BNI) + jumlah transaksi janggal
create or replace function public.rekap_harian(p_outlet uuid, p_periode date, p_mode mode_data default 'asli'::mode_data)
returns jsonb language sql stable set search_path to 'public' as $function$
  with trx as (
    select t.id, t.kanal::text kanal, t.subtotal, t.diskon, public.tgl_op(t.created_at) tgl
      from transaksi t
     where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas'
       and t.created_at >= public.awal_op(date_trunc('month', p_periode)::date)
       and t.created_at < public.awal_op((date_trunc('month', p_periode) + interval '1 month')::date)
  ),
  bayar as (
    select t.id, p.metode::text metode, p.nominal, sum(p.nominal) over (partition by t.id) total_bayar
      from trx t join pembayaran p on p.transaksi_id = t.id
  ),
  kolom as (
    -- porsi subtotal per pembayaran; transaksi tanpa pembayaran mengikuti kanal
    select t.id, t.tgl,
           case when b.metode in ('gofood','grabfood','shopeefood','tiktok','ruma_app') then b.metode
                when t.kanal = 'tumbler' then 'tumbler'
                when b.metode = 'tunai' then 'tunai'
                when b.metode is not null then 'non_tunai'
                when t.kanal = 'langsung' then 'tunai'
                else t.kanal end kol,
           case when b.metode is null or b.total_bayar = 0 then t.subtotal else round(t.subtotal * b.nominal::numeric / b.total_bayar) end nilai,
           case when b.metode is null then false
                when t.kanal = 'langsung' then b.metode in ('gofood','grabfood','shopeefood','tiktok','ruma_app')
                when t.kanal in ('gofood','grabfood','shopeefood','tiktok','ruma_app') then b.metode <> t.kanal
                else false end janggal
      from trx t left join bayar b on b.id = t.id
  ),
  per_trx as (select tgl, id, bool_or(janggal) janggal from kolom group by tgl, id),
  shift as (
    select coalesce(tanggal_shift, public.tgl_op(dibuka_at)) tgl, sum(setoran) setoran, sum(seharusnya) seharusnya, sum(selisih) selisih, count(*) n
      from sesi_kas where outlet_id = p_outlet and mode = p_mode and ditutup_at is not null
       and coalesce(tanggal_shift, public.tgl_op(dibuka_at)) >= date_trunc('month', p_periode)::date
       and coalesce(tanggal_shift, public.tgl_op(dibuka_at)) < (date_trunc('month', p_periode) + interval '1 month')::date
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'tanggal', d.tgl, 'transaksi', coalesce(n.n, 0), 'janggal', coalesce(n.janggal, 0),
      'tunai', coalesce(j.tunai, 0), 'non_tunai', coalesce(j.non_tunai, 0), 'gofood', coalesce(j.gofood, 0), 'grabfood', coalesce(j.grabfood, 0),
      'shopeefood', coalesce(j.shopeefood, 0), 'tiktok', coalesce(j.tiktok, 0), 'ruma_app', coalesce(j.ruma_app, 0), 'tumbler', coalesce(j.tumbler, 0),
      'diskon', coalesce(n.diskon, 0), 'setoran', s.setoran, 'seharusnya', s.seharusnya, 'selisih', s.selisih, 'shift', coalesce(s.n, 0)) order by d.tgl), '[]')
  from (select g::date tgl from generate_series(date_trunc('month', p_periode), date_trunc('month', p_periode) + interval '1 month - 1 day', interval '1 day') g) d
  left join (
    select tgl, sum(nilai) filter (where kol = 'tunai') tunai, sum(nilai) filter (where kol = 'non_tunai') non_tunai,
           sum(nilai) filter (where kol = 'gofood') gofood, sum(nilai) filter (where kol = 'grabfood') grabfood,
           sum(nilai) filter (where kol = 'shopeefood') shopeefood, sum(nilai) filter (where kol = 'tiktok') tiktok,
           sum(nilai) filter (where kol = 'ruma_app') ruma_app, sum(nilai) filter (where kol = 'tumbler') tumbler
      from kolom group by tgl
  ) j on j.tgl = d.tgl
  left join (
    select x.tgl, count(*) n, count(*) filter (where p.janggal) janggal, sum(x.diskon) diskon
      from trx x join per_trx p on p.id = x.id group by x.tgl
  ) n on n.tgl = d.tgl
  left join shift s on s.tgl = d.tgl
  where d.tgl <= public.tgl_op(now())
$function$;

-- rincian satu tanggal: transaksi + kolom catatan harian + tanda janggal (untuk panel "asal uang")
create or replace function public.rincian_harian(p_outlet uuid, p_tanggal date, p_mode mode_data default 'asli'::mode_data)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when not boleh_outlet(p_outlet) then '[]'::jsonb else coalesce((
    select jsonb_agg(x order by x->>'waktu') from (
      select jsonb_build_object('id', t.id, 'nomor', t.nomor, 'waktu', t.created_at, 'kanal', t.kanal, 'subtotal', t.subtotal, 'diskon', t.diskon, 'total', t.total,
        'kasir', coalesce(sk.nama_kasir, '-'),
        'bayar', (select coalesce(jsonb_agg(jsonb_build_object('metode', p.metode, 'nominal', p.nominal)), '[]') from pembayaran p where p.transaksi_id = t.id),
        'items', (select string_agg(m.nama || ' x' || i.qty, ', ') from item_transaksi i join menu m on m.id = i.menu_id where i.transaksi_id = t.id)) x
      from transaksi t left join sesi_kas sk on sk.id = t.sesi_kas_id
      where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas'
        and t.created_at >= public.awal_op(p_tanggal) and t.created_at < public.awal_op(p_tanggal + 1)) q), '[]') end
$$;
revoke all on function public.rincian_harian(uuid, date, mode_data) from public, anon;
grant execute on function public.rincian_harian(uuid, date, mode_data) to authenticated;

-- (4) riwayat perbaikan admin pada catatan harian (koreksi transaksi, pengeluaran, input manual, revisi kas)
create or replace function public.riwayat_perbaikan_harian(p_outlet uuid, p_awal date, p_akhir date)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when not boleh_outlet(p_outlet) then '[]'::jsonb else coalesce((select jsonb_agg(r order by r->>'waktu' desc) from (
    -- koreksi / hapus / pulihkan / void transaksi
    select jsonb_build_object('waktu', l.waktu, 'siapa', coalesce(g.nama, 'Sistem'), 'jenis', l.aksi, 'tanggal', public.tgl_op(t.created_at),
      'judul', 'Transaksi #' || t.nomor, 'lama', l.nilai_lama, 'baru', l.nilai_baru) r
      from log_aktivitas l join transaksi t on l.entitas = 'transaksi' and t.id::text = l.entitas_id
      left join pengguna g on g.id = l.pengguna_id
     where t.outlet_id = p_outlet and l.aksi in ('koreksi_transaksi','hapus_transaksi','pulihkan_transaksi','void_pos','koreksi_data_akunting')
       and public.tgl_op(t.created_at) between p_awal and p_akhir
    union all
    -- pengeluaran (ubah/hapus, termasuk kas final)
    select jsonb_build_object('waktu', l.waktu, 'siapa', coalesce(g.nama, 'Sistem'), 'jenis', l.aksi, 'tanggal', coalesce(l.nilai_baru->>'tanggal', l.nilai_lama->>'tanggal'),
      'judul', 'Pengeluaran ' || coalesce(l.nilai_baru->>'keterangan', l.nilai_lama->>'keterangan', ''), 'lama', l.nilai_lama, 'baru', l.nilai_baru)
      from log_aktivitas l left join pengguna g on g.id = l.pengguna_id
     where l.entitas = 'biaya_outlet' and l.aksi in ('update','koreksi_biaya_final','hapus_biaya_final')
       and coalesce(l.nilai_baru->>'outlet_id', l.nilai_lama->>'outlet_id') = p_outlet::text
       and not (l.aksi = 'update' and exists (select 1 from log_aktivitas l2 where l2.entitas_id = l.entitas_id and l2.aksi in ('koreksi_biaya_final','hapus_biaya_final') and l2.waktu = l.waktu))
       and coalesce(l.nilai_baru->>'tanggal', l.nilai_lama->>'tanggal')::date between p_awal and p_akhir
    union all
    -- input manual & koreksi angka harian
    select jsonb_build_object('waktu', coalesce(m.deleted_at, m.updated_at, m.created_at), 'siapa', coalesce(m.nama_pembuat, '-'),
      'jenis', case when m.deleted_at is not null then 'hapus_manual' when m.jenis = 'platform' then 'input_platform' else 'koreksi_manual' end,
      'tanggal', m.tanggal, 'judul', m.kanal || ' ' || to_char(m.jumlah, 'FM999G999G999'), 'lama', null,
      'baru', jsonb_build_object('kanal', m.kanal, 'jumlah', m.jumlah, 'keterangan', m.keterangan))
      from penjualan_manual m
     where m.outlet_id = p_outlet and m.mode = 'asli' and m.tanggal between p_awal and p_akhir
  ) q), '[]') end
$$;
revoke all on function public.riwayat_perbaikan_harian(uuid, date, date) from public, anon;
grant execute on function public.riwayat_perbaikan_harian(uuid, date, date) to authenticated;

-- (5) data 4 Nov Kominot: #27 tercatat GrabFood padahal Normal (QRIS), #30 tercatat Normal padahal GrabFood
do $$
declare t transaksi; o uuid := (select id from outlet where nama = 'Ruma Kopi Kominot' and mode = 'asli' limit 1); k text;
begin
  for t in select * from transaksi where outlet_id = o and mode = 'asli' and status = 'lunas' and public.tgl_op(created_at) = '2026-11-04' and nomor in (27, 30) for update loop
    k := case when t.nomor = 27 and t.kanal = 'grabfood' then 'langsung' when t.nomor = 30 and t.kanal = 'langsung' then 'grabfood' end;
    if k is not null then
      update transaksi set kanal = k::kanal_jual where id = t.id;
      insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
      values (null, 'koreksi_data_akunting', 'transaksi', t.id::text, jsonb_build_object('kanal', t.kanal),
        jsonb_build_object('kanal', k, 'alasan', 'Kanal tertukar saat input kasir (#27 Normal QRIS, #30 GrabFood) — disesuaikan dengan mutasi BNI & dashboard Grab, 4 Nov 2026'));
    end if;
  end loop;
end $$;

-- (6) titipan: edit & hapus catatan pergerakan
create or replace function matur_internal.boleh_kelola_titipan(p_outlet uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select gudang_pusat() or punya_peran('{finance}') or peran_di_outlet(p_outlet, '{kasir,spv}') or (punya_peran('{hrd}') and boleh_outlet(p_outlet));
$$;

create or replace function public.ubah_titipan_masuk(p_id uuid, p_qty integer, p_tanggal date, p_jenis text, p_catatan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r titipan_masuk; j text := coalesce(nullif(trim(p_jenis), ''), 'masuk'); c text := nullif(left(trim(coalesce(p_catatan, '')), 200), ''); sisa numeric; jual numeric;
begin
  select * into r from titipan_masuk where id = p_id for update;
  if r.id is null then raise exception 'Catatan titipan tidak ditemukan'; end if;
  if not matur_internal.boleh_kelola_titipan(r.outlet_id) then raise exception 'Anda tidak punya akses mengelola titipan di outlet ini'; end if;
  if j not in ('masuk', 'retur', 'rusak', 'koreksi') then raise exception 'Jenis pencatatan tidak valid'; end if;
  if coalesce(p_qty, 0) = 0 then raise exception 'Jumlah tidak boleh 0'; end if;
  if p_tanggal is null or p_tanggal > (now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal tidak valid'; end if;
  if j in ('retur', 'rusak') and p_qty > 0 then p_qty := -p_qty; end if;
  if j = 'masuk' and p_qty < 0 then j := 'koreksi'; end if;
  if (p_qty < 0 or j <> 'masuk') and length(coalesce(c, '')) < 3 then raise exception 'Catatan wajib untuk retur/rusak/koreksi (min. 3 huruf)'; end if;
  perform pg_advisory_xact_lock(hashtext('titipan:' || r.outlet_id || ':' || r.menu_id));
  if p_qty < 0 and p_qty < r.qty then
    select coalesce(sum(qty), 0) into sisa from titipan_masuk where outlet_id = r.outlet_id and menu_id = r.menu_id and id <> r.id;
    select coalesce(sum(i.qty), 0) into jual from item_transaksi i join transaksi t on t.id = i.transaksi_id
      where t.outlet_id = r.outlet_id and t.mode = 'asli' and t.status = 'lunas' and i.menu_id = r.menu_id;
    select jual + coalesce(sum((x->>'qty')::numeric), 0) into jual from produk_keluar pk cross join jsonb_array_elements(pk.items) x
      where pk.outlet_id = r.outlet_id and pk.deleted_at is null and x->>'menu_id' = r.menu_id::text;
    if -p_qty > greatest(sisa - jual, 0) then raise exception 'Retur/rusak melebihi sisa titipan'; end if;
  end if;
  update titipan_masuk set qty = p_qty, tanggal = p_tanggal, jenis = j, catatan = c where id = r.id;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (auth.uid(), 'ubah_titipan', 'titipan_masuk', r.id::text, to_jsonb(r), jsonb_build_object('qty', p_qty, 'tanggal', p_tanggal, 'jenis', j, 'catatan', c));
  return jsonb_build_object('ok', 'Catatan titipan diperbarui.');
end $$;

create or replace function public.hapus_titipan_masuk(p_id uuid, p_alasan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r titipan_masuk;
begin
  select * into r from titipan_masuk where id = p_id for update;
  if r.id is null then raise exception 'Catatan titipan tidak ditemukan'; end if;
  if not matur_internal.boleh_kelola_titipan(r.outlet_id) then raise exception 'Anda tidak punya akses mengelola titipan di outlet ini'; end if;
  delete from titipan_masuk where id = r.id;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (auth.uid(), 'hapus_titipan', 'titipan_masuk', r.id::text, to_jsonb(r), jsonb_build_object('alasan', nullif(left(trim(coalesce(p_alasan, '')), 200), '')));
  return jsonb_build_object('ok', 'Catatan titipan dihapus.');
end $$;

revoke all on function matur_internal.boleh_kelola_titipan(uuid) from public, anon;
grant execute on function matur_internal.boleh_kelola_titipan(uuid) to authenticated;
revoke all on function public.ubah_titipan_masuk(uuid, integer, date, text, text) from public, anon;
grant execute on function public.ubah_titipan_masuk(uuid, integer, date, text, text) to authenticated;
revoke all on function public.hapus_titipan_masuk(uuid, text) from public, anon;
grant execute on function public.hapus_titipan_masuk(uuid, text) to authenticated;
