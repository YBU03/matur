-- Jangan ubah katalog izin yang mungkin masih dirujuk antrean offline.
-- Harga baru memakai izin baru; struk lama tetap dapat disinkronkan dengan snapshotnya.
do $$ declare d text;needle text:='and ditarik_at is null order by mulai_at desc limit 1;';begin
 d:=pg_get_functiondef('pos_kas_internal.siapkan_langsung(uuid,text,text)'::regprocedure);
 if position(needle in d)=0 then raise exception 'Definisi izin POS langsung berubah';end if;
 d:=replace(d,needle,'and ditarik_at is null and katalog=kat order by mulai_at desc limit 1;');execute d;
end $$;
