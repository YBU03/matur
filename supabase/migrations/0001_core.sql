-- Matur · Tahap 1: fondasi organisasi, pengguna, peran, mitra & log aktivitas.
-- Semua uang disimpan sebagai rupiah bulat (bigint). Tabel data memakai
-- penanda mode (asli/simulasi) dan deleted_at untuk tempat sampah 30 hari.

create type peran as enum (
  'owner','manajer_area','finance','hrd','admin_pusat','admin_gudang',
  'spv','kasir','barista','mitra','pic'
);
create type mode_data as enum ('asli','simulasi');
create type status_outlet as enum ('pembangunan','operasional','tutup');

create table perusahaan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  alamat text, email text, telepon text, logo_url text,
  penandatangan_nama text, penandatangan_jabatan text, kota_terbit text
);

create table area (
  id uuid primary key default gen_random_uuid(),
  nama text not null
);

create table pengguna (
  id uuid primary key references auth.users on delete cascade,
  nama text not null,
  email text unique,
  no_hp text unique,
  pin_hash text,                       -- PIN kasir/barista (bcrypt)
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table outlet (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  nama text not null,
  alamat text,
  tgl_mulai date,
  jam_operasional text,
  status status_outlet not null default 'pembangunan',
  pj_laporan_id uuid references pengguna,
  spv_id uuid references pengguna,
  area_id uuid references area,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- satu orang bisa memegang beberapa peran / outlet (AKS-01)
create table penugasan (
  id uuid primary key default gen_random_uuid(),
  pengguna_id uuid not null references pengguna on delete cascade,
  peran peran not null,
  outlet_id uuid references outlet,    -- null = semua outlet (peran pusat)
  area_id uuid references area,        -- untuk manajer area
  unique (pengguna_id, peran, outlet_id)
);

-- perangkat outlet terdaftar untuk login PIN (AKS-02)
create table perangkat (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlet,
  nama text not null,
  token_hash text not null,
  terdaftar_at timestamptz not null default now(),
  dicabut_at timestamptz
);

create table mitra (
  id uuid primary key default gen_random_uuid(),
  pengguna_id uuid references pengguna,
  nama text not null, no_hp text, email text
);

create table perjanjian (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  mitra_id uuid not null references mitra,
  outlet_id uuid not null references outlet,
  persen_mitra numeric(5,2) not null default 55,
  persen_pengelola numeric(5,2) not null default 45,
  sewa_bulanan bigint not null default 0,
  modal_outlet bigint not null default 200000,
  investasi_awal bigint not null default 135000000,
  sewa_masuk_bep boolean not null default false,  -- MTR-05
  bank text, no_rekening text, atas_nama text,
  deleted_at timestamptz,
  check (persen_mitra + persen_pengelola = 100)
);

-- AKS-04: log semua perubahan; tidak bisa diubah/dihapus
create table log_aktivitas (
  id bigint generated always as identity primary key,
  pengguna_id uuid references pengguna,
  aksi text not null,                  -- create / update / delete / restore
  entitas text not null,
  entitas_id text,
  nilai_lama jsonb,
  nilai_baru jsonb,
  waktu timestamptz not null default now()
);

-- ---------- Helper hak akses (RLS) ----------
create or replace function punya_peran(p peran[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from penugasan where pengguna_id = auth.uid() and peran = any(p));
$$;

create or replace function boleh_outlet(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from penugasan t
    left join outlet x on x.id = o
    where t.pengguna_id = auth.uid()
      and (t.outlet_id = o
           or (t.outlet_id is null and t.peran in ('owner','finance','hrd','admin_pusat','admin_gudang'))
           or (t.peran = 'manajer_area' and t.area_id = x.area_id))
  );
$$;

alter table perusahaan enable row level security;
alter table area enable row level security;
alter table pengguna enable row level security;
alter table outlet enable row level security;
alter table penugasan enable row level security;
alter table perangkat enable row level security;
alter table mitra enable row level security;
alter table perjanjian enable row level security;
alter table log_aktivitas enable row level security;

create policy baca_perusahaan on perusahaan for select to authenticated using (true);
create policy kelola_perusahaan on perusahaan for all to authenticated
  using (punya_peran('{owner}')) with check (punya_peran('{owner}'));

create policy baca_area on area for select to authenticated using (true);

create policy baca_diri on pengguna for select to authenticated
  using (id = auth.uid() or punya_peran('{owner,hrd,admin_pusat}'));
create policy kelola_pengguna on pengguna for all to authenticated
  using (punya_peran('{owner}')) with check (punya_peran('{owner}'));

create policy baca_penugasan on penugasan for select to authenticated
  using (pengguna_id = auth.uid() or punya_peran('{owner}'));
create policy kelola_penugasan on penugasan for all to authenticated
  using (punya_peran('{owner}')) with check (punya_peran('{owner}'));

create policy baca_outlet on outlet for select to authenticated using (boleh_outlet(id));
create policy kelola_outlet on outlet for all to authenticated
  using (punya_peran('{owner,admin_pusat}')) with check (punya_peran('{owner,admin_pusat}'));

create policy kelola_perangkat on perangkat for all to authenticated
  using (punya_peran('{owner,admin_pusat}')) with check (punya_peran('{owner,admin_pusat}'));

create policy baca_mitra on mitra for select to authenticated
  using (pengguna_id = auth.uid() or punya_peran('{owner,finance,admin_pusat}'));
create policy kelola_mitra on mitra for all to authenticated
  using (punya_peran('{owner,admin_pusat}')) with check (punya_peran('{owner,admin_pusat}'));

-- mitra hanya-baca untuk outlet miliknya (AKS-03)
create policy baca_perjanjian on perjanjian for select to authenticated
  using (punya_peran('{owner,finance,admin_pusat}')
         or mitra_id in (select id from mitra where pengguna_id = auth.uid()));
-- investasi awal bisa diubah Admin Pusat atau Finance (MST-03)
create policy kelola_perjanjian on perjanjian for all to authenticated
  using (punya_peran('{owner,admin_pusat,finance}')) with check (punya_peran('{owner,admin_pusat,finance}'));

create policy baca_log on log_aktivitas for select to authenticated using (punya_peran('{owner}'));
-- tidak ada policy insert/update/delete: log hanya ditulis lewat trigger

create or replace function catat_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into log_aktivitas (pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (
    auth.uid(),
    case
      when tg_op = 'INSERT' then 'create'
      when tg_op = 'DELETE' then 'purge'
      when old.deleted_at is null and new.deleted_at is not null then 'delete'
      when old.deleted_at is not null and new.deleted_at is null then 'restore'
      else 'update'
    end,
    tg_table_name,
    coalesce(new.id, old.id)::text,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger log_outlet after insert or update or delete on outlet for each row execute function catat_log();
create trigger log_perjanjian after insert or update or delete on perjanjian for each row execute function catat_log();
