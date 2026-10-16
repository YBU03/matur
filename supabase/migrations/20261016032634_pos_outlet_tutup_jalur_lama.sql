-- Once an outlet uses shared credentials, staff-PIN endpoints cannot reopen a legacy drawer.
do $$ declare d text;begin
 d:=pg_get_functiondef('public.buka_pos_tim(uuid,text,text,text,bigint,uuid[],text)'::regprocedure);
 d:=replace(d,'begin','begin
 if exists(select 1 from matur_internal.pos_outlet_akses where outlet_id=p_outlet) then raise exception ''Gunakan akun POS outlet dan pilih PIC sesuai shift'';end if;');execute d;
end $$;
