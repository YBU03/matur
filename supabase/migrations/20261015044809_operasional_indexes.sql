-- Cover new foreign keys and avoid per-row evaluation of the current user.
create index on kiriman(kiriman_induk_id) where kiriman_induk_id is not null;
create index on penerimaan_kiriman(outlet_id);
create index on penerimaan_kiriman(penerima_id);
create index on setoran_omzet(penyetor_id);
create index on setoran_omzet(diverifikasi_oleh) where diverifikasi_oleh is not null;
create index on rekonsiliasi_kas_harian(diubah_oleh);
create index on kasbon_staf(outlet_id);
create index on kasbon_staf(dibuat_oleh);
create index on slip_gaji(jam_disetujui_oleh) where jam_disetujui_oleh is not null;
alter policy baca on kasbon_staf using(punya_peran('{owner,hrd,finance}') or pengguna_id=(select auth.uid()));
-- Reject null actions as well as unknown choices before closing a discrepancy.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.selesaikan_selisih_kiriman(uuid,text,jsonb,text)'::regprocedure);
 d:=replace(d, 'if p_tindakan not in', 'if p_tindakan is null or p_tindakan not in');
 execute d;
end $$;
