-- Catatan harian ala sheet "Transaksi" Ruma: pengeluaran dicatat kasir/barista saat shift (dari laci atau dibayar pusat),
-- tutup shift dengan cocok kas (tunai − pengeluaran laci vs uang aktual), penutupan bulan (cocok ojol), dan opname outlet.

-- kategori: grup hpp (masuk "Pembelian bahan baku"), beban (beban operasional), lain (tidak masuk laporan, mis. reimburse)
alter table kategori_biaya add column grup text not null default 'beban' check (grup in ('hpp','beban','lain'));
alter table kategori_biaya add column harian boolean not null default false;   -- tampil di aplikasi kasir
update kategori_biaya set nama = 'Biaya Internet/Wifi' where nama = 'Biaya Internet';
update kategori_biaya set nama = 'Biaya Air/PDAM' where nama = 'Biaya Air';
update kategori_biaya set nama = 'Biaya lain lain' where nama = 'Biaya Lain Lain';
insert into kategori_biaya (nama, urutan, grup, harian) values
  ('Es Kristal', 101, 'hpp', true), ('Bahan Baku', 102, 'hpp', true), ('Biaya Galon', 103, 'hpp', true), ('Reimburse', 201, 'lain', true);
update kategori_biaya set harian = true where nama in ('Biaya Marketing','Biaya Maintenance','Biaya Distribusi','Biaya Listrik','Biaya Air/PDAM',
  'Biaya Perlengkapan','Biaya Pemeliharaan Lingkungan','Biaya lain lain');

alter table biaya_outlet add column sumber text not null default 'laci' check (sumber in ('laci','pusat'));
alter table biaya_outlet add column sesi_kas_id uuid references sesi_kas;

-- kasir/barista/SPV mencatat pengeluaran outlet sendiri; ubah/hapus catatan sendiri dalam 2 hari
create policy catat_kasir on biaya_outlet for insert to authenticated
  with check (peran_di_outlet(outlet_id, '{kasir,barista,spv}') and dibuat_oleh = auth.uid());
create policy ubah_kasir on biaya_outlet for update to authenticated
  using (dibuat_oleh = auth.uid() and created_at > now() - interval '2 days')
  with check (dibuat_oleh = auth.uid() and peran_di_outlet(outlet_id, '{kasir,barista,spv}'));

-- pengeluaran dari laci otomatis menempel ke shift yang sedang buka di outlet itu
create or replace function tempel_sesi_biaya() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sumber = 'laci' and new.sesi_kas_id is null and new.tanggal = (now() at time zone 'Asia/Jakarta')::date then
    select id into new.sesi_kas_id from sesi_kas
     where outlet_id = new.outlet_id and mode = new.mode and ditutup_at is null
     order by (kasir_id = auth.uid()) desc, dibuka_at desc limit 1;
  end if;
  if new.sumber = 'pusat' then new.sesi_kas_id := null; end if;
  return new;
end $$;
create trigger tempel_sesi_biaya before insert or update of sumber on biaya_outlet for each row execute function tempel_sesi_biaya();

-- tutup shift: seharusnya = penjualan tunai − pengeluaran dari laci (di luar modal laci), selisih = aktual − seharusnya
create or replace function tutup_sesi_kas(p_sesi uuid, p_aktual bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k sesi_kas; tunai bigint; laci bigint;
begin
  select * into k from sesi_kas where id = p_sesi for update;
  if k.id is null or k.ditutup_at is not null then raise exception 'Shift tidak ditemukan atau sudah ditutup'; end if;
  if not (k.kasir_id = auth.uid() or peran_di_outlet(k.outlet_id, '{spv}') or punya_peran('{owner,admin_pusat}')) then raise exception 'Tidak diizinkan'; end if;
  select coalesce(sum(p.nominal), 0) into tunai from pembayaran p join transaksi t on t.id = p.transaksi_id
   where t.sesi_kas_id = p_sesi and t.status = 'lunas' and p.metode = 'tunai';
  select coalesce(sum(jumlah), 0) into laci from biaya_outlet where sesi_kas_id = p_sesi and sumber = 'laci' and deleted_at is null;
  update sesi_kas set ditutup_at = now(), seharusnya = tunai - laci, setoran = greatest(p_aktual, 0), selisih = greatest(p_aktual, 0) - (tunai - laci)
   where id = p_sesi;
  return jsonb_build_object('tunai', tunai, 'laci', laci, 'seharusnya', tunai - laci, 'aktual', p_aktual, 'selisih', p_aktual - (tunai - laci));
end $$;
revoke execute on function tutup_sesi_kas(uuid, bigint) from public, anon;
grant execute on function tutup_sesi_kas(uuid, bigint) to authenticated;

-- penutupan bulan oleh Finance: angka asli dari aplikasi ojol, koreksi pendapatan lain-lain, persediaan akhir
create table penutupan_bulan (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  outlet_id uuid not null references outlet,
  periode date not null check (extract(day from periode) = 1),
  ojol jsonb not null default '{}',          -- {gofood, grabfood, shopeefood}: total menurut laporan aplikasi
  koreksi_lain bigint,                       -- kosong = mengikuti format Ruma (discount dikembalikan)
  persediaan_akhir bigint,
  catatan text,
  updated_at timestamptz not null default now(),
  unique (outlet_id, periode, mode)
);
alter table penutupan_bulan enable row level security;
create policy baca on penutupan_bulan for select to authenticated using (punya_peran('{owner,admin_pusat,finance}'));
create policy kelola on penutupan_bulan for all to authenticated using (punya_peran('{owner,admin_pusat,finance}')) with check (punya_peran('{owner,admin_pusat,finance}'));

-- opname outlet: hitung fisik → stok outlet disesuaikan, nilai persediaan tersimpan
create table opname (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  outlet_id uuid not null references outlet,
  tanggal date not null default current_date,
  total_nilai bigint not null default 0,
  catatan text,
  dibuat_oleh uuid references pengguna default auth.uid(),
  created_at timestamptz not null default now()
);
create table item_opname (
  id uuid primary key default gen_random_uuid(),
  opname_id uuid not null references opname on delete cascade,
  bahan_id uuid not null references bahan,
  qty_sistem numeric not null,
  qty_fisik numeric not null,
  harga_unit numeric not null,          -- per satuan pakai
  nilai bigint not null
);
alter table opname enable row level security;
alter table item_opname enable row level security;
create policy baca on opname for select to authenticated using (punya_peran('{owner,admin_pusat,admin_gudang,finance}') or boleh_outlet(outlet_id));
create policy baca on item_opname for select to authenticated using (exists (select 1 from opname o where o.id = opname_id));

-- p_items: [{bahan_id, qty_fisik}] dalam satuan pakai
create or replace function simpan_opname(p_outlet uuid, p_tanggal date, p_items jsonb, p_catatan text) returns uuid
language plpgsql security definer set search_path = public as $$
declare oid uuid; x jsonb; b bahan; sist numeric; fis numeric; hu numeric; tot numeric := 0;
begin
  if not (gudang_pusat() or peran_di_outlet(p_outlet, '{spv}')) then raise exception 'Hanya SPV outlet atau Gudang Pusat'; end if;
  insert into opname (outlet_id, tanggal, catatan) values (p_outlet, coalesce(p_tanggal, current_date), left(p_catatan, 300)) returning id into oid;
  for x in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    select * into b from bahan where id = (x->>'bahan_id')::uuid;
    if b.id is null then continue; end if;
    fis := greatest(coalesce((x->>'qty_fisik')::numeric, 0), 0);
    select coalesce(jumlah, 0) into sist from stok where mode = 'asli' and outlet_id = p_outlet and bahan_id = b.id;
    sist := coalesce(sist, 0);
    hu := coalesce(nullif(b.harga_jual_gudang, 0), b.harga_beli, 0) / nullif(b.konversi, 0);
    insert into item_opname (opname_id, bahan_id, qty_sistem, qty_fisik, harga_unit, nilai) values (oid, b.id, sist, fis, coalesce(hu, 0), round(fis * coalesce(hu, 0)));
    if fis <> sist then perform geser_stok('asli', p_outlet, b.id, fis - sist, 'opname', oid, 'Opname ' || coalesce(p_tanggal, current_date)); end if;
    tot := tot + round(fis * coalesce(hu, 0));
  end loop;
  update opname set total_nilai = tot where id = oid;
  return oid;
end $$;
revoke execute on function simpan_opname(uuid, date, jsonb, text) from public, anon;
grant execute on function simpan_opname(uuid, date, jsonb, text) to authenticated;

-- rekening penerima sewa (dikembalikan ke mitra setiap bulan)
update perjanjian set bank = 'BCA', no_rekening = '0970886583', atas_nama = 'Dwi Suyoko'
 where outlet_id = 'de5b97c8-31fc-4daf-9478-a19e675503e1' and mode = 'asli' and no_rekening is null;
