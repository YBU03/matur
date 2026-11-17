create schema rekonsiliasi_internal;
revoke all on schema rekonsiliasi_internal from public,anon;
grant usage on schema rekonsiliasi_internal to authenticated;
create table rekonsiliasi_internal.verifikasi_transaksi (
 id uuid primary key default gen_random_uuid(), transaksi_id uuid not null references public.transaksi(id),
 sidik text not null, alasan text not null check(length(trim(alasan))>=3),
 pengguna_id uuid not null, nama text not null, created_at timestamptz not null default now(), batal_at timestamptz
);
create index on rekonsiliasi_internal.verifikasi_transaksi(transaksi_id,created_at desc);
alter table rekonsiliasi_internal.verifikasi_transaksi enable row level security;
revoke all on rekonsiliasi_internal.verifikasi_transaksi from public,anon,authenticated;
create function rekonsiliasi_internal.sidik_transaksi(p_id uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object('transaksi',to_jsonb(t),'bayar',
  (select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.pembayaran p where p.transaksi_id=t.id),
  'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from public.item_transaksi i where i.transaksi_id=t.id))::text)
 from public.transaksi t where t.id=p_id and auth.uid() is not null and public.boleh_outlet(t.outlet_id)
$$;
create function rekonsiliasi_internal.status_transaksi(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('nama',v.nama,'waktu',v.created_at,'alasan',v.alasan)
 from rekonsiliasi_internal.verifikasi_transaksi v where v.transaksi_id=p_id and v.batal_at is null
 and v.sidik=rekonsiliasi_internal.sidik_transaksi(p_id) order by v.created_at desc limit 1
$$;
create function rekonsiliasi_internal.verifikasi(p_id uuid,p_sidik text,p_alasan text) returns void language plpgsql security definer set search_path='' as $$
declare t public.transaksi; sidik text;
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Akunting';end if;
 if length(trim(coalesce(p_alasan,'')))<3 or length(p_alasan)>500 then raise exception 'Isi alasan pemeriksaan (3–500 huruf)';end if;
 select * into t from public.transaksi where id=p_id for update;
 if t.id is null or t.status<>'lunas' or t.mode<>'asli' or not public.boleh_outlet(t.outlet_id) then raise exception 'Transaksi tidak tersedia';end if;
 perform id from public.pembayaran where transaksi_id=p_id order by id for update;
 perform id from public.item_transaksi where transaksi_id=p_id order by id for update;
 sidik:=rekonsiliasi_internal.sidik_transaksi(p_id);
 if sidik is distinct from p_sidik then raise exception 'Transaksi berubah. Muat ulang sebelum memverifikasi';end if;
 if rekonsiliasi_internal.status_transaksi(p_id) is not null then return;end if;
 insert into rekonsiliasi_internal.verifikasi_transaksi(transaksi_id,sidik,alasan,pengguna_id,nama)
 values(p_id,sidik,trim(p_alasan),auth.uid(),coalesce((select nama from public.pengguna where id=auth.uid()),'Akunting'));
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru)
 values(auth.uid(),'verifikasi_transaksi','transaksi',p_id::text,jsonb_build_object('alasan',trim(p_alasan),'outlet_id',t.outlet_id,'tanggal',public.tgl_op(t.created_at),'sidik',sidik));
end $$;
create function public.verifikasi_transaksi_harian(p_id uuid,p_sidik text,p_alasan text) returns void language sql security invoker set search_path='' as $$select rekonsiliasi_internal.verifikasi(p_id,p_sidik,p_alasan)$$;
create function rekonsiliasi_internal.batalkan_verifikasi() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and to_jsonb(old)=to_jsonb(new) then return new;end if;
 if tg_table_name='transaksi' then
  update rekonsiliasi_internal.verifikasi_transaksi set batal_at=clock_timestamp() where transaksi_id=old.id and batal_at is null;
 else
  if tg_op<>'INSERT' then update rekonsiliasi_internal.verifikasi_transaksi set batal_at=clock_timestamp() where transaksi_id=old.transaksi_id and batal_at is null;end if;
  if tg_op<>'DELETE' then update rekonsiliasi_internal.verifikasi_transaksi set batal_at=clock_timestamp() where transaksi_id=new.transaksi_id and batal_at is null;end if;
 end if;return case when tg_op='DELETE' then old else new end;
end $$;
create trigger verifikasi_ulang after update or delete on public.transaksi for each row execute function rekonsiliasi_internal.batalkan_verifikasi();
create trigger verifikasi_ulang after insert or update or delete on public.pembayaran for each row execute function rekonsiliasi_internal.batalkan_verifikasi();
create trigger verifikasi_ulang after insert or update or delete on public.item_transaksi for each row execute function rekonsiliasi_internal.batalkan_verifikasi();
-- Jumlah peringatan berubah; perhitungan uang tidak diubah.
do $$declare d text;begin
 d:=pg_get_functiondef('public.rekap_harian(uuid,date,public.mode_data)'::regprocedure);
 if position('count(*) filter (where p.janggal) janggal' in d)=0 then raise exception 'Definisi rekap_harian berubah';end if;
 d:=replace(d,'count(*) filter (where p.janggal) janggal','count(*) filter (where p.janggal and rekonsiliasi_internal.status_transaksi(x.id) is null) janggal');execute d;
 d:=pg_get_functiondef('public.rincian_harian(uuid,date,public.mode_data)'::regprocedure);
 if position('''id'', t.id, ''nomor''' in d)=0 then raise exception 'Definisi rincian_harian berubah';end if;
 d:=replace(d,'''id'', t.id, ''nomor''','''sidik'', rekonsiliasi_internal.sidik_transaksi(t.id), ''verifikasi'', rekonsiliasi_internal.status_transaksi(t.id), ''id'', t.id, ''nomor''');execute d;
end $$;
create function rekonsiliasi_internal.periksa(p_sesi uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.sesi_kas; t date; b jsonb; pilihan jsonb; h jsonb; riwayat jsonb;
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Akunting';end if;
 select * into s from public.sesi_kas where id=p_sesi;
 if s.id is null or s.mode<>'asli' or not public.boleh_outlet(s.outlet_id) then raise exception 'Kas tidak tersedia';end if;
 t:=coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at));h:=matur_internal.kas_ringkas(s.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'tanggal',x.tanggal,'jumlah',x.jumlah,'sumber',x.sumber,'keterangan',x.keterangan,'sesi_kas_id',x.sesi_kas_id,
 'tanggal_shift',coalesce(sk.tanggal_shift,public.tgl_op(sk.dibuka_at)),
 'sidik',md5(to_jsonb(x)::text),'dilindungi',exists(select 1 from public.belanja_bahan_outlet bb where bb.biaya_id=x.id)) order by x.tanggal,x.created_at),'[]') into b
 from public.biaya_outlet x left join public.sesi_kas sk on sk.id=x.sesi_kas_id
 where x.outlet_id=s.outlet_id and x.mode=s.mode and x.deleted_at is null and (x.sesi_kas_id=s.id or x.tanggal=t);
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'tanggal',coalesce(x.tanggal_shift,public.tgl_op(x.dibuka_at)),'nama',x.nama_kasir,'dibuka_at',x.dibuka_at,'ditutup_at',x.ditutup_at) order by x.dibuka_at),'[]') into pilihan
 from public.sesi_kas x where x.outlet_id=s.outlet_id and x.mode=s.mode and coalesce(x.tanggal_shift,public.tgl_op(x.dibuka_at)) between t-31 and t+31;
 select coalesce(jsonb_agg(x order by x->>'waktu' desc),'[]') into riwayat from (
 select jsonb_build_object('waktu',l.created_at,'nama',(select u.nama from public.pengguna u where u.id=l.pengguna_id),'alasan',l.nilai_baru->>'alasan','lama',l.nilai_lama,'baru',l.nilai_baru) x
 from public.log_aktivitas l where l.entitas='sesi_kas' and l.entitas_id=s.id::text and l.aksi='rekonsiliasi_kas' order by l.created_at desc limit 20) q;
 return jsonb_build_object('sesi',to_jsonb(s),'tanggal',t,'hitung',h,'biaya',b,'pilihan',pilihan,'riwayat',riwayat,
 'penyerahan',(select coalesce(jsonb_agg(jsonb_build_object('jumlah',k.jumlah,'data',to_jsonb(k))),'[]') from public.pos_kas_keluar k where k.sesi_id=s.id));
end $$;
create function public.periksa_rekonsiliasi_kas(p_sesi uuid) returns jsonb language sql security invoker set search_path='' as $$select rekonsiliasi_internal.periksa(p_sesi)$$;
create function rekonsiliasi_internal.koreksi(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.biaya_outlet; s public.sesi_kas; target uuid; ids uuid[]; v_tanggal date; v_jumlah bigint; v_sumber text;
 alasan text:=trim(p->>'alasan'); h jsonb; sebelum jsonb:='[]'; sesudah jsonb:='[]'; sidik text; delta bigint; eks bigint; aktual bigint; simpan boolean:=coalesce((p->>'simpan')::boolean,false);
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Akunting';end if;
 select * into b from public.biaya_outlet where id=(p->>'id')::uuid;
 if b.id is null or b.deleted_at is not null or b.mode<>'asli' or not public.boleh_outlet(b.outlet_id) then raise exception 'Pengeluaran tidak tersedia';end if;
 perform id from public.outlet where id=b.outlet_id for update;
 target:=nullif(p->>'sesi_id','')::uuid;v_tanggal:=(p->>'tanggal')::date;v_jumlah:=(p->>'jumlah')::bigint;v_sumber:=p->>'sumber';
 if v_tanggal is null or v_jumlah is null or v_jumlah<=0 or v_jumlah>1000000000000 or v_sumber is null or v_sumber not in ('laci','pusat') then raise exception 'Isi tanggal, nominal dan sumber yang valid';end if;
 if v_sumber='pusat' then target:=null;elsif target is null then raise exception 'Pilih shift untuk pengeluaran laci';end if;
 ids:=array(select distinct x from unnest(array[b.sesi_kas_id,target]) x where x is not null order by x);
 perform id from public.sesi_kas where id=any(ids) order by id for update;
 perform id from public.transaksi where sesi_kas_id=any(ids) order by id for update;
 perform pay.id from public.pembayaran pay join public.transaksi t on t.id=pay.transaksi_id where t.sesi_kas_id=any(ids) order by pay.id for update of pay;
 perform id from public.biaya_outlet where sesi_kas_id=any(ids) order by id for update;
 select * into b from public.biaya_outlet where id=b.id for update;
 if b.deleted_at is not null or md5(to_jsonb(b)::text) is distinct from p->>'sidik_biaya' then raise exception 'Pengeluaran berubah. Muat ulang';end if;
 if target is not null and not exists(select 1 from public.sesi_kas x where x.id=target and x.outlet_id=b.outlet_id and x.mode=b.mode and coalesce(x.tanggal_shift,public.tgl_op(x.dibuka_at))=v_tanggal) then raise exception 'Tanggal pengeluaran harus sesuai tanggal shift tujuan';end if;
 for s in select * from public.sesi_kas where id=any(ids) order by id loop
  if s.outlet_id<>b.outlet_id or s.mode<>b.mode or s.ditutup_at is null or coalesce(s.pending_offline,0)>0 then raise exception 'Pilih kas tertutup tanpa antrean offline; kas aktif dikelola dari POS';end if;
  h:=matur_internal.kas_ringkas(s.id);
  sebelum:=sebelum||jsonb_build_array(jsonb_build_object('id',s.id,'tanggal',coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at)),'hitung',h,'setoran',s.setoran,'seharusnya',s.seharusnya,'selisih',s.selisih));
  delta:=case when b.sesi_kas_id=s.id and b.sumber='laci' then b.jumlah else 0 end-case when target=s.id and v_sumber='laci' then v_jumlah else 0 end;
  eks:=(h->>'seharusnya')::bigint-s.modal_laci+delta;aktual:=s.setoran;
  sesudah:=sesudah||jsonb_build_array(jsonb_build_object('id',s.id,'tanggal',coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at)),'setoran',aktual,'seharusnya',eks,'selisih',aktual-eks));
 end loop;
 sidik:=md5(jsonb_build_object('biaya',to_jsonb(b),'sebelum',sebelum,'sesudah',sesudah,'tanggal',v_tanggal,'jumlah',v_jumlah,'sumber',v_sumber,'target',target)::text);
 if simpan then
  if length(coalesce(alasan,''))<3 or length(alasan)>500 then raise exception 'Isi alasan koreksi (3–500 huruf)';end if;
  if sidik is distinct from p->>'sidik' then raise exception 'Perhitungan berubah. Periksa pratinjau kembali';end if;
  perform set_config('matur.biaya_final','1',true);
  update public.biaya_outlet set tanggal=v_tanggal,jumlah=v_jumlah,sumber=v_sumber,sesi_kas_id=target where id=b.id;
  perform set_config('matur.biaya_final','',true);
  for s in select * from public.sesi_kas where id=any(ids) order by id loop
   h:=matur_internal.kas_ringkas(s.id);eks:=(h->>'seharusnya')::bigint-s.modal_laci;
   update public.sesi_kas set kas_seharusnya=(h->>'seharusnya')::bigint,seharusnya=eks,selisih=case when s.setoran is null then null else s.setoran-eks end where id=s.id;
   insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)
   values(auth.uid(),'rekonsiliasi_kas','sesi_kas',s.id::text,to_jsonb(s),jsonb_build_object('alasan',alasan,'outlet_id',s.outlet_id,'tanggal',coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at)),'biaya_id',b.id,'seharusnya',eks,'selisih',s.setoran-eks));
  end loop;
  insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)
  values(auth.uid(),'rekonsiliasi_pengeluaran','biaya_outlet',b.id::text,to_jsonb(b),jsonb_build_object('alasan',alasan,'outlet_id',b.outlet_id,'tanggal',v_tanggal,'jumlah',v_jumlah,'sumber',v_sumber,'sesi_kas_id',target));
 end if;
 return jsonb_build_object('sidik',sidik,'sebelum',sebelum,'sesudah',sesudah,'tersimpan',simpan);
end $$;
create function public.koreksi_rekonsiliasi_kas(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select rekonsiliasi_internal.koreksi(p)$$;
-- Jangan menempelkan pengeluaran tanggal lama ke kas yang sedang aktif hari ini.
create or replace function public.tempel_sesi_biaya() returns trigger language plpgsql security definer set search_path='' as $$
declare pilihan uuid[];
begin
 if current_setting('matur.biaya_final',true)='1' then return new;end if;
 if new.sumber='pusat' then new.sesi_kas_id:=null;return new;end if;
 if tg_op='UPDATE' and (new.tanggal is distinct from old.tanggal or new.sumber is distinct from old.sumber) then new.sesi_kas_id:=null;end if;
 if new.sesi_kas_id is not null and not exists(select 1 from public.sesi_kas s where s.id=new.sesi_kas_id and s.outlet_id=new.outlet_id and s.mode=new.mode and coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at))=new.tanggal) then new.sesi_kas_id:=null;end if;
 if new.sesi_kas_id is null then
  select array_agg(s.id) into pilihan from public.sesi_kas s where s.outlet_id=new.outlet_id and s.mode=new.mode and s.ditutup_at is null and coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at))=new.tanggal;
  if cardinality(pilihan)=1 then new.sesi_kas_id:=pilihan[1];end if;
 end if;return new;
end $$;
drop trigger tempel_sesi_biaya on public.biaya_outlet;
create trigger tempel_sesi_biaya before insert or update of sumber,tanggal,sesi_kas_id on public.biaya_outlet for each row execute function public.tempel_sesi_biaya();
revoke all on all functions in schema rekonsiliasi_internal from public,anon,authenticated;
grant execute on function rekonsiliasi_internal.sidik_transaksi(uuid),rekonsiliasi_internal.status_transaksi(uuid),rekonsiliasi_internal.verifikasi(uuid,text,text),rekonsiliasi_internal.periksa(uuid),rekonsiliasi_internal.koreksi(jsonb) to authenticated;
revoke all on function public.periksa_rekonsiliasi_kas(uuid),public.koreksi_rekonsiliasi_kas(jsonb),public.verifikasi_transaksi_harian(uuid,text,text) from public,anon;
grant execute on function public.periksa_rekonsiliasi_kas(uuid),public.koreksi_rekonsiliasi_kas(jsonb),public.verifikasi_transaksi_harian(uuid,text,text) to authenticated;

revoke all on function public.tempel_sesi_biaya() from public,anon,authenticated;
