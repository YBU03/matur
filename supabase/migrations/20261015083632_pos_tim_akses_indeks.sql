create index if not exists pos_pin_diubah_oleh_idx on matur_internal.pos_pin(diubah_oleh);
revoke all on function public.info_akun_karyawan() from public,anon;
grant execute on function public.info_akun_karyawan() to authenticated;
