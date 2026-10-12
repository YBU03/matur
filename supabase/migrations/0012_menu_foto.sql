-- Foto menu untuk POS. Foto awal disimpan sebagai aset aplikasi (/menu/*.webp);
-- foto baru diunggah admin ke bucket publik "menu".
alter table menu add column foto_url text, add column urutan int not null default 0;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('menu', 'menu', true, 2097152, array['image/jpeg','image/png','image/webp']);
create policy menu_unggah on storage.objects for insert to authenticated
  with check (bucket_id = 'menu' and punya_peran('{owner,admin_pusat}'));
