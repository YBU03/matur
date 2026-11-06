-- Actual disbursement only. Keep outside HPP/operating expense projection,
-- which already calculates the monthly sedekah allocation separately.
insert into public.kategori_biaya(nama,grup,urutan,harian)
select 'Sedekah','lain',202,true
where not exists(select 1 from public.kategori_biaya where lower(trim(nama))='sedekah');
