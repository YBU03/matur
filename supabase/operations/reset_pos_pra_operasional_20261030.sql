-- ONE-OFF, BUKAN MIGRASI OTOMATIS. Pemilik menyatakan semua penjualan/pengeluaran adalah latihan.
-- Jalankan lebih dulu dengan ROLLBACK; ganti terminator dengan COMMIT hanya setelah hasil diverifikasi.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
lock table public.transaksi,public.sesi_kas,public.pembayaran,public.item_transaksi,public.pesanan_draft,public.biaya_outlet,public.penjualan_manual,public.produk_keluar,public.stok,public.mutasi_stok in access exclusive mode;
do $$
declare v_batch uuid;tbl text;rec record;rows jsonb;n bigint;h text;before_hash jsonb:='{}';after_hash jsonb:='{}';tables text[];
 masters text[]:=array['public.outlet','public.menu','public.varian','public.resep','public.bahan','public.pengguna','public.penugasan','public.absensi','public.jadwal_shift','public.penggajian','public.laporan_bulanan','public.kiriman','public.item_kiriman','public.pos_perangkat','matur_internal.pos_outlet_akses','matur_internal.pos_perangkat_rahasia','pos_kas_internal.aturan_shift'];
begin
 if (select count(*) from transaksi)<>3415 then raise exception 'Jumlah transaksi berubah, periksa ulang sebelum reset';end if;
 if (select count(*) from biaya_outlet)<>31 then raise exception 'Pengeluaran berubah, periksa ulang sebelum reset';end if;
 if exists(select 1 from matur_internal.pos_pending) or exists(select 1 from sesi_kas where coalesce(pending_offline,0)>0) or exists(select 1 from pos_perangkat where coalesce(antrean_jumlah,0)>0) then raise exception 'Masih ada antrean offline';end if;
 if exists(select 1 from penggajian where biaya_id is not null) or exists(select 1 from belanja_bahan_outlet) or exists(select 1 from setoran_omzet) then raise exception 'Ada relasi keuangan lain, jangan reset tanpa pemeriksaan';end if;
 if exists(select 1 from mutasi_stok where mode='asli' and jenis='pemakaian' and not exists(select 1 from transaksi t where t.id=ref_id)) then raise exception 'Ada pemakaian stok bukan transaksi yang disetujui';end if;
 foreach tbl in array masters loop
  execute format('lock table %s in share row exclusive mode',tbl);
  execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text) from %s t',tbl) into n,h;
  before_hash:=before_hash||jsonb_build_object(tbl,jsonb_build_object('jumlah',n,'checksum',h));
 end loop;
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]')::text) into h from stok s where outlet_id is null;
 before_hash:=before_hash||jsonb_build_object('stok_gudang',h);
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]')::text) into h from mutasi_stok s where mode='asli' and jenis<>'pemakaian';
 before_hash:=before_hash||jsonb_build_object('mutasi_gudang',h);
 insert into arsip_operasional_internal.batch(alasan,dipertahankan) values('Reset pra-operasional 1 November 2026 atas permintaan pemilik; seluruh transaksi dan pengeluaran latihan, termasuk label asli, disetujui dibersihkan.',before_hash) returning id into v_batch;
 tables:=array['public.transaksi','public.item_transaksi','public.pembayaran','public.pesanan_draft','public.sesi_kas','public.biaya_outlet','public.penjualan_manual','public.produk_keluar','public.stok','public.mutasi_stok','public.rekonsiliasi_kas_harian'];
 for rec in select distinct conrelid::regclass::text tbl from pg_constraint where contype='f' and confrelid='public.sesi_kas'::regclass loop
  if not rec.tbl=any(tables) and not ('public.'||rec.tbl)=any(tables) then tables:=array_append(tables,rec.tbl);end if;
 end loop;
 foreach tbl in array tables loop
  execute format('lock table %s in access exclusive mode',tbl);
  execute format('select count(*),coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from %s t',tbl) into n,rows;
  insert into arsip_operasional_internal.snapshot(batch_id,tabel,jumlah,data,checksum) values(v_batch,tbl,n,rows,md5(rows::text));
 end loop;
 -- Pulihkan persis pemakaian transaksi, tanpa menimpa stok awal/pembelian/kiriman gudang.
 update stok s set jumlah=s.jumlah-m.qty from (
  select mode,outlet_id,bahan_id,sum(jumlah) qty from mutasi_stok where mode='asli' and jenis='pemakaian' and ref_id in(select id from transaksi) group by mode,outlet_id,bahan_id
 )m where s.mode=m.mode and s.outlet_id=m.outlet_id and s.bahan_id=m.bahan_id;
 delete from mutasi_stok where mode='simulasi' or (jenis='pemakaian' and ref_id in(select id from transaksi));
 delete from stok where mode='simulasi' and outlet_id is not null;
 -- Batalkan kaitan draft dua arah sebelum menghapus pesanan dan penjualan.
 update transaksi set draft_id=null where draft_id is not null;
 delete from pesanan_draft;
 delete from transaksi; -- item_transaksi dan pembayaran ON DELETE CASCADE.
 -- Pelindung biaya final tetap aktif. Penanda kas tim pada baris latihan tertutup
 -- dinetralkan hanya di transaksi terkunci ini sebelum biaya dan kas dihapus.
 -- Tidak membuka kas lama atau menonaktifkan trigger/aturan aplikasi secara global.
 update sesi_kas set pos_tim=false where ditutup_at is not null and pos_tim;
 delete from biaya_outlet;
 delete from penjualan_manual;
 delete from produk_keluar where mode='simulasi';
 delete from rekonsiliasi_kas_harian;
 for rec in
  select conrelid::regclass::text tbl,a.attname col from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid='public.sesi_kas'::regclass and c.conrelid not in('public.transaksi'::regclass,'public.biaya_outlet'::regclass,'public.pesanan_draft'::regclass)
 loop
  execute format('delete from %s where %I in(select id from public.sesi_kas)',rec.tbl,rec.col);
 end loop;
 delete from sesi_kas;
 foreach tbl in array masters loop
  execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text) from %s t',tbl) into n,h;
  after_hash:=after_hash||jsonb_build_object(tbl,jsonb_build_object('jumlah',n,'checksum',h));
 end loop;
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]')::text) into h from stok s where outlet_id is null;
 after_hash:=after_hash||jsonb_build_object('stok_gudang',h);
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]')::text) into h from mutasi_stok s where mode='asli' and jenis<>'pemakaian';
 after_hash:=after_hash||jsonb_build_object('mutasi_gudang',h);
 if before_hash<>after_hash then raise exception 'Data yang harus dipertahankan berubah; seluruh reset dibatalkan';end if;
 if exists(select 1 from transaksi) or exists(select 1 from pembayaran) or exists(select 1 from item_transaksi) or exists(select 1 from biaya_outlet) or exists(select 1 from sesi_kas) or exists(select 1 from penjualan_manual) then raise exception 'Pembersihan belum tuntas';end if;
 if exists(select 1 from stok where outlet_id is not null and jumlah<>0) then raise exception 'Stok outlet tidak sesuai saldo awal setelah pemulihan';end if;
 update arsip_operasional_internal.batch set ringkasan=jsonb_build_object('transaksi',3415,'biaya',31,'master_dan_gudang_utuh',true,'hasil','bersih','snapshots',(select jsonb_object_agg(tabel,jumlah) from arsip_operasional_internal.snapshot where batch_id=v_batch)) where id=v_batch;
 perform set_config('reset_pos.batch',v_batch::text,true);
end $$;
select id,created_at,ringkasan from arsip_operasional_internal.batch where id=current_setting('reset_pos.batch')::uuid;
rollback;
