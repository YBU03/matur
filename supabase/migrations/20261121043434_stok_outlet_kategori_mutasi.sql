-- Each movement belongs to exactly one category, even if an old reversal has the opposite sign.
do $$declare f text;begin
 f:=pg_get_functiondef('stok_outlet_internal.laporan(uuid,date,date,uuid,timestamptz,uuid,timestamptz)'::regprocedure);
 if position('jenis not in(''void'',''opname'',''koreksi'')' in f)=0 then raise exception 'Report classification changed';end if;
 f:=replace(f,'jenis not in(''void'',''opname'',''koreksi'')','jenis not in(''void'',''opname'',''koreksi'',''pemakaian'',''waste'',''marketing'')');
 f:=replace(f,'jenis not in(''pemakaian'',''waste'',''marketing'',''opname'',''koreksi'')','jenis not in(''pemakaian'',''waste'',''marketing'',''opname'',''koreksi'',''void'')');
 execute f;
end $$;
