-- Isi JSON sumber dari berkas lokal melalui SET LOCAL matoer.impor_pdf_source sebelum DO.
-- Data rinci dokumen sumber tidak disimpan di repository.
-- SATU KALI; hanya Kominot 1 November 2026. Default ROLLBACK; COMMIT setelah verifikasi.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
lock table public.transaksi,public.item_transaksi,public.pembayaran,public.mutasi_stok,public.stok,public.sesi_kas,public.pesanan_draft in share row exclusive mode;
do $op$
declare
 o uuid;sid uuid;ids uuid[];v_batch uuid;tid uuid;r jsonb;rows jsonb;n bigint;tbl text;where_sql text;h text;before_hash jsonb;after_hash jsonb;cash_expected bigint;src jsonb := current_setting('matoer.impor_pdf_source')::jsonb;
begin
 select id into strict o from outlet where nama='Ruma Kopi Kominot' and mode='asli' and deleted_at is null;
 select array_agg(id),min(sesi_kas_id::text)::uuid into ids,sid from transaksi where outlet_id=o and mode='asli' and (created_at at time zone 'Asia/Jakarta')::date='2026-11-01';
 if cardinality(ids)<>15 or (select sum(total) from transaksi where id=any(ids))<>636000 then raise exception 'Data target berubah; hentikan dan periksa';end if;
 if (select count(distinct sesi_kas_id) from transaksi where id=any(ids))<>1 or exists(select 1 from transaksi where id=any(ids) and (sumber_penjualan is not null or status<>'lunas' or draft_id is not null)) then raise exception 'Target tidak sesuai snapshot';end if;
 if exists(select 1 from pesanan_draft where transaksi_id=any(ids)) or exists(select 1 from matur_internal.pos_pending) or exists(select 1 from sesi_kas where id=sid and pending_offline>0) or exists(select 1 from pos_perangkat where outlet_id=o and antrean_jumlah>0) then raise exception 'Ada relasi draft/antrean, hentikan';end if;
 if jsonb_array_length(src->'rows')<>38 or (select sum((v->>'total')::bigint) from jsonb_array_elements(src->'rows')v)<>1758000 or (select sum((v->>'qty')::int) from jsonb_array_elements(src->'rows')v)<>82 then raise exception 'Dokumen sumber tidak valid';end if;
 -- Checksum transaksi di luar target (termasuk Demo, tanggal lain); gudang; master; pengeluaran.
 select jsonb_build_object('transaksi_lain',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from transaksi t where not(id=any(ids))),
 'stok_lain',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from stok t where outlet_id is distinct from o),
 'mutasi_lain',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from mutasi_stok t where ref_id is null or not(ref_id=any(ids))),
 'outlet',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from outlet t),
 'menu',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from menu t),
 'biaya',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from biaya_outlet t)) into before_hash;
 insert into arsip_operasional_internal.batch(alasan,dipertahankan) values('Penggantian 15 transaksi Kominot 1 November 2026 dengan 38 transaksi PDF asli atas persetujuan pemilik. Rincian item/HPP tidak direka.',before_hash) returning id into v_batch;
 foreach tbl in array array['transaksi','item_transaksi','pembayaran','mutasi_stok','stok','sesi_kas'] loop
  where_sql:=case tbl when 'transaksi' then format('id=any(%L::uuid[])',ids) when 'item_transaksi' then format('transaksi_id=any(%L::uuid[])',ids) when 'pembayaran' then format('transaksi_id=any(%L::uuid[])',ids) when 'mutasi_stok' then format('ref_id=any(%L::uuid[])',ids) when 'stok' then format('outlet_id=%L::uuid',o) else format('id=%L::uuid',sid) end;
  execute format('select count(*),coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where %s',tbl,where_sql) into n,rows;
  insert into arsip_operasional_internal.snapshot(batch_id,tabel,jumlah,data,checksum) values(v_batch,'public.'||tbl,n,rows,md5(rows::text));
 end loop;
 if exists(select 1 from mutasi_stok where ref_id=any(ids) and jenis<>'pemakaian') then raise exception 'Mutasi target bukan hanya pemakaian';end if;
 if exists(select 1 from mutasi_stok m where ref_id=any(ids) and not exists(select 1 from stok s where s.outlet_id=m.outlet_id and s.mode=m.mode and s.bahan_id=m.bahan_id)) then raise exception 'Saldo stok target hilang';end if;
 update stok s set jumlah=s.jumlah-m.qty from (select outlet_id,mode,bahan_id,sum(jumlah) qty from mutasi_stok where ref_id=any(ids) group by outlet_id,mode,bahan_id)m where s.outlet_id=m.outlet_id and s.mode=m.mode and s.bahan_id=m.bahan_id;
 delete from mutasi_stok where ref_id=any(ids);
 delete from transaksi where id=any(ids);
 for r in select value from jsonb_array_elements(src->'rows') loop
  insert into transaksi(outlet_id,sesi_kas_id,nomor,kanal,tipe,pelanggan,catatan,subtotal,total,status,status_pesanan,created_at,operator_nama,sumber_penjualan)
  values(o,sid,split_part(r->>'ref','-',3)::int,case when r->>'method'='Grab-Food' then 'grabfood'::kanal_jual else 'langsung'::kanal_jual end,'take_away','Default Customer',
   'Impor PDF historis; tipe pesanan/kasir/HPP dan alokasi item tidak tersedia pada sumber.',(r->>'total')::bigint,(r->>'total')::bigint,'lunas','diambil',('2026-11-01 '||(r->>'time')||':00+07')::timestamptz,'Impor dokumen',
   r||jsonb_build_object('file',src->>'file','sha256',src->>'sha256','batch',v_batch,'pajak',0,'service_charge',0,'penyesuaian',0)) returning id into tid;
  insert into pembayaran(transaksi_id,metode,nominal,diterima) values(tid,case r->>'method' when 'Cash' then 'tunai'::metode_bayar when 'Qris' then 'qris'::metode_bayar when 'Grab-Food' then 'grabfood'::metode_bayar when 'Shopee-Pay' then 'shopeepay'::metode_bayar end,(r->>'total')::bigint,null);
 end loop;
 -- Kas aktual/setoran tetap fakta lama. Perbarui ekspektasi & selisih, bukan mengarang uang diterima.
 select s.modal_laci+coalesce((select sum(p.nominal) from pembayaran p join transaksi t on t.id=p.transaksi_id where t.sesi_kas_id=sid and t.status='lunas' and p.metode='tunai'),0)-coalesce((select sum(jumlah) from biaya_outlet where sesi_kas_id=sid and sumber='laci' and deleted_at is null),0)-coalesce((select sum(jumlah) from pos_kas_keluar where sesi_id=sid),0) into cash_expected from sesi_kas s where s.id=sid;
 update sesi_kas set kas_seharusnya=cash_expected,seharusnya=cash_expected-modal_laci,selisih=coalesce(fisik_akhir,setoran+modal_laci)-cash_expected,catatan_tutup=concat_ws(E'\n',nullif(catatan_tutup,''),'Penjualan 1 November diganti PDF asli 38 transaksi. Aktual/setoran lama dipertahankan; Finance perlu mencocokkan fisik. Batch '||v_batch) where id=sid;
 if (select count(*) from transaksi where outlet_id=o and mode='asli' and (created_at at time zone 'Asia/Jakarta')::date='2026-11-01')<>38 or (select sum(total) from transaksi where outlet_id=o and mode='asli' and (created_at at time zone 'Asia/Jakarta')::date='2026-11-01')<>1758000 then raise exception 'Rekonsiliasi gagal';end if;
 select jsonb_build_object('transaksi_lain',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from transaksi t where sumber_penjualan->>'batch' is distinct from v_batch::text),
 'stok_lain',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from stok t where outlet_id is distinct from o),
 'mutasi_lain',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from mutasi_stok t),
 'outlet',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from outlet t),
 'menu',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from menu t),
 'biaya',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from biaya_outlet t)) into after_hash;
 if before_hash<>after_hash then raise exception 'Data di luar lingkup berubah; rollback';end if;
 update arsip_operasional_internal.batch set ringkasan=jsonb_build_object('tanggal','2026-11-01','outlet','Ruma Kopi Kominot','lama_transaksi',15,'lama_total',636000,'baru_transaksi',38,'qty',82,'baru_total',1758000,'sumber_sha256',src->>'sha256','master_dan_data_lain_utuh',true,'kas_ekspektasi',cash_expected) where id=v_batch;
 perform set_config('impor_pdf.batch',v_batch::text,true);
end $op$;
select id,ringkasan from arsip_operasional_internal.batch where id=current_setting('impor_pdf.batch')::uuid;
rollback;
