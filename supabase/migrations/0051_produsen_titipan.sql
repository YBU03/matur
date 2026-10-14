-- Produsen titipan (konsinyasi) jadi data pilihan: bisa ditambah, diubah, dihapus; menu titipan memilih produsennya.
-- Laporan bulanan menyimpan rincian tagihan per produsen.
create table if not exists produsen_titipan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kontak text,
  catatan text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table produsen_titipan enable row level security;
create policy baca on produsen_titipan for select to authenticated using (true);
create policy kelola on produsen_titipan for insert to authenticated with check (punya_peran('{owner,admin_pusat,finance,admin_gudang}'));
create policy ubah on produsen_titipan for update to authenticated using (punya_peran('{owner,admin_pusat,finance,admin_gudang}'));
create trigger log_produsen_titipan after insert or update or delete on produsen_titipan for each row execute function catat_log();

alter table menu add column if not exists produsen_id uuid references produsen_titipan(id);
alter table laporan_bulanan add column if not exists rincian_titipan jsonb not null default '[]';

-- nama produsen di menu mengikuti data produsen (dipakai rekap_titipan & laporan)
create or replace function isi_nama_produsen() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.produsen_id is not null then new.produsen := (select nama from produsen_titipan where id = new.produsen_id);
  elsif tg_op = 'UPDATE' and old.produsen_id is not null then new.produsen := null; end if;
  return new;
end $$;
create trigger isi_nama_produsen before insert or update of produsen_id on menu for each row execute function isi_nama_produsen();

create or replace function sebar_nama_produsen() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update menu set produsen = new.nama where produsen_id = new.id and produsen is distinct from new.nama;
  return new;
end $$;
create trigger sebar_nama_produsen after update of nama on produsen_titipan for each row execute function sebar_nama_produsen();

-- data awal dari teks produsen yang sudah ada (mis. Bu Ratna)
insert into produsen_titipan (nama) select distinct trim(produsen) from menu where produsen is not null and trim(produsen) <> ''
  and not exists (select 1 from produsen_titipan p where lower(p.nama) = lower(trim(menu.produsen)));
update menu m set produsen_id = p.id from produsen_titipan p where m.produsen_id is null and lower(trim(m.produsen)) = lower(p.nama);
