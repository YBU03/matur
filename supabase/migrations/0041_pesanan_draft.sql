-- Pesanan draft (simpan dulu, bayar nanti / open bill). Tidak pernah dihapus: status draft → dibayar / dibatalkan,
-- setiap perubahan tercatat di log_aktivitas.
create table pesanan_draft (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlet,
  label text,
  kanal text not null default 'langsung',
  tipe text not null default 'dine_in',
  pelanggan text, meja text,
  diskon bigint not null default 0,
  items jsonb not null default '[]',
  total bigint not null default 0,
  status text not null default 'draft' check (status in ('draft','dibayar','dibatalkan')),
  dibuat_oleh uuid default auth.uid() references pengguna,
  diubah_oleh uuid references pengguna,
  transaksi_id uuid references transaksi,
  alasan_batal text,
  dibatalkan_oleh uuid references pengguna,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  selesai_at timestamptz
);
create index on pesanan_draft (outlet_id, status, created_at desc);
alter table pesanan_draft enable row level security;
create policy baca on pesanan_draft for select using (boleh_outlet(outlet_id));
create policy buat on pesanan_draft for insert with check (peran_di_outlet(outlet_id, '{kasir,spv}') and status = 'draft');
create policy ubah on pesanan_draft for update using (peran_di_outlet(outlet_id, '{kasir,spv}') and status = 'draft');
create trigger log_pesanan_draft after insert or update on pesanan_draft for each row execute function catat_log_sdm();

alter table transaksi add column if not exists draft_id uuid references pesanan_draft;

create or replace function tutup_draft_dibayar() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update pesanan_draft set status = 'dibayar', transaksi_id = new.id, selesai_at = now(), updated_at = now(), diubah_oleh = auth.uid()
   where id = new.draft_id and status = 'draft';
  return new;
end $$;
create trigger tutup_draft after insert on transaksi for each row when (new.draft_id is not null) execute function tutup_draft_dibayar();

create or replace function batal_draft(p_id uuid, p_alasan text) returns void language plpgsql security definer set search_path = public as $$
declare d pesanan_draft;
begin
  select * into d from pesanan_draft where id = p_id for update;
  if d.id is null or d.status <> 'draft' then raise exception 'Draft tidak ditemukan atau sudah selesai'; end if;
  if not peran_di_outlet(d.outlet_id, '{kasir,spv}') then raise exception 'Tidak diizinkan'; end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan pembatalan wajib diisi'; end if;
  update pesanan_draft set status = 'dibatalkan', alasan_batal = trim(p_alasan), dibatalkan_oleh = auth.uid(), selesai_at = now(), updated_at = now() where id = p_id;
end $$;
grant execute on function batal_draft(uuid, text) to authenticated;

-- buat_transaksi menyimpan p.draft_id ke transaksi.draft_id (patch pada definisi yang berlaku)
do $$ declare f text := pg_get_functiondef('public.buat_transaksi'::regproc);
begin
  if position('draft_id' in f) = 0 then
    f := replace(f, 'insert into transaksi (id, client_id,', 'insert into transaksi (draft_id, id, client_id,');
    f := replace(f, 'values (v_id, (p->>''client_id'')::uuid,', 'values (nullif(p->>''draft_id'', '''')::uuid, v_id, (p->>''client_id'')::uuid,');
    execute f;
  end if;
end $$;

-- (0041b) nama pembuat & penutup disimpan sebagai teks (kasir tidak bisa membaca data pengguna lain)
alter table pesanan_draft add column if not exists nama_pembuat text, add column if not exists nama_penutup text;
create or replace function isi_nama_draft() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.nama_pembuat := (select nama from pengguna where id = auth.uid()); end if;
  if tg_op = 'UPDATE' and new.status <> 'draft' and old.status = 'draft' then new.nama_penutup := (select nama from pengguna where id = auth.uid()); end if;
  return new;
end $$;
create trigger isi_nama_draft before insert or update on pesanan_draft for each row execute function isi_nama_draft();
