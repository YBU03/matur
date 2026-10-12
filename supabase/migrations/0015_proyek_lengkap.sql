-- Proyek pembangunan lengkap: tanggal opening + usulan bersama, jadwal/timeline yang bisa diedit,
-- setoran dana mitra, checklist persiapan buka, dokumen, diskusi, dan info lokasi.

alter table proyek
  add column tgl_soft_opening date,
  add column alamat text,
  add column maps_url text,
  add column luas text,
  add column sewa_tempat text,
  add column kontak_tempat text;
comment on column proyek.target_buka is 'Tanggal Grand Opening';

-- akses baca: admin atau siapa pun yang boleh melihat outlet proyek (mitra/PIC)
create or replace function boleh_proyek(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select admin_proyek() or boleh_outlet(proyek_outlet(p))
$$;
revoke execute on function boleh_proyek(uuid) from public, anon;
grant execute on function boleh_proyek(uuid) to authenticated;

-- usulan tanggal opening dari admin maupun mitra (tanggal yang dipakai tetap di tabel proyek)
create table usulan_tanggal (
  id uuid primary key default gen_random_uuid(),
  proyek_id uuid not null references proyek,
  jenis text not null check (jenis in ('Soft Opening','Grand Opening')),
  tanggal date not null,
  catatan text,
  diusulkan_oleh uuid references pengguna default auth.uid(),
  nama_pengusul text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table jadwal_proyek (
  id uuid primary key default gen_random_uuid(),
  proyek_id uuid not null references proyek,
  judul text not null,
  tgl_rencana date not null,
  tgl_realisasi date,
  status text not null default 'rencana' check (status in ('rencana','selesai','mundur')),
  keterangan text,
  deleted_at timestamptz
);

create table setoran_mitra (
  id uuid primary key default gen_random_uuid(),
  proyek_id uuid not null references proyek,
  tanggal date not null,
  jumlah bigint not null check (jumlah > 0),
  keterangan text,
  deleted_at timestamptz
);

create table checklist_proyek (
  id uuid primary key default gen_random_uuid(),
  proyek_id uuid not null references proyek,
  nama text not null,
  selesai boolean not null default false,
  catatan text,
  urutan int not null default 0,
  deleted_at timestamptz
);

create table dokumen_proyek (
  id uuid primary key default gen_random_uuid(),
  proyek_id uuid not null references proyek,
  judul text not null,
  jenis text not null default 'Lainnya',
  path text not null,              -- storage: proyek/<proyek_id>/dokumen/<file>
  tipe text,                       -- mime type
  ukuran int,
  diunggah_oleh uuid references pengguna default auth.uid(),
  created_at timestamptz not null default now()
);

create table komentar_proyek (
  id uuid primary key default gen_random_uuid(),
  proyek_id uuid not null references proyek,
  pengguna_id uuid not null references pengguna default auth.uid(),
  nama text not null,
  peran text,
  isi text not null check (length(isi) between 1 and 2000),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['usulan_tanggal','jadwal_proyek','setoran_mitra','checklist_proyek','dokumen_proyek','komentar_proyek'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy baca on %I for select to authenticated using (boleh_proyek(proyek_id))', t);
  end loop;
  foreach t in array array['jadwal_proyek','setoran_mitra','checklist_proyek','dokumen_proyek'] loop
    execute format('create policy kelola on %I for all to authenticated using (admin_proyek()) with check (admin_proyek())', t);
  end loop;
  foreach t in array array['usulan_tanggal','jadwal_proyek','setoran_mitra','checklist_proyek'] loop
    execute format('create trigger log_%s after insert or update or delete on %I for each row execute function catat_log()', t, t);
  end loop;
end $$;

-- usulan & komentar: siapa pun yang boleh melihat proyek bisa menambah; ubah/hapus milik sendiri atau admin
create policy tambah on usulan_tanggal for insert to authenticated with check (boleh_proyek(proyek_id) and diusulkan_oleh = auth.uid());
create policy ubah on usulan_tanggal for update to authenticated using (diusulkan_oleh = auth.uid() or admin_proyek()) with check (boleh_proyek(proyek_id));
create policy tambah on komentar_proyek for insert to authenticated with check (boleh_proyek(proyek_id) and pengguna_id = auth.uid());
create policy hapus on komentar_proyek for delete to authenticated using (pengguna_id = auth.uid() or admin_proyek());

-- dokumen boleh PDF; batas 10 MB
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'], file_size_limit = 10485760 where id = 'proyek';
create policy dokumen_unggah on storage.objects for insert to authenticated with check (
  bucket_id = 'proyek' and (storage.foldername(name))[2] = 'dokumen' and admin_proyek()
);
create policy dokumen_baca on storage.objects for select to authenticated using (
  bucket_id = 'proyek' and (storage.foldername(name))[2] = 'dokumen'
  and exists (select 1 from dokumen_proyek d where d.path = name and boleh_proyek(d.proyek_id))
);
