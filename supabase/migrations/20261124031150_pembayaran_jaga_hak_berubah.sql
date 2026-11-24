-- A revised/reordered report cannot silently reuse earlier payments for a new entitlement.
do $patch$
declare d text;needle text:='   select coalesce(sum(jumlah-pembulatan),0),coalesce(sum(abs(pembulatan)),0) into paid,adj_used';
begin
 d:=pg_get_functiondef('laporan_lanjut_internal.simpan(jsonb)'::regprocedure);
 if position(needle in d)=0 then raise exception 'Payment function changed: review source guard';end if;
 execute replace(d,needle,'   if exists(select 1 from public.laporan_bayar where laporan_id=l and penerima_key=p->>''penerima_key'' and status=''tercatat'' and hak_snapshot is distinct from hak) then raise exception ''Hak laporan berubah. Rekonsiliasi catatan pembayaran lama terlebih dahulu'';end if;'||chr(10)||needle);
end $patch$;
