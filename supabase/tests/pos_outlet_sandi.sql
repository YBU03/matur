-- Run against a migrated database with an active owner/admin. All fixtures are rolled back.
-- Never select or log actual outlet passwords.
begin;
do $$
declare
 admin uuid; staf uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); other_o uuid:=gen_random_uuid();
 un text:='test-'||replace(o::text,'-',''); r jsonb; before_hash text; before_version timestamptz;
 sid uuid; old_sid uuid; n bigint; denied boolean;
begin
 select u.id into admin from public.pengguna u join public.penugasan t on t.pengguna_id=u.id
 where u.status='aktif' and t.peran in ('owner','admin_pusat') limit 1;
 if admin is null then raise exception 'Test requires an active central admin';end if;
 insert into public.outlet(id,nama) values(o,'Test sandi POS rollback'),(other_o,'Test outlet lain rollback');
 insert into auth.users(id,email) values(staf,staf::text||'@test.invalid');
 insert into public.pengguna(id,nama,email,status) values(staf,'Test HRD rollback',staf::text||'@test.invalid','aktif');
 insert into public.penugasan(pengguna_id,peran,outlet_id) values(staf,'hrd',o);
 perform set_config('request.jwt.claim.sub',admin::text,true);
 perform public.atur_akses_pos_outlet(o,un,'Test-POS-password-123',true);
 perform public.atur_akses_pos_outlet(other_o,un||'-2','Test-other-password-123',true);
 r:=public.lihat_sandi_pos_outlet(o);
 if r->>'sandi'<>'Test-POS-password-123' then raise exception 'New password roundtrip failed';end if;
 select password_secret_id into old_sid from matur_internal.pos_outlet_akses where outlet_id=o;
 if exists(select 1 from vault.secrets where id=old_sid and secret='Test-POS-password-123') then raise exception 'Secret stored unencrypted';end if;
 if public.panel_akses_pos_outlet()::text like '%Test-POS-password-123%' then raise exception 'List leaks password';end if;
 if exists(select 1 from public.log_aktivitas where entitas_id=o::text and (coalesce(nilai_baru::text,'')||coalesce(nilai_lama::text,'')) like '%Test-POS-password-123%') then raise exception 'Audit leaks password';end if;
 if not exists(select 1 from public.log_aktivitas where entitas_id=o::text and aksi='lihat_sandi_pos_outlet' and pengguna_id=admin) then raise exception 'Reveal audit missing';end if;
 -- Editing only username/status must preserve the recoverable password.
 perform public.atur_akses_pos_outlet(o,un,'',true);
 r:=public.lihat_sandi_pos_outlet(o);
 if r->>'sandi'<>'Test-POS-password-123' then raise exception 'Empty password edit lost secret';end if;
 -- Authorized HRD can reveal only their assigned outlet.
 perform set_config('request.jwt.claim.sub',staf::text,true);
 r:=public.lihat_sandi_pos_outlet(o);
 if r->>'sandi'<>'Test-POS-password-123' then raise exception 'Assigned HRD cannot reveal';end if;
 denied:=false;
 begin perform public.lihat_sandi_pos_outlet(other_o);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'HRD can read another outlet';end if;
 update public.pengguna set status='nonaktif' where id=staf;
 denied:=false;
 begin perform public.lihat_sandi_pos_outlet(o);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Inactive admin can reveal';end if;
 update public.pengguna set status='aktif' where id=staf;
 update public.penugasan set peran='barista' where pengguna_id=staf;
 denied:=false;
 begin perform public.lihat_sandi_pos_outlet(o);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Barista can reveal';end if;
 perform set_config('request.jwt.claim.sub','',true);
 denied:=false;
 begin perform public.lihat_sandi_pos_outlet(o);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Missing identity can reveal';end if;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 -- Simulate an existing hash-only credential, as stored before this migration.
 update matur_internal.pos_outlet_akses set password_hash=extensions.crypt('Test-POS-password-123',extensions.gen_salt('bf')) where outlet_id=o;
 if exists(select 1 from vault.secrets where id=old_sid) then raise exception 'Old secret not removed on hash change';end if;
 select password_hash,diubah_at into before_hash,before_version from matur_internal.pos_outlet_akses where outlet_id=o;
 r:=public.lihat_sandi_pos_outlet(o);
 if r->>'belum_tersimpan'<>'true' then raise exception 'Legacy credential status incorrect';end if;
 r:=public.simpan_sandi_pos_lama(o,'Incorrect-password',before_version);
 if r->>'error' is null then raise exception 'Incorrect legacy password accepted';end if;
 if (select password_secret_id from matur_internal.pos_outlet_akses where outlet_id=o) is not null then raise exception 'Incorrect password stored';end if;
 r:=public.simpan_sandi_pos_lama(o,'Test-POS-password-123',before_version);
 if r->>'ok'<>'true' then raise exception 'Same password enrollment failed';end if;
 if exists(select 1 from matur_internal.pos_outlet_akses where outlet_id=o and (password_hash<>before_hash or diubah_at<>before_version)) then raise exception 'Enrollment rotated login credentials';end if;
 r:=public.lihat_sandi_pos_outlet(o);
 if r->>'sandi'<>'Test-POS-password-123' then raise exception 'Legacy roundtrip failed';end if;
 -- Failed enrollment is rate limited and version protected.
 denied:=false;
 begin perform public.simpan_sandi_pos_lama(o,'Test-POS-password-123',before_version-interval '1 second');exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Stale version accepted';end if;
 for i in 1..8 loop perform public.simpan_sandi_pos_lama(o,'Incorrect-password',before_version);end loop;
 r:=public.simpan_sandi_pos_lama(o,'Test-POS-password-123',before_version);
 if r->>'error' not like 'Terlalu banyak%' then raise exception 'Rate limit missing';end if;
 -- Successful POS login captures the same legacy password without changing credential version.
 update matur_internal.pos_outlet_akses set password_hash=extensions.crypt('Test-other-password-123',extensions.gen_salt('bf')) where outlet_id=other_o;
 select password_hash,diubah_at into before_hash,before_version from matur_internal.pos_outlet_akses where outlet_id=other_o;
 perform set_config('request.jwt.claim.sub','',true);
 r:=public.masuk_pos_outlet(un||'-2','Test-other-password-123',repeat('x',64),repeat('z',48));
 if r->>'email' is null then raise exception 'POS login failed: %',r->>'error';end if;
 if exists(select 1 from matur_internal.pos_outlet_akses where outlet_id=other_o and (password_hash<>before_hash or diubah_at<>before_version or password_secret_id is null)) then raise exception 'Login capture failed or changed credentials';end if;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 r:=public.lihat_sandi_pos_outlet(other_o);
 if r->>'sandi'<>'Test-other-password-123' then raise exception 'Login captured wrong password';end if;
 -- Editing credentials replaces encrypted copy; delete removes it.
 perform public.atur_akses_pos_outlet(o,un,'Replacement-POS-123',true);
 r:=public.lihat_sandi_pos_outlet(o);
 if r->>'sandi'<>'Replacement-POS-123' then raise exception 'Updated secret stale';end if;
 select password_secret_id,diubah_at into sid,before_version from matur_internal.pos_outlet_akses where outlet_id=o;
 perform public.hapus_akses_pos_outlet(o,before_version);
 if exists(select 1 from vault.secrets where id=sid) then raise exception 'Deleted login retains secret';end if;
 if has_function_privilege('anon','public.lihat_sandi_pos_outlet(uuid)','execute') or has_table_privilege('authenticated','vault.decrypted_secrets','select') or has_function_privilege('authenticated','matur_internal.simpan_sandi_pos(uuid,text)','execute') then raise exception 'Privileges too broad';end if;
end $$;
select 'PASS: encryption, reveal audit, outlet scope, roles/status, legacy enrollment, throttling, login capture, edit/delete cleanup, grants' as result;
rollback;
