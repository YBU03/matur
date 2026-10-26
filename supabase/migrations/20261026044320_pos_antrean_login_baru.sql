-- Antrean tersimpan tetap sah setelah cookie login berganti. Perangkat/akun/outlet,
-- ID izin historis, waktu, pembayaran tunai dan idempotensi tetap diperiksa.
do $$ declare d text;old text;begin
 d:=pg_get_functiondef('pos_kas_internal.checkout_langsung(jsonb)'::regprocedure);
 old:='iz.id is null or iz.token_hash<>encode(extensions.digest(coalesce(nullif(p->>''pos_token'',''''),p->>''device_token''),''sha256''),''hex'')';
 if position(old in d)=0 then raise exception 'Definisi checkout langsung berubah';end if;
 d:=replace(d,old,'iz.id is null or (not off and iz.token_hash<>encode(extensions.digest(coalesce(nullif(p->>''pos_token'',''''),p->>''device_token''),''sha256''),''hex''))');execute d;
end $$;
