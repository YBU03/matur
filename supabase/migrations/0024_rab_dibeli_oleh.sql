-- Rincian keperluan: siapa yang membeli (kantor pusat atau mitra, mis. untuk tukang mitra)
alter table item_rab add column dibeli_oleh text not null default 'kantor' check (dibeli_oleh in ('kantor','mitra'));
