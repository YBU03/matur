-- A handover with an unreachable source must not falsely finalize a cash report.
create function matur_internal.pindah_menunggu(p_sesi uuid) returns bigint
language sql stable security definer set search_path=public as $$
 select count(*) from matur_internal.pos_pindah where sesi_id=p_sesi and selesai_at is not null and bersih_at is null
$$;
revoke all on function matur_internal.pindah_menunggu(uuid) from public,anon,authenticated;

do $$ declare d text;begin
 d:=pg_get_functiondef('public.tutup_pos_tim(uuid,text,text,text,bigint,text,uuid[])'::regprocedure);
 if position('case when n>0 then ''sementara'' else ''final'' end' in d)=0 then raise exception 'Struktur tutup kas berubah';end if;
 d:=replace(d,'case when n>0 then ''sementara'' else ''final'' end','case when n>0 or matur_internal.pindah_menunggu(s.id)>0 then ''sementara'' else ''final'' end');
 execute d;
 d:=pg_get_functiondef('public.buat_transaksi(jsonb)'::regprocedure);
 if position('not exists(select 1 from matur_internal.pos_pending where client_id=client and sesi_id=sid)' in d)=0 then raise exception 'Struktur sinkronisasi berubah';end if;
 d:=replace(d,'not exists(select 1 from matur_internal.pos_pending where client_id=client and sesi_id=sid)',
 '(not exists(select 1 from matur_internal.pos_pending where client_id=client and sesi_id=sid) and not exists(select 1 from matur_internal.pos_pindah ph where ph.sesi_id=sid and ph.asal_id=dev and ph.selesai_at is not null and ph.bersih_at is null))');
 d:=replace(d,'case when cnt=0 then ''final'' else ''sementara'' end','case when cnt=0 and matur_internal.pindah_menunggu(sid)=0 then ''final'' else ''sementara'' end');
 execute d;
 d:=pg_get_functiondef('public.lapor_perangkat_pos(text,uuid[],boolean,text)'::regprocedure);
 d:=replace(d,'r.id is not null and r.selesai_at is null and p_beku','r.id is not null and p_beku');
 -- Use the same session -> handover -> device lock order as handover completion.
 d:=replace(d,' select * into r from matur_internal.pos_pindah where asal_id=d.id and batal_at is null order by diminta_at desc limit 1;','');
 d:=replace(d,' update pos_perangkat set terlihat_at=now()',
 ' select * into r from matur_internal.pos_pindah where asal_id=d.id and batal_at is null order by diminta_at desc limit 1;
 perform 1 from sesi_kas where id=r.sesi_id for update;
 select * into r from matur_internal.pos_pindah where id=r.id and batal_at is null for update;
 update pos_perangkat set terlihat_at=now()');
 d:=replace(d,'update matur_internal.pos_pindah set bersih_at=coalesce(bersih_at,now()) where id=r.id;',
 'update matur_internal.pos_pindah set bersih_at=coalesce(bersih_at,now()) where id=r.id;
  update sesi_kas set rekap_status=case when pending_offline=0 and matur_internal.pindah_menunggu(r.sesi_id)=0 then ''final'' else ''sementara'' end where id=r.sesi_id and ditutup_at is not null;');
 execute d;
 d:=pg_get_functiondef('public.ringkasan_kas_tim(uuid)'::regprocedure);
 d:=replace(d,'return matur_internal.kas_ringkas(p_sesi)||jsonb_build_object(', 'return matur_internal.kas_ringkas(p_sesi)||jsonb_build_object(''pindah_menunggu'',matur_internal.pindah_menunggu(p_sesi),');
 execute d;
 d:=pg_get_functiondef('matur_internal.panel_pos_admin()'::regprocedure);
 d:=replace(d,'''pending'',s.pending_offline,','''pindah_menunggu'',matur_internal.pindah_menunggu(s.id),''pending'',s.pending_offline,');
 execute d;
 d:=pg_get_functiondef('public.panel_pos_admin()'::regprocedure);
 d:=replace(d,'''pending'',s.pending_offline,','''pindah_menunggu'',matur_internal.pindah_menunggu(s.id),''pending'',s.pending_offline,');
 execute d;
end $$;
