-- Preserve exact imported monetary values when approving a monthly report.
-- Existing integer values remain numerically identical; RLS and publication gates stay unchanged.
alter table public.laporan_bulanan
 alter column modal_awal type numeric using modal_awal::numeric,
 alter column persediaan_awal type numeric using persediaan_awal::numeric,
 alter column pembelian type numeric using pembelian::numeric,
 alter column persediaan_akhir type numeric using persediaan_akhir::numeric,
 alter column diskon type numeric using diskon::numeric,
 alter column sedekah type numeric using sedekah::numeric,
 alter column laba_bersih type numeric using laba_bersih::numeric,
 alter column tagihan_titipan type numeric using tagihan_titipan::numeric,
 add column sumber_excel jsonb;
-- Initial insert already copies the complete record. Reapproval must also replace its source archive.
do $$declare f text;begin
 f:=pg_get_functiondef('public.setujui_laporan_mitra(uuid,date,timestamptz,boolean)'::regprocedure);
 if position('rincian_titipan=excluded.rincian_titipan' in f)=0 then raise exception 'Publication function changed';end if;
 f:=replace(f,'rincian_titipan=excluded.rincian_titipan','sumber_excel=excluded.sumber_excel, rincian_titipan=excluded.rincian_titipan');
 f:=replace(f,'d.snapshot || jsonb_build_object', 'd.snapshot || jsonb_build_object(''rincian_titipan'',coalesce(d.snapshot->''rincian_titipan'',''[]''::jsonb)) || jsonb_build_object');
 execute f;
end $$;
