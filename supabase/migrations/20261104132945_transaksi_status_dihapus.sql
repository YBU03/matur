-- izinkan status tempat sampah
alter table public.transaksi drop constraint transaksi_status_check;
alter table public.transaksi add constraint transaksi_status_check check (status = any (array['lunas'::text, 'void'::text, 'dihapus'::text]));
alter table public.transaksi add constraint transaksi_status_sebelum_check check (status_sebelum is null or status_sebelum = any (array['lunas'::text, 'void'::text]));
