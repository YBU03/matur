-- Koreksi historis terautentikasi: idempoten, sidik, audit dan rekalkulasi kas.
alter table public.transaksi add column koreksi_penjualan jsonb;
comment on column public.transaksi.koreksi_penjualan is 'Metadata penjualan susulan Akunting; terpisah dari impor PDF tanpa rincian.';
create schema penjualan_internal;
revoke all on schema penjualan_internal from public,anon;
grant usage on schema penjualan_internal to authenticated;
create table penjualan_internal.permintaan(id uuid primary key,payload text not null,hasil jsonb not null,pengguna uuid not null);
alter table penjualan_internal.permintaan enable row level security;
revoke all on penjualan_internal.permintaan from public,anon,authenticated;
create function penjualan_internal.rincian(tid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('transaksi',to_jsonb(t),'sidik',rekonsiliasi_internal.sidik_transaksi(t.id),
 'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from public.item_transaksi i where i.transaksi_id=t.id),
 'bayar',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.pembayaran b where b.transaksi_id=t.id),
 'riwayat',(select coalesce(jsonb_agg(x order by x->>'waktu' desc),'[]') from (select jsonb_build_object('waktu',l.waktu,'aksi',l.aksi,'lama',l.nilai_lama,'baru',l.nilai_baru,'nama',(select nama from public.pengguna where id=l.pengguna_id)) x from public.log_aktivitas l where l.entitas='transaksi' and l.entitas_id=t.id::text order by l.waktu desc limit 30) z))
 from public.transaksi t where t.id=tid and t.mode='asli' and auth.uid() is not null and public.punya_peran('{owner,admin_pusat,finance}') and public.boleh_outlet(t.outlet_id)
$$;
create function public.rincian_koreksi_penjualan(tid uuid) returns jsonb language sql security invoker set search_path='' as $$select penjualan_internal.rincian(tid)$$;
create function penjualan_internal.simpan(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); req uuid:=(p->>'request_id')::uuid; tid uuid:=nullif(p->>'id','')::uuid;
 aksi text:=p->>'aksi'; alasan text:=trim(p->>'alasan'); o uuid:=(p->>'outlet_id')::uuid;
 t public.transaksi; s public.sesi_kas; m public.menu; oldi public.item_transaksi;
 sebelum jsonb; sesudah jsonb; tersimpan penjualan_internal.permintaan; h jsonb; r record; it jsonb;
 sub bigint:=0; biaya bigint:=0; disk bigint:=coalesce((p->>'diskon')::bigint,0); harga bigint; qty int; ih bigint; no int;
 waktu timestamptz; tanggal date; sid uuid; vids uuid[]; items jsonb:='[]'; stok_baru jsonb:='{}'; stok_lama jsonb:='{}'; resep_lama jsonb:='{}'; delta numeric;
 dilewati jsonb:='[]'; metode public.metode_bayar; v_kanal public.kanal_jual; hasil jsonb; cash bigint; sidik_preview text; preview_detail text; preview boolean:=coalesce((p->>'pratinjau')::boolean,false);
begin
 if uid is null or not public.punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Akunting';end if;
 if req is null or aksi is null or aksi not in ('tambah','edit','hapus','pulihkan') or length(coalesce(alasan,''))<3 or length(alasan)>500 then raise exception 'Isi aksi dan alasan (3–500 huruf)';end if;
 perform pg_advisory_xact_lock(hashtextextended('koreksi-penjualan:'||req,0));
 select * into tersimpan from penjualan_internal.permintaan where id=req;
 if found then
  if tersimpan.pengguna<>uid or tersimpan.payload<>md5(p::text) then raise exception 'ID permintaan sudah dipakai untuk data berbeda';end if;
  return tersimpan.hasil;
 end if;
 if aksi<>'tambah' then
  select * into t from public.transaksi where id=tid;
  if t.id is null or t.mode<>'asli' or not public.boleh_outlet(t.outlet_id) then raise exception 'Transaksi tidak tersedia';end if;
  o:=t.outlet_id;
 end if;
 if o is null or not public.boleh_outlet(o) then raise exception 'Outlet tidak diizinkan';end if;
 perform id from public.outlet where id=o and mode='asli' and deleted_at is null for update;
 if not found then raise exception 'Outlet tidak tersedia';end if;
 -- Kunci kas sebelum transaksi mengikuti alur rekonsiliasi pengeluaran.
 if aksi='tambah' then sid:=(p->>'sesi_id')::uuid;else sid:=t.sesi_kas_id;end if;
 select * into s from public.sesi_kas where id=sid for update;
 if s.id is null or s.outlet_id<>o or s.mode<>'asli' or s.ditutup_at is null or coalesce(s.pending_offline,0)>0 then raise exception 'Pilih shift tertutup tanpa antrean offline';end if;
 if exists(select 1 from public.pos_perangkat where outlet_id=o and coalesce(antrean_jumlah,0)>0) then raise exception 'Masih ada antrean offline outlet. Sinkronkan dahulu agar tidak dobel';end if;
 if aksi<>'tambah' then
  select * into t from public.transaksi where id=tid for update;
  if t.sesi_kas_id<>s.id or rekonsiliasi_internal.sidik_transaksi(tid) is distinct from p->>'sidik' then raise exception 'Transaksi berubah. Muat ulang';end if;
  sebelum:=penjualan_internal.rincian(tid);
  if aksi='pulihkan' then
   if t.status<>'dihapus' or t.status_sebelum<>'lunas' then raise exception 'Hanya penjualan lunas di tempat sampah yang bisa dipulihkan';end if;
  elsif t.status<>'lunas' then raise exception 'Hanya transaksi lunas yang bisa diperbaiki';end if;
 end if;
 sidik_preview:=md5(jsonb_build_object('sesi',to_jsonb(s),'hitung',matur_internal.kas_ringkas(s.id),'transaksi',sebelum,
 'stok',(select md5(coalesce(jsonb_agg(to_jsonb(st) order by st.id),'[]')::text) from public.stok st where st.outlet_id=o),
 'so',(select max(op.created_at) from public.opname op where op.outlet_id=o),
 'resep',(select md5(coalesce(jsonb_agg(to_jsonb(rp) order by rp.id),'[]')::text) from public.resep rp),
 'hpp',(select md5(coalesce(jsonb_agg(jsonb_build_array(b.id,b.harga_pokok) order by b.id),'[]')::text) from public.bahan b),
 'menu',(select md5(coalesce(jsonb_agg(jsonb_build_array(mn.id,mn.titipan,mn.harga_titip,mn.deleted_at) order by mn.id),'[]')::text) from public.menu mn),
 'p',p-'pratinjau'-'sidik_preview')::text);
 if not preview and sidik_preview is distinct from p->>'sidik_preview' then raise exception 'Perhitungan berubah. Lihat pratinjau kembali';end if;
 if aksi in ('tambah','edit') then
  if aksi='edit' then
   for r in select rp.bahan_id,sum(rp.takaran*i.qty*case when rp.varian_id is null then 1 else matur_internal.jumlah_varian(rp.varian_id,i.varian_ids) end) jml from public.item_transaksi i join public.resep rp on rp.menu_id=i.menu_id where i.transaksi_id=tid and rp.deleted_at is null and (rp.varian_id is null or rp.varian_id=any(i.varian_ids)) group by rp.bahan_id loop
    resep_lama:=jsonb_set(resep_lama,array[r.bahan_id::text],to_jsonb(-r.jml));
   end loop;
  end if;
  if aksi='edit' and t.sumber_penjualan is not null then raise exception 'Impor dokumen lama: perbaiki dari dokumen sumber agar rincian dan laporan tidak bertentangan';end if;
  if aksi='edit' and (t.promo_snapshot is not null or exists(select 1 from public.pembayaran where transaksi_id=tid group by transaksi_id having count(*)<>1)) then raise exception 'Transaksi promo/split: gunakan koreksi kanal/metode atau batalkan dan catat pengganti dengan bukti';end if;
  tanggal:=(p->>'tanggal')::date;
  if tanggal is null or tanggal<>coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at)) or tanggal>public.tgl_op(now()) then raise exception 'Tanggal harus sesuai shift asli dan tidak boleh masa depan';end if;
  if aksi='edit' and tanggal<>public.tgl_op(t.created_at) then raise exception 'Pemindahan tanggal: batalkan dan catat pengganti pada shift tujuan';end if;
  waktu:=case when aksi='edit' then t.created_at else ((tanggal+case when coalesce(nullif(p->>'jam',''),'21:00')::time<time '03:00' then 1 else 0 end)::text||'T'||coalesce(nullif(p->>'jam',''),'21:00')||':00+07:00')::timestamptz end;
  if public.tgl_op(waktu)<>tanggal then raise exception 'Jam di luar tanggal operasional';end if;
  v_kanal:=(p->>'kanal')::public.kanal_jual;metode:=(p->>'metode')::public.metode_bayar;
  if v_kanal is null or metode is null then raise exception 'Pilih kanal dan metode pembayaran';end if;
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 100 then raise exception 'Isi 1–100 baris menu';end if;
  for it in select value from jsonb_array_elements(p->'items') loop
   select * into m from public.menu where id=(it->>'menu_id')::uuid and mode='asli' and deleted_at is null;
   if m.id is null then raise exception 'Menu tidak tersedia';end if;
   qty:=(it->>'qty')::int;harga:=(it->>'harga')::bigint;
   if qty is null or qty not between 1 and 1000 or harga is null or harga not between 0 and 100000000 then raise exception 'Jumlah/harga menu tidak valid';end if;
   vids:=coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(it->'varian_ids','[]'))x),'{}');
   if exists(select 1 from unnest(vids)v where not exists(select 1 from public.varian where id=v and menu_id=m.id and deleted_at is null)) then raise exception 'Varian tidak sesuai menu';end if;
   oldi:=null;
   if aksi='edit' then select * into oldi from public.item_transaksi where transaksi_id=tid and id=nullif(it->>'id','')::uuid and menu_id=m.id and varian_ids=vids;end if;
   ih:=case when oldi.id is not null then oldi.hpp_teoritis when m.titipan then coalesce(m.harga_titip,0) else coalesce((select round(sum(rp.takaran*b.harga_pokok*case when rp.varian_id is null then 1 else matur_internal.jumlah_varian(rp.varian_id,vids) end)) from public.resep rp join public.bahan b on b.id=rp.bahan_id where rp.menu_id=m.id and rp.deleted_at is null and (rp.varian_id is null or rp.varian_id=any(vids))),0) end;
   items:=items||jsonb_build_array(jsonb_build_object('menu_id',m.id,'nama',case when oldi.id is not null then oldi.nama else m.nama end,'qty',qty,'harga',harga,'hpp',ih,'varian_ids',to_jsonb(vids)));
   sub:=sub+qty*harga;biaya:=biaya+qty*ih;
   for r in select rp.bahan_id,sum(rp.takaran*qty*case when rp.varian_id is null then 1 else matur_internal.jumlah_varian(rp.varian_id,vids) end) jml from public.resep rp where rp.menu_id=m.id and rp.deleted_at is null and (rp.varian_id is null or rp.varian_id=any(vids)) group by rp.bahan_id loop
    stok_baru:=jsonb_set(stok_baru,array[r.bahan_id::text],to_jsonb(coalesce((stok_baru->>r.bahan_id::text)::numeric,0)-r.jml));
   end loop;
  end loop;
  if disk<0 or disk>=sub then raise exception 'Diskon harus lebih kecil dari subtotal';end if;
  if aksi='tambah' then
   tid:=gen_random_uuid();select coalesce(max(nomor),0)+1 into no from public.transaksi where outlet_id=o and public.tgl_op(created_at)=tanggal;
   insert into public.transaksi(id,client_id,outlet_id,sesi_kas_id,nomor,kanal,tipe,catatan,subtotal,diskon,total,hpp_teoritis,status,status_pesanan,dibuat_oleh,operator_nama,created_at,koreksi_penjualan)
   values(tid,req,o,s.id,no,v_kanal,'take_away',alasan,sub,disk,sub-disk,biaya,'lunas','diambil',uid,'Koreksi Akunting',waktu,jsonb_build_object('jenis','susulan_akunting','jam_pasti',coalesce((p->>'jam_pasti')::boolean,false),'alasan',alasan,'dicatat_at',now(),'hpp_basis','Resep/HPP saat pencatatan; data baru dibekukan'));
  else
   update public.transaksi set kanal=v_kanal,subtotal=sub,diskon=disk,total=sub-disk,hpp_teoritis=biaya where id=tid;
   delete from public.item_transaksi where transaksi_id=tid;
   delete from public.pembayaran where transaksi_id=tid;
  end if;
  for it in select value from jsonb_array_elements(items) loop
   insert into public.item_transaksi(transaksi_id,menu_id,nama,qty,harga,hpp_teoritis,varian_ids)
   values(tid,(it->>'menu_id')::uuid,it->>'nama',(it->>'qty')::int,(it->>'harga')::bigint,(it->>'hpp')::bigint,array(select x::uuid from jsonb_array_elements_text(it->'varian_ids')x));
  end loop;
  insert into public.pembayaran(transaksi_id,metode,nominal,diterima) values(tid,metode,sub-disk,case when metode='tunai' then sub-disk end);
 else
  if aksi='hapus' then
   stok_baru:='{}';
   update public.transaksi set status_sebelum=status,status='dihapus',dihapus_at=now(),dihapus_oleh=uid,dihapus_alasan=alasan where id=tid;
  else
   -- Gunakan snapshot net tepat sebelum dihapus, bukan pemakaian awal yang bisa sudah dikoreksi.
   select l.nilai_baru->'stok_sebelum' into stok_baru from public.log_aktivitas l where l.entitas='transaksi' and l.entitas_id=tid::text and l.aksi='akunting_hapus' order by l.waktu desc limit 1;
   if stok_baru is null then raise exception 'Pulihkan transaksi lama melalui tempat sampah Laporan POS';end if;
   update public.transaksi set status='lunas',status_sebelum=null,dihapus_at=null,dihapus_oleh=null,dihapus_alasan=null where id=tid;
  end if;
 end if;
 select coalesce(jsonb_object_agg(bahan_id,jml),'{}') into stok_lama from (select bahan_id,sum(jumlah) jml from public.mutasi_stok where ref_id=tid and jenis in ('pemakaian','koreksi','void') group by bahan_id) q;
 if aksi='edit' then
  for r in select distinct key::uuid bahan_id from jsonb_each(stok_lama||stok_baru||resep_lama) loop
   stok_baru:=jsonb_set(stok_baru,array[r.bahan_id::text],to_jsonb(coalesce((stok_lama->>r.bahan_id::text)::numeric,0)+coalesce((stok_baru->>r.bahan_id::text)::numeric,0)-coalesce((resep_lama->>r.bahan_id::text)::numeric,0)));
  end loop;
 end if;
 for r in select distinct key::uuid bahan_id from jsonb_each(stok_lama||stok_baru) loop
  delta:=coalesce((stok_baru->>r.bahan_id::text)::numeric,0)-coalesce((stok_lama->>r.bahan_id::text)::numeric,0);
  if delta=0 then continue;end if;
  -- SO fisik telah menetapkan saldo setelah transaksi: koreksi historis tidak mengurangi/menambah saldo kini lagi.
  if exists(select 1 from public.opname op join public.item_opname io on io.opname_id=op.id where op.outlet_id=o and op.mode='asli' and io.bahan_id=r.bahan_id and op.created_at>=coalesce(t.created_at,waktu)) then
   dilewati:=dilewati||jsonb_build_array(r.bahan_id);continue;
  end if;
  perform public.geser_stok('asli',o,r.bahan_id,delta,case when aksi='tambah' then 'pemakaian' when aksi='hapus' then 'void' else 'koreksi' end,tid,'Akunting '||aksi||': '||alasan);
 end loop;
 h:=matur_internal.kas_ringkas(s.id);cash:=(h->>'seharusnya')::bigint-s.modal_laci;
 update public.sesi_kas set seharusnya=cash,kas_seharusnya=(h->>'seharusnya')::bigint,selisih=case when setoran is null then null else setoran-cash end where id=s.id;
 sesudah:=penjualan_internal.rincian(tid);
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)
 values(uid,'akunting_'||aksi,'transaksi',tid::text,sebelum-'riwayat',jsonb_build_object('alasan',alasan,'data',sesudah-'riwayat','kas_lama',to_jsonb(s),'seharusnya',cash,'setoran_tetap',s.setoran,'stok_sebelum',stok_lama,'stok_dilewati_so',dilewati,'hpp_basis','HPP lama dipertahankan untuk item yang sama; item baru memakai resep sekarang'));
 hasil:=jsonb_build_object('id',tid,'total',(sesudah->'transaksi'->>'total')::bigint,'ok','Tersimpan. Laporan dan kas diperbarui; setoran aktual dipertahankan.','stok_dilewati_so',dilewati,'sidik_preview',sidik_preview,'pratinjau',preview,'kas_sebelum',jsonb_build_object('setoran',s.setoran,'seharusnya',s.seharusnya,'selisih',s.selisih),'kas_sesudah',jsonb_build_object('setoran',s.setoran,'seharusnya',cash,'selisih',s.setoran-cash));
 if preview then raise exception using errcode='PZ001',message='Pratinjau tanpa penyimpanan',detail=hasil::text;end if;
 insert into penjualan_internal.permintaan values(req,md5(p::text),hasil,uid);
 return hasil;
exception when sqlstate 'PZ001' then
 get stacked diagnostics preview_detail=PG_EXCEPTION_DETAIL;
 return preview_detail::jsonb;
end $$;
create function public.simpan_koreksi_penjualan(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select penjualan_internal.simpan(p)$$;
revoke all on all functions in schema penjualan_internal from public,anon,authenticated;
grant execute on function penjualan_internal.rincian(uuid),penjualan_internal.simpan(jsonb) to authenticated;
revoke all on function public.rincian_koreksi_penjualan(uuid),public.simpan_koreksi_penjualan(jsonb) from public,anon;
grant execute on function public.rincian_koreksi_penjualan(uuid),public.simpan_koreksi_penjualan(jsonb) to authenticated;
-- Rincian kartu menggunakan sumber yang sama dengan kas shift, termasuk biaya beda tanggal.
create function penjualan_internal.dasar_kas(o uuid,d date,s date) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'hitung',matur_internal.kas_ringkas(k.id)) order by k.id),'[]') from public.sesi_kas k
 where k.outlet_id=o and k.mode='asli' and coalesce(k.tanggal_shift,public.tgl_op(k.dibuka_at))>=d and coalesce(k.tanggal_shift,public.tgl_op(k.dibuka_at))<s
 and auth.uid() is not null and public.punya_peran('{owner,admin_pusat,finance,spv}') and public.boleh_outlet(o)
$$;
create function public.dasar_kas_harian(o uuid,d date,s date) returns jsonb language sql security invoker set search_path='' as $$select penjualan_internal.dasar_kas(o,d,s)$$;
revoke all on function penjualan_internal.dasar_kas(uuid,date,date),public.dasar_kas_harian(uuid,date,date) from public,anon;
grant execute on function penjualan_internal.dasar_kas(uuid,date,date),public.dasar_kas_harian(uuid,date,date) to authenticated;
