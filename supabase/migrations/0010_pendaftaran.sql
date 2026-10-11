-- Daftar akun mandiri + persetujuan admin. Akun baru berstatus 'menunggu' dan tidak punya
-- penugasan, jadi RLS tidak memberi akses apa pun sampai disetujui.

alter table pengguna
  add column status text not null default 'aktif' check (status in ('menunggu','aktif','ditolak','nonaktif')),
  add column permintaan jsonb;  -- {portal, peran, outlet, catatan} yang diisi saat mendaftar

-- Hak akses hanya berlaku untuk pengguna berstatus aktif (akun nonaktif langsung terkunci)
create or replace function punya_peran(p peran[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from penugasan t join pengguna u on u.id = t.pengguna_id
                 where t.pengguna_id = auth.uid() and u.status = 'aktif' and t.peran = any(p));
$$;

create or replace function boleh_outlet(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from penugasan t
    join pengguna u on u.id = t.pengguna_id and u.status = 'aktif'
    left join outlet x on x.id = o
    where t.pengguna_id = auth.uid()
      and (t.outlet_id = o
           or (t.outlet_id is null and t.peran in ('owner','finance','hrd','admin_pusat','admin_gudang'))
           or (t.peran = 'manajer_area' and t.area_id = x.area_id))
  );
$$;

create or replace function peran_di_outlet(p_outlet uuid, p peran[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from penugasan t join pengguna u on u.id = t.pengguna_id
                 where t.pengguna_id = auth.uid() and u.status = 'aktif' and t.outlet_id = p_outlet and t.peran = any(p));
$$;

-- Admin Pusat juga mengelola pendaftar (selain owner)
create policy baca_penugasan_admin on penugasan for select to authenticated
  using (punya_peran('{admin_pusat}'));
create policy ubah_status_pengguna on pengguna for update to authenticated
  using (punya_peran('{admin_pusat}') and not exists (select 1 from penugasan t where t.pengguna_id = pengguna.id and t.peran = 'owner'))
  with check (punya_peran('{admin_pusat}'));

-- Pendaftaran publik (dipanggil dari halaman daftar, tanpa login)
create or replace function daftar_akun(p_nama text, p_email text, p_hp text, p_password text, p_permintaan jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid(); v_email text := lower(trim(p_email));
begin
  if length(trim(coalesce(p_nama, ''))) < 2 or length(p_nama) > 100 then raise exception 'Nama wajib diisi'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 or v_email like '%@pin.matur.id' then
    raise exception 'Format email tidak valid';
  end if;
  if length(coalesce(p_password, '')) < 8 or length(p_password) > 72 then raise exception 'Password minimal 8 karakter'; end if;
  if exists (select 1 from auth.users where email = v_email) then raise exception 'Email sudah terdaftar'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nama', trim(p_nama)), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', v_email), 'email', now(), now(), now());
  insert into pengguna (id, nama, email, no_hp, status, permintaan)
  values (uid, trim(p_nama), v_email, nullif(left(trim(coalesce(p_hp, '')), 20), ''), 'menunggu',
          jsonb_build_object('portal', left(p_permintaan->>'portal', 20), 'peran', left(p_permintaan->>'peran', 30),
                             'outlet', left(p_permintaan->>'outlet', 100), 'catatan', left(p_permintaan->>'catatan', 300)));
end $$;

-- ACC: tetapkan peran + outlet. Hanya owner yang boleh memberi peran owner.
create or replace function setujui_pengguna(p_uid uuid, p_peran peran, p_outlet uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u pengguna;
begin
  if not punya_peran('{owner,admin_pusat}') then raise exception 'Hanya Owner/Admin Pusat'; end if;
  if p_peran = 'owner' and not punya_peran('{owner}') then raise exception 'Hanya Owner yang bisa memberi peran Owner'; end if;
  select * into u from pengguna where id = p_uid;
  if u.id is null then raise exception 'Pengguna tidak ditemukan'; end if;
  if p_peran not in ('owner','finance','hrd','admin_pusat','admin_gudang') and p_outlet is null then
    raise exception 'Peran ini wajib memilih outlet';
  end if;
  update pengguna set status = 'aktif' where id = p_uid;
  if p_peran in ('owner','finance','hrd','admin_pusat','admin_gudang') then p_outlet := null; end if;
  if not exists (select 1 from penugasan where pengguna_id = p_uid and peran = p_peran and outlet_id is not distinct from p_outlet) then
    insert into penugasan (pengguna_id, peran, outlet_id) values (p_uid, p_peran, p_outlet);
  end if;
  -- mitra otomatis punya data mitra agar bisa dihubungkan ke perjanjian
  if p_peran = 'mitra' and not exists (select 1 from mitra where pengguna_id = p_uid) then
    insert into mitra (pengguna_id, nama, email, no_hp) values (p_uid, u.nama, u.email, u.no_hp);
  end if;
end $$;

create or replace function tolak_pengguna(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not punya_peran('{owner,admin_pusat}') then raise exception 'Hanya Owner/Admin Pusat'; end if;
  update pengguna set status = 'ditolak' where id = p_uid and status = 'menunggu';
end $$;

revoke execute on function setujui_pengguna(uuid, peran, uuid) from public, anon;
revoke execute on function tolak_pengguna(uuid) from public, anon;
grant execute on function setujui_pengguna(uuid, peran, uuid) to authenticated;
grant execute on function tolak_pengguna(uuid) to authenticated;
revoke execute on function daftar_akun(text, text, text, text, jsonb) from public;
grant execute on function daftar_akun(text, text, text, text, jsonb) to anon, authenticated;

-- log aman untuk tabel tanpa kolom deleted_at (mis. pengguna)
create or replace function catat_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare lama jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
        baru jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  insert into log_aktivitas (pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (
    auth.uid(),
    case
      when tg_op = 'INSERT' then 'create'
      when tg_op = 'DELETE' then 'purge'
      when lama->>'deleted_at' is null and baru->>'deleted_at' is not null then 'delete'
      when lama->>'deleted_at' is not null and baru->>'deleted_at' is null then 'restore'
      else 'update'
    end,
    tg_table_name, coalesce(baru->>'id', lama->>'id'), lama, baru
  );
  return coalesce(new, old);
end $$;
revoke execute on function catat_log() from public, anon, authenticated;

create trigger log_pengguna after update on pengguna for each row execute function catat_log();
