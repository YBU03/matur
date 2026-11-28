-- A narrow projection for Accounting; no broad access to users or assignments.
create function laporan_lanjut_internal.kontak_mitra(l uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o uuid; hasil jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.pengguna where id=auth.uid() and status='aktif') or not laporan_lanjut_internal.pusat() then raise exception 'Tidak diizinkan'; end if;
 select b.outlet_id into o from public.laporan_bulanan b join public.outlet t on t.id=b.outlet_id and t.deleted_at is null where b.id=l and b.mode='asli' and b.deleted_at is null;
 if o is null then raise exception 'Laporan tidak tersedia'; end if;
 with contacts as (
  select coalesce('akun:'||m.pengguna_id::text,'mitra:'||m.id::text) k,'mitra:'||m.id::text id,m.nama,
   coalesce(nullif(btrim(m.no_hp),''),nullif(btrim(u.no_hp),'')) no_hp,
   case when exists(select 1 from public.perjanjian p where p.mitra_id=m.id and p.outlet_id=o and p.mode='asli' and p.deleted_at is null) then 0 else 1 end prioritas
  from public.mitra m left join public.pengguna u on u.id=m.pengguna_id
  where m.deleted_at is null and (
   exists(select 1 from public.perjanjian p where p.mitra_id=m.id and p.outlet_id=o and p.mode='asli' and p.deleted_at is null)
   or (u.status='aktif' and exists(select 1 from public.penugasan t where t.pengguna_id=u.id and t.peran='mitra' and t.outlet_id=o)))
  union all
  select 'akun:'||u.id::text,'akun:'||u.id::text,u.nama,nullif(btrim(u.no_hp),''),2
  from public.pengguna u where u.status='aktif' and exists(select 1 from public.penugasan t where t.pengguna_id=u.id and t.peran='mitra' and t.outlet_id=o)
   and not exists(select 1 from public.mitra m where m.pengguna_id=u.id)
 ), unik as (select distinct on(k) id,nama,no_hp from contacts order by k,prioritas,id)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'nama',nama,'no_hp',no_hp) order by nama,id),'[]') into hasil from unik;
 return hasil;
end $$;
create function public.kontak_mitra_laporan(l uuid) returns jsonb
language sql security invoker set search_path='' as $$select laporan_lanjut_internal.kontak_mitra(l)$$;
revoke all on function laporan_lanjut_internal.kontak_mitra(uuid),public.kontak_mitra_laporan(uuid) from public,anon;
grant execute on function laporan_lanjut_internal.kontak_mitra(uuid),public.kontak_mitra_laporan(uuid) to authenticated;
