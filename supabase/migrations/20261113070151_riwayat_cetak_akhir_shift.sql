-- Reprint normal closed sessions as well as optional shift sessions, same outlet boundaries.
do $$declare d text;begin
 d:=pg_get_functiondef('pos_kas_internal.riwayat_shift(uuid,text)'::regprocedure);
 if position('and not matur_internal.admin_pos_outlet(o)' in d)=0 then raise exception 'Periksa izin riwayat shift';end if;
 d:=replace(d,'and not matur_internal.admin_pos_outlet(o)', 'and not matur_internal.admin_pos_outlet(o) and not (public.peran_di_outlet(o,''{kasir,barista,spv}'') and public.boleh_outlet(o))');
 d:=replace(d,'and exists(select 1 from pos_kas_internal.shift_baru b where b.sesi_id=s.id)', 'and (s.pos_tim or s.ditutup_at is not null)');
 execute d;
end $$;
