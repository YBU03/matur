-- Data awal Matur. Ganti {{PASSWORD}} dan {{PIN_PEPPER}} sebelum dijalankan.
-- Akun kasir/barista login dengan PIN: password Supabase = 'pin:' || PIN || ':' || PIN_PEPPER.

create or replace function pg_temp.buat_akun(p_email text, p_pw text, p_nama text) returns uuid
language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_pw, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('nama', p_nama), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', p_email), 'email', now(), now(), now());
  insert into public.pengguna (id, nama, email) values (uid, p_nama, p_email);
  return uid;
end $$;

do $$
declare
  pw text := '{{PASSWORD}}';
  pep text := '{{PIN_PEPPER}}';
  o1 uuid; o2 uuid; m1 uuid;
  owner uuid; fin uuid; hrd uuid; gdg uuid; spv uuid; ksr uuid; brs uuid; mtr uuid; pic uuid;
begin
  insert into perusahaan (nama, kota_terbit) values ('CV. Hazna Berkah Indonesia', 'Purbalingga');

  insert into outlet (nama, kota, tgl_mulai, jam_operasional, status)
    values ('Ruma Kopiaksa', 'Purbalingga', '2025-01-01', '08.00 - 22.00', 'operasional') returning id into o1;
  insert into outlet (nama, kota, status) values ('Ruma Outlet 2', 'Purwokerto', 'pembangunan') returning id into o2;

  owner := pg_temp.buat_akun('owner@matur.id', pw, 'Owner Hazna');
  fin   := pg_temp.buat_akun('finance@matur.id', pw, 'Nurfaika');
  hrd   := pg_temp.buat_akun('hrd@matur.id', pw, 'HRD Pusat');
  gdg   := pg_temp.buat_akun('gudang@matur.id', pw, 'Admin Gudang');
  spv   := pg_temp.buat_akun('spv@matur.id', pw, 'SPV Kopiaksa');
  mtr   := pg_temp.buat_akun('mitra@matur.id', pw, 'Dwi Suyoko');
  pic   := pg_temp.buat_akun('pic@matur.id', pw, 'PIC Kontraktor');
  ksr   := pg_temp.buat_akun('kasir1@pin.matur.id', 'pin:1234:' || pep, 'Kasir Satu');
  brs   := pg_temp.buat_akun('barista1@pin.matur.id', 'pin:5678:' || pep, 'Barista Satu');

  insert into penugasan (pengguna_id, peran, outlet_id) values
    (owner, 'owner', null), (owner, 'admin_pusat', null),
    (fin, 'finance', null), (hrd, 'hrd', null), (gdg, 'admin_gudang', null),
    (spv, 'spv', o1), (spv, 'spv', o2),
    (ksr, 'kasir', o1), (brs, 'barista', o1),
    (mtr, 'mitra', o1), (pic, 'pic', o2);

  update outlet set spv_id = spv, pj_laporan_id = fin where id = o1;

  insert into mitra (pengguna_id, nama, email) values (mtr, 'Dwi Suyoko', 'mitra@matur.id') returning id into m1;
  insert into perjanjian (mitra_id, outlet_id, sewa_bulanan) values (m1, o1, 1416667);

  insert into karyawan (pengguna_id, outlet_id, nama, jabatan, is_spv) values
    (spv, o1, 'SPV Kopiaksa', 'Kepala Outlet', true),
    (ksr, o1, 'Kasir Satu', 'Kasir', false),
    (brs, o1, 'Barista Satu', 'Barista', false);
end $$;
