-- Cadangan operasional privat sebelum pembersihan data latihan atas permintaan pemilik.
-- Tidak diekspos melalui Data API atau akun aplikasi.
create schema arsip_operasional_internal;
revoke all on schema arsip_operasional_internal from public,anon,authenticated,service_role;
create table arsip_operasional_internal.batch(
 id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),
 alasan text not null,ringkasan jsonb not null default '{}',dipertahankan jsonb not null default '{}'
);
create table arsip_operasional_internal.snapshot(
 batch_id uuid not null references arsip_operasional_internal.batch(id),tabel text not null,
 jumlah bigint not null,data jsonb not null,checksum text not null,
 primary key(batch_id,tabel),check(jumlah=jsonb_array_length(data)),check(checksum=md5(data::text))
);
alter table arsip_operasional_internal.batch enable row level security;
alter table arsip_operasional_internal.snapshot enable row level security;
revoke all on all tables in schema arsip_operasional_internal from public,anon,authenticated,service_role;
comment on schema arsip_operasional_internal is 'Arsip privat yang hanya dapat dipulihkan operator database. Bukan data operasional aktif.';
