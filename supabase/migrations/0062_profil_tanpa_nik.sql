-- NIK tidak dipakai: tidak wajib dan tidak disimpan di profil karyawan.
update profil_karyawan set nik = null where nik is not null;
create or replace function public.profil_kurang(p_uid uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from penugasan where pengguna_id = p_uid and peran in ('kasir','barista','spv')) then '{}'::text[] else
    array_remove(array[
      case when p.foto_path is null then 'Foto diri' end,
      case when p.jenis_kelamin is null then 'Jenis kelamin' end,
      case when coalesce(trim(p.tempat_lahir),'') = '' or p.tgl_lahir is null then 'Tempat & tanggal lahir' end,
      case when coalesce(trim(p.alamat_ktp),'') = '' then 'Alamat sesuai KTP' end,
      case when p.maps_url is null then 'Sharelok rumah (Google Maps)' end,
      case when coalesce(trim(u.no_hp),'') = '' then 'Nomor HP' end,
      case when coalesce(trim(p.darurat_nama),'') = '' or coalesce(trim(p.darurat_hp),'') = '' then 'Kontak darurat' end
    ], null) end
  from pengguna u left join profil_karyawan p on p.pengguna_id = u.id where u.id = p_uid
$$;
do $$ declare d text; d0 text; begin
  d := pg_get_functiondef('public.simpan_profil_karyawan(jsonb)'::regprocedure); d0 := d;
  d := replace(d, $r$    nik = nullif(regexp_replace(coalesce(p->>'nik',''), '\D', '', 'g'), ''),
$r$, '');
  if d = d0 then raise exception 'patch simpan_profil_karyawan gagal'; end if;
  execute d;
end $$;
