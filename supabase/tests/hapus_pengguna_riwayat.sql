-- Disposable fixtures only. All deletions and fixture creation are ROLLED BACK.
begin;
do $$
declare
 actor uuid;fresh uuid:=gen_random_uuid();hadir uuid:=gen_random_uuid();gaji uuid:=gen_random_uuid();slip uuid:=gen_random_uuid();
 protected_owner uuid:=gen_random_uuid();staf uuid:=gen_random_uuid();tablet uuid:=gen_random_uuid();o uuid:=gen_random_uuid();pay uuid:=gen_random_uuid();u uuid;r text;denied boolean;
begin
 select p.id into actor from public.pengguna p join public.penugasan t on t.pengguna_id=p.id where p.status='aktif' and t.peran='owner' limit 1;
 if actor is null then raise exception 'Test requires an active Owner';end if;
 insert into public.outlet(id,nama) values(o,'Delete test rollback');
 foreach u in array array[fresh,hadir,gaji,slip,protected_owner,staf,tablet] loop
  insert into auth.users(id,email) values(u,u::text||'@test.invalid');
  insert into public.pengguna(id,nama,email,status) values(u,'Test rollback',u::text||'@test.invalid','aktif');
 end loop;
 update public.pengguna set akun_tablet=true where id=tablet;
 insert into public.penugasan(pengguna_id,peran,outlet_id) values(protected_owner,'owner',null),(staf,'hrd',o),(hadir,'barista',o);
 insert into public.absensi(outlet_id,pengguna_id,tanggal,status) values(o,hadir,current_date,'tepat');
 insert into public.gaji_staf(pengguna_id,gaji_pokok) values(gaji,1000000);
 insert into public.penggajian(id,outlet_id,periode) values(pay,o,date_trunc('month',current_date)::date);
 insert into public.slip_gaji(penggajian_id,pengguna_id,nama,total) values(pay,slip,'Test rollback',1000000);
 perform set_config('request.jwt.claim.sub',staf::text,true);
 denied:=false;
 begin perform public.hapus_pengguna(fresh);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Non-owner can delete';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 denied:=false;
 begin perform public.hapus_pengguna(actor);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Self-delete allowed';end if;
 denied:=false;
 begin perform public.hapus_pengguna(protected_owner);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Owner target can be deleted';end if;
 denied:=false;
 begin perform public.hapus_pengguna(tablet);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Tablet target can be deleted';end if;
 r:=public.hapus_pengguna(fresh);
 if r<>'dihapus' or exists(select 1 from auth.users where id=fresh) or exists(select 1 from public.pengguna where id=fresh) then raise exception 'History-free account not removed';end if;
 foreach u in array array[hadir,gaji,slip] loop
  r:=public.hapus_pengguna(u);
  if r<>'diarsipkan' then raise exception 'Account with history not archived';end if;
  if not exists(select 1 from public.pengguna where id=u and status='dihapus') then raise exception 'Archive status missing';end if;
  if not exists(select 1 from auth.users where id=u and banned_until='infinity'::timestamptz) then raise exception 'Archived login not banned';end if;
  if exists(select 1 from public.penugasan where pengguna_id=u) then raise exception 'Archived account still has roles';end if;
 end loop;
 if not exists(select 1 from public.absensi where pengguna_id=hadir) then raise exception 'Attendance history lost';end if;
 if not exists(select 1 from public.gaji_staf where pengguna_id=gaji and gaji_pokok=1000000) then raise exception 'Salary settings lost';end if;
 if not exists(select 1 from public.slip_gaji where pengguna_id=slip and total=1000000) then raise exception 'Payslip lost';end if;
 if not exists(select 1 from public.log_aktivitas where pengguna_id=actor and aksi='hapus_pengguna' and entitas_id=hadir::text) then raise exception 'Deletion audit missing';end if;
 if has_function_privilege('anon','public.hapus_pengguna(uuid)','execute') then raise exception 'Anonymous can invoke delete';end if;
end $$;
select 'PASS: owner-only, protected self/owner/tablet, history-free deletion, attendance/salary/payslip retained, login banned, roles removed, audit' as result;
rollback;
