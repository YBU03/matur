-- Disposable fixture; no production rows changed. Verify existing RLS, then ROLLBACK.
begin;
do $$
declare a uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); j uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email) values(a,a::text||'@test.invalid'),(u,u::text||'@test.invalid');
 insert into public.pengguna(id,nama,email,status) values(a,'Admin Test',a::text||'@test.invalid','aktif'),(u,'Staf Test',u::text||'@test.invalid','aktif');
 insert into public.penugasan(pengguna_id,peran,outlet_id) values(a,'admin_pusat',null);
 insert into public.outlet(id,nama) values(o,'Jadwal read-only test');
 insert into public.shift_outlet(id,outlet_id,nama,jam_mulai,jam_selesai) values(s,o,'Shift Test','08:00','16:00');
 insert into public.jadwal_shift(id,outlet_id,shift_id,pengguna_id,tanggal,status) values(j,o,s,u,current_date,'terbit'),(gen_random_uuid(),o,s,u,current_date+1,'draft');
 perform set_config('test.outlet',o::text,true);perform set_config('test.published',j::text,true);perform set_config('request.jwt.claim.sub',a::text,true);
end $$;
set local role authenticated;
do $$
declare n int;o uuid:=current_setting('test.outlet')::uuid;j uuid:=current_setting('test.published')::uuid;
begin
 if not public.boleh_outlet(o) then raise exception 'Admin cannot read outlet';end if;
 if public.kelola_sdm(o) then raise exception 'Admin unexpectedly has SDM write access';end if;
 select count(*) into n from public.jadwal_shift where outlet_id=o and status='terbit';
 if n<>1 then raise exception 'Published schedule not readable';end if;
 select count(*) into n from public.jadwal_shift where outlet_id=o and status='draft';
 if n<>0 then raise exception 'Draft leaked to Admin';end if;
 update public.jadwal_shift set status='draft' where id=j;get diagnostics n=row_count;
 if n<>0 then raise exception 'Admin can edit schedule';end if;
 delete from public.jadwal_shift where id=j;get diagnostics n=row_count;
 if n<>0 then raise exception 'Admin can delete schedule';end if;
end $$;
reset role;
select 'PASS: Admin reads published schedules only; cannot edit/delete; no write permissions expanded' as result;
rollback;
