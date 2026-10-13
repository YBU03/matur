-- Akunting otomatis: biaya operasional harian per outlet + proyeksi laporan bulanan dari POS, kiriman gudang, dan biaya.
create table biaya_outlet (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  outlet_id uuid not null references outlet,
  tanggal date not null default current_date,
  kategori_id uuid not null references kategori_biaya,
  jumlah bigint not null check (jumlah > 0),
  keterangan text,
  dibuat_oleh uuid references pengguna default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table biaya_outlet enable row level security;
create policy baca on biaya_outlet for select to authenticated using (punya_peran('{owner,admin_pusat,finance}') or boleh_outlet(outlet_id));
create policy kelola_pusat on biaya_outlet for all to authenticated using (punya_peran('{owner,admin_pusat,finance}')) with check (punya_peran('{owner,admin_pusat,finance}'));
create policy kelola_spv on biaya_outlet for all to authenticated using (peran_di_outlet(outlet_id, '{spv}')) with check (peran_di_outlet(outlet_id, '{spv}'));
create trigger log_biaya_outlet after insert or update or delete on biaya_outlet for each row execute function catat_log();

-- Proyeksi angka laporan bulan p_periode (tanggal 1) untuk satu outlet. Mengikuti hak baca pemanggil (RLS).
create or replace function proyeksi_laporan(p_outlet uuid, p_periode date, p_mode mode_data default 'asli') returns jsonb
language plpgsql stable set search_path = public as $$
declare
  a timestamptz := (date_trunc('month', p_periode)::timestamp at time zone 'Asia/Jakarta');
  b timestamptz := ((date_trunc('month', p_periode) + interval '1 month')::timestamp at time zone 'Asia/Jakarta');
  hasil jsonb;
begin
  with trx as (
    select t.id, t.kanal, t.subtotal, t.diskon, t.total, (t.created_at at time zone 'Asia/Jakarta')::date tgl
      from transaksi t
     where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas' and t.created_at >= a and t.created_at < b
  ),
  bayar as (  -- porsi tunai per transaksi langsung
    select t.id, coalesce(sum(p.nominal) filter (where p.metode = 'tunai'), 0)::numeric tunai, coalesce(sum(p.nominal), 0)::numeric semua
      from trx t left join pembayaran p on p.transaksi_id = t.id
     where t.kanal = 'langsung' group by t.id
  ),
  baris as (
    select case when t.kanal = 'langsung' then 'tunai' else t.kanal::text end k,
           case when t.kanal = 'langsung' then round(t.subtotal * case when x.semua > 0 then x.tunai / x.semua else 1 end) else t.subtotal end v
      from trx t left join bayar x on x.id = t.id
    union all
    select 'non_tunai', t.subtotal - round(t.subtotal * case when x.semua > 0 then x.tunai / x.semua else 1 end)
      from trx t join bayar x on x.id = t.id
  ),
  harian_trx as (select tgl, sum(subtotal) jual, sum(diskon) diskon, count(*) n from trx group by tgl),
  kir as (
    select (k.diterima_at at time zone 'Asia/Jakarta')::date tgl, k.total
      from kiriman k where k.outlet_id = p_outlet and k.mode = p_mode and k.status = 'diterima' and k.diterima_at >= a and k.diterima_at < b
  ),
  bia as (
    select bo.tanggal tgl, kb.nama, kb.urutan, bo.jumlah
      from biaya_outlet bo join kategori_biaya kb on kb.id = bo.kategori_id
     where bo.outlet_id = p_outlet and bo.mode = p_mode and bo.deleted_at is null
       and bo.tanggal >= date_trunc('month', p_periode)::date and bo.tanggal < (date_trunc('month', p_periode) + interval '1 month')::date
  ),
  nilai as (  -- nilai persediaan outlet pada akhir periode (stok sekarang dikurangi mutasi sesudah periode)
    select coalesce(sum(greatest(coalesce(s.jumlah, 0) - coalesce((select sum(m.jumlah) from mutasi_stok m
             where m.mode = p_mode and m.outlet_id = p_outlet and m.bahan_id = bh.id and m.created_at >= b), 0), 0)
           * coalesce(nullif(bh.harga_jual_gudang, 0), bh.harga_beli, 0) / nullif(bh.konversi, 0)), 0) v
      from bahan bh left join stok s on s.bahan_id = bh.id and s.outlet_id = p_outlet and s.mode = p_mode
     where bh.mode = p_mode and bh.deleted_at is null
  )
  select jsonb_build_object(
    'jumlah_transaksi', (select count(*) from trx),
    'pendapatan', (select coalesce(jsonb_object_agg(k, v), '{}') from (select k, sum(v) v from baris group by k) z),
    'diskon', (select coalesce(sum(diskon), 0) from trx),
    'pembelian', (select coalesce(sum(total), 0) from kir),
    'jumlah_kiriman', (select count(*) from kir),
    'persediaan_akhir_sistem', (select round(v) from nilai),
    'beban', (select coalesce(jsonb_agg(jsonb_build_object('nama', nama, 'jumlah', j) order by u), '[]') from (select nama, min(urutan) u, sum(jumlah) j from bia group by nama) z),
    'harian', (select coalesce(jsonb_agg(jsonb_build_object('tanggal', d, 'penjualan', coalesce(h.jual, 0), 'diskon', coalesce(h.diskon, 0), 'transaksi', coalesce(h.n, 0),
                 'pembelian', (select coalesce(sum(total), 0) from kir where kir.tgl = d), 'biaya', (select coalesce(sum(jumlah), 0) from bia where bia.tgl = d)) order by d), '[]')
               from generate_series(date_trunc('month', p_periode)::date, (date_trunc('month', p_periode) + interval '1 month - 1 day')::date, interval '1 day') g(d)
               left join harian_trx h on h.tgl = g.d::date
              where g.d::date <= current_date)
  ) into hasil;
  return hasil;
end $$;
revoke execute on function proyeksi_laporan(uuid, date, mode_data) from public, anon;
grant execute on function proyeksi_laporan(uuid, date, mode_data) to authenticated;
