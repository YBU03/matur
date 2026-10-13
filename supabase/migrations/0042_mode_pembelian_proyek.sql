-- Mode pembelian barang per proyek: normal (tanpa penandaan) atau split (tiap barang dipilih dibeli pusat/mitra)
alter table proyek add column if not exists mode_pembelian text not null default 'normal' check (mode_pembelian in ('normal','split'));
update proyek set mode_pembelian = 'split' where id in (select distinct proyek_id from item_rab where dibeli_oleh = 'mitra' and deleted_at is null);
