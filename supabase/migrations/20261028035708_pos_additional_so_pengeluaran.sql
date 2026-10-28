create schema operasional_outlet_internal;
revoke all on schema operasional_outlet_internal from public,anon;
grant usage on schema operasional_outlet_internal to authenticated;
-- SO outlet dan pengeluaran: tetap satu sumber untuk stok/laporan, retry tidak menggandakan.
alter table public.opname add column request_id uuid unique, add column request_hash text, add column petugas_nama text;
alter table public.biaya_outlet add column request_id uuid unique;

create function operasional_outlet_internal.opname_terukur(p jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare o uuid:=(p->>'outlet_id')::uuid; req uuid:=(p->>'request_id')::uuid;
 d date:=(p->>'tanggal')::date; oid uuid; x jsonb; b bahan; sist numeric; fis numeric; hu numeric; tot numeric:=0;
begin
 if auth.uid() is null or not (gudang_pusat() or punya_peran('{hrd,finance}') or peran_di_outlet(o,'{kasir,barista,spv}')) then raise exception 'Tidak berwenang melakukan SO outlet ini';end if;
 if octet_length(p::text)>500000 then raise exception 'Data terlalu besar';end if;
 if req is null then raise exception 'Identitas penyimpanan diperlukan';end if;
 perform pg_advisory_xact_lock(hashtextextended(req::text,0));
 select id into oid from opname where request_id=req and outlet_id=o and dibuat_oleh=auth.uid();
 if oid is not null then
  if (select request_hash from opname where id=oid) is distinct from md5(p::text) then raise exception 'Permintaan SO sudah tersimpan dengan isi berbeda. Muat ulang riwayat dahulu.';end if;
  return oid;end if;
 if not exists(select 1 from outlet where id=o and deleted_at is null and mode='asli') then raise exception 'Outlet tidak tersedia';end if;
 if d is null or d>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal SO tidak valid atau belum terjadi';end if;
 if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items')=0 then raise exception 'Isi hasil hitung fisik';end if;
 if exists(select 1 from jsonb_array_elements(p->'items') z group by z->>'bahan_id' having count(*)>1) then raise exception 'Bahan SO berulang';end if;
 -- Urutan kunci konsisten; stok yang semula belum ada juga dikunci melalui baris nol.
 for x in select * from jsonb_array_elements(p->'items') order by value->>'bahan_id' loop
  select * into b from bahan where id=(x->>'bahan_id')::uuid and mode='asli' and deleted_at is null;
  fis:=(x->>'qty_fisik')::numeric;
  if b.id is null or fis is null or fis<0 or fis>99999999999.999 or fis<>round(fis,3) or fis::text in ('NaN','Infinity','-Infinity') then raise exception 'Bahan/jumlah SO tidak valid';end if;
  insert into stok(mode,outlet_id,bahan_id,jumlah) values('asli',o,b.id,0) on conflict do nothing;
  select jumlah into sist from stok where mode='asli' and outlet_id=o and bahan_id=b.id for update;
  if (x->>'qty_sistem')::numeric is null or abs(sist-(x->>'qty_sistem')::numeric)>0.0001 then raise exception 'Stok berubah selama penghitungan. Muat ulang lalu periksa hasil SO sebelum menyimpan.';end if;
 end loop;
 insert into opname(outlet_id,tanggal,catatan,request_id,request_hash,created_at,petugas_nama) values(o,d,left(p->>'catatan',300),req,md5(p::text),clock_timestamp(),(select nama from pengguna where id=auth.uid())) returning id into oid;
 for x in select * from jsonb_array_elements(p->'items') order by value->>'bahan_id' loop
  select * into b from bahan where id=(x->>'bahan_id')::uuid;
  fis:=(x->>'qty_fisik')::numeric;
  select jumlah into sist from stok where mode='asli' and outlet_id=o and bahan_id=b.id;
  hu:=coalesce(nullif(b.harga_jual_gudang,0),b.harga_beli,0)/nullif(b.konversi,0);
  insert into item_opname(opname_id,bahan_id,qty_sistem,qty_fisik,harga_unit,nilai) values(oid,b.id,sist,fis,coalesce(hu,0),round(fis*coalesce(hu,0)));
  if fis<>sist then perform geser_stok('asli',o,b.id,fis-sist,'opname',oid,'SO outlet '||d);end if;
  tot:=tot+round(fis*coalesce(hu,0));
 end loop;
 -- SO boleh parsial: nilai akhir tetap mencakup SEMUA stok outlet, bukan hanya baris yang dihitung.
 select coalesce(round(sum(greatest(s.jumlah,0)*coalesce(nullif(bb.harga_jual_gudang,0),bb.harga_beli,0)/nullif(bb.konversi,0))),0)
 into tot from stok s join bahan bb on bb.id=s.bahan_id where s.mode='asli' and s.outlet_id=o and bb.mode='asli' and bb.deleted_at is null;
 update opname set total_nilai=tot where id=oid;
 return oid;
end $$;
revoke all on function operasional_outlet_internal.opname_terukur(jsonb) from public,anon;
grant execute on function operasional_outlet_internal.opname_terukur(jsonb) to authenticated;
create function public.simpan_opname_terukur(p jsonb) returns uuid language sql security invoker set search_path='' as $$ select operasional_outlet_internal.opname_terukur(p) $$;
revoke all on function public.simpan_opname_terukur(jsonb) from public,anon;
grant execute on function public.simpan_opname_terukur(jsonb) to authenticated;

create function operasional_outlet_internal.catat_pengeluaran_pos(p jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare o uuid:=(p->>'outlet_id')::uuid; req uuid:=(p->>'request_id')::uuid; sid uuid:=(p->>'sesi_id')::uuid;
 k uuid:=(p->>'kategori_id')::uuid; j numeric:=(p->>'jumlah')::numeric; v_sumber text:=p->>'sumber';
 d date:=coalesce((p->>'tanggal')::date,(now() at time zone 'Asia/Jakarta')::date); bid uuid;s sesi_kas;
begin
 if auth.uid() is null or not (punya_peran('{owner,admin_pusat,finance}') or peran_di_outlet(o,'{kasir,barista,spv}')) then raise exception 'Anda tidak berwenang mencatat pengeluaran outlet ini';end if;
 if octet_length(p::text)>500000 then raise exception 'Data terlalu besar';end if;
 if req is null then raise exception 'Identitas penyimpanan diperlukan';end if;
 perform pg_advisory_xact_lock(hashtextextended(req::text,0));
 select id into bid from biaya_outlet where request_id=req and outlet_id=o and dibuat_oleh=auth.uid();
 if bid is not null then
  if exists(select 1 from biaya_outlet where id=bid and (kategori_id is distinct from k or jumlah is distinct from j or sumber is distinct from (p->>'sumber') or tanggal is distinct from d or coalesce(keterangan,'') is distinct from coalesce(nullif(left(trim(p->>'keterangan'),200),''),''))) then raise exception 'Permintaan sudah tersimpan dengan isi berbeda. Muat ulang riwayat sebelum mencatat lagi.';end if;
  return bid;
 end if;
 if j is null or j<=0 or j<>round(j) or j>1000000000000 or v_sumber not in ('laci','pusat') or v_sumber is null then raise exception 'Nominal atau sumber pembayaran tidak valid';end if;
 if not exists(select 1 from outlet where id=o and deleted_at is null and mode='asli') then raise exception 'Outlet tidak tersedia';end if;
 if not exists(select 1 from kategori_biaya where id=k) then raise exception 'Pilih kategori pengeluaran yang tersedia';end if;
 if v_sumber='laci' then
  if sid is null then
   select id into sid from sesi_kas where outlet_id=o and mode='asli' and pos_tim and ditutup_at is null order by dibuka_at desc limit 1;
  end if;
  select * into s from sesi_kas where id=sid for update;
  if s.id is null or s.outlet_id<>o or s.mode<>'asli' or not s.pos_tim or s.ditutup_at is not null then raise exception 'Kas sudah ditutup atau belum tersedia. Muat ulang halaman Kas & Pengeluaran lalu simpan kembali.';end if;
  if d<>(now() at time zone 'Asia/Jakarta')::date and not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Pengeluaran laci POS harus dicatat untuk hari ini';end if;
 else sid:=null;end if;
 insert into biaya_outlet(outlet_id,tanggal,kategori_id,jumlah,keterangan,sumber,sesi_kas_id,dibuat_oleh,request_id)
 values(o,d,k,j,nullif(left(trim(p->>'keterangan'),200),''),v_sumber,sid,auth.uid(),req) returning id into bid;
 return bid;
end $$;
revoke all on function operasional_outlet_internal.catat_pengeluaran_pos(jsonb) from public,anon;
grant execute on function operasional_outlet_internal.catat_pengeluaran_pos(jsonb) to authenticated;
create function public.catat_pengeluaran_pos(p jsonb) returns uuid language sql security invoker set search_path='' as $$ select operasional_outlet_internal.catat_pengeluaran_pos(p) $$;
revoke all on function public.catat_pengeluaran_pos(jsonb) from public,anon;
grant execute on function public.catat_pengeluaran_pos(jsonb) to authenticated;
