-- Read-only projection for the partner dashboard; never exposes attendance evidence or editing privileges.
create schema if not exists mitra_dashboard_internal;
revoke all on schema mitra_dashboard_internal from public, anon;
grant usage on schema mitra_dashboard_internal to authenticated;
create or replace function mitra_dashboard_internal.jadwal(p_awal date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare awal date:=date_trunc('week',coalesce(p_awal,(now() at time zone 'Asia/Jakarta')::date))::date; hasil jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.pengguna where id=auth.uid() and status='aktif') then return jsonb_build_object('outlets','[]'::jsonb,'jadwal','[]'::jsonb,'aktif','[]'::jsonb); end if;
 if awal < date '1900-01-01' or awal > date '2200-12-31' then raise exception 'Minggu tidak valid'; end if;
 with milik as materialized (
  select o.id,o.nama from public.outlet o where o.deleted_at is null and o.mode='asli' and exists(select 1 from public.penugasan m where m.pengguna_id=auth.uid() and m.peran='mitra' and m.outlet_id=o.id)
 ), baris as (
  select j.id::text id,j.outlet_id,j.tanggal,u.nama,s.nama shift,s.jam_mulai::text mulai,s.jam_selesai::text selesai,
    a.masuk_at,a.pulang_at,coalesce(a.telat_menit,0) telat_menit,coalesce(a.status,'jadwal')::text status
  from public.jadwal_shift j join milik o on o.id=j.outlet_id join public.pengguna u on u.id=j.pengguna_id
  join public.shift_outlet s on s.id=j.shift_id and s.outlet_id=j.outlet_id
  left join public.absensi a on a.jadwal_id=j.id and a.outlet_id=j.outlet_id and a.pengguna_id=j.pengguna_id
  where j.status='terbit' and j.tanggal between awal and awal+6
  union all
  select i.id::text,i.outlet_id,i.tanggal,u.nama,null,null,null,null,null,0,i.jenis::text
  from public.pengajuan_izin i join milik o on o.id=i.outlet_id join public.pengguna u on u.id=i.pengguna_id
  where i.status='disetujui' and i.tanggal between awal and awal+6
  union all
  select a.id::text,a.outlet_id,a.tanggal,u.nama,null,null,null,a.masuk_at,a.pulang_at,coalesce(a.telat_menit,0),a.status::text
  from public.absensi a join milik o on o.id=a.outlet_id join public.pengguna u on u.id=a.pengguna_id
  where a.tanggal between awal and awal+6 and (a.jadwal_id is null or not exists(select 1 from public.jadwal_shift j where j.id=a.jadwal_id and j.status='terbit'))
 ), aktif as (
  select a.id::text id,a.outlet_id,u.nama,s.nama shift,a.masuk_at,coalesce(a.telat_menit,0) telat_menit
  from public.absensi a join milik o on o.id=a.outlet_id join public.pengguna u on u.id=a.pengguna_id
  left join public.jadwal_shift j on j.id=a.jadwal_id and j.outlet_id=a.outlet_id
  left join public.shift_outlet s on s.id=j.shift_id and s.outlet_id=a.outlet_id
  where a.pulang_at is null and a.masuk_at<=now() and a.masuk_at>now()-interval '24 hours'
 ) select jsonb_build_object('outlets',coalesce((select jsonb_agg(to_jsonb(o) order by o.nama) from milik o),'[]'::jsonb),
  'jadwal',coalesce((select jsonb_agg(to_jsonb(b) order by b.tanggal,b.mulai,b.nama) from baris b),'[]'::jsonb),
  'aktif',coalesce((select jsonb_agg(to_jsonb(a) order by a.masuk_at,a.nama) from aktif a),'[]'::jsonb)) into hasil;
 return hasil;
end $$;
revoke all on function mitra_dashboard_internal.jadwal(date) from public, anon;
grant execute on function mitra_dashboard_internal.jadwal(date) to authenticated;
create or replace function public.jadwal_mitra_mingguan(p_awal date) returns jsonb
language sql stable security invoker set search_path='' as $$select mitra_dashboard_internal.jadwal(p_awal)$$;
revoke all on function public.jadwal_mitra_mingguan(date) from public, anon;
grant execute on function public.jadwal_mitra_mingguan(date) to authenticated;
