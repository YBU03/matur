-- Keep the login hash; Vault holds the recoverable copy for authorized outlet admins.
create extension if not exists supabase_vault with schema vault;
alter table matur_internal.pos_outlet_akses add column password_secret_id uuid;

create function matur_internal.simpan_sandi_pos(o uuid, sandi text) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 select password_secret_id into sid from matur_internal.pos_outlet_akses where outlet_id=o for update;
 if sid is null then
  sid:=vault.create_secret(sandi);
  update matur_internal.pos_outlet_akses set password_secret_id=sid where outlet_id=o;
 else
  perform vault.update_secret(sid,sandi);
 end if;
end $$;
revoke all on function matur_internal.simpan_sandi_pos(uuid,text) from public,anon,authenticated;

-- Forget the recoverable copy whenever any credential writer changes/removes the hash.
create function matur_internal.bersihkan_sandi_pos() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or new.password_hash is distinct from old.password_hash or new.deleted_at is not null then
  delete from vault.secrets where id=old.password_secret_id;
  if tg_op='UPDATE' then new.password_secret_id:=null;end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;
revoke all on function matur_internal.bersihkan_sandi_pos() from public,anon,authenticated;
create trigger bersihkan_sandi_pos before update or delete on matur_internal.pos_outlet_akses
for each row execute function matur_internal.bersihkan_sandi_pos();

-- Preserve the existing validation, lease revocation and audit behavior.
do $$ declare d text; needle text;begin
 d:=pg_get_functiondef('public.atur_akses_pos_outlet(uuid,text,text,boolean)'::regprocedure);
 needle:=' if not p_aktif or coalesce(p_password,';
 if position(needle in d)=0 then raise exception 'Definisi pengaturan akses POS berubah';end if;
 d:=replace(d,needle,E' if coalesce(p_password,\'\')<>\'\' then perform matur_internal.simpan_sandi_pos(p_outlet,p_password);end if;\n'||needle);
 execute d;
 -- Capture the *same* password on a successful POS login. Do not rotate credentials or leases.
 d:=pg_get_functiondef('public.masuk_pos_outlet(text,text,text,text)'::regprocedure);
 needle:='where username=lower(trim(p_username)) and aktif;';
 if position(needle in d)=0 then raise exception 'Definisi login POS berubah';end if;
 d:=replace(d,needle,'where username=lower(trim(p_username)) and aktif and deleted_at is null for update;');
 needle:='  return jsonb_build_object(''email'', v_email';
 if position(needle in d)=0 then raise exception 'Hasil login POS berubah';end if;
 d:=replace(d,needle,E'  if cred.password_secret_id is null then perform matur_internal.simpan_sandi_pos(o,p_sandi);end if;\n'||needle);
 execute d;
end $$;

create or replace function public.panel_akses_pos_outlet() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nama',o.nama,'username',a.username,'aktif',coalesce(a.aktif,false),'diubah_at',a.diubah_at,'sandi_tersimpan',a.password_secret_id is not null) order by o.nama),'[]')
 from public.outlet o left join matur_internal.pos_outlet_akses a on a.outlet_id=o.id and a.deleted_at is null
 where o.deleted_at is null and matur_internal.admin_pos_outlet(o.id)
$$;

create function public.lihat_sandi_pos_outlet(p_outlet uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a matur_internal.pos_outlet_akses;sandi text;
begin
 if not matur_internal.admin_pos_outlet(p_outlet) then raise exception 'Tidak berwenang melihat sandi outlet ini';end if;
 select * into a from matur_internal.pos_outlet_akses where outlet_id=p_outlet and deleted_at is null for update;
 if a.outlet_id is null then raise exception 'Akses POS tidak ditemukan';end if;
 if a.password_secret_id is null then return jsonb_build_object('belum_tersimpan',true);end if;
 select decrypted_secret into sandi from vault.decrypted_secrets where id=a.password_secret_id;
 if sandi is null then raise exception 'Sandi belum dapat ditampilkan';end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id)
 values(auth.uid(),'lihat_sandi_pos_outlet','outlet',p_outlet::text);
 return jsonb_build_object('sandi',sandi);
end $$;

-- Existing known password can be enrolled without changing the hash, version or device permits.
create function public.simpan_sandi_pos_lama(p_outlet uuid,p_sandi text,p_versi timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a matur_internal.pos_outlet_akses;
begin
 if not matur_internal.admin_pos_outlet(p_outlet) then raise exception 'Tidak berwenang mengelola sandi outlet ini';end if;
 select * into a from matur_internal.pos_outlet_akses where outlet_id=p_outlet and deleted_at is null for update;
 if a.outlet_id is null then raise exception 'Akses POS tidak ditemukan';end if;
 if p_versi is null or a.diubah_at is distinct from p_versi then raise exception 'Akses sudah berubah. Muat ulang daftar';end if;
 if (select count(*) from matur_internal.pos_login_gagal where username=a.username and at>now()-interval '15 minutes')>=8 then
  return jsonb_build_object('error','Terlalu banyak percobaan. Coba lagi 15 menit lagi.');end if;
 if coalesce(p_sandi,'')='' or octet_length(p_sandi)>72 or extensions.crypt(p_sandi,a.password_hash)<>a.password_hash then
  insert into matur_internal.pos_login_gagal(username) values(a.username);
  return jsonb_build_object('error','Sandi tidak cocok dengan password POS saat ini. Tidak ada perubahan.');
 end if;
 perform matur_internal.simpan_sandi_pos(p_outlet,p_sandi);
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id)
 values(auth.uid(),'simpan_sandi_pos_lama','outlet',p_outlet::text);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.lihat_sandi_pos_outlet(uuid),public.simpan_sandi_pos_lama(uuid,text,timestamptz) from public,anon;
grant execute on function public.lihat_sandi_pos_outlet(uuid),public.simpan_sandi_pos_lama(uuid,text,timestamptz) to authenticated;
