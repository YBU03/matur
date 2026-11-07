-- Alamat teks saja, tanpa membuka profil lengkap / NIK / Maps kepada mitra.
create or replace function public.karyawan_outlet_saya() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id, 'nama', u.nama, 'outlet_id', o.id, 'outlet', o.nama,
      'peran', (select array_agg(distinct t2.peran::text) from public.penugasan t2 where t2.pengguna_id = u.id and t2.outlet_id = o.id and t2.peran in ('kasir','barista','spv')),
      'foto_path', p.foto_path,
      'alamat', coalesce(nullif(trim(p.alamat_domisili), ''), nullif(trim(p.alamat_ktp), '')),
      'tgl_masuk', (select min(k.tgl_masuk) from public.karyawan k where k.pengguna_id = u.id and k.deleted_at is null)
    ) order by o.nama, u.nama), '[]'::jsonb)
  from (select distinct t.pengguna_id, t.outlet_id from public.penugasan t where t.peran in ('kasir','barista','spv') and t.outlet_id is not null) t
  join public.pengguna u on u.id = t.pengguna_id and u.status = 'aktif' and not u.akun_tablet
  join public.outlet o on o.id = t.outlet_id and o.deleted_at is null
  left join public.profil_karyawan p on p.pengguna_id = u.id
  where auth.uid() is not null and exists (
    select 1 from public.penugasan m join public.pengguna pemilik on pemilik.id = m.pengguna_id and pemilik.status = 'aktif'
    where m.pengguna_id = auth.uid() and m.peran = 'mitra' and m.outlet_id = o.id
  )
$$;
revoke all on function public.karyawan_outlet_saya() from public, anon;
grant execute on function public.karyawan_outlet_saya() to authenticated;
