-- Pengeluaran POS memakai hari operasional (tutup buku 03.00 WIB, public.tgl_op): catatan jam 00.00–03.00
-- tetap masuk tanggal shift yang sedang berjalan. Data lama tidak diubah.
do $$
declare d text;
begin
  d := pg_get_functiondef('operasional_outlet_internal.catat_pengeluaran_pos(jsonb)'::regprocedure);
  if (select count(*) from regexp_matches(d, $q$\(now\(\) at time zone 'Asia/Jakarta'\)::date$q$, 'g')) <> 2 then raise exception 'pola tanggal catat_pengeluaran_pos tidak sesuai'; end if;
  d := replace(d, $q$(now() at time zone 'Asia/Jakarta')::date$q$, $q$public.tgl_op(now())$q$);
  execute d;
  d := pg_get_functiondef('public.tempel_sesi_biaya()'::regprocedure);
  if position($q$new.tanggal = (now() at time zone 'Asia/Jakarta')::date$q$ in d) = 0 then raise exception 'pola tempel_sesi_biaya tidak ditemukan'; end if;
  d := replace(d, $q$new.tanggal = (now() at time zone 'Asia/Jakarta')::date$q$, $q$new.tanggal in (public.tgl_op(now()), (now() at time zone 'Asia/Jakarta')::date)$q$);
  execute d;
end $$;
