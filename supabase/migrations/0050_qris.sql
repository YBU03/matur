-- QRIS per outlet: gambar QRIS (biasa, ditempel) dan/atau payload QRIS statis untuk dibuat QRIS dinamis (nominal otomatis) di POS.
-- Diunggah oleh Owner / Admin Pusat / Admin Gudang.
alter table outlet add column if not exists qris_url text;
alter table outlet add column if not exists qris_payload text;
alter table outlet add column if not exists qris_nama text;
alter table outlet add column if not exists qris_dinamis boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qris', 'qris', true, 3145728, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy qris_unggah on storage.objects for insert to authenticated
  with check (bucket_id = 'qris' and punya_peran('{owner,admin_pusat,admin_gudang}'));
create policy qris_ganti on storage.objects for update to authenticated
  using (bucket_id = 'qris' and punya_peran('{owner,admin_pusat,admin_gudang}'));

create or replace function atur_qris(p_outlet uuid, p_url text, p_payload text, p_nama text, p_dinamis boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not punya_peran('{owner,admin_pusat,admin_gudang}') then raise exception 'Hanya Owner / Admin Pusat / Admin Gudang'; end if;
  if nullif(p_payload, '') is not null and p_payload !~ '^000201' then raise exception 'Isi QRIS tidak valid'; end if;
  update outlet set qris_url = nullif(p_url, ''), qris_payload = nullif(p_payload, ''), qris_nama = nullif(trim(p_nama), ''),
         qris_dinamis = coalesce(p_dinamis, false) and nullif(p_payload, '') is not null
   where id = p_outlet;
  if not found then raise exception 'Outlet tidak ditemukan'; end if;
end $$;
