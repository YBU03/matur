-- Laporan keuangan bulanan outlet (format resmi CV. Hazna Berkah Indonesia).
-- Angka disimpan persis seperti laporan yang diterbitkan; bagi hasil & transfer disimpan sebagai
-- salinan per bulan agar laporan lama tidak berubah bila perjanjian berganti.
create table laporan_bulanan (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  outlet_id uuid not null references outlet,
  periode date not null check (extract(day from periode) = 1),   -- tanggal 1 bulan laporan
  nama_outlet text not null,                                     -- nama di kop laporan, mis. "Ruma Kopiaksa"
  mitra text,
  pj_laporan text,
  karyawan text[] not null default '{}',
  modal_awal bigint not null default 0,
  persediaan_awal bigint not null default 0,
  pembelian bigint not null default 0,
  persediaan_akhir bigint not null default 0,
  pendapatan jsonb not null default '[]',   -- [{nama, jumlah}]
  diskon bigint not null default 0,
  persen_sedekah numeric not null default 2.5,
  sedekah bigint not null default 0,         -- 2,5% dari laba kotor, disalurkan Kelola Pusat
  beban jsonb not null default '[]',         -- [{nama, jumlah}] tanpa sedekah
  bagi_hasil jsonb not null default '[]',    -- [{nama, persen, jumlah}] termasuk pengelola
  transfer jsonb not null default '[]',      -- [{keterangan, jumlah, bank, no_rekening, atas_nama}]
  tgl_terbit date,
  kota_terbit text default 'Purbalingga',
  penandatangan text,
  jabatan_penandatangan text,
  catatan text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (outlet_id, periode, mode)
);
alter table laporan_bulanan enable row level security;
-- baca: pusat (owner/admin/finance/manajer area sesuai outlet) dan mitra outlet tersebut saja
create policy baca on laporan_bulanan for select to authenticated using (
  punya_peran('{owner,admin_pusat,finance}') or peran_di_outlet(outlet_id, '{mitra}')
  or (punya_peran('{manajer_area}') and boleh_outlet(outlet_id))
);
create policy kelola on laporan_bulanan for all to authenticated
  using (punya_peran('{owner,admin_pusat,finance}')) with check (punya_peran('{owner,admin_pusat,finance}'));
create trigger log_laporan_bulanan after insert or update or delete on laporan_bulanan for each row execute function catat_log();

-- laba bersih resmi sesuai laporan terbit (Excel asli menyimpan desimal, selisih pembulatan ±Rp1)
alter table laporan_bulanan add column laba_bersih bigint;
