-- Catatan tambahan proyek (mis. permintaan mitra lewat chat: kode warna cat, ukuran, merek)
create table catatan_proyek (
  id uuid primary key default gen_random_uuid(),
  proyek_id uuid not null references proyek,
  judul text not null,
  isi text,
  tanggal date not null default current_date,
  deleted_at timestamptz
);
alter table catatan_proyek enable row level security;
create policy baca on catatan_proyek for select to authenticated using (boleh_proyek(proyek_id));
create policy kelola on catatan_proyek for all to authenticated using (admin_proyek()) with check (admin_proyek());
create trigger log_catatan_proyek after insert or update or delete on catatan_proyek for each row execute function catat_log();
