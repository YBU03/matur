-- Matur · Tahap 4 (prioritas launching): proyek pembangunan & pemantauan progres (PRY-01..05, MTR-01).

create table proyek (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  outlet_id uuid not null references outlet,
  nama text not null,
  estimasi_budget bigint not null default 0,
  tgl_mulai date,
  target_buka date,
  status text not null default 'berjalan' check (status in ('berjalan','selesai')),
  catatan text,
  deleted_at timestamptz
);

-- PRY-02: daftar kebutuhan (RAB)
create table item_rab (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  proyek_id uuid not null references proyek,
  kategori text not null default 'Lainnya',
  nama text not null,
  qty numeric(12,2) not null default 1,
  harga_estimasi bigint not null default 0,   -- total estimasi untuk item ini
  harga_realisasi bigint,                     -- total realisasi
  status text not null default 'rencana' check (status in ('rencana','dibeli','terpasang')),
  deleted_at timestamptz
);

-- PRY-03: pekerjaan dengan PIC, bobot, progres
create table pekerjaan (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  proyek_id uuid not null references proyek,
  nama text not null,
  pic_id uuid references pengguna,
  bobot numeric(6,2) not null default 1 check (bobot > 0),
  progres int not null default 0 check (progres between 0 and 100),
  tgl_mulai date,
  tgl_selesai date,
  deleted_at timestamptz
);

-- PRY-04: PIC unggah foto + progres; tampil ke mitra setelah disetujui admin
create table foto_progres (
  id uuid primary key default gen_random_uuid(),
  pekerjaan_id uuid not null references pekerjaan,
  path text not null,                         -- storage: proyek/<proyek_id>/<pekerjaan_id>/<file>
  keterangan text,
  progres_diajukan int check (progres_diajukan between 0 and 100),
  status text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak')),
  diunggah_oleh uuid references pengguna default auth.uid(),
  diperiksa_oleh uuid references pengguna,
  created_at timestamptz not null default now()
);

create or replace function proyek_outlet(p uuid) returns uuid
language sql stable security definer set search_path = public as $$ select outlet_id from proyek where id = p $$;

create or replace function admin_proyek() returns boolean
language sql stable security definer set search_path = public as $$ select punya_peran('{owner,admin_pusat}') $$;

alter table proyek enable row level security;
alter table item_rab enable row level security;
alter table pekerjaan enable row level security;
alter table foto_progres enable row level security;

-- baca: admin semua; mitra & PIC hanya outlet yang ditugaskan (boleh_outlet)
create policy baca on proyek for select to authenticated using (admin_proyek() or boleh_outlet(outlet_id));
create policy baca on item_rab for select to authenticated using (admin_proyek() or boleh_outlet(proyek_outlet(proyek_id)));
create policy baca on pekerjaan for select to authenticated using (admin_proyek() or boleh_outlet(proyek_outlet(proyek_id)));
create policy baca on foto_progres for select to authenticated using (
  admin_proyek() or diunggah_oleh = auth.uid()
  or (status = 'disetujui' and exists (select 1 from pekerjaan k where k.id = pekerjaan_id and boleh_outlet(proyek_outlet(k.proyek_id))))
);

create policy kelola on proyek for all to authenticated using (admin_proyek()) with check (admin_proyek());
create policy kelola on item_rab for all to authenticated using (admin_proyek()) with check (admin_proyek());
create policy kelola on pekerjaan for all to authenticated using (admin_proyek()) with check (admin_proyek());

create trigger log_proyek after insert or update or delete on proyek for each row execute function catat_log();
create trigger log_item_rab after insert or update or delete on item_rab for each row execute function catat_log();
create trigger log_pekerjaan after insert or update or delete on pekerjaan for each row execute function catat_log();

-- PIC/admin mengajukan foto + progres untuk satu pekerjaan
create or replace function ajukan_progres(p_pekerjaan uuid, p_path text, p_keterangan text, p_progres int) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid; k pekerjaan;
begin
  select * into k from pekerjaan where id = p_pekerjaan and deleted_at is null;
  if k.id is null or not (admin_proyek() or k.pic_id = auth.uid()) then raise exception 'Tidak diizinkan'; end if;
  if p_path not like k.proyek_id || '/' || k.id || '/%' then raise exception 'Lokasi file tidak valid'; end if;
  insert into foto_progres (pekerjaan_id, path, keterangan, progres_diajukan)
    values (k.id, p_path, nullif(p_keterangan, ''), p_progres) returning id into fid;
  -- foto dari admin langsung disetujui
  if admin_proyek() then perform periksa_progres(fid, true); end if;
  return fid;
end $$;

-- Admin menyetujui/menolak; bila disetujui progres pekerjaan diperbarui
create or replace function periksa_progres(p_foto uuid, p_setuju boolean) returns void
language plpgsql security definer set search_path = public as $$
declare f foto_progres;
begin
  if not admin_proyek() then raise exception 'Hanya Admin Pusat'; end if;
  update foto_progres set status = case when p_setuju then 'disetujui' else 'ditolak' end, diperiksa_oleh = auth.uid()
    where id = p_foto and status = 'menunggu' returning * into f;
  if f.id is null then raise exception 'Foto tidak ditemukan atau sudah diperiksa'; end if;
  if p_setuju and f.progres_diajukan is not null then
    update pekerjaan set progres = f.progres_diajukan where id = f.pekerjaan_id;
  end if;
end $$;

revoke execute on function proyek_outlet(uuid) from public, anon;
revoke execute on function admin_proyek() from public, anon;
revoke execute on function ajukan_progres(uuid, text, text, int) from public, anon;
revoke execute on function periksa_progres(uuid, boolean) from public, anon;
grant execute on function proyek_outlet(uuid) to authenticated;
grant execute on function admin_proyek() to authenticated;
grant execute on function ajukan_progres(uuid, text, text, int) to authenticated;
grant execute on function periksa_progres(uuid, boolean) to authenticated;

-- Storage foto (privat; ditampilkan lewat signed URL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('proyek', 'proyek', false, 5242880, array['image/jpeg','image/png','image/webp']);

create policy proyek_unggah on storage.objects for insert to authenticated with check (
  bucket_id = 'proyek' and exists (
    select 1 from pekerjaan k
    where k.proyek_id::text = (storage.foldername(name))[1] and k.id::text = (storage.foldername(name))[2]
      and (admin_proyek() or k.pic_id = auth.uid())
  )
);
create policy proyek_baca on storage.objects for select to authenticated using (
  bucket_id = 'proyek' and exists (
    select 1 from foto_progres f where f.path = name
      and (admin_proyek() or f.diunggah_oleh = auth.uid()
           or (f.status = 'disetujui' and boleh_outlet(proyek_outlet(((storage.foldername(name))[1])::uuid))))
  )
);
