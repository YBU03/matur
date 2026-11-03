-- Tutup buku 03.00 hanya berlaku mulai hari operasional 2 Nov 2026; data sebelumnya (termasuk dokumen PDF 1 Nov) tetap per tanggal kalender.
alter table public.perusahaan add column if not exists tutup_buku_mulai date not null default '2026-11-02';

create or replace function public.tutup_buku_mulai() returns date language sql stable security definer set search_path = '' as $$
  select coalesce((select tutup_buku_mulai from public.perusahaan limit 1), date '2026-11-02')
$$;
create or replace function public.tgl_op(p timestamptz) returns date language sql stable set search_path = '' as $$
  select case when p < (public.tutup_buku_mulai()::timestamp at time zone 'Asia/Jakarta')
              then (p at time zone 'Asia/Jakarta')::date
              else ((p at time zone 'Asia/Jakarta') - public.jam_tutup_buku())::date end
$$;
create or replace function public.awal_op(p date) returns timestamptz language sql stable set search_path = '' as $$
  select case when p < public.tutup_buku_mulai()
              then (p::timestamp at time zone 'Asia/Jakarta')
              else ((p::timestamp + public.jam_tutup_buku()) at time zone 'Asia/Jakarta') end
$$;
grant execute on function public.tutup_buku_mulai() to authenticated, anon;
