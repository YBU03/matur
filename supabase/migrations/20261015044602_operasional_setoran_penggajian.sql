-- Sistem pengiriman, setoran omzet, akses persediaan dan komponen gaji.
-- All evidence stays in private Storage. RPCs validate roles/outlet inside each transaction.
create schema if not exists matur_internal;
revoke all on schema matur_internal from public, anon, authenticated;

create or replace function public.operasional_boleh(o uuid, jenis text) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and case when jenis='kiriman' then
   punya_peran('{owner,admin_pusat,admin_gudang,finance}') or peran_di_outlet(o,'{kasir,barista,spv}')
 else punya_peran('{owner,admin_pusat,finance}') or peran_di_outlet(o,'{kasir,barista,spv}') end
$$;
revoke all on function public.operasional_boleh(uuid,text) from public,anon;
grant execute on function public.operasional_boleh(uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('operasional-bukti','operasional-bukti',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy operasional_upload on storage.objects for insert to authenticated with check (
 bucket_id='operasional-bukti' and (storage.foldername(name))[1] in ('kiriman','setoran')
 and (storage.foldername(name))[3]=auth.uid()::text
 and operasional_boleh(((storage.foldername(name))[2])::uuid,(storage.foldername(name))[1]));
create policy operasional_read on storage.objects for select to authenticated using (
 bucket_id='operasional-bukti' and (storage.foldername(name))[1] in ('kiriman','setoran')
 and operasional_boleh(((storage.foldername(name))[2])::uuid,(storage.foldername(name))[1]));
create policy operasional_cleanup on storage.objects for delete to authenticated using (
 bucket_id='operasional-bukti' and (storage.foldername(name))[3]=auth.uid()::text
 and created_at>now()-interval '1 hour');

-- Shipment receipts are append-only. Rejected goods are not silently put back in warehouse stock.
alter table kiriman add column kiriman_induk_id uuid references kiriman;
alter table kiriman add column pemeriksaan_status text not null default 'belum' check(pemeriksaan_status in ('belum','selisih','selesai'));
alter table kiriman add column total_kirim bigint not null default 0;
alter table kiriman add column penyelesaian text;
update kiriman set total_kirim=total, pemeriksaan_status=case when status='diterima' then 'selesai' else 'belum' end;
create table penerimaan_kiriman (
 id uuid primary key default gen_random_uuid(),client_id uuid not null unique,
 kiriman_id uuid not null references kiriman, outlet_id uuid not null references outlet,
 penerima_id uuid not null references pengguna,penerima_nama text not null,
 waktu timestamptz not null default now(),items jsonb not null,catatan text,foto_path text
);
create index on penerimaan_kiriman(kiriman_id,waktu);
alter table penerimaan_kiriman enable row level security;
create policy baca on penerimaan_kiriman for select to authenticated using(operasional_boleh(outlet_id,'kiriman'));
grant select on penerimaan_kiriman to authenticated;

create or replace function periksa_kiriman(p_id uuid,p_client uuid,p_items jsonb,p_catatan text,p_foto text) returns uuid
language plpgsql security definer set search_path=public as $$
declare k kiriman; i item_kiriman; x jsonb; baik numeric; rusak numeric; salah numeric; lama numeric; tersedia numeric; rid uuid; nm text;
begin
 select * into k from kiriman where id=p_id and deleted_at is null for update;
 if k.id is null or not (gudang_pusat() or peran_di_outlet(k.outlet_id,'{kasir,barista,spv}')) then raise exception 'Tidak diizinkan menerima kiriman'; end if;
 select id into rid from penerimaan_kiriman where client_id=p_client and kiriman_id=p_id and penerima_id=auth.uid();
 if rid is not null then return rid; end if;
 if k.status<>'dikirim' then raise exception 'Kiriman sudah selesai atau belum dikirim'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)<>(select count(*) from item_kiriman where kiriman_id=p_id) then raise exception 'Periksa seluruh barang'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) jv group by jv->>'id' having count(*)>1) then raise exception 'Item berulang'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) jv where not exists(select 1 from item_kiriman where id=(jv->>'id')::uuid and kiriman_id=p_id)) then raise exception 'Item bukan milik kiriman'; end if;
 if nullif(p_foto,'') is not null and not exists(select 1 from storage.objects where bucket_id='operasional-bukti' and name=p_foto and name like 'kiriman/'||k.outlet_id||'/'||auth.uid()||'/%') then raise exception 'Bukti foto tidak valid'; end if;
 for i in select * from item_kiriman where kiriman_id=p_id order by id for update loop
   select z into x from jsonb_array_elements(p_items) z where z->>'id'=i.id::text;
   baik:=(x->>'baik')::numeric; rusak:=(x->>'rusak')::numeric; salah:=(x->>'salah')::numeric;
   if baik is null or rusak is null or salah is null or least(baik,rusak,salah)<0 then raise exception 'Jumlah pemeriksaan tidak valid'; end if;
   select coalesce(sum((j->>'baik')::numeric+(j->>'rusak')::numeric+(j->>'salah')::numeric),0) into lama
     from penerimaan_kiriman r cross join jsonb_array_elements(r.items) j where r.kiriman_id=p_id and j->>'id'=i.id::text;
   tersedia:=i.qty-lama;
   if baik+rusak+salah>tersedia then raise exception 'Jumlah melebihi sisa kiriman: %',i.nama; end if;
   if (rusak+salah>0 or baik<tersedia) and length(trim(coalesce(p_catatan,'')))<3 then raise exception 'Catatan wajib untuk selisih/rusak/salah'; end if;
   if rusak+salah>0 and nullif(p_foto,'') is null then raise exception 'Foto wajib untuk barang rusak atau salah'; end if;
   if baik>0 then perform geser_stok(k.mode,k.outlet_id,i.bahan_id,baik*i.konversi,'kiriman_masuk',p_id,k.nomor); end if;
   update item_kiriman set qty_diterima=coalesce(qty_diterima,0)+baik where id=i.id;
 end loop;
 select nama into nm from pengguna where id=auth.uid() and status='aktif';
 if nm is null then raise exception 'Akun penerima tidak aktif'; end if;
 insert into penerimaan_kiriman(client_id,kiriman_id,outlet_id,penerima_id,penerima_nama,items,catatan,foto_path)
 values(p_client,p_id,k.outlet_id,auth.uid(),nm,p_items,left(p_catatan,1000),nullif(p_foto,'')) returning id into rid;
 update kiriman set nama_penerima=nm,diterima_oleh=auth.uid(),
 total_kirim=case when total_kirim=0 then total else total_kirim end,
 total=(select coalesce(sum(round(coalesce(qty_diterima,0)*harga)),0) from item_kiriman where kiriman_id=p_id),
 status=case when not exists(select 1 from item_kiriman where kiriman_id=p_id and coalesce(qty_diterima,0)<qty) then 'diterima' else 'dikirim' end,
 pemeriksaan_status=case when not exists(select 1 from item_kiriman where kiriman_id=p_id and coalesce(qty_diterima,0)<qty) then 'selesai' else 'selisih' end,
 diterima_at=now() where id=p_id;
 return rid;
end $$;
revoke all on function periksa_kiriman(uuid,uuid,jsonb,text,text) from public,anon;
grant execute on function periksa_kiriman(uuid,uuid,jsonb,text,text) to authenticated;

-- Old clients remain supported but cannot restore phantom stock or accept omitted lines.
create or replace function terima_kiriman(p_id uuid,p_items jsonb,p_penerima text) returns void
language plpgsql security definer set search_path=public as $$
declare xs jsonb;
begin
 select jsonb_agg(jsonb_build_object('id',jv->>'id','baik',(jv->>'qty_diterima')::numeric,'rusak',0,'salah',0)) into xs from jsonb_array_elements(p_items) jv;
 perform periksa_kiriman(p_id,gen_random_uuid(),xs,'Penerimaan melalui formulir lama',null);
end $$;

create or replace function selesaikan_selisih_kiriman(p_id uuid,p_tindakan text,p_retur jsonb,p_catatan text) returns uuid
language plpgsql security definer set search_path=public as $$
declare k kiriman; i item_kiriman; jumlah numeric; fisik numeric; child uuid;
begin
 if not gudang_pusat() or auth.uid() is null then raise exception 'Hanya pengelola gudang'; end if;
 if p_tindakan not in ('susulan','koreksi') or length(trim(coalesce(p_catatan,'')))<3 then raise exception 'Isi tindakan dan alasan penyelesaian'; end if;
 select * into k from kiriman where id=p_id and deleted_at is null for update;
 if k.id is null or k.status<>'dikirim' or k.pemeriksaan_status<>'selisih' then raise exception 'Tidak ada selisih terbuka'; end if;
 if jsonb_typeof(p_retur) is distinct from 'array' then raise exception 'Daftar retur tidak valid'; end if;
 if exists(select 1 from jsonb_array_elements(p_retur) jv group by jv->>'id' having count(*)>1) then raise exception 'Retur berulang'; end if;
 if exists(select 1 from jsonb_array_elements(p_retur) jv where not exists(select 1 from item_kiriman where id=(jv->>'id')::uuid and kiriman_id=p_id)) then raise exception 'Item retur tidak valid'; end if;
 if p_tindakan='susulan' then insert into kiriman(outlet_id,kiriman_induk_id,pengirim,catatan) values(k.outlet_id,p_id,(select nama from pengguna where id=auth.uid()),'Susulan '||k.nomor||': '||p_catatan) returning id into child; end if;
 for i in select * from item_kiriman where kiriman_id=p_id order by id loop
   select coalesce(sum((j->>'rusak')::numeric),0) into fisik from penerimaan_kiriman r cross join jsonb_array_elements(r.items) j where r.kiriman_id=p_id and j->>'id'=i.id::text;
   select coalesce((jv->>'qty')::numeric,0) into jumlah from jsonb_array_elements(p_retur) jv where jv->>'id'=i.id::text;
   jumlah:=coalesce(jumlah,0);
   if jumlah<0 or jumlah>fisik then raise exception 'Retur melebihi barang rusak/salah yang tercatat'; end if;
   if jumlah>0 then perform geser_stok(k.mode,null,i.bahan_id,jumlah*i.konversi,'koreksi',p_id,k.nomor||' retur fisik dikonfirmasi: '||p_catatan); end if;
   if child is not null and i.qty>coalesce(i.qty_diterima,0) then
     insert into item_kiriman(kiriman_id,bahan_id,nama,satuan,konversi,qty,harga) values(child,i.bahan_id,i.nama,i.satuan,i.konversi,i.qty-coalesce(i.qty_diterima,0),i.harga);
   end if;
 end loop;
 update kiriman set status='diterima',pemeriksaan_status='selesai',penyelesaian=p_tindakan||': '||p_catatan||' | retur fisik: '||p_retur::text,
 total=(select coalesce(sum(round(coalesce(qty_diterima,0)*harga)),0) from item_kiriman where kiriman_id=p_id) where id=p_id;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'selesaikan_selisih','kiriman',p_id::text,jsonb_build_object('tindakan',p_tindakan,'retur',p_retur,'catatan',p_catatan,'susulan',child));
 return child;
end $$;
revoke all on function selesaikan_selisih_kiriman(uuid,text,jsonb,text) from public,anon;
grant execute on function selesaikan_selisih_kiriman(uuid,text,jsonb,text) to authenticated;

-- Setoran is a cash movement ledger. POS revenue is never inserted a second time.
create table setoran_omzet (
 id uuid primary key default gen_random_uuid(),client_id uuid not null unique,outlet_id uuid not null references outlet,
 cara text not null check(cara in ('tunai','transfer')),waktu timestamptz not null,
 penyetor_id uuid not null references pengguna,penyetor_nama text not null,
 pengambil text,penanggung_jawab text not null,tujuan text not null,bukti_path text not null,
 status text not null default 'menunggu' check(status in ('menunggu','disetujui','ditolak')),
 catatan text,alasan_verifikasi text,diverifikasi_oleh uuid references pengguna,diverifikasi_at timestamptz,
 created_at timestamptz not null default now()
);
create index on setoran_omzet(outlet_id,status,created_at);
create table alokasi_setoran (
 id uuid primary key default gen_random_uuid(),setoran_id uuid not null references setoran_omzet,
 tanggal date not null,jumlah bigint not null check(jumlah>0),unique(setoran_id,tanggal)
);
create index on alokasi_setoran(tanggal,setoran_id);
create table rekonsiliasi_kas_harian (
 outlet_id uuid not null references outlet,tanggal date not null,modal_ditahan bigint not null default 0 check(modal_ditahan>=0),
 koreksi bigint not null default 0,alasan text not null,diubah_oleh uuid not null references pengguna,diubah_at timestamptz not null default now(),
 primary key(outlet_id,tanggal)
);
alter table setoran_omzet enable row level security;
alter table alokasi_setoran enable row level security;
alter table rekonsiliasi_kas_harian enable row level security;
create policy baca on setoran_omzet for select to authenticated using(operasional_boleh(outlet_id,'setoran'));
create policy baca on alokasi_setoran for select to authenticated using(exists(select 1 from setoran_omzet s where s.id=setoran_id));
create policy baca on rekonsiliasi_kas_harian for select to authenticated using(operasional_boleh(outlet_id,'setoran'));
grant select on setoran_omzet,alokasi_setoran,rekonsiliasi_kas_harian to authenticated;

create or replace function rekap_setoran(p_outlet uuid,p_dari date,p_sampai date) returns jsonb
language plpgsql volatile security definer set search_path=public as $$
declare hasil jsonb;
begin
 if not operasional_boleh(p_outlet,'setoran') then raise exception 'Tidak diizinkan'; end if;
 if p_dari is null or p_sampai is null or p_sampai<p_dari or p_sampai-p_dari>92 then raise exception 'Rentang maksimal 93 hari'; end if;
 with hari as(select generate_series(p_dari,p_sampai,'1 day')::date tanggal),
 pos as(select (t.created_at at time zone 'Asia/Jakarta')::date tanggal,
   sum(p.nominal) filter(where p.metode='tunai') tunai,sum(p.nominal) filter(where p.metode='qris') qris,
   sum(p.nominal) filter(where p.metode not in ('tunai','qris')) non_tunai
   from pembayaran p join transaksi t on t.id=p.transaksi_id where t.outlet_id=p_outlet and t.mode='asli' and t.status='lunas'
   and t.created_at>=(p_dari::timestamp at time zone 'Asia/Jakarta') and t.created_at<((p_sampai+1)::timestamp at time zone 'Asia/Jakarta') group by 1),
 biaya as(select tanggal,sum(jumlah) filter(where sumber='laci') laci,sum(jumlah) filter(where sumber='pusat') pusat from biaya_outlet where outlet_id=p_outlet and mode='asli' and deleted_at is null and tanggal between p_dari and p_sampai group by 1),
 setor as(select a.tanggal,sum(a.jumlah) filter(where s.status='disetujui') disetujui,sum(a.jumlah) filter(where s.status='menunggu') menunggu
   from alokasi_setoran a join setoran_omzet s on s.id=a.setoran_id where s.outlet_id=p_outlet and a.tanggal between p_dari and p_sampai group by 1)
 select coalesce(jsonb_agg(jsonb_build_object('tanggal',h.tanggal,'tunai',coalesce(p.tunai,0),'qris',coalesce(p.qris,0),'non_tunai',coalesce(p.non_tunai,0),
 'pengeluaran_laci',coalesce(b.laci,0),'pengeluaran_pusat',coalesce(b.pusat,0),'modal_ditahan',coalesce(r.modal_ditahan,0),'koreksi',coalesce(r.koreksi,0),'alasan',r.alasan,
 'seharusnya',coalesce(p.tunai,0)-coalesce(b.laci,0)-coalesce(r.modal_ditahan,0)+coalesce(r.koreksi,0),
 'disetujui',coalesce(s.disetujui,0),'menunggu',coalesce(s.menunggu,0),
 'sisa',coalesce(p.tunai,0)-coalesce(b.laci,0)-coalesce(r.modal_ditahan,0)+coalesce(r.koreksi,0)-coalesce(s.disetujui,0)-coalesce(s.menunggu,0)) order by h.tanggal),'[]') into hasil
 from hari h left join pos p using(tanggal) left join biaya b using(tanggal) left join setor s using(tanggal)
 left join rekonsiliasi_kas_harian r on r.outlet_id=p_outlet and r.tanggal=h.tanggal;
 return hasil;
end $$;
revoke all on function rekap_setoran(uuid,date,date) from public,anon;
grant execute on function rekap_setoran(uuid,date,date) to authenticated;

create or replace function buat_setoran(p jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare o uuid:=(p->>'outlet_id')::uuid; cid uuid:=(p->>'client_id')::uuid; sid uuid; x jsonb; d date; nominal bigint; rekap jsonb; sisa bigint; nm text;
begin
 if not operasional_boleh(o,'setoran') then raise exception 'Tidak diizinkan'; end if;
 if cid is null then raise exception 'ID pengajuan wajib'; end if;
 perform pg_advisory_xact_lock(hashtext('setoran:'||o));
 select id into sid from setoran_omzet where client_id=cid and outlet_id=o and penyetor_id=auth.uid();
 if sid is not null then return sid; end if;
 if p->>'cara' not in ('tunai','transfer') or length(trim(coalesce(p->>'tujuan','')))<3 or length(trim(coalesce(p->>'penanggung_jawab','')))<3 then raise exception 'Isi cara, tujuan, dan penanggung jawab'; end if;
 if p->>'cara'='tunai' and length(trim(coalesce(p->>'pengambil','')))<3 then raise exception 'Nama pengambil wajib'; end if;
 if (p->>'waktu')::timestamptz is null or (p->>'waktu')::timestamptz>now()+interval '5 minutes' then raise exception 'Waktu penyerahan/transfer tidak valid'; end if;
 if not exists(select 1 from storage.objects where bucket_id='operasional-bukti' and name=p->>'bukti_path' and name like 'setoran/'||o||'/'||auth.uid()||'/%') then raise exception 'Unggah foto pengambil atau bukti transfer'; end if;
 if jsonb_typeof(p->'rincian') is distinct from 'array' or jsonb_array_length(p->'rincian') not between 1 and 93 then raise exception 'Isi rincian tanggal omzet'; end if;
 if exists(select 1 from jsonb_array_elements(p->'rincian') z group by z->>'tanggal' having count(*)>1) then raise exception 'Tanggal omzet berulang'; end if;
 select nama into nm from pengguna where id=auth.uid() and status='aktif';
 if nm is null then raise exception 'Akun tidak aktif'; end if;
 insert into setoran_omzet(client_id,outlet_id,cara,waktu,penyetor_id,penyetor_nama,pengambil,penanggung_jawab,tujuan,bukti_path,catatan)
 values(cid,o,p->>'cara',(p->>'waktu')::timestamptz,auth.uid(),nm,nullif(trim(p->>'pengambil'),''),left(trim(p->>'penanggung_jawab'),150),left(trim(p->>'tujuan'),200),p->>'bukti_path',left(p->>'catatan',1000)) returning id into sid;
 for x in select * from jsonb_array_elements(p->'rincian') loop
   d:=(x->>'tanggal')::date; nominal:=(x->>'jumlah')::bigint;
   if d is null or d>(now() at time zone 'Asia/Jakarta')::date or nominal is null or nominal<=0 then raise exception 'Tanggal/nominal rincian tidak valid'; end if;
   select z into rekap from jsonb_array_elements(rekap_setoran(o,d,d)) z;
   sisa:=(rekap->>'sisa')::bigint;
   if nominal>greatest(sisa,0) then raise exception 'Nominal tanggal % melebihi sisa %; minta Akunting memeriksa POS/catatan harian',d,sisa; end if;
   insert into alokasi_setoran(setoran_id,tanggal,jumlah) values(sid,d,nominal);
 end loop;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'buat','setoran_omzet',sid::text,p-'bukti_path');
 return sid;
end $$;
revoke all on function buat_setoran(jsonb) from public,anon;
grant execute on function buat_setoran(jsonb) to authenticated;

create or replace function verifikasi_setoran(p_id uuid,p_setuju boolean,p_alasan text) returns void
language plpgsql security definer set search_path=public as $$
declare s setoran_omzet; x alokasi_setoran; r jsonb;
begin
 if auth.uid() is null or not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Akunting/Pusat'; end if;
 select * into s from setoran_omzet where id=p_id for update;
 if s.id is null or s.status<>'menunggu' then raise exception 'Setoran sudah diperiksa/tidak ditemukan'; end if;
 perform pg_advisory_xact_lock(hashtext('setoran:'||s.outlet_id));
 if length(trim(coalesce(p_alasan,'')))<3 then raise exception 'Catatan verifikasi wajib'; end if;
 if p_setuju then
  for x in select * from alokasi_setoran where setoran_id=p_id loop
   select z into r from jsonb_array_elements(rekap_setoran(s.outlet_id,x.tanggal,x.tanggal)) z;
   if (r->>'sisa')::bigint<0 then raise exception 'Kas tanggal % berubah/lebih setor; cocokkan ulang',x.tanggal; end if;
  end loop;
 end if;
 update setoran_omzet set status=case when p_setuju then 'disetujui' else 'ditolak' end,alasan_verifikasi=left(p_alasan,1000),diverifikasi_oleh=auth.uid(),diverifikasi_at=now() where id=p_id;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'verifikasi','setoran_omzet',p_id::text,to_jsonb(s),jsonb_build_object('setuju',p_setuju,'alasan',p_alasan));
end $$;
revoke all on function verifikasi_setoran(uuid,boolean,text) from public,anon;
grant execute on function verifikasi_setoran(uuid,boolean,text) to authenticated;

create or replace function koreksi_rekonsiliasi(p_outlet uuid,p_tanggal date,p_modal bigint,p_koreksi bigint,p_alasan text) returns void
language plpgsql security definer set search_path=public as $$
declare lama rekonsiliasi_kas_harian;
begin
 if auth.uid() is null or not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Akunting/Pusat'; end if;
 if p_modal is null or p_modal<0 or p_koreksi is null or p_tanggal is null or p_tanggal>(now() at time zone 'Asia/Jakarta')::date or length(trim(coalesce(p_alasan,'')))<3 then raise exception 'Tanggal, modal, koreksi, atau alasan tidak valid'; end if;
 perform pg_advisory_xact_lock(hashtext('setoran:'||p_outlet));
 select * into lama from rekonsiliasi_kas_harian where outlet_id=p_outlet and tanggal=p_tanggal for update;
 insert into rekonsiliasi_kas_harian(outlet_id,tanggal,modal_ditahan,koreksi,alasan,diubah_oleh)
 values(p_outlet,p_tanggal,p_modal,p_koreksi,left(p_alasan,1000),auth.uid()) on conflict(outlet_id,tanggal) do update
 set modal_ditahan=excluded.modal_ditahan,koreksi=excluded.koreksi,alasan=excluded.alasan,diubah_oleh=auth.uid(),diubah_at=now();
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'koreksi','rekonsiliasi_kas_harian',p_outlet||':'||p_tanggal,to_jsonb(lama),jsonb_build_object('modal',p_modal,'koreksi',p_koreksi,'alasan',p_alasan));
end $$;
revoke all on function koreksi_rekonsiliasi(uuid,date,bigint,bigint,text) from public,anon;
grant execute on function koreksi_rekonsiliasi(uuid,date,bigint,bigint,text) to authenticated;

-- Open inventory workflows to HRD & Finance at both UI and database layers.
create policy baca_hrd on opname for select to authenticated using(punya_peran('{hrd}'));
create policy catat_hrd on titipan_masuk for insert to authenticated with check(punya_peran('{hrd}') and boleh_outlet(outlet_id));
alter table titipan_masuk add column jenis text not null default 'masuk' check(jenis in ('masuk','retur','rusak','koreksi'));
update titipan_masuk set jenis='koreksi' where qty<0;
create or replace function matur_internal.cek_titipan() returns trigger
language plpgsql security definer set search_path=public as $$
declare sisa numeric; jual numeric;
begin
 if new.qty=0 or new.tanggal>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Jumlah/tanggal titipan tidak valid'; end if;
 if not exists(select 1 from menu where id=new.menu_id and mode='asli' and titipan and deleted_at is null) then raise exception 'Pilih menu titipan aktif'; end if;
 if new.qty<0 and new.jenis='masuk' then new.jenis:='koreksi'; end if;
 if (new.qty<0 or new.jenis<>'masuk') and length(trim(coalesce(new.catatan,'')))<3 then raise exception 'Catatan wajib untuk retur/rusak/koreksi'; end if;
 if new.jenis in ('retur','rusak') and new.qty>0 then raise exception 'Retur/rusak harus mengurangi stok'; end if;
 perform pg_advisory_xact_lock(hashtext('titipan:'||new.outlet_id||':'||new.menu_id));
 if new.qty<0 then
  select coalesce(sum(qty),0) into sisa from titipan_masuk where outlet_id=new.outlet_id and menu_id=new.menu_id;
  select coalesce(sum(i.qty),0) into jual from item_transaksi i join transaksi t on t.id=i.transaksi_id where t.outlet_id=new.outlet_id and t.mode='asli' and t.status='lunas' and i.menu_id=new.menu_id;
  select jual+coalesce(sum((x->>'qty')::numeric),0) into jual from produk_keluar pk cross join jsonb_array_elements(pk.items) x where pk.outlet_id=new.outlet_id and pk.deleted_at is null and x->>'menu_id'=new.menu_id::text;
  if -new.qty>greatest(sisa-jual,0) then raise exception 'Retur/rusak melebihi sisa titipan'; end if;
 end if;
 return new;
end $$;
revoke all on function matur_internal.cek_titipan() from public,anon,authenticated;
create trigger cek_titipan before insert on titipan_masuk for each row execute function matur_internal.cek_titipan();

do $$ declare d text; begin
 d:=pg_get_functiondef('public.simpan_opname(uuid,date,jsonb,text)'::regprocedure);
 d:=replace(d,'gudang_pusat() or peran_di_outlet(p_outlet, ''{spv}'')','gudang_pusat() or punya_peran(''{hrd,finance}'') or peran_di_outlet(p_outlet, ''{spv}'')');
 d:=replace(d,'  insert into opname (', $guard$
  if p_tanggal is not null and p_tanggal>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal opname belum terjadi'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'Isi bahan opname'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) z group by z->>'bahan_id' having count(*)>1) then raise exception 'Bahan opname berulang'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) z where (z->>'qty_fisik')::numeric is null or (z->>'qty_fisik')::numeric<0 or not exists(select 1 from bahan bb where bb.id=(z->>'bahan_id')::uuid and bb.mode='asli' and bb.deleted_at is null)) then raise exception 'Bahan/jumlah opname tidak valid'; end if;
  insert into opname ($guard$);

 if d not like '%{hrd,finance}%' then raise exception 'Definisi opname berbeda; hentikan migrasi'; end if;
 execute d;
end $$;

-- Configurable monthly salary references and approval snapshots.
alter table gaji_staf add column aturan jsonb not null default '{"hari_pembagi":26,"jam_normal":8,"istirahat_menit":0,"lembur_min_menit":120,"lembur_mode":"seluruh","lembur_tarif":0,"lembur_pengali":1,"pembulatan_menit":1}'::jsonb;
alter table slip_gaji add column hitungan_jam jsonb not null default '{}';
alter table slip_gaji add column jam_disetujui boolean not null default false;
alter table slip_gaji add column jam_disetujui_oleh uuid references pengguna;
alter table slip_gaji add column jam_disetujui_at timestamptz;
create table kasbon_staf (
 id uuid primary key default gen_random_uuid(),outlet_id uuid not null references outlet,pengguna_id uuid not null references pengguna,
 tanggal date not null,jumlah bigint not null check(jumlah>0),cicilan bigint not null check(cicilan>0),catatan text not null,
 dibuat_oleh uuid not null references pengguna,created_at timestamptz not null default now()
);
alter table kasbon_staf add column client_id uuid not null default gen_random_uuid() unique;
create index on kasbon_staf(pengguna_id,tanggal);
create table kasbon_potongan (
 kasbon_id uuid not null references kasbon_staf,slip_id uuid not null references slip_gaji on delete cascade,
 jumlah bigint not null check(jumlah>0),primary key(kasbon_id,slip_id)
);
create index on kasbon_potongan(slip_id);
alter table kasbon_staf enable row level security;
alter table kasbon_potongan enable row level security;
create policy baca on kasbon_staf for select to authenticated using(punya_peran('{owner,hrd,finance}') or pengguna_id=auth.uid());
create policy baca on kasbon_potongan for select to authenticated using(exists(select 1 from kasbon_staf k where k.id=kasbon_id));
grant select on kasbon_staf,kasbon_potongan to authenticated;

create or replace function catat_kasbon(p_outlet uuid,p_uid uuid,p_tanggal date,p_jumlah bigint,p_cicilan bigint,p_catatan text,p_client uuid default gen_random_uuid()) returns uuid
language plpgsql security definer set search_path=public as $$
declare kid uuid;
begin
 if auth.uid() is null or not punya_peran('{owner,hrd}') then raise exception 'Hanya HRD/Owner'; end if;
 if p_client is null then raise exception 'ID pencairan wajib'; end if;
 perform pg_advisory_xact_lock(hashtext('kasbon:'||p_client));
 select id into kid from kasbon_staf where client_id=p_client and dibuat_oleh=auth.uid();
 if kid is not null then return kid; end if;
 if p_jumlah is null or p_jumlah<=0 or p_cicilan is null or p_cicilan<=0 or p_cicilan>p_jumlah or p_tanggal is null or p_tanggal>(now() at time zone 'Asia/Jakarta')::date or length(trim(coalesce(p_catatan,'')))<3 then raise exception 'Data kasbon tidak valid'; end if;
 if not exists(select 1 from penugasan where pengguna_id=p_uid and outlet_id=p_outlet) then raise exception 'Staf tidak terdaftar di outlet'; end if;
 insert into kasbon_staf(outlet_id,pengguna_id,tanggal,jumlah,cicilan,catatan,dibuat_oleh,client_id) values(p_outlet,p_uid,p_tanggal,p_jumlah,p_cicilan,left(p_catatan,1000),auth.uid(),p_client) returning id into kid;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'catat','kasbon_staf',kid::text,jsonb_build_object('staf',p_uid,'jumlah',p_jumlah,'cicilan',p_cicilan));
 return kid;
end $$;
revoke all on function catat_kasbon(uuid,uuid,date,bigint,bigint,text,uuid) from public,anon;
grant execute on function catat_kasbon(uuid,uuid,date,bigint,bigint,text,uuid) to authenticated;

-- Atomic payroll writes lock the same payroll row used by finalization.
create or replace function simpan_draft_gaji(p_id uuid,p_rows jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare g penggajian; x jsonb; uid uuid; sid uuid; k kasbon_staf; sisa bigint; cicil bigint; budget bigint; jumlah bigint; deduksi jsonb; pp jsonb; pq jsonb;
begin
 if auth.uid() is null or not kelola_gaji() then raise exception 'Hanya HRD/Owner'; end if;
 select * into g from penggajian where id=p_id for update;
 if g.id is null or g.status<>'draft' then raise exception 'Penggajian tidak ditemukan atau sudah final'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)=0 then raise exception 'Slip kosong'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) z group by z->>'pengguna_id' having count(*)>1) then raise exception 'Staf berulang'; end if;
 -- Serialize reservation of each staff member across draft payrolls and outlets.
 for x in select * from jsonb_array_elements(p_rows) z order by z->>'pengguna_id' loop
  uid:=(x->>'pengguna_id')::uuid;
  perform pg_advisory_xact_lock(hashtext('gaji:'||uid));
  if exists(select 1 from slip_gaji s join penggajian p on p.id=s.penggajian_id where s.pengguna_id=uid and p.periode=g.periode and p.mode=g.mode and p.id<>p_id) then raise exception 'Staf sudah memiliki slip bulan ini di outlet lain'; end if;
  if not exists(select 1 from penugasan where pengguna_id=uid and outlet_id=g.outlet_id) then raise exception 'Staf tidak terdaftar di outlet'; end if;
  pp:=coalesce(x->'pendapatan','[]'); pq:=coalesce(x->'potongan','[]');
  if exists(select 1 from jsonb_array_elements(pp||pq) z where coalesce((z->>'kasbon')::boolean,false)) then raise exception 'Cicilan kasbon dihitung otomatis'; end if;
  if jsonb_typeof(pp)<>'array' or jsonb_typeof(pq)<>'array' then raise exception 'Baris gaji tidak valid'; end if;
  if exists(select 1 from jsonb_array_elements(pp||pq) z where coalesce((z->>'jumlah')::numeric,-1)<0 or (z->>'jumlah')::numeric<>trunc((z->>'jumlah')::numeric) or length(coalesce(z->>'nama',''))=0) then raise exception 'Nominal/nama komponen tidak valid'; end if;
  budget:=greatest(0,(select coalesce(sum((z->>'jumlah')::bigint),0) from jsonb_array_elements(pp) z)-(select coalesce(sum((z->>'jumlah')::bigint),0) from jsonb_array_elements(pq) z));
  insert into slip_gaji(penggajian_id,pengguna_id,nama,jabatan,hadir,telat,menit_telat,tidak_absen,izin,menit_kerja,pendapatan,potongan,total,rekening,hitungan_jam,jam_disetujui)
  values(p_id,uid,x->>'nama',x->>'jabatan',coalesce((x->>'hadir')::int,0),coalesce((x->>'telat')::int,0),coalesce((x->>'menit_telat')::int,0),coalesce((x->>'tidak_absen')::int,0),coalesce((x->>'izin')::int,0),coalesce((x->>'menit_kerja')::int,0),pp,pq,budget,x->>'rekening',coalesce(x->'hitungan_jam','{}'),false)
  on conflict(penggajian_id,pengguna_id) do update set nama=excluded.nama,jabatan=excluded.jabatan,hadir=excluded.hadir,telat=excluded.telat,menit_telat=excluded.menit_telat,tidak_absen=excluded.tidak_absen,izin=excluded.izin,menit_kerja=excluded.menit_kerja,pendapatan=excluded.pendapatan,potongan=excluded.potongan,total=excluded.total,rekening=excluded.rekening,hitungan_jam=excluded.hitungan_jam,jam_disetujui=false,jam_disetujui_oleh=null,jam_disetujui_at=null returning id into sid;
  delete from kasbon_potongan where slip_id=sid;
  deduksi:='[]';
  for k in select * from kasbon_staf where pengguna_id=uid and tanggal<(g.periode+interval '1 month')::date order by tanggal,id for update loop
   select k.jumlah-coalesce(sum(q.jumlah),0) into sisa from kasbon_potongan q where q.kasbon_id=k.id;
   cicil:=least(greatest(sisa,0),k.cicilan,budget);
   if cicil>0 then
    insert into kasbon_potongan values(k.id,sid,cicil);
    deduksi:=deduksi||jsonb_build_array(jsonb_build_object('nama','Cicilan kasbon '||k.tanggal,'jumlah',cicil,'kasbon',true));
    budget:=budget-cicil;
   end if;
  end loop;
  update slip_gaji set potongan=pq||deduksi,total=budget where id=sid;
 end loop;
 -- Remove stale draft slips (staff removed from outlet) without touching finalized payroll.
 delete from slip_gaji s where penggajian_id=p_id and not exists(select 1 from jsonb_array_elements(p_rows) z where z->>'pengguna_id'=s.pengguna_id::text);
end $$;
revoke all on function simpan_draft_gaji(uuid,jsonb) from public,anon;
grant execute on function simpan_draft_gaji(uuid,jsonb) to authenticated;

create or replace function setujui_jam_gaji(p_slip uuid) returns void
language plpgsql security definer set search_path=public as $$
declare g penggajian; s slip_gaji;
begin
 if auth.uid() is null or not kelola_gaji() then raise exception 'Hanya HRD/Owner'; end if;
 select p.* into g from penggajian p join slip_gaji x on x.penggajian_id=p.id where x.id=p_slip for update of p;
 if g.id is null or g.status<>'draft' then raise exception 'Slip bukan draft'; end if;
 select * into s from slip_gaji where id=p_slip;
 if coalesce((s.hitungan_jam->>'belum_lengkap')::int,0)>0 then raise exception 'Lengkapi absen pulang lalu hitung ulang'; end if;
 update slip_gaji set jam_disetujui=true,jam_disetujui_oleh=auth.uid(),jam_disetujui_at=now() where id=p_slip;
end $$;
revoke all on function setujui_jam_gaji(uuid) from public,anon;
grant execute on function setujui_jam_gaji(uuid) to authenticated;

-- Wrap existing finalization, preserving its financial integration.
alter function public.finalkan_penggajian(uuid) set schema matur_internal;
revoke all on function matur_internal.finalkan_penggajian(uuid) from public,anon,authenticated;
do $$ declare d text; begin
 d:=pg_get_functiondef('matur_internal.finalkan_penggajian(uuid)'::regprocedure);
 d:=replace(d,'select coalesce(sum(total), 0) into v_total from slip_gaji where penggajian_id = p_id;', 'select coalesce(sum(total),0)+(select coalesce(sum(q.jumlah),0) from kasbon_potongan q join slip_gaji s on s.id=q.slip_id where s.penggajian_id=p_id) into v_total from slip_gaji where penggajian_id=p_id;');
 execute d;
end $$;

create or replace function public.finalkan_penggajian(p_id uuid) returns bigint
language plpgsql security definer set search_path=public as $$
declare g penggajian; hasil bigint; kasbon bigint;
begin
 if auth.uid() is null or not kelola_gaji() then raise exception 'Hanya HRD/Owner'; end if;
 select * into g from penggajian where id=p_id for update;
 if g.id is null then raise exception 'Penggajian tidak ditemukan'; end if;
 if exists(select 1 from slip_gaji where penggajian_id=p_id and (coalesce((hitungan_jam->>'belum_lengkap')::int,0)>0 or (coalesce((hitungan_jam->>'menit_lembur')::int,0)>0 and not jam_disetujui))) then raise exception 'Lengkapi absensi dan setujui hitungan lembur sebelum final'; end if;
 if g.status='final' then return (select coalesce(sum(total),0) from slip_gaji where penggajian_id=p_id); end if;
 if exists(select 1 from slip_gaji where penggajian_id=p_id and hitungan_jam='{}') then raise exception 'Hitung ulang gaji untuk menyertakan aturan jam dan kasbon'; end if;
 perform matur_internal.finalkan_penggajian(p_id);
 select coalesce(sum(total),0) into hasil from slip_gaji where penggajian_id=p_id;
 select coalesce(sum(q.jumlah),0) into kasbon from kasbon_potongan q join slip_gaji s on s.id=q.slip_id where s.penggajian_id=p_id;
 -- Loan repayment is recovery of receivables, not a reduction of salary expense.
 update biaya_outlet set jumlah=hasil+kasbon where id=(select biaya_id from penggajian where id=p_id);
 return hasil;
end $$;
revoke all on function public.finalkan_penggajian(uuid) from public,anon;
grant execute on function public.finalkan_penggajian(uuid) to authenticated;

-- Evidence may only be removed while unreferenced (failed uploads), never after submission.
alter policy operasional_cleanup on storage.objects using (
 bucket_id='operasional-bukti' and (storage.foldername(name))[3]=auth.uid()::text and created_at>now()-interval '1 hour'
 and not exists(select 1 from setoran_omzet s where s.bukti_path=name)
 and not exists(select 1 from penerimaan_kiriman r where r.foto_path=name));

-- Keep final payroll immutable through the Data API. All edits use the locking RPCs.
revoke insert,update,delete on slip_gaji from authenticated,anon;
revoke update,delete on penggajian from authenticated,anon;
alter policy kelola on penggajian with check (kelola_gaji() and status='draft');

create or replace function ubah_manual_slip(p_slip uuid,p_pendapatan jsonb,p_potongan jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare g penggajian; s slip_gaji; rows jsonb; pp jsonb; pq jsonb;
begin
 if auth.uid() is null or not kelola_gaji() then raise exception 'Hanya HRD/Owner'; end if;
 select p.* into g from penggajian p join slip_gaji x on x.penggajian_id=p.id where x.id=p_slip for update of p;
 if g.id is null or g.status<>'draft' then raise exception 'Slip bukan draft'; end if;
 select * into s from slip_gaji where id=p_slip;
 if jsonb_typeof(p_pendapatan) is distinct from 'array' or jsonb_typeof(p_potongan) is distinct from 'array' then raise exception 'Komponen harus daftar'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('nama',left(trim(x->>'nama'),60),'jumlah',(x->>'jumlah')::bigint,'manual',true)),'[]') into pp from jsonb_array_elements(p_pendapatan) x where length(trim(x->>'nama'))>0 and (x->>'jumlah')::bigint>0;
 select coalesce(jsonb_agg(jsonb_build_object('nama',left(trim(x->>'nama'),60),'jumlah',(x->>'jumlah')::bigint,'manual',true)),'[]') into pq from jsonb_array_elements(p_potongan) x where length(trim(x->>'nama'))>0 and (x->>'jumlah')::bigint>0;
 select coalesce(jsonb_agg(x),'[]')||pp into pp from jsonb_array_elements(s.pendapatan) x where not coalesce((x->>'manual')::boolean,false);
 select coalesce(jsonb_agg(x),'[]')||pq into pq from jsonb_array_elements(s.potongan) x where not coalesce((x->>'manual')::boolean,false) and not coalesce((x->>'kasbon')::boolean,false);
 select jsonb_agg(case when x.id=p_slip then to_jsonb(x)||jsonb_build_object('pendapatan',pp,'potongan',pq) else
 to_jsonb(x)||jsonb_build_object('potongan',(select coalesce(jsonb_agg(z),'[]') from jsonb_array_elements(x.potongan) z where not coalesce((z->>'kasbon')::boolean,false))) end) into rows from slip_gaji x where penggajian_id=g.id;
 perform simpan_draft_gaji(g.id,rows);
end $$;
revoke all on function ubah_manual_slip(uuid,jsonb,jsonb) from public,anon;
grant execute on function ubah_manual_slip(uuid,jsonb,jsonb) to authenticated;

create or replace function batal_kiriman(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare k kiriman; i item_kiriman;
begin
 if auth.uid() is null or not gudang_pusat() then raise exception 'Hanya Admin Gudang / Pusat'; end if;
 select * into k from kiriman where id=p_id for update;
 if k.id is null or k.status not in ('draft','dikirim') then raise exception 'Kiriman tidak bisa dibatalkan'; end if;
 if exists(select 1 from penerimaan_kiriman where kiriman_id=p_id) then raise exception 'Kiriman sudah diperiksa; selesaikan selisih melalui pemeriksaan'; end if;
 if k.status='dikirim' then
  for i in select * from item_kiriman where kiriman_id=p_id loop
   perform geser_stok(k.mode,null,i.bahan_id,i.qty*i.konversi,'kiriman_batal',p_id,k.nomor);
  end loop;
 end if;
 update kiriman set status='batal' where id=p_id;
end $$;
revoke all on function batal_kiriman(uuid) from public,anon;
grant execute on function batal_kiriman(uuid) to authenticated;
