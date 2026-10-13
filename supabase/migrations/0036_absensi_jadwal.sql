-- Tahap 5 · SDM outlet: shift kerja, jadwal (draft → terbit), absensi selfie + GPS,
-- izin & libur mingguan, tukar shift. Konsep diambil dari Makaryo, disesuaikan untuk
-- banyak outlet: HRD (dan Owner) mengelola semua outlet, SPV mengelola outletnya sendiri.
-- Shift kerja (kehadiran orang) sengaja terpisah dari sesi_kas (uang di laci).
-- Semua timestamp timestamptz UTC; tanggal kerja & jam shift dalam WIB.

-- ---------- Pengaturan ----------
alter table perusahaan
  add column toleransi_telat_menit int not null default 5,
  add column jatah_libur_default int not null default 1,     -- hari libur per minggu
  add column izin_min_hari int not null default 3,           -- izin mendadak minimal H-3
  add column libur_mingguan_dibuka boolean not null default false;

alter table pengguna add column jatah_libur int check (jatah_libur between 0 and 6);  -- null = default perusahaan

-- pengelola SDM sebuah outlet: Owner & HRD semua outlet, SPV outletnya sendiri
create or replace function kelola_sdm(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select punya_peran('{owner,hrd}') or peran_di_outlet(o, '{spv}')
$$;
revoke execute on function kelola_sdm(uuid) from public, anon;
grant execute on function kelola_sdm(uuid) to authenticated;

-- log untuk tabel tanpa kolom deleted_at (catat_log membaca deleted_at)
create or replace function catat_log_sdm() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into log_aktivitas (pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (auth.uid(),
    case tg_op when 'INSERT' then 'create' when 'DELETE' then 'purge' else 'update' end,
    tg_table_name, coalesce(new.id, old.id)::text,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- ---------- Shift kerja per outlet ----------
create table shift_outlet (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlet,
  nama text not null,
  jam_mulai time not null,
  jam_selesai time not null,                 -- <= jam_mulai berarti selesai keesokan hari
  min_orang int not null default 1 check (min_orang between 0 and 50),
  urutan int not null default 0,
  aktif boolean not null default true,       -- dinonaktifkan, tidak pernah dihapus
  created_at timestamptz not null default now()
);
create index on shift_outlet (outlet_id);

-- ---------- Jadwal ----------
create table jadwal_shift (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlet,
  shift_id uuid not null references shift_outlet,
  pengguna_id uuid not null references pengguna on delete cascade,
  tanggal date not null,
  status text not null default 'draft' check (status in ('draft','terbit')),
  dibuat_oleh uuid references pengguna,
  created_at timestamptz not null default now(),
  unique (shift_id, pengguna_id, tanggal)
);
create index on jadwal_shift (outlet_id, tanggal);
create index on jadwal_shift (pengguna_id, tanggal);

-- ---------- Absensi ----------
create table absensi (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlet,
  pengguna_id uuid not null references pengguna on delete cascade,
  jadwal_id uuid references jadwal_shift on delete set null,
  tanggal date not null,                     -- tanggal kerja WIB
  masuk_at timestamptz not null default now(),
  masuk_foto text,
  masuk_lat double precision, masuk_lng double precision, masuk_akurasi real,
  status text not null check (status in ('tepat','telat','tanpa_jadwal')),
  telat_menit int not null default 0,
  pulang_at timestamptz,
  pulang_foto text,
  pulang_lat double precision, pulang_lng double precision, pulang_akurasi real,
  perangkat text check (perangkat in ('hp','outlet')),
  catatan text,
  created_at timestamptz not null default now()
);
create index on absensi (outlet_id, tanggal);
create index on absensi (pengguna_id, tanggal);
create unique index absensi_jadwal_unik on absensi (jadwal_id) where jadwal_id is not null;

-- ---------- Izin & libur ----------
create table pengajuan_izin (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlet,
  pengguna_id uuid not null references pengguna on delete cascade,
  jenis text not null check (jenis in ('izin','libur','sakit')),
  tanggal date not null,
  alasan text,
  status text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak','dibatalkan')),
  alasan_tolak text,
  diputus_oleh uuid references pengguna,
  diputus_at timestamptz,
  created_at timestamptz not null default now()
);
create index on pengajuan_izin (outlet_id, tanggal);
create unique index izin_aktif_unik on pengajuan_izin (pengguna_id, tanggal) where status in ('menunggu','disetujui');

-- ---------- Tukar shift ----------
create table tukar_shift (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlet,
  pengaju_id uuid not null references pengguna on delete cascade,
  jadwal_pengaju uuid not null references jadwal_shift on delete cascade,
  rekan_id uuid not null references pengguna on delete cascade,
  jadwal_rekan uuid not null references jadwal_shift on delete cascade,
  alasan text,
  status text not null default 'menunggu_rekan'
    check (status in ('menunggu_rekan','menunggu_atasan','disetujui','ditolak','dibatalkan')),
  alasan_tolak text,
  diputus_oleh uuid references pengguna,
  diputus_at timestamptz,
  created_at timestamptz not null default now()
);
create index on tukar_shift (outlet_id, status);

-- ---------- RLS ----------
alter table shift_outlet enable row level security;
alter table jadwal_shift enable row level security;
alter table absensi enable row level security;
alter table pengajuan_izin enable row level security;
alter table tukar_shift enable row level security;

create policy baca on shift_outlet for select to authenticated using (boleh_outlet(outlet_id) or kelola_sdm(outlet_id));
create policy kelola on shift_outlet for all to authenticated using (kelola_sdm(outlet_id)) with check (kelola_sdm(outlet_id));

-- staf hanya melihat jadwal yang sudah terbit
create policy baca on jadwal_shift for select to authenticated
  using (kelola_sdm(outlet_id) or (status = 'terbit' and boleh_outlet(outlet_id)));
create policy kelola on jadwal_shift for all to authenticated using (kelola_sdm(outlet_id)) with check (kelola_sdm(outlet_id));

-- absen masuk/pulang hanya lewat RPC (jam server); pengelola boleh mengoreksi
create policy baca on absensi for select to authenticated using (pengguna_id = auth.uid() or kelola_sdm(outlet_id));
create policy kelola on absensi for all to authenticated using (kelola_sdm(outlet_id)) with check (kelola_sdm(outlet_id));

create policy baca on pengajuan_izin for select to authenticated using (pengguna_id = auth.uid() or kelola_sdm(outlet_id));
create policy baca on tukar_shift for select to authenticated
  using (pengaju_id = auth.uid() or rekan_id = auth.uid() or kelola_sdm(outlet_id));

create trigger log_shift_outlet after insert or update or delete on shift_outlet for each row execute function catat_log_sdm();
create trigger log_jadwal_shift after insert or update or delete on jadwal_shift for each row execute function catat_log_sdm();
create trigger log_absensi after update or delete on absensi for each row execute function catat_log_sdm();
create trigger log_pengajuan_izin after update on pengajuan_izin for each row execute function catat_log_sdm();
create trigger log_tukar_shift after update on tukar_shift for each row execute function catat_log_sdm();

-- ---------- Foto absensi ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('absensi', 'absensi', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
-- path: <pengguna_id>/<tanggal>/<file>
create policy absensi_unggah on storage.objects for insert to authenticated
  with check (bucket_id = 'absensi' and (storage.foldername(name))[1] = auth.uid()::text);
create policy absensi_baca on storage.objects for select to authenticated using (
  bucket_id = 'absensi' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or punya_peran('{owner,hrd}')
    or exists (select 1 from absensi a where (a.masuk_foto = name or a.pulang_foto = name) and kelola_sdm(a.outlet_id))
  )
);

-- ---------- Fungsi ----------
create or replace function hari_wib() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- staf yang bisa dijadwalkan di sebuah outlet (kasir, barista, SPV berstatus aktif)
create or replace function staf_jadwal(p_outlet uuid)
returns table (id uuid, nama text, peran text, jatah_libur int)
language sql stable security definer set search_path = public as $$
  select u.id, u.nama, string_agg(distinct t.peran::text, ',' order by t.peran::text),
         coalesce(u.jatah_libur, (select jatah_libur_default from perusahaan limit 1), 1)
  from penugasan t join pengguna u on u.id = t.pengguna_id and u.status = 'aktif'
  where t.outlet_id = p_outlet and t.peran in ('kasir','barista','spv')
    and (boleh_outlet(p_outlet) or kelola_sdm(p_outlet))
  group by u.id, u.nama, u.jatah_libur
  order by u.nama
$$;

create or replace function atur_jatah_libur(p_uid uuid, p_outlet uuid, p_jatah int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not kelola_sdm(p_outlet) then raise exception 'Tidak diizinkan'; end if;
  if not exists (select 1 from penugasan where pengguna_id = p_uid and outlet_id = p_outlet) then
    raise exception 'Staf tidak bertugas di outlet ini';
  end if;
  if p_jatah is not null and (p_jatah < 0 or p_jatah > 6) then raise exception 'Jatah libur 0-6 hari'; end if;
  update pengguna set jatah_libur = p_jatah where id = p_uid;
end $$;

create or replace function atur_sdm(p_toleransi int, p_jatah int, p_izin_min int, p_libur_dibuka boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not punya_peran('{owner,hrd}') then raise exception 'Hanya Owner/HRD'; end if;
  if p_toleransi not between 0 and 120 or p_jatah not between 0 and 6 or p_izin_min not between 0 and 30 then
    raise exception 'Nilai pengaturan tidak valid';
  end if;
  update perusahaan set toleransi_telat_menit = p_toleransi, jatah_libur_default = p_jatah,
    izin_min_hari = p_izin_min, libur_mingguan_dibuka = p_libur_dibuka
  where id is not null;
end $$;

-- Absen masuk: jam server, dicocokkan ke jadwal terbit hari ini yang jam mulainya paling dekat.
create or replace function absen_masuk(p_outlet uuid, p_foto text, p_lat double precision, p_lng double precision,
  p_akurasi real, p_perangkat text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hari date := hari_wib();
  sekarang timestamp := now() at time zone 'Asia/Jakarta';
  j record; tol int; st text := 'tanpa_jadwal'; tel int := 0; menit numeric; baru uuid;
begin
  if not peran_di_outlet(p_outlet, '{kasir,barista,spv}') then raise exception 'Anda tidak bertugas di outlet ini'; end if;
  if p_foto is null or split_part(p_foto, '/', 1) <> uid::text then raise exception 'Foto selfie wajib'; end if;
  if exists (select 1 from absensi where pengguna_id = uid and pulang_at is null and masuk_at > now() - interval '20 hours') then
    raise exception 'Anda masih tercatat masuk. Absen pulang dulu.';
  end if;
  select js.id, s.jam_mulai, s.nama into j
  from jadwal_shift js join shift_outlet s on s.id = js.shift_id
  where js.pengguna_id = uid and js.outlet_id = p_outlet and js.tanggal = hari and js.status = 'terbit'
    and not exists (select 1 from absensi a where a.jadwal_id = js.id)
  order by abs(extract(epoch from ((hari + s.jam_mulai) - sekarang))) limit 1;
  select coalesce(toleransi_telat_menit, 5) into tol from perusahaan limit 1;
  if j.id is not null then
    menit := extract(epoch from (sekarang - (hari + j.jam_mulai))) / 60;
    if menit > coalesce(tol, 5) then st := 'telat'; tel := ceil(menit)::int; else st := 'tepat'; end if;
  end if;
  insert into absensi (outlet_id, pengguna_id, jadwal_id, tanggal, masuk_foto, masuk_lat, masuk_lng, masuk_akurasi, status, telat_menit, perangkat)
  values (p_outlet, uid, j.id, hari, p_foto, p_lat, p_lng, p_akurasi, st, tel,
          case when p_perangkat in ('hp','outlet') then p_perangkat end)
  returning id into baru;
  return jsonb_build_object('id', baru, 'status', st, 'telat_menit', tel, 'shift', j.nama);
end $$;

create or replace function absen_pulang(p_foto text, p_lat double precision, p_lng double precision, p_akurasi real) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a record;
begin
  if p_foto is null or split_part(p_foto, '/', 1) <> uid::text then raise exception 'Foto selfie wajib'; end if;
  select id, masuk_at into a from absensi
  where pengguna_id = uid and pulang_at is null and masuk_at > now() - interval '20 hours'
  order by masuk_at desc limit 1;
  if a.id is null then raise exception 'Belum ada absen masuk yang terbuka'; end if;
  update absensi set pulang_at = now(), pulang_foto = p_foto, pulang_lat = p_lat, pulang_lng = p_lng, pulang_akurasi = p_akurasi
  where id = a.id;
  return jsonb_build_object('id', a.id, 'menit', round(extract(epoch from (now() - a.masuk_at)) / 60));
end $$;

-- Pengajuan izin/libur. Staf: izin minimal H-n (pengaturan), libur hanya saat dibuka HRD, sakit untuk hari ini/ke depan.
-- Pengelola SDM boleh mencatat untuk staf lain dan langsung disetujui (tanpa batas H-n).
create or replace function ajukan_izin(p_outlet uuid, p_jenis text, p_tanggal date, p_alasan text, p_pengguna uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); siapa uuid := coalesce(p_pengguna, auth.uid()); hari date := hari_wib();
  cfg record; atasan boolean := p_pengguna is not null and p_pengguna <> auth.uid(); baru uuid;
begin
  if p_jenis not in ('izin','libur','sakit') then raise exception 'Jenis tidak valid'; end if;
  select izin_min_hari, libur_mingguan_dibuka into cfg from perusahaan limit 1;
  if atasan then
    if not kelola_sdm(p_outlet) then raise exception 'Tidak diizinkan'; end if;
    if not exists (select 1 from penugasan where pengguna_id = siapa and outlet_id = p_outlet) then
      raise exception 'Staf tidak bertugas di outlet ini';
    end if;
  else
    if not peran_di_outlet(p_outlet, '{kasir,barista,spv}') then raise exception 'Anda tidak bertugas di outlet ini'; end if;
    if p_jenis = 'izin' and p_tanggal < hari + coalesce(cfg.izin_min_hari, 3) then
      raise exception 'Izin wajib diajukan minimal H-% (paling cepat %)', coalesce(cfg.izin_min_hari, 3), to_char(hari + coalesce(cfg.izin_min_hari, 3), 'DD-MM-YYYY');
    end if;
    if p_jenis = 'libur' and not coalesce(cfg.libur_mingguan_dibuka, false) then
      raise exception 'Pengajuan libur mingguan sedang ditutup HRD';
    end if;
    if p_jenis = 'libur' and p_tanggal <= hari then raise exception 'Libur hanya untuk tanggal ke depan'; end if;
    if p_jenis = 'sakit' and p_tanggal < hari then raise exception 'Tanggal sudah lewat'; end if;
    if p_jenis <> 'libur' and coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan wajib diisi'; end if;
  end if;
  if exists (select 1 from pengajuan_izin where pengguna_id = siapa and tanggal = p_tanggal and status in ('menunggu','disetujui')) then
    raise exception 'Sudah ada pengajuan di tanggal itu';
  end if;
  insert into pengajuan_izin (outlet_id, pengguna_id, jenis, tanggal, alasan, status, diputus_oleh, diputus_at)
  values (p_outlet, siapa, p_jenis, p_tanggal, nullif(trim(p_alasan), ''),
          case when atasan then 'disetujui' else 'menunggu' end,
          case when atasan then uid end, case when atasan then now() end)
  returning id into baru;
  if atasan then delete from jadwal_shift where pengguna_id = siapa and tanggal = p_tanggal and outlet_id = p_outlet; end if;
  return baru;
end $$;

-- Setujui/tolak. Disetujui → jadwal orang itu di tanggal tersebut dilepas (slot jadi kurang orang).
create or replace function putus_izin(p_id uuid, p_setuju boolean, p_alasan text) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  select * into r from pengajuan_izin where id = p_id;
  if r.id is null or not kelola_sdm(r.outlet_id) then raise exception 'Tidak diizinkan'; end if;
  if r.status <> 'menunggu' then raise exception 'Pengajuan sudah diputus'; end if;
  if not p_setuju and coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan penolakan wajib diisi'; end if;
  update pengajuan_izin set status = case when p_setuju then 'disetujui' else 'ditolak' end,
    alasan_tolak = case when p_setuju then null else trim(p_alasan) end, diputus_oleh = auth.uid(), diputus_at = now()
  where id = p_id;
  if p_setuju then
    delete from jadwal_shift where pengguna_id = r.pengguna_id and tanggal = r.tanggal and outlet_id = r.outlet_id;
    get diagnostics n = row_count;
  end if;
  return n;
end $$;

create or replace function batal_izin(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update pengajuan_izin set status = 'dibatalkan' where id = p_id and pengguna_id = auth.uid() and status = 'menunggu';
  if not found then raise exception 'Pengajuan tidak bisa dibatalkan'; end if;
end $$;

-- Tukar shift: pengaju → rekan menerima → atasan menyetujui → pemilik kedua jadwal ditukar.
create or replace function ajukan_tukar(p_jadwal_saya uuid, p_jadwal_rekan uuid, p_alasan text) returns uuid
language plpgsql security definer set search_path = public as $$
declare a record; b record; baru uuid; besok date := hari_wib() + 1;
begin
  select * into a from jadwal_shift where id = p_jadwal_saya;
  select * into b from jadwal_shift where id = p_jadwal_rekan;
  if a.id is null or b.id is null or a.pengguna_id <> auth.uid() then raise exception 'Jadwal tidak ditemukan'; end if;
  if a.status <> 'terbit' or b.status <> 'terbit' then raise exception 'Hanya jadwal yang sudah terbit'; end if;
  if a.outlet_id <> b.outlet_id then raise exception 'Harus di outlet yang sama'; end if;
  if b.pengguna_id = auth.uid() then raise exception 'Pilih jadwal rekan lain'; end if;
  if a.tanggal < besok or b.tanggal < besok then raise exception 'Tukar shift paling lambat H-1'; end if;
  if exists (select 1 from tukar_shift where status in ('menunggu_rekan','menunggu_atasan')
             and (jadwal_pengaju in (a.id, b.id) or jadwal_rekan in (a.id, b.id))) then
    raise exception 'Salah satu jadwal sedang dalam pengajuan tukar';
  end if;
  insert into tukar_shift (outlet_id, pengaju_id, jadwal_pengaju, rekan_id, jadwal_rekan, alasan)
  values (a.outlet_id, a.pengguna_id, a.id, b.pengguna_id, b.id, nullif(trim(p_alasan), ''))
  returning id into baru;
  return baru;
end $$;

create or replace function jawab_tukar(p_id uuid, p_terima boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update tukar_shift set status = case when p_terima then 'menunggu_atasan' else 'ditolak' end,
    alasan_tolak = case when p_terima then null else 'Ditolak rekan' end
  where id = p_id and rekan_id = auth.uid() and status = 'menunggu_rekan';
  if not found then raise exception 'Pengajuan tidak ditemukan'; end if;
end $$;

create or replace function batal_tukar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update tukar_shift set status = 'dibatalkan'
  where id = p_id and pengaju_id = auth.uid() and status in ('menunggu_rekan','menunggu_atasan');
  if not found then raise exception 'Pengajuan tidak bisa dibatalkan'; end if;
end $$;

create or replace function putus_tukar(p_id uuid, p_setuju boolean, p_alasan text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from tukar_shift where id = p_id;
  if r.id is null or not kelola_sdm(r.outlet_id) then raise exception 'Tidak diizinkan'; end if;
  if r.status <> 'menunggu_atasan' then raise exception 'Pengajuan belum diterima rekan atau sudah diputus'; end if;
  if p_setuju then
    if not exists (select 1 from jadwal_shift where id = r.jadwal_pengaju and pengguna_id = r.pengaju_id)
       or not exists (select 1 from jadwal_shift where id = r.jadwal_rekan and pengguna_id = r.rekan_id) then
      raise exception 'Jadwal sudah berubah sejak diajukan';
    end if;
    update jadwal_shift set pengguna_id = r.rekan_id where id = r.jadwal_pengaju;
    update jadwal_shift set pengguna_id = r.pengaju_id where id = r.jadwal_rekan;
  elsif coalesce(trim(p_alasan), '') = '' then
    raise exception 'Alasan penolakan wajib diisi';
  end if;
  update tukar_shift set status = case when p_setuju then 'disetujui' else 'ditolak' end,
    alasan_tolak = case when p_setuju then null else trim(p_alasan) end, diputus_oleh = auth.uid(), diputus_at = now()
  where id = p_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'staf_jadwal(uuid)','atur_jatah_libur(uuid,uuid,int)','atur_sdm(int,int,int,boolean)',
    'absen_masuk(uuid,text,double precision,double precision,real,text)','absen_pulang(text,double precision,double precision,real)',
    'ajukan_izin(uuid,text,date,text,uuid)','putus_izin(uuid,boolean,text)','batal_izin(uuid)',
    'ajukan_tukar(uuid,uuid,text)','jawab_tukar(uuid,boolean)','batal_tukar(uuid)','putus_tukar(uuid,boolean,text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- halaman SDM ikut segar otomatis
alter publication supabase_realtime add table absensi, pengajuan_izin, tukar_shift;
