-- Nama kasir disimpan di sesi_kas (dibaca Akunting/SPV di Catatan Harian tanpa perlu akses tabel pengguna)
alter table sesi_kas add column if not exists nama_kasir text;
create or replace function isi_nama_kasir() returns trigger language plpgsql security definer set search_path = public as $$
begin if new.nama_kasir is null then new.nama_kasir := (select nama from pengguna where id = new.kasir_id); end if; return new; end $$;
create trigger isi_nama_kasir before insert on sesi_kas for each row execute function isi_nama_kasir();
update sesi_kas s set nama_kasir = p.nama from pengguna p where p.id = s.kasir_id and s.nama_kasir is null;
