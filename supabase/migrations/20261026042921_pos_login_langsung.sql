-- POS langsung: akun outlet -> kasir. Tidak bergantung shift/absensi/PIC/perangkat tunggal.
create function pos_kas_internal.perangkat_langsung(o uuid,rahasia text) returns uuid
language sql stable security definer set search_path='' as $$
 select d.id from public.pos_perangkat d join matur_internal.pos_perangkat_rahasia h on h.perangkat_id=d.id
 join public.pengguna u on u.id=d.akun_id and u.id=auth.uid() and u.status='aktif'
 join matur_internal.pos_outlet_akses a on a.outlet_id=d.outlet_id and a.aktif and a.deleted_at is null
 join public.outlet ot on ot.id=d.outlet_id and ot.deleted_at is null
 where d.outlet_id=o and d.status='aktif' and d.kredensial_at>=a.diubah_at
 and h.hash=encode(extensions.digest(rahasia,'sha256'),'hex')
 and exists(select 1 from public.penugasan t where t.pengguna_id=u.id and t.peran='tablet' and t.outlet_id=o)
$$;
create function pos_kas_internal.siapkan_langsung(o uuid,rahasia text,token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare dev uuid;s public.sesi_kas;iz matur_internal.pos_izin;kat jsonb;nama text;kunci text:=coalesce(nullif(token,''),rahasia);jauh timestamptz:='2099-12-31 23:59:59+00';
begin
 dev:=pos_kas_internal.perangkat_langsung(o,rahasia);
 if dev is null then raise exception 'Masuk kembali dengan username/password outlet yang aktif';end if;
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||o));
 select ot.nama into nama from public.outlet ot where ot.id=o;
 select * into s from public.sesi_kas where outlet_id=o and mode='asli' and pos_tim and ditutup_at is null for update;
 if s.id is null then
  insert into public.sesi_kas(outlet_id,kasir_id,dibuka_oleh,nama_kasir,pos_tim,kas_harian,modal_laci,tanggal_shift,perangkat_id,batas_at)
  values(o,auth.uid(),auth.uid(),'Kas '||nama,true,true,0,(now() at time zone 'Asia/Jakarta')::date,dev,jauh) returning * into s;
  insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'buka_kas_pos_langsung','sesi_kas',s.id::text,jsonb_build_object('modal',0,'otomatis',true));
 elsif s.batas_at is distinct from jauh or not s.kas_harian then
  update public.sesi_kas set batas_at=jauh,kas_harian=true where id=s.id returning * into s;
 end if;
 kat:=matur_internal.katalog_pos();
 select * into iz from matur_internal.pos_izin where sesi_id=s.id and perangkat_id=dev and token_hash=encode(extensions.digest(kunci,'sha256'),'hex') and ditarik_at is null order by mulai_at desc limit 1;
 if iz.id is null then
  insert into matur_internal.pos_izin(sesi_id,perangkat_id,diverifikasi_oleh,token_hash,sampai_at,katalog)
  values(s.id,dev,auth.uid(),encode(extensions.digest(kunci,'sha256'),'hex'),jauh,kat) returning * into iz;
 elsif iz.katalog is distinct from kat or iz.sampai_at is distinct from jauh then
  update matur_internal.pos_izin set katalog=kat,sampai_at=jauh where id=iz.id returning * into iz;
 end if;
 return jsonb_build_object('langsung',true,'server_at',now(),'device',jsonb_build_object('id',dev,'nama',nama,'status','aktif'),'mode','kasir','boleh',true,
 'sesi',jsonb_build_object('id',s.id,'nama',s.nama_kasir,'pembuka_id',s.kasir_id,'modal',s.modal_laci,'buka_at',s.dibuka_at,'batas_at',jauh,'shift_id',s.shift_id,'tanggal',s.tanggal_shift,'kas_harian',true,'legacy',false,'perangkat_sama',true,'anggota','[]'::jsonb,'aktif_tim',true),
 'izin',jsonb_build_object('id',iz.id,'mulai_at',iz.mulai_at,'sampai_at',jauh),'katalog',kat,'roster','[]'::jsonb,'pic',null,
 'operator',jsonb_build_object('id',auth.uid(),'nama','POS '||nama,'kasir',true),
 'omzet',(select jsonb_build_object('total',coalesce(sum(total),0),'jumlah',count(*)) from public.transaksi where sesi_kas_id=s.id and status='lunas'));
end $$;
-- Simpan mesin lama untuk sinkronisasi klien personal lama, bukan jalur aplikasi baru.
alter function public.status_pos_tim(uuid,text,text,boolean) set schema pos_kas_internal;
alter function pos_kas_internal.status_pos_tim(uuid,text,text,boolean) rename to status_pos_lama;
revoke all on function pos_kas_internal.status_pos_lama(uuid,text,text,boolean) from public,anon,authenticated;
create function public.status_pos_tim(p_outlet uuid,p_device text,p_token text,p_perbarui boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select pos_kas_internal.siapkan_langsung(p_outlet,p_device,p_token)$$;
alter function public.buat_transaksi(jsonb) set schema pos_kas_internal;
alter function pos_kas_internal.buat_transaksi(jsonb) rename to checkout_lama;
revoke all on function pos_kas_internal.checkout_lama(jsonb) from public,anon,authenticated;
create function pos_kas_internal.checkout_langsung(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o uuid:=(p->>'outlet_id')::uuid;sid uuid:=(p->>'sesi_id')::uuid;dev uuid;iz matur_internal.pos_izin;s public.sesi_kas;t public.transaksi;w timestamptz;h text;hasil jsonb;off boolean:=coalesce((p->>'sinkron_offline')::boolean,false);client uuid:=(p->>'client_id')::uuid;nomor_baru int;kr jsonb;cnt int;
begin
 if not exists(select 1 from public.pengguna where id=auth.uid() and akun_tablet) then return pos_kas_internal.checkout_lama(p);end if;
 p:=p-'_katalog';dev:=pos_kas_internal.perangkat_langsung(o,p->>'device_token');
 if dev is null then raise exception 'Akun atau perangkat tidak sesuai outlet';end if;
 if client is null or sid is null then raise exception 'Identitas transaksi/kas wajib';end if;
 perform pg_advisory_xact_lock(hashtext('transaksi:'||client));
 h:=encode(extensions.digest((p-array['device_token','pos_token','sinkron_offline'])::text,'sha256'),'hex');
 select * into t from public.transaksi where client_id=client;
 if t.id is not null then
  if t.outlet_id<>o or t.sesi_kas_id<>sid or t.pos_payload_hash is distinct from h then raise exception 'ID transaksi sudah dipakai untuk data lain';end if;
  return jsonb_build_object('id',t.id,'nomor',t.nomor,'subtotal',t.subtotal,'diskon',t.diskon,'total',t.total,'kembalian',0,'ulang',true);
 end if;
 select * into s from public.sesi_kas where id=sid and outlet_id=o and pos_tim for update;
 select * into iz from matur_internal.pos_izin where id=(p->>'izin_id')::uuid and sesi_id=sid and perangkat_id=dev;
 if s.id is null or iz.id is null or iz.token_hash<>encode(extensions.digest(coalesce(nullif(p->>'pos_token',''),p->>'device_token'),'sha256'),'hex') then raise exception 'Kas atau identitas transaksi tidak valid';end if;
 w:=case when off then (p->>'waktu_asli')::timestamptz else now() end;
 if w is null or w<iz.mulai_at-interval '5 seconds' or w>now()+interval '30 seconds' then raise exception 'Waktu transaksi tidak valid';end if;
 if not off and s.ditutup_at is not null then raise exception 'Kas baru sudah tersedia. Muat ulang POS';end if;
 if off then
  if s.ditutup_at is not null and w>s.ditutup_at then raise exception 'Waktu transaksi setelah kas ditutup';end if;
  if p->>'metode'<>'tunai' or p ? 'pembayaran' and p->'pembayaran'<>'null'::jsonb or nullif(p->>'draft_id','') is not null or nullif(p->>'otorisasi','') is not null then raise exception 'Offline hanya transaksi tunai tanpa split/draft/persetujuan khusus';end if;
 end if;
 if nullif(p->>'draft_id','') is not null and not exists(select 1 from public.pesanan_draft where id=(p->>'draft_id')::uuid and outlet_id=o and status='draft') then raise exception 'Draft bukan milik outlet atau sudah dibayar';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p->'items','[]')) z where iz.katalog#>array['menu',z->>'menu_id'] is null or (z->>'qty')::int<=0 or not exists(select 1 from public.menu m where m.id=(z->>'menu_id')::uuid and m.mode='asli' and m.deleted_at is null)) then raise exception 'Item/jumlah tidak valid';end if;
 if exists(select 1 from jsonb_array_elements(p->'items') z cross join jsonb_array_elements_text(coalesce(z->'varian_ids','[]')) vid where iz.katalog#>array['varian',vid] is null or not exists(select 1 from public.varian v where v.id=vid::uuid and v.menu_id=(z->>'menu_id')::uuid)) then raise exception 'Varian tidak sesuai menu';end if;
 if off and (iz.katalog->>'resep_hash') is distinct from (matur_internal.katalog_pos()->>'resep_hash') then raise exception 'Resep/HPP berubah. Cocokkan transaksi tersimpan dahulu';end if;
 perform pg_advisory_xact_lock(hashtext('nomor-pos:'||o));
 hasil:=matur_internal.buat_transaksi(p||jsonb_build_object('_katalog',iz.katalog));
 select coalesce(max(nomor),0)+1 into nomor_baru from public.transaksi where outlet_id=o and id<>(hasil->>'id')::uuid and (created_at at time zone 'Asia/Jakarta')::date=(w at time zone 'Asia/Jakarta')::date;
 update public.transaksi set operator_id=auth.uid(),operator_nama=(select nama from public.pengguna where id=auth.uid()),pos_payload_hash=h,sinkron_offline=off,diterima_server_at=now(),created_at=w,nomor=nomor_baru where id=(hasil->>'id')::uuid;
 hasil:=hasil||jsonb_build_object('nomor',nomor_baru);
 if off and s.ditutup_at is not null then
  delete from matur_internal.pos_pending where client_id=client and sesi_id=sid;
  select count(*) into cnt from matur_internal.pos_pending where sesi_id=sid;
  kr:=matur_internal.kas_ringkas(sid);
  update public.sesi_kas set pending_offline=cnt,kas_seharusnya=(kr->>'seharusnya')::bigint,seharusnya=(kr->>'seharusnya')::bigint-modal_laci,selisih=fisik_akhir-(kr->>'seharusnya')::bigint,rekap_status=case when cnt=0 then 'final' else 'sementara' end where id=sid;
 end if;
 return hasil;
end $$;
create function public.buat_transaksi(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select pos_kas_internal.checkout_langsung(p)$$;
create function pos_kas_internal.tutup_langsung(p_sesi uuid,p_device text,p_aktual bigint,p_catatan text,p_pending uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.sesi_kas;h jsonb;n int;
begin
 select * into s from public.sesi_kas where id=p_sesi for update;
 if s.id is null or pos_kas_internal.perangkat_langsung(s.outlet_id,p_device) is null then raise exception 'Kas bukan milik outlet akun ini';end if;
 if s.ditutup_at is not null then return matur_internal.kas_ringkas(s.id)||jsonb_build_object('aktual',s.fisik_akhir,'selisih',s.selisih,'pending',s.pending_offline);end if;
 if p_aktual is null or p_aktual<0 then raise exception 'Isi uang fisik termasuk modal';end if;
 if coalesce(cardinality(p_pending),0)>1000 or coalesce(cardinality(p_pending),0)<>(select count(distinct x) from unnest(p_pending) x) then raise exception 'Daftar antrean tidak valid';end if;
 h:=matur_internal.kas_ringkas(s.id);
 insert into matur_internal.pos_pending(client_id,sesi_id) select x,s.id from unnest(p_pending) x where not exists(select 1 from public.transaksi where client_id=x) on conflict do nothing;
 select count(*) into n from matur_internal.pos_pending where sesi_id=s.id;
 update public.sesi_kas set ditutup_at=now(),ditutup_oleh=auth.uid(),fisik_akhir=p_aktual,kas_seharusnya=(h->>'seharusnya')::bigint,setoran=p_aktual-s.modal_laci,seharusnya=(h->>'seharusnya')::bigint-s.modal_laci,selisih=p_aktual-(h->>'seharusnya')::bigint,catatan_tutup=left(p_catatan,1000),pending_offline=n,rekap_status=case when n>0 then 'sementara' else 'final' end where id=s.id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'tutup_kas_pos_langsung','sesi_kas',s.id::text,h||jsonb_build_object('aktual',p_aktual,'catatan',p_catatan,'pending',n));
 return h||jsonb_build_object('aktual',p_aktual,'selisih',p_aktual-(h->>'seharusnya')::bigint,'pending',n);
end $$;
create or replace function public.tutup_kas_outlet(p_sesi uuid,p_device text,p_kode text,p_pin text,p_aktual bigint,p_catatan text,p_pending uuid[]) returns jsonb language sql security invoker set search_path='' as $$select pos_kas_internal.tutup_langsung(p_sesi,p_device,p_aktual,p_catatan,p_pending)$$;
create function pos_kas_internal.modal_langsung(sid uuid,rahasia text,jumlah bigint) returns void
language plpgsql security definer set search_path='' as $$
declare s public.sesi_kas;
begin
 select * into s from public.sesi_kas where id=sid for update;
 if s.id is null or pos_kas_internal.perangkat_langsung(s.outlet_id,rahasia) is null then raise exception 'Kas bukan milik outlet akun ini';end if;
 if s.ditutup_at is not null or jumlah is null or jumlah<0 or jumlah>1000000000000 then raise exception 'Modal/kas tidak valid';end if;
 update public.sesi_kas set modal_laci=jumlah where id=sid;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'atur_modal_pos','sesi_kas',sid::text,jsonb_build_object('modal',s.modal_laci),jsonb_build_object('modal',jumlah));
end $$;
create function public.atur_modal_pos(p_sesi uuid,p_device text,p_jumlah bigint) returns void language sql security invoker set search_path='' as $$select pos_kas_internal.modal_langsung(p_sesi,p_device,p_jumlah)$$;
-- Tampilkan draft dengan validasi status langsung; status_pos_tim tetap nama RPC kompatibel.
-- Pelaporan perangkat hanya informatif, tidak lagi membekukan kasir lain.
create or replace function public.lapor_perangkat_pos(p_rahasia text,p_ids uuid[],p_beku boolean,p_info text) returns jsonb language plpgsql security definer set search_path='' as $$
declare dev uuid;
begin
 select id into dev from public.pos_perangkat where akun_id=auth.uid() and pos_kas_internal.perangkat_langsung(outlet_id,p_rahasia)=id;
 if dev is null then raise exception 'Akun/perangkat tidak sesuai';end if;
 if p_ids is null or cardinality(p_ids)>1000 then raise exception 'Antrean tidak valid';end if;
 update public.pos_perangkat set terlihat_at=now(),antrean_jumlah=cardinality(p_ids),antrean_at=now(),info_perangkat=left(p_info,300) where id=dev;
 return jsonb_build_object('beku',false,'pindah_id',null);
end $$;
-- Batas jumlah perangkat dan afinitas kas saat mengganti outlet dihapus.
do $$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.masuk_pos_outlet(text,text,text,text)'::regprocedure);
 needle:='    if (select count(*) from pos_perangkat where outlet_id = o and status = ''aktif'' and akun_id is not null) >= 10 then
      return jsonb_build_object(''error'',''Batas 10 tablet aktif per outlet tercapai. Minta admin mencabut tablet lama.'');
    end if;';
 if position(needle in d)=0 then raise exception 'Definisi login berubah';end if;
 d:=replace(d,needle,'');
 d:=replace(d,'if exists(select 1 from sesi_kas where perangkat_id=dev.id and ditutup_at is null) then return jsonb_build_object(''error'',''Tutup sesi outlet sebelumnya sebelum mengganti outlet.'');end if;','');execute d;
end $$;
-- Hentikan konfigurasi lama; audit dan transaksi tidak dihapus.
update matur_internal.pos_testing set aktif=false,diubah_at=clock_timestamp();
update pos_kas_internal.presentasi set sampai_at=now() where sampai_at>now();
create or replace function public.status_testing_pos(p_outlet uuid) returns boolean language sql stable security invoker set search_path='' as $$select false$$;
create or replace function public.atur_testing_pos(p_outlet uuid,p_aktif boolean,p_versi timestamptz) returns void language plpgsql security invoker set search_path='' as $$begin raise exception 'Pengunci/testing POS sudah dihapus. Gunakan POS langsung';end$$;
create or replace function public.atur_presentasi_pos(p_outlet uuid,p_menit int,p_alasan text) returns void language plpgsql security invoker set search_path='' as $$begin raise exception 'Pengecualian presentasi tidak diperlukan. Gunakan POS langsung';end$$;
create or replace function public.izinkan_lanjut_kas_pos(p_sesi uuid,p_ditutup timestamptz,p_alasan text) returns void language plpgsql security invoker set search_path='' as $$begin raise exception 'Izin lanjut tidak diperlukan. Gunakan POS langsung';end$$;
-- Hilangkan akses langsung ke implementasi privat dan berikan hanya RPC yang dijaga.
revoke all on function pos_kas_internal.perangkat_langsung(uuid,text) from public,anon,authenticated;
revoke all on function pos_kas_internal.siapkan_langsung(uuid,text,text),pos_kas_internal.checkout_langsung(jsonb),pos_kas_internal.tutup_langsung(uuid,text,bigint,text,uuid[]),pos_kas_internal.modal_langsung(uuid,text,bigint) from public,anon;
grant execute on function pos_kas_internal.siapkan_langsung(uuid,text,text),pos_kas_internal.checkout_langsung(jsonb),pos_kas_internal.tutup_langsung(uuid,text,bigint,text,uuid[]),pos_kas_internal.modal_langsung(uuid,text,bigint) to authenticated;
revoke all on function public.status_pos_tim(uuid,text,text,boolean),public.buat_transaksi(jsonb),public.tutup_kas_outlet(uuid,text,text,text,bigint,text,uuid[]),public.atur_modal_pos(uuid,text,bigint) from public,anon;
grant execute on function public.status_pos_tim(uuid,text,text,boolean),public.buat_transaksi(jsonb),public.tutup_kas_outlet(uuid,text,text,text,bigint,text,uuid[]),public.atur_modal_pos(uuid,text,bigint) to authenticated;
