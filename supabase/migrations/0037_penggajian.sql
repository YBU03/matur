-- Penggajian & slip gaji staf outlet (kasir/barista), dihitung dari absensi
create table gaji_staf (
  pengguna_id uuid primary key references pengguna on delete cascade,
  gaji_pokok bigint not null default 0,
  tunjangan bigint not null default 0,
  uang_makan bigint not null default 0,        -- per hari hadir
  potongan_telat bigint not null default 0,    -- per kejadian telat
  potongan_alpa bigint not null default 0,     -- per hari tidak absen tanpa izin
  bank text, no_rekening text, atas_nama text,
  updated_at timestamptz not null default now()
);

create table penggajian (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  outlet_id uuid not null references outlet,
  periode date not null,                       -- tanggal 1 bulan gaji
  status text not null default 'draft' check (status in ('draft','final')),
  catatan text,
  biaya_id uuid references biaya_outlet,       -- beban "Biaya Gaji" di laporan saat final
  dibuat_oleh uuid default auth.uid() references pengguna,
  created_at timestamptz not null default now(),
  final_at timestamptz,
  unique (mode, outlet_id, periode)
);

create table slip_gaji (
  id uuid primary key default gen_random_uuid(),
  penggajian_id uuid not null references penggajian on delete cascade,
  pengguna_id uuid not null references pengguna on delete cascade,
  nama text not null,
  jabatan text,
  hadir int not null default 0,
  telat int not null default 0,
  menit_telat int not null default 0,
  tidak_absen int not null default 0,
  izin int not null default 0,
  menit_kerja int not null default 0,
  pendapatan jsonb not null default '[]',      -- [{nama, jumlah}]
  potongan jsonb not null default '[]',
  total bigint not null default 0,
  rekening text,
  unique (penggajian_id, pengguna_id)
);

create or replace function kelola_gaji() returns boolean language sql stable security definer set search_path = public as $$
  select punya_peran('{owner,hrd}') $$;

alter table gaji_staf enable row level security;
alter table penggajian enable row level security;
alter table slip_gaji enable row level security;

create policy baca on gaji_staf for select using (kelola_gaji() or punya_peran('{finance}') or pengguna_id = auth.uid());
create policy kelola on gaji_staf for all using (kelola_gaji()) with check (kelola_gaji());
create policy baca on penggajian for select using (kelola_gaji() or punya_peran('{finance}')
  or (status = 'final' and exists (select 1 from slip_gaji s where s.penggajian_id = penggajian.id and s.pengguna_id = auth.uid())));
create policy kelola on penggajian for all using (kelola_gaji()) with check (kelola_gaji());
create policy baca on slip_gaji for select using (kelola_gaji() or punya_peran('{finance}')
  or (pengguna_id = auth.uid() and exists (select 1 from penggajian g where g.id = penggajian_id and g.status = 'final')));
create policy kelola on slip_gaji for all using (kelola_gaji()) with check (kelola_gaji());

-- Finalkan: kunci slip & catat total gaji sebagai beban "Biaya Gaji" (masuk proyeksi laporan bulanan)
create or replace function finalkan_penggajian(p_id uuid) returns bigint language plpgsql security definer set search_path = public as $$
declare g penggajian; v_total bigint; v_kat uuid; v_biaya uuid;
begin
  if not kelola_gaji() then raise exception 'Hanya Owner/HRD yang bisa memfinalkan gaji'; end if;
  select * into g from penggajian where id = p_id for update;
  if g.id is null then raise exception 'Penggajian tidak ditemukan'; end if;
  select coalesce(sum(total), 0) into v_total from slip_gaji where penggajian_id = p_id;
  if v_total <= 0 then raise exception 'Belum ada slip bernilai'; end if;
  select id into v_kat from kategori_biaya where nama ilike 'biaya gaji' limit 1;
  if g.biaya_id is not null then
    update biaya_outlet set jumlah = v_total, deleted_at = null where id = g.biaya_id returning id into v_biaya;
  end if;
  if v_biaya is null then
    insert into biaya_outlet (mode, outlet_id, tanggal, kategori_id, jumlah, keterangan, sumber)
    values (g.mode, g.outlet_id, (g.periode + interval '1 month - 1 day')::date, v_kat, v_total,
            'Gaji karyawan ' || to_char(g.periode, 'MM/YYYY') || ' (penggajian)', 'pusat')
    returning id into v_biaya;
  end if;
  update penggajian set status = 'final', final_at = now(), biaya_id = v_biaya where id = p_id;
  return v_total;
end $$;

-- Buka lagi: kembali ke draft, beban gaji di laporan ditarik
create or replace function buka_penggajian(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare g penggajian;
begin
  if not kelola_gaji() then raise exception 'Hanya Owner/HRD'; end if;
  select * into g from penggajian where id = p_id for update;
  if g.biaya_id is not null then update biaya_outlet set deleted_at = now() where id = g.biaya_id; end if;
  update penggajian set status = 'draft', final_at = null where id = p_id;
end $$;

grant execute on function finalkan_penggajian(uuid), buka_penggajian(uuid), kelola_gaji() to authenticated;

-- (0037b/c) cegah rekursi RLS penggajian ↔ slip_gaji: cek silang lewat fungsi security definer
create or replace function punya_slip(p_penggajian uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from slip_gaji where penggajian_id = p_penggajian and pengguna_id = auth.uid()) $$;
create or replace function gaji_final(p_penggajian uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from penggajian where id = p_penggajian and status = 'final') $$;
grant execute on function punya_slip(uuid), gaji_final(uuid) to authenticated;
alter policy baca on penggajian using (kelola_gaji() or punya_peran('{finance}') or (status = 'final' and punya_slip(id)));
alter policy baca on slip_gaji using (kelola_gaji() or punya_peran('{finance}') or (pengguna_id = auth.uid() and gaji_final(penggajian_id)));
