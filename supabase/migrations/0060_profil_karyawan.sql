-- Profil lengkap karyawan outlet (kasir/barista/SPV): foto asli, NIK, TTL, alamat KTP, sharelok rumah (Google Maps),
-- kontak darurat. Wajib lengkap sebelum memakai Ruang Karyawan. Foto di bucket privat "profil".
create table if not exists public.profil_karyawan (
  pengguna_id uuid primary key references pengguna on delete cascade,
  foto_path text,
  nik text check (nik is null or nik ~ '^[0-9]{16}$'),
  jenis_kelamin text check (jenis_kelamin is null or jenis_kelamin in ('L','P')),
  tempat_lahir text,
  tgl_lahir date,
  alamat_ktp text,
  alamat_domisili text,
  maps_url text check (maps_url is null or maps_url ~* '^https://(www\.)?(google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps)'),
  darurat_nama text,
  darurat_hubungan text,
  darurat_hp text,
  updated_at timestamptz not null default now()
);
alter table profil_karyawan enable row level security;
-- baca: diri sendiri, Owner/HRD/Admin Pusat, SPV outlet tempat staf bertugas
create policy baca on profil_karyawan for select to authenticated using (
  pengguna_id = (select auth.uid()) or punya_peran('{owner,hrd,admin_pusat}')
  or exists (select 1 from penugasan t where t.pengguna_id = profil_karyawan.pengguna_id and t.outlet_id is not null and peran_di_outlet(t.outlet_id, '{spv}'))
);
grant select on profil_karyawan to authenticated;

-- staf wajib profil lengkap: punya peran kasir/barista/spv (bukan akun tablet)
create or replace function public.profil_kurang(p_uid uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from penugasan where pengguna_id = p_uid and peran in ('kasir','barista','spv')) then '{}'::text[] else
    array_remove(array[
      case when p.foto_path is null then 'Foto diri' end,
      case when p.nik is null then 'NIK KTP' end,
      case when p.jenis_kelamin is null then 'Jenis kelamin' end,
      case when coalesce(trim(p.tempat_lahir),'') = '' or p.tgl_lahir is null then 'Tempat & tanggal lahir' end,
      case when coalesce(trim(p.alamat_ktp),'') = '' then 'Alamat sesuai KTP' end,
      case when p.maps_url is null then 'Sharelok rumah (Google Maps)' end,
      case when coalesce(trim(u.no_hp),'') = '' then 'Nomor HP' end,
      case when coalesce(trim(p.darurat_nama),'') = '' or coalesce(trim(p.darurat_hp),'') = '' then 'Kontak darurat' end
    ], null) end
  from pengguna u left join profil_karyawan p on p.pengguna_id = u.id where u.id = p_uid
$$;
revoke all on function profil_kurang(uuid) from public, anon;
grant execute on function profil_kurang(uuid) to authenticated;

create or replace function public.simpan_profil_karyawan(p jsonb) returns text[]
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_foto text := nullif(p->>'foto_path','');
begin
  if uid is null then raise exception 'Masuk dahulu'; end if;
  if v_foto is not null and split_part(v_foto, '/', 1) <> uid::text then raise exception 'Foto tidak valid'; end if;
  insert into profil_karyawan (pengguna_id) values (uid) on conflict do nothing;
  update profil_karyawan set
    foto_path = coalesce(v_foto, foto_path),
    nik = nullif(regexp_replace(coalesce(p->>'nik',''), '\D', '', 'g'), ''),
    jenis_kelamin = nullif(p->>'jenis_kelamin',''),
    tempat_lahir = nullif(trim(p->>'tempat_lahir'),''),
    tgl_lahir = nullif(p->>'tgl_lahir','')::date,
    alamat_ktp = nullif(trim(p->>'alamat_ktp'),''),
    alamat_domisili = nullif(trim(p->>'alamat_domisili'),''),
    maps_url = nullif(trim(p->>'maps_url'),''),
    darurat_nama = nullif(trim(p->>'darurat_nama'),''),
    darurat_hubungan = nullif(trim(p->>'darurat_hubungan'),''),
    darurat_hp = nullif(trim(p->>'darurat_hp'),''),
    updated_at = now()
  where pengguna_id = uid;
  if p ? 'no_hp' then update pengguna set no_hp = nullif(trim(p->>'no_hp'),'') where id = uid; end if;
  return profil_kurang(uid);
end $$;
revoke all on function simpan_profil_karyawan(jsonb) from public, anon;
grant execute on function simpan_profil_karyawan(jsonb) to authenticated;

-- foto profil: bucket privat; unggah ke folder sendiri; dilihat diri sendiri, Owner/HRD/Admin Pusat,
-- dan siapa pun yang boleh melihat outlet tempat staf itu bertugas (SPV, mitra outlet)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profil', 'profil', false, 3145728, '{image/jpeg,image/png,image/webp}') on conflict (id) do nothing;
create or replace function public.boleh_foto_profil(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    split_part(p_name, '/', 1) = auth.uid()::text or punya_peran('{owner,hrd,admin_pusat}')
    or exists (select 1 from penugasan t where t.pengguna_id::text = split_part(p_name, '/', 1)
               and t.peran in ('kasir','barista','spv') and t.outlet_id is not null and boleh_outlet(t.outlet_id))
  )
$$;
revoke all on function boleh_foto_profil(text) from public, anon;
grant execute on function boleh_foto_profil(text) to authenticated;
create policy profil_baca on storage.objects for select to authenticated using (bucket_id = 'profil' and boleh_foto_profil(name));
create policy profil_unggah on storage.objects for insert to authenticated with check (bucket_id = 'profil' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- mitra: daftar karyawan outletnya (tanpa data pribadi selain nama, peran, foto, tanggal masuk)
create or replace function public.karyawan_outlet_saya() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id, 'nama', u.nama, 'outlet_id', o.id, 'outlet', o.nama,
      'peran', (select array_agg(distinct t2.peran::text) from penugasan t2 where t2.pengguna_id = u.id and t2.outlet_id = o.id and t2.peran in ('kasir','barista','spv')),
      'foto_path', p.foto_path,
      'tgl_masuk', (select min(k.tgl_masuk) from karyawan k where k.pengguna_id = u.id and k.deleted_at is null)
    ) order by o.nama, u.nama), '[]')
  from (select distinct t.pengguna_id, t.outlet_id from penugasan t where t.peran in ('kasir','barista','spv') and t.outlet_id is not null) t
  join pengguna u on u.id = t.pengguna_id and u.status = 'aktif' and not u.akun_tablet
  join outlet o on o.id = t.outlet_id and o.deleted_at is null
  left join profil_karyawan p on p.pengguna_id = u.id
  where auth.uid() is not null and exists (select 1 from penugasan m where m.pengguna_id = auth.uid() and m.peran = 'mitra' and m.outlet_id = o.id)
$$;
revoke all on function karyawan_outlet_saya() from public, anon;
grant execute on function karyawan_outlet_saya() to authenticated;

-- HRD/Owner/Admin Pusat: semua profil karyawan outlet beserta kekurangannya
create or replace function public.daftar_profil_karyawan() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id, 'nama', u.nama, 'no_hp', u.no_hp,
      'tugas', (select jsonb_agg(distinct jsonb_build_object('outlet', o.nama, 'peran', t.peran)) from penugasan t join outlet o on o.id = t.outlet_id where t.pengguna_id = u.id and t.peran in ('kasir','barista','spv')),
      'profil', to_jsonb(p) - 'pengguna_id',
      'kurang', profil_kurang(u.id)
    ) order by u.nama), '[]')
  from pengguna u left join profil_karyawan p on p.pengguna_id = u.id
  where u.status = 'aktif' and not u.akun_tablet
    and exists (select 1 from penugasan t where t.pengguna_id = u.id and t.peran in ('kasir','barista','spv'))
    and auth.uid() is not null and punya_peran('{owner,hrd,admin_pusat}')
$$;
revoke all on function daftar_profil_karyawan() from public, anon;
grant execute on function daftar_profil_karyawan() to authenticated;
