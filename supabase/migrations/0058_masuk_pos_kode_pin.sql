-- Tablet POS masuk langsung dengan kode staf + PIN (tanpa pemasangan oleh admin/HRD).
-- Staf yang bertugas di outlet (kasir/barista/SPV) memasukkan kode + PIN di /pos; sistem membuat/memakai ulang
-- akun tablet tersembunyi untuk perangkat itu dan mengaktifkannya untuk outlet staf tersebut.
create or replace function public.masuk_pos_tablet(p_kode text, p_pin text, p_outlet uuid, p_rahasia text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid; h text; v_nama text; outlets jsonb; o uuid; v_outlet text; dev pos_perangkat; akun uuid; v_email text;
  hash_dev text := encode(digest(coalesce(p_rahasia,''),'sha256'),'hex');
begin
  if length(coalesce(p_rahasia,'')) < 40 or length(coalesce(p_password,'')) < 24 then return jsonb_build_object('error','Identitas perangkat tidak valid'); end if;
  -- batas umum percobaan dari perangkat tanpa akun (cegah tebak kode/PIN massal)
  if (select count(*) from matur_internal.pos_pin_gagal where pengguna_id is null and at > now() - interval '15 minutes') >= 50 then
    return jsonb_build_object('error','Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi.');
  end if;
  select p.pengguna_id, p.pin_hash, u.nama into uid, h, v_nama
    from matur_internal.pos_pin p join pengguna u on u.id = p.pengguna_id and u.status = 'aktif' and not u.akun_tablet
   where p.kode = lower(trim(coalesce(p_kode,'')));
  if uid is null then
    insert into matur_internal.pos_pin_gagal(pengguna_id, perangkat_id) values (null, null);
    return jsonb_build_object('error','Kode staf atau PIN salah.');
  end if;
  if (select count(*) from matur_internal.pos_pin_gagal where pengguna_id = uid and at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('error','PIN dikunci 15 menit setelah 5 kali salah.');
  end if;
  if h is null or coalesce(p_pin,'') !~ '^[0-9]{4,6}$' or h <> crypt(p_pin, h) then
    insert into matur_internal.pos_pin_gagal(pengguna_id, perangkat_id) values (uid, null);
    return jsonb_build_object('error','Kode staf atau PIN salah.');
  end if;

  select coalesce(jsonb_agg(distinct jsonb_build_object('id', x.id, 'nama', x.nama)), '[]') into outlets
    from penugasan t join outlet x on x.id = t.outlet_id and x.deleted_at is null
   where t.pengguna_id = uid and t.peran in ('kasir','barista','spv');
  if jsonb_array_length(outlets) = 0 then return jsonb_build_object('error','Akun ini tidak bertugas di outlet mana pun. Hubungi HRD.'); end if;
  if p_outlet is null then
    if jsonb_array_length(outlets) > 1 then return jsonb_build_object('pilih', outlets, 'nama', v_nama); end if;
    o := (outlets->0->>'id')::uuid;
  else
    if not exists (select 1 from penugasan where pengguna_id = uid and outlet_id = p_outlet and peran in ('kasir','barista','spv')) then
      return jsonb_build_object('error','Anda tidak bertugas di outlet tersebut.');
    end if;
    o := p_outlet;
  end if;
  select nama into v_outlet from outlet where id = o;

  -- perangkat yang sama (cookie) dipakai ulang; berpindah outlet hanya bila staf bertugas di outlet baru
  select d.* into dev from pos_perangkat d join matur_internal.pos_perangkat_rahasia r on r.perangkat_id = d.id where r.hash = hash_dev;
  if dev.id is not null and dev.status = 'dicabut' then
    return jsonb_build_object('error','Tablet ini dicabut aksesnya oleh admin. Hubungi HRD/Admin Gudang.');
  end if;
  if dev.id is not null and dev.akun_id is not null then
    akun := dev.akun_id;
    if dev.outlet_id <> o then
      update pos_perangkat set outlet_id = o, diubah_at = now() where id = dev.id;
      update penugasan set outlet_id = o where pengguna_id = akun and peran = 'tablet';
    end if;
    update pos_perangkat set status = 'aktif', diubah_at = now() where id = dev.id;
    update pengguna set status = 'aktif' where id = akun;
  else
    if (select count(*) from pos_perangkat where outlet_id = o and status = 'aktif' and akun_id is not null) >= 10 then
      return jsonb_build_object('error','Batas 10 tablet aktif per outlet tercapai. Minta admin mencabut tablet lama.');
    end if;
    akun := gen_random_uuid();
    v_email := 'tablet-' || substr(replace(akun::text,'-',''),1,12) || '@tablet.matur.id';
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', akun, 'authenticated', 'authenticated', v_email,
      crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nama', 'Tablet ' || v_outlet), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), akun, akun::text, jsonb_build_object('sub', akun::text, 'email', v_email), 'email', now(), now(), now());
    insert into pengguna (id, nama, email, status, akun_tablet) values (akun, 'Tablet ' || v_outlet, v_email, 'aktif', true);
    insert into penugasan (pengguna_id, peran, outlet_id) values (akun, 'tablet', o);
    if dev.id is null then
      insert into pos_perangkat (outlet_id, nama, status, diminta_oleh, disetujui_oleh, mode, akun_id)
        values (o, 'Tablet ' || v_outlet, 'aktif', uid, uid, 'kasir', akun) returning * into dev;
      insert into matur_internal.pos_perangkat_rahasia values (dev.id, hash_dev);
    else
      update pos_perangkat set outlet_id = o, akun_id = akun, status = 'aktif', diubah_at = now() where id = dev.id;
    end if;
  end if;
  select email into v_email from pengguna where id = akun;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = akun;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru)
    values (uid, 'masuk_tablet_pos', 'pos_perangkat', dev.id::text, jsonb_build_object('outlet', v_outlet));
  return jsonb_build_object('email', v_email, 'outlet_id', o, 'outlet', v_outlet, 'nama', v_nama, 'uid', uid);
end $$;
revoke all on function masuk_pos_tablet(text,text,uuid,text,text) from public;
grant execute on function masuk_pos_tablet(text,text,uuid,text,text) to anon, authenticated;
