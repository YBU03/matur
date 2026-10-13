-- HRD & Admin Gudang mengelola akun kasir/barista (staf outlet): buat akun, ganti PIN, aktif/nonaktif,
-- dan menyetujui pendaftar yang menandai dirinya karyawan outlet. Peran lain tetap hanya Owner/Admin Pusat.

-- akun yang perannya hanya kasir/barista (bukan merangkap peran lain)
create or replace function staf_outlet(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from penugasan where pengguna_id = p_uid and peran in ('kasir','barista'))
     and not exists (select 1 from penugasan where pengguna_id = p_uid and peran not in ('kasir','barista'))
$$;
create or replace function pengelola_staf() returns boolean
language sql stable security definer set search_path = public as $$
  select punya_peran('{hrd,admin_gudang}')
$$;
revoke execute on function staf_outlet(uuid) from public, anon;
revoke execute on function pengelola_staf() from public, anon;
grant execute on function staf_outlet(uuid) to authenticated;
grant execute on function pengelola_staf() to authenticated;

create or replace function buat_pengguna(p_email text, p_password text, p_nama text, p_peran peran, p_outlet uuid) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid();
begin
  if not (punya_peran('{owner}') or (pengelola_staf() and p_peran in ('kasir','barista'))) then
    raise exception 'Tidak diizinkan membuat akun dengan peran ini';
  end if;
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'Email/kode sudah dipakai';
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', lower(p_email),
    crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nama', p_nama), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', lower(p_email)), 'email', now(), now(), now());
  insert into pengguna (id, nama, email) values (uid, p_nama, lower(p_email));
  insert into penugasan (pengguna_id, peran, outlet_id) values (uid, p_peran, p_outlet);
  return uid;
end $$;

create or replace function atur_password(p_uid uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (punya_peran('{owner}') or p_uid = auth.uid() or (pengelola_staf() and staf_outlet(p_uid))) then
    raise exception 'Tidak diizinkan';
  end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_uid;
end $$;

create or replace function atur_status_staf(p_uid uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('aktif','nonaktif') then raise exception 'Status tidak valid'; end if;
  if p_uid = auth.uid() then raise exception 'Tidak bisa mengubah status akun sendiri'; end if;
  if not (pengelola_staf() and staf_outlet(p_uid)) then raise exception 'Hanya untuk akun kasir/barista'; end if;
  update pengguna set status = p_status where id = p_uid and status in ('aktif','nonaktif');
end $$;

-- pendaftar yang menandai "karyawan outlet (kasir/barista)"
create or replace function setujui_staf(p_uid uuid, p_peran peran, p_outlet uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pengelola_staf() then raise exception 'Tidak diizinkan'; end if;
  if p_peran not in ('kasir','barista') then raise exception 'HRD/Gudang hanya bisa memberi peran Kasir atau Barista'; end if;
  if p_outlet is null then raise exception 'Pilih outlet'; end if;
  if not exists (select 1 from pengguna where id = p_uid and status = 'menunggu' and permintaan->>'jenis' = 'staf_outlet') then
    raise exception 'Pendaftar ini bukan karyawan outlet atau sudah diproses';
  end if;
  update pengguna set status = 'aktif' where id = p_uid;
  insert into penugasan (pengguna_id, peran, outlet_id) values (p_uid, p_peran, p_outlet);
end $$;

create or replace function tolak_staf(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pengelola_staf() then raise exception 'Tidak diizinkan'; end if;
  update pengguna set status = 'ditolak' where id = p_uid and status = 'menunggu' and permintaan->>'jenis' = 'staf_outlet';
  if not found then raise exception 'Pendaftar ini bukan karyawan outlet atau sudah diproses'; end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['atur_status_staf(uuid, text)','setujui_staf(uuid, peran, uuid)','tolak_staf(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- baca: HRD & Gudang melihat akun staf outlet dan pendaftar karyawan outlet
create policy baca_staf on pengguna for select to authenticated using (
  pengelola_staf() and (staf_outlet(id) or (status = 'menunggu' and permintaan->>'jenis' = 'staf_outlet'))
);
create policy baca_staf on penugasan for select to authenticated using (pengelola_staf() and peran in ('kasir','barista'));
-- tambah/cabut peran kasir/barista pada akun staf
create policy tambah_staf on penugasan for insert to authenticated
  with check (pengelola_staf() and peran in ('kasir','barista') and staf_outlet(pengguna_id));
create policy cabut_staf on penugasan for delete to authenticated
  using (pengelola_staf() and peran in ('kasir','barista') and staf_outlet(pengguna_id));

-- daftar akun staf outlet (untuk halaman Akun Kasir & Barista)
create or replace function id_staf_outlet() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct t.pengguna_id from penugasan t
  where (pengelola_staf() or punya_peran('{owner,admin_pusat}')) and staf_outlet(t.pengguna_id)
$$;
revoke execute on function id_staf_outlet() from public, anon;
grant execute on function id_staf_outlet() to authenticated;

-- daftar_akun: simpan penanda "karyawan outlet" (jenis = staf_outlet) di permintaan
-- (lihat definisi lengkap di database; hanya kolom permintaan yang berubah)
