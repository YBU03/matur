-- Skema produksi memakai log_aktivitas.waktu, bukan created_at.
do $$declare d text;begin
 d:=pg_get_functiondef('rekonsiliasi_internal.periksa(uuid)'::regprocedure);
 d:=replace(d,'l.created_at','l.waktu');
 execute d;
end $$;
