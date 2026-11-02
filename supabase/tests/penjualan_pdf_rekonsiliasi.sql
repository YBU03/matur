-- Jalankan setelah operasi; seluruh pemeriksaan read-only dan ROLLBACK.
begin;
select set_config('request.jwt.claim.sub',(select p.pengguna_id::text from penugasan p join pengguna u on u.id=p.pengguna_id where p.peran='owner' and u.status='aktif' limit 1),true);
set local role authenticated;
do $test$
declare r jsonb;q jsonb;
begin
 r:=laporan_operasional('transaksi','de5b97c8-31fc-4daf-9478-a19e675503e1','2026-11-01','2026-11-01');
 if jsonb_array_length(r)<>38 or (select sum((v->>'total')::bigint) from jsonb_array_elements(r)v)<>1758000 or (select sum((v->>'qty')::int) from jsonb_array_elements(r)v)<>82 then raise exception 'Finance tidak cocok';end if;
 if (select sum((v->>'dibayar')::bigint) from jsonb_array_elements(r)v)<>1758000 or exists(select 1 from jsonb_array_elements(r)v where (v->>'sisa')::bigint<>0 or v->>'terakhir_dibayar'<>'2026-11-01') then raise exception 'Pembayaran/tanggal tidak cocok';end if;
 q:=laporan_operasional('ringkasan','de5b97c8-31fc-4daf-9478-a19e675503e1','2026-11-01','2026-11-01');
 if (q->0->>'item')::int<>82 or (q->0->>'bersih')::bigint<>1758000 or (q->0->>'impor_tanpa_rincian')::int<>38 then raise exception 'Ringkasan salah';end if;
 q:=ringkasan_penjualan('de5b97c8-31fc-4daf-9478-a19e675503e1','2026-11-01','2026-11-01');
 if (q->'kpi'->>'omzet')::bigint<>1758000 or (q->'kpi'->>'trx')::int<>38 or (q->'kpi'->>'impor_tanpa_rincian')::int<>38 then raise exception 'Dashboard tidak cocok';end if;
 if (select count(*) from transaksi where outlet_id='de5b97c8-31fc-4daf-9478-a19e675503e1' and created_at>='2026-11-01T00:00:00+07' and created_at<'2026-11-02T00:00:00+07')<>38 then raise exception 'POS RLS tidak cocok';end if;
 if (select sum(p.nominal) from pembayaran p join transaksi t on t.id=p.transaksi_id where t.sumber_penjualan is not null and t.outlet_id='de5b97c8-31fc-4daf-9478-a19e675503e1' and p.metode='tunai')<>786000 then raise exception 'Tunai salah';end if;
end $test$;
reset role;
-- Uji Finance yang aktif, bila tersedia, dengan izin yang sama seperti aplikasi.
do $test$
declare uid uuid;r jsonb;
begin
 select p.pengguna_id into uid from penugasan p join pengguna u on u.id=p.pengguna_id where p.peran='finance' and u.status='aktif' limit 1;
 if uid is not null then
  perform set_config('request.jwt.claim.sub',uid::text,true);
  set local role authenticated;
  r:=laporan_operasional('transaksi','de5b97c8-31fc-4daf-9478-a19e675503e1','2026-11-01','2026-11-01');
  if jsonb_array_length(r)<>38 then raise exception 'Akses Finance tidak cocok';end if;
  reset role;
 end if;
end $test$;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $test$
declare ditolak boolean:=false;
begin
 begin
  perform laporan_operasional('transaksi','de5b97c8-31fc-4daf-9478-a19e675503e1','2026-11-01','2026-11-01');
 exception when insufficient_privilege then ditolak:=true;when raise_exception then ditolak:=sqlerrm='Tidak diizinkan';end;
 if not ditolak then raise exception 'Anon dapat membaca laporan';end if;
end $test$;
reset role;
rollback;
