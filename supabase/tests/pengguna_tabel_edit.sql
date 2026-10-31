begin;
do $$declare owner_id uuid;u uuid:=gen_random_uuid();h uuid:=gen_random_uuid();o uuid:=gen_random_uuid();other uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();begin
 select t.pengguna_id into owner_id from penugasan t join pengguna g on g.id=t.pengguna_id where t.peran='owner' and g.status='aktif' limit 1;
 if owner_id is null then raise exception 'Perlu Owner aktif';end if;
 insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','fixture-'||u||'@example.invalid'),(h,'authenticated','authenticated','fixture-'||h||'@example.invalid');
 insert into pengguna(id,nama,status) values(u,'Pengguna tabel fixture','aktif'),(h,'HRD tabel fixture','aktif');
 insert into outlet(id,nama) values(o,'Outlet tabel fixture'),(other,'Outlet kedua fixture');
 insert into penugasan(id,pengguna_id,peran,outlet_id) values(a,u,'barista',o),(b,u,'kasir',other),(gen_random_uuid(),h,'hrd',null);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('test.uid',u::text,true);perform set_config('test.hrd',h::text,true);perform set_config('test.a',a::text,true);perform set_config('test.b',b::text,true);perform set_config('test.o',o::text,true);perform set_config('test.other',other::text,true);
end $$;
set local role authenticated;
do $$declare a uuid:=current_setting('test.a')::uuid;o uuid:=current_setting('test.o')::uuid;begin
 perform edit_penugasan_pengguna(a,jsonb_build_object('peran','barista','outlet_id',o),'spv',o);
 if not exists(select 1 from penugasan where id=a and peran='spv') or not exists(select 1 from penugasan where id=current_setting('test.b')::uuid and peran='kasir') then raise exception 'Perubahan menghapus akses lain';end if;
 begin perform edit_penugasan_pengguna(a,jsonb_build_object('peran','barista','outlet_id',o),'barista',o);raise exception 'Konflik tidak ditolak';exception when others then if sqlerrm not like 'Akses sudah berubah%' then raise;end if;end;
 perform edit_penugasan_pengguna(a,jsonb_build_object('peran','spv','outlet_id',o),'barista',o);
 insert into penugasan(pengguna_id,peran,outlet_id) values(current_setting('test.uid')::uuid,'finance',null);
 begin perform edit_penugasan_pengguna(a,jsonb_build_object('peran','barista','outlet_id',o),'finance',null);raise exception 'Akses pusat ganda lolos';exception when unique_violation then null;end;
 delete from penugasan where pengguna_id=current_setting('test.uid')::uuid and peran='finance';
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.hrd'),true);
do $$declare a uuid:=current_setting('test.a')::uuid;o uuid:=current_setting('test.o')::uuid;other uuid:=current_setting('test.other')::uuid;begin
 -- HRD boleh mencabut+menambahkan akses kasir/barista pada kebijakan lama, tanpa UPDATE policy baru.
 perform edit_penugasan_pengguna(a,jsonb_build_object('peran','barista','outlet_id',o),'barista',other);
 begin perform edit_penugasan_pengguna(a,jsonb_build_object('peran','barista','outlet_id',other),'owner',null);raise exception 'Eskalasi HRD lolos';exception when insufficient_privilege then null;end;
 if not exists(select 1 from penugasan where id=a and peran='barista' and outlet_id=other) then raise exception 'Gagal INSERT menghilangkan akses lama';end if;
 begin perform edit_penugasan_pengguna(a,jsonb_build_object('peran','barista','outlet_id',other),'kasir',other);raise exception 'Duplikat lolos';exception when unique_violation then null;end;
 if not exists(select 1 from penugasan where id=a and peran='barista' and outlet_id=other) then raise exception 'Duplikat menghilangkan akses lama';end if;
 if has_function_privilege('anon','public.edit_penugasan_pengguna(uuid,jsonb,public.peran,uuid)','execute') then raise exception 'Anon berhak edit';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
do $$begin
 begin perform edit_penugasan_pengguna(current_setting('test.a')::uuid,jsonb_build_object('peran','barista','outlet_id',current_setting('test.other')),'kasir',current_setting('test.o')::uuid);raise exception 'Edit sendiri lolos';exception when others then if sqlerrm not like 'Akses sendiri%' then raise;end if;end;
end $$;
rollback;
