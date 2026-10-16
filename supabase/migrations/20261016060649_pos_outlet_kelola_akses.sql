-- Delete the outlet login independently of financial and employee records.
alter table matur_internal.pos_outlet_akses add column deleted_at timestamptz;
create or replace function public.panel_akses_pos_outlet() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nama',o.nama,'username',a.username,'aktif',coalesce(a.aktif,false),'diubah_at',a.diubah_at) order by o.nama),'[]')
 from outlet o left join matur_internal.pos_outlet_akses a on a.outlet_id=o.id and a.deleted_at is null
 where o.deleted_at is null and matur_internal.admin_pos_outlet(o.id)
$$;
-- Re-adding an archived login always requires a new password; preserve compatibility with the old API.
do $$ declare d text;begin
 d:=pg_get_functiondef('public.atur_akses_pos_outlet(uuid,text,text,boolean)'::regprocedure);
 d:=replace(d,'old.outlet_id is null or coalesce(p_password,', 'old.outlet_id is null or old.deleted_at is not null or coalesce(p_password,');
 d:=replace(d,'diubah_at=now();','diubah_at=clock_timestamp(),deleted_at=null;');
 if position('old.deleted_at is not null' in d)=0 or position('deleted_at=null' in d)=0 then raise exception 'Patch akses outlet tidak sesuai';end if;
 execute d;
end $$;

create function public.simpan_akses_pos_outlet(p_outlet uuid,p_username text,p_password text,p_aktif boolean,p_baru boolean,p_versi timestamptz) returns void
language plpgsql security definer set search_path=public as $$
declare a matur_internal.pos_outlet_akses;
begin
 if not matur_internal.admin_pos_outlet(p_outlet) then raise exception 'Tidak berwenang mengelola outlet ini';end if;
 if p_baru is null then raise exception 'Pilih tambah atau edit akses';end if;
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||p_outlet));
 select * into a from matur_internal.pos_outlet_akses where outlet_id=p_outlet for update;
 if p_baru then
  if a.outlet_id is not null and a.deleted_at is null then raise exception 'Outlet sudah memiliki akses POS. Gunakan Edit';end if;
 else
  if a.outlet_id is null or a.deleted_at is not null then raise exception 'Akses sudah dihapus atau belum dibuat. Muat ulang daftar';end if;
  if p_versi is null or a.diubah_at is distinct from p_versi then raise exception 'Akses sudah berubah. Muat ulang daftar sebelum mengedit';end if;
 end if;
 perform public.atur_akses_pos_outlet(p_outlet,p_username,p_password,p_aktif);
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru)
 values(auth.uid(),case when p_baru then 'tambah_akses_pos_outlet' else 'edit_akses_pos_outlet' end,'outlet',p_outlet::text,jsonb_build_object('username',lower(trim(p_username)),'aktif',p_aktif));
exception when unique_violation then raise exception 'Username POS sudah dipakai outlet lain. Gunakan username berbeda';
end $$;

create function public.hapus_akses_pos_outlet(p_outlet uuid,p_versi timestamptz) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare a matur_internal.pos_outlet_akses;at_time timestamptz:=clock_timestamp();
begin
 if not matur_internal.admin_pos_outlet(p_outlet) then raise exception 'Tidak berwenang mengelola outlet ini';end if;
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||p_outlet));
 select * into a from matur_internal.pos_outlet_akses where outlet_id=p_outlet for update;
 if a.outlet_id is null or a.deleted_at is not null then raise exception 'Akses sudah dihapus atau belum dibuat. Muat ulang daftar';end if;
 if p_versi is null or a.diubah_at is distinct from p_versi then raise exception 'Akses sudah berubah. Muat ulang daftar sebelum menghapus';end if;
 -- Invalidate shared credentials, release the username, and withdraw online authorizations.
 -- Keep browser identities and financial rows so historical offline queues can still be reconciled.
 update matur_internal.pos_outlet_akses set aktif=false,deleted_at=at_time,diubah_at=at_time,admin_id=auth.uid(),
 username='!deleted!'||replace(p_outlet::text,'-',''),password_hash=crypt(gen_random_uuid()::text,gen_salt('bf')) where outlet_id=p_outlet;
 update matur_internal.pos_izin set ditarik_at=coalesce(ditarik_at,at_time) where perangkat_id in(select id from public.pos_perangkat where outlet_id=p_outlet);
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)
 values(auth.uid(),'hapus_akses_pos_outlet','outlet',p_outlet::text,jsonb_build_object('username',a.username,'aktif',a.aktif),jsonb_build_object('akses_dihapus',true,'riwayat_dipertahankan',true));
end $$;
revoke all on function public.simpan_akses_pos_outlet(uuid,text,text,boolean,boolean,timestamptz),public.hapus_akses_pos_outlet(uuid,timestamptz) from public,anon;
grant execute on function public.simpan_akses_pos_outlet(uuid,text,text,boolean,boolean,timestamptz),public.hapus_akses_pos_outlet(uuid,timestamptz) to authenticated;
