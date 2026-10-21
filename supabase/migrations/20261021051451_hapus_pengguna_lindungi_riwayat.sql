-- Preserve all referenced application history, including cascading attendance/payroll rows.
create or replace function public.hapus_pengguna(p_uid uuid) returns text
language plpgsql security definer set search_path='' as $$
declare target public.pengguna;ref record;punya_riwayat boolean:=false;mode_hapus text;
begin
 if not exists(select 1 from public.penugasan t join public.pengguna p on p.id=t.pengguna_id where t.pengguna_id=auth.uid() and t.peran='owner' and p.status='aktif') then raise exception 'Hanya Owner yang bisa menghapus pengguna';end if;
 if p_uid=auth.uid() then raise exception 'Tidak bisa menghapus akun sendiri';end if;
 -- FOR UPDATE also prevents a concurrent FK insert from being lost to a cascade.
 select * into target from public.pengguna where id=p_uid for update;
 if not found or target.status='dihapus' then raise exception 'Pengguna sudah dihapus atau tidak ditemukan';end if;
 if target.akun_tablet then raise exception 'Akun perangkat POS tidak bisa dihapus melalui menu pengguna';end if;
 if exists(select 1 from public.penugasan where pengguna_id=p_uid and peran='owner') then raise exception 'Akun Owner tidak bisa dihapus';end if;
 -- Only role assignments are disposable. Every other FK reference counts as retained history.
 for ref in
  select ns.nspname,cl.relname,att.attname from pg_catalog.pg_constraint fk
  join pg_catalog.pg_class cl on cl.oid=fk.conrelid
  join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
  join pg_catalog.pg_attribute att on att.attrelid=fk.conrelid and att.attnum=fk.conkey[array_position(fk.confkey,1::smallint)]
  where fk.contype='f' and fk.confrelid='public.pengguna'::regclass and fk.conrelid<>'public.penugasan'::regclass
 loop
  execute format('select exists(select 1 from %I.%I where %I=$1)',ref.nspname,ref.relname,ref.attname) into punya_riwayat using p_uid;
  exit when punya_riwayat;
 end loop;
 if punya_riwayat then
  delete from public.penugasan where pengguna_id=p_uid;
  update public.outlet set spv_id=null where spv_id=p_uid;
  update public.outlet set pj_laporan_id=null where pj_laporan_id=p_uid;
  update public.pengguna set status='dihapus',email=null,no_hp=null where id=p_uid;
  update auth.users set email='dihapus+'||id||'@hapus.matur.id',banned_until='infinity',phone=null where id=p_uid;
  delete from auth.sessions where user_id=p_uid;
  delete from auth.refresh_tokens where user_id=p_uid::text;
  mode_hapus:='diarsipkan';
 else
  delete from auth.users where id=p_uid;
  mode_hapus:='dihapus';
 end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru)
 values(auth.uid(),'hapus_pengguna','pengguna',p_uid::text,jsonb_build_object('hasil',mode_hapus,'riwayat_dipertahankan',punya_riwayat));
 return mode_hapus;
end $$;
revoke all on function public.hapus_pengguna(uuid) from public,anon;
grant execute on function public.hapus_pengguna(uuid) to authenticated;
