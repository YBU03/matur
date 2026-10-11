-- Matur · Tahap 3: kelola pengguna (tanpa service key) + POS kasir & antrean barista.

-- ---------- Pengguna ----------
-- Membuat akun Supabase Auth dari aplikasi; hanya owner (HRD untuk kasir/barista).
-- Untuk akun PIN, server aplikasi mengirim password = 'pin:' || PIN || ':' || PIN_PEPPER.
create or replace function buat_pengguna(p_email text, p_password text, p_nama text, p_peran peran, p_outlet uuid)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid();
begin
  if not (punya_peran('{owner}') or (punya_peran('{hrd}') and p_peran in ('kasir','barista'))) then
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

create or replace function atur_password(p_uid uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (punya_peran('{owner}') or p_uid = auth.uid()
          or (punya_peran('{hrd}') and exists (select 1 from penugasan where pengguna_id = p_uid and peran in ('kasir','barista')))) then
    raise exception 'Tidak diizinkan';
  end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_uid;
end $$;

revoke execute on function buat_pengguna(text, text, text, peran, uuid) from public, anon;
revoke execute on function atur_password(uuid, text) from public, anon;
grant execute on function buat_pengguna(text, text, text, peran, uuid) to authenticated;
grant execute on function atur_password(uuid, text) to authenticated;

create trigger log_penugasan after insert or delete on penugasan for each row execute function catat_log();

-- ---------- POS ----------
alter table perusahaan add column batas_diskon_persen int not null default 10;  -- POS-04, bisa diubah owner

create type kanal_jual as enum ('langsung','gofood','grabfood','shopeefood','tiktok','ruma_app','tumbler');
create type metode_bayar as enum ('tunai','qris','debit','transfer');
create type status_pesanan as enum ('baru','diproses','siap','diambil');

create table sesi_kas (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  outlet_id uuid not null references outlet,
  kasir_id uuid not null references pengguna,
  dibuka_at timestamptz not null default now(),
  modal_laci bigint not null default 0,
  ditutup_at timestamptz,
  setoran bigint, seharusnya bigint, selisih bigint
);
create unique index sesi_kas_terbuka on sesi_kas (outlet_id, kasir_id) where ditutup_at is null;

create table transaksi (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  client_id uuid unique,                 -- idempotensi untuk sinkron offline (POS-08)
  outlet_id uuid not null references outlet,
  sesi_kas_id uuid not null references sesi_kas,
  nomor int not null,
  kanal kanal_jual not null,
  tipe text not null default 'dine_in' check (tipe in ('dine_in','take_away')),
  pelanggan text, meja text, catatan text,
  subtotal bigint not null,
  diskon bigint not null default 0,
  total bigint not null,
  hpp_teoritis bigint not null default 0,
  status text not null default 'lunas' check (status in ('lunas','void')),
  status_pesanan status_pesanan not null default 'baru',
  dibuat_oleh uuid references pengguna default auth.uid(),
  created_at timestamptz not null default now()
);
create index on transaksi (outlet_id, created_at);

create table item_transaksi (
  id uuid primary key default gen_random_uuid(),
  transaksi_id uuid not null references transaksi on delete cascade,
  menu_id uuid not null references menu,
  varian_ids uuid[] not null default '{}',
  nama text not null,                    -- snapshot nama + varian
  qty int not null check (qty > 0),
  harga bigint not null,                 -- harga satuan termasuk varian
  hpp_teoritis bigint not null default 0,
  catatan text
);

create table pembayaran (
  id uuid primary key default gen_random_uuid(),
  transaksi_id uuid not null references transaksi on delete cascade,
  metode metode_bayar not null,
  nominal bigint not null,
  diterima bigint                        -- uang diterima (tunai), untuk kembalian
);

alter table sesi_kas enable row level security;
alter table transaksi enable row level security;
alter table item_transaksi enable row level security;
alter table pembayaran enable row level security;
create policy baca on sesi_kas for select to authenticated using (boleh_outlet(outlet_id));
create policy baca on transaksi for select to authenticated using (boleh_outlet(outlet_id));
create policy baca on item_transaksi for select to authenticated
  using (exists (select 1 from transaksi t where t.id = transaksi_id and boleh_outlet(t.outlet_id)));
create policy baca on pembayaran for select to authenticated
  using (exists (select 1 from transaksi t where t.id = transaksi_id and boleh_outlet(t.outlet_id)));
-- penulisan hanya lewat fungsi di bawah agar harga & total dihitung di server

create or replace function peran_di_outlet(p_outlet uuid, p peran[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from penugasan where pengguna_id = auth.uid() and outlet_id = p_outlet and peran = any(p));
$$;

-- SFT-03 (versi awal): buka shift kasir dengan modal laci
create or replace function buka_sesi_kas(p_outlet uuid, p_modal bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not peran_di_outlet(p_outlet, '{kasir,spv}') then raise exception 'Tidak diizinkan'; end if;
  select id into sid from sesi_kas where outlet_id = p_outlet and kasir_id = auth.uid() and ditutup_at is null;
  if sid is null then
    insert into sesi_kas (outlet_id, kasir_id, modal_laci) values (p_outlet, auth.uid(), greatest(p_modal, 0)) returning id into sid;
  end if;
  return sid;
end $$;

-- POS-01..04, 07: simpan transaksi. Harga diambil dari master menu sesuai kanal.
-- p = {client_id, outlet_id, kanal, tipe, pelanggan, meja, catatan, diskon, metode, diterima,
--      items:[{menu_id, varian_ids:[], qty, catatan}]}
create or replace function buat_transaksi(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_outlet uuid := (p->>'outlet_id')::uuid;
  v_kanal kanal_jual := (p->>'kanal')::kanal_jual;
  v_sesi uuid; v_id uuid; v_nomor int;
  v_sub bigint := 0; v_hpp bigint := 0; v_diskon bigint := greatest(coalesce((p->>'diskon')::bigint, 0), 0);
  v_total bigint; v_batas int; v_diterima bigint;
  it jsonb; m menu; v_harga bigint; v_nama text; v_vids uuid[]; v_item_hpp bigint; v_qty int;
begin
  select id into v_id from transaksi where client_id = (p->>'client_id')::uuid;
  if v_id is not null then  -- sudah pernah tersimpan (kirim ulang dari offline)
    return (select jsonb_build_object('id', id, 'nomor', nomor, 'total', total) from transaksi where id = v_id);
  end if;
  if not peran_di_outlet(v_outlet, '{kasir,spv}') then raise exception 'Tidak diizinkan bertransaksi di outlet ini'; end if;
  select id into v_sesi from sesi_kas where outlet_id = v_outlet and kasir_id = auth.uid() and ditutup_at is null;
  if v_sesi is null then raise exception 'Buka shift terlebih dahulu'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) = 0 then raise exception 'Keranjang kosong'; end if;

  v_id := gen_random_uuid();
  select coalesce(max(nomor), 0) + 1 into v_nomor from transaksi
    where outlet_id = v_outlet and created_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';

  -- simpan kepala transaksi dulu, total dihitung ulang setelah item masuk
  insert into transaksi (id, client_id, outlet_id, sesi_kas_id, nomor, kanal, tipe, pelanggan, meja, catatan, subtotal, total)
    values (v_id, (p->>'client_id')::uuid, v_outlet, v_sesi, v_nomor, v_kanal, coalesce(p->>'tipe', 'dine_in'),
            nullif(p->>'pelanggan', ''), nullif(p->>'meja', ''), nullif(p->>'catatan', ''), 0, 0);

  for it in select * from jsonb_array_elements(p->'items') loop
    select * into m from menu where id = (it->>'menu_id')::uuid and deleted_at is null and aktif;
    if m.id is null then raise exception 'Menu tidak tersedia'; end if;
    v_qty := greatest((it->>'qty')::int, 1);
    v_vids := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(it->'varian_ids', '[]')) x), '{}');
    v_harga := case when v_kanal in ('gofood','grabfood','shopeefood','tiktok') then m.harga_ojol else m.harga_langsung end
      + coalesce((select sum(tambahan_harga) from varian where id = any(v_vids) and menu_id = m.id), 0);
    v_nama := m.nama || coalesce(' (' || (select string_agg(nama, ', ') from varian where id = any(v_vids)) || ')', '');
    -- HPP teoritis dari resep: bahan umum menu + bahan khusus varian terpilih
    v_item_hpp := coalesce((select round(sum(r.takaran * b.harga_pokok)) from resep r join bahan b on b.id = r.bahan_id
      where r.menu_id = m.id and r.deleted_at is null and (r.varian_id is null or r.varian_id = any(v_vids))), 0);
    insert into item_transaksi (transaksi_id, menu_id, varian_ids, nama, qty, harga, hpp_teoritis, catatan)
      values (v_id, m.id, v_vids, v_nama, v_qty, v_harga, v_item_hpp, nullif(it->>'catatan', ''));
    v_sub := v_sub + v_harga * v_qty;
    v_hpp := v_hpp + v_item_hpp * v_qty;
  end loop;

  select batas_diskon_persen into v_batas from perusahaan limit 1;
  if v_diskon > v_sub then raise exception 'Diskon melebihi subtotal'; end if;
  if v_diskon * 100 > v_sub * coalesce(v_batas, 0) and not peran_di_outlet(v_outlet, '{spv}') then
    raise exception 'Diskon di atas % persen perlu persetujuan Kepala Outlet', v_batas;
  end if;
  v_total := v_sub - v_diskon;
  v_diterima := coalesce((p->>'diterima')::bigint, v_total);
  if (p->>'metode') = 'tunai' and v_diterima < v_total then raise exception 'Uang diterima kurang'; end if;

  update transaksi set subtotal = v_sub, diskon = v_diskon, total = v_total, hpp_teoritis = v_hpp where id = v_id;
  insert into pembayaran (transaksi_id, metode, nominal, diterima)
    values (v_id, (p->>'metode')::metode_bayar, v_total, case when p->>'metode' = 'tunai' then v_diterima end);

  return jsonb_build_object('id', v_id, 'nomor', v_nomor, 'subtotal', v_sub, 'diskon', v_diskon, 'total', v_total,
                            'kembalian', case when p->>'metode' = 'tunai' then v_diterima - v_total else 0 end);
end $$;

-- POS-06: barista menandai diproses / siap / diambil
create or replace function ubah_status_pesanan(p_id uuid, p_status status_pesanan) returns void
language plpgsql security definer set search_path = public as $$
begin
  update transaksi set status_pesanan = p_status
   where id = p_id and status = 'lunas' and peran_di_outlet(outlet_id, '{barista,kasir,spv}');
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
end $$;

revoke execute on function peran_di_outlet(uuid, peran[]) from public, anon;
revoke execute on function buka_sesi_kas(uuid, bigint) from public, anon;
revoke execute on function buat_transaksi(jsonb) from public, anon;
revoke execute on function ubah_status_pesanan(uuid, status_pesanan) from public, anon;
grant execute on function peran_di_outlet(uuid, peran[]) to authenticated;
grant execute on function buka_sesi_kas(uuid, bigint) to authenticated;
grant execute on function buat_transaksi(jsonb) to authenticated;
grant execute on function ubah_status_pesanan(uuid, status_pesanan) to authenticated;
