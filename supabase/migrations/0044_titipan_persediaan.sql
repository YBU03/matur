-- Produk titipan (konsinyasi) mis. cheesecake & dessert dari Bu Ratna + persediaan/HPP bulanan bersama.
-- HPP = persediaan awal + pembelian bahan baku + tagihan dessert & cheesecake (titipan TERJUAL × harga produsen) − persediaan akhir.
-- Definisi lengkap rekap_titipan(), persediaan_bulanan() & patch buat_transaksi diterapkan lewat MCP (0044, 0044b).
alter table menu add column if not exists titipan boolean not null default false,
  add column if not exists produsen text,
  add column if not exists harga_titip bigint not null default 0;

create table if not exists titipan_masuk (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlet,
  menu_id uuid not null references menu,
  tanggal date not null default current_date,
  qty int not null check (qty <> 0),           -- negatif = retur / koreksi
  catatan text,
  dibuat_oleh uuid default auth.uid() references pengguna,
  nama_pembuat text,
  created_at timestamptz not null default now()
);
alter table titipan_masuk enable row level security;
create policy baca on titipan_masuk for select using (boleh_outlet(outlet_id));
create policy catat on titipan_masuk for insert with check (gudang_pusat() or punya_peran('{finance}') or peran_di_outlet(outlet_id, '{kasir,spv}'));
create trigger log_titipan_masuk after insert or update or delete on titipan_masuk for each row execute function catat_log_sdm();

alter table laporan_bulanan add column if not exists tagihan_titipan bigint not null default 0;
-- rekap_titipan(outlet, periode): per menu titipan → masuk, terjual (POS lunas), sisa, harga, tagihan
-- persediaan_bulanan(outlet, periode): awal (laporan/penutupan/opname bulan lalu), pembelian (kiriman + biaya grup HPP),
--   tagihan titipan, akhir (penutupan → opname → stok sistem), hpp. Akses: owner, admin pusat, finance, admin gudang, HRD, manajer area, SPV outlet.
-- buat_transaksi: menu titipan → hpp item = harga_titip.
