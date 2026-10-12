-- Urutan tahapan pekerjaan + galeri desain cafe per proyek (tampil langsung ke mitra).
alter table pekerjaan add column urutan int not null default 0;

create table desain_proyek (
  id uuid primary key default gen_random_uuid(),
  proyek_id uuid not null references proyek,
  path text not null,                 -- storage: proyek/<proyek_id>/desain/<file>
  judul text,
  diunggah_oleh uuid references pengguna default auth.uid(),
  created_at timestamptz not null default now()
);
alter table desain_proyek enable row level security;
create policy baca on desain_proyek for select to authenticated using (admin_proyek() or boleh_outlet(proyek_outlet(proyek_id)));
create policy kelola on desain_proyek for all to authenticated using (admin_proyek()) with check (admin_proyek());
create trigger log_desain after insert or delete on desain_proyek for each row execute function catat_log();

create policy desain_unggah on storage.objects for insert to authenticated with check (
  bucket_id = 'proyek' and (storage.foldername(name))[2] = 'desain' and admin_proyek()
);
create policy desain_baca on storage.objects for select to authenticated using (
  bucket_id = 'proyek' and (storage.foldername(name))[2] = 'desain'
  and exists (select 1 from desain_proyek d where d.path = name and (admin_proyek() or boleh_outlet(proyek_outlet(d.proyek_id))))
);
