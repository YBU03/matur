-- Pendaftar pertama (saat belum ada Owner aktif) otomatis menjadi Owner / Super Admin.
-- Pendaftar berikutnya berstatus 'menunggu'; peran & outlet ditentukan admin saat ACC.
create or replace function daftar_akun(p_nama text, p_email text, p_hp text, p_password text, p_permintaan jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid(); v_email text := lower(trim(p_email)); v_owner boolean;
begin
  if length(trim(coalesce(p_nama, ''))) < 2 or length(p_nama) > 100 then raise exception 'Nama wajib diisi'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 or v_email like '%@pin.matur.id' then
    raise exception 'Format email tidak valid';
  end if;
  if length(coalesce(p_password, '')) < 8 or length(p_password) > 72 then raise exception 'Password minimal 8 karakter'; end if;
  perform pg_advisory_xact_lock(hashtext('daftar_akun'));  -- dua pendaftar bersamaan tidak sama-sama jadi owner
  if exists (select 1 from auth.users where email = v_email) then raise exception 'Email sudah terdaftar'; end if;
  v_owner := not exists (select 1 from penugasan t join pengguna u on u.id = t.pengguna_id where t.peran = 'owner' and u.status = 'aktif');

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nama', trim(p_nama)), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', v_email), 'email', now(), now(), now());
  insert into pengguna (id, nama, email, no_hp, status, permintaan)
  values (uid, trim(p_nama), v_email, nullif(left(trim(coalesce(p_hp, '')), 20), ''),
          case when v_owner then 'aktif' else 'menunggu' end,
          jsonb_build_object('catatan', left(p_permintaan->>'catatan', 300)));
  if v_owner then
    insert into penugasan (pengguna_id, peran, outlet_id) values (uid, 'owner', null), (uid, 'admin_pusat', null);
  end if;
end $$;
revoke execute on function daftar_akun(text, text, text, text, jsonb) from public;
grant execute on function daftar_akun(text, text, text, text, jsonb) to anon, authenticated;
