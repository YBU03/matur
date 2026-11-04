-- Perluas metode pembayaran tanpa mengubah transaksi atau metode historis.
alter type public.metode_bayar add value if not exists 'gofood';
alter type public.metode_bayar add value if not exists 'shopeefood';
alter type public.metode_bayar add value if not exists 'tiktok';
alter type public.metode_bayar add value if not exists 'ruma_app';
