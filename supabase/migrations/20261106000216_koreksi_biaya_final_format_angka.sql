-- Pesan koreksi_biaya_final: angka geser kas memakai titik ribuan (1.000), bukan koma.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.koreksi_biaya_final(uuid, uuid, text, bigint, text, boolean, text)'::regprocedure);
  if position($q$to_char(abs(laci_lama - laci_baru), 'FM999G999G999')$q$ in d) = 0 then raise exception 'pola format tidak ditemukan'; end if;
  d := replace(d, $q$to_char(abs(laci_lama - laci_baru), 'FM999G999G999')$q$, $q$replace(to_char(abs(laci_lama - laci_baru), 'FM999,999,999,999'), ',', '.')$q$);
  execute d;
end $$;
