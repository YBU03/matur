-- Alur baru bersifat opt-in. Tidak menghapus kas/transaksi/arsip sebelumnya.
create table pos_kas_internal.aturan_shift (
 outlet_id uuid primary key references public.outlet(id), aktif boolean not null default false,
 pin_hash text, versi integer not null default 0, diubah_at timestamptz not null default now()
);
create table pos_kas_internal.pin_percobaan (
 perangkat_id uuid primary key references public.pos_perangkat(id), jumlah integer not null default 0,
 sejak timestamptz not null default clock_timestamp()
);
alter table pos_kas_internal.pin_percobaan enable row level security;
revoke all on pos_kas_internal.pin_percobaan from public,anon,authenticated;
create table pos_kas_internal.shift_baru (
 id uuid primary key default gen_random_uuid(), sesi_id uuid not null references public.sesi_kas(id),
 pic_id uuid not null references public.pengguna(id), nama text not null, label text not null,
 mulai_at timestamptz not null default clock_timestamp(), selesai_at timestamptz,
 awal bigint not null check(awal>=0), aktual bigint check(aktual>=0), catatan text not null default '',
 alasan text not null default '', tim jsonb not null default '[]', request_id uuid not null unique, request_hash text, laporan jsonb not null default '{}'
);
create table pos_kas_internal.shift_unlock (
 perangkat_id uuid not null references public.pos_perangkat(id), sesi_id uuid not null references public.sesi_kas(id),
 token_hash text not null, primary key(perangkat_id,sesi_id)
);
create index shift_unlock_sesi on pos_kas_internal.shift_unlock(sesi_id);
alter table pos_kas_internal.shift_unlock enable row level security;
revoke all on pos_kas_internal.shift_unlock from public,anon,authenticated;
create unique index shift_baru_aktif on pos_kas_internal.shift_baru(sesi_id) where selesai_at is null;
create index shift_baru_pic on pos_kas_internal.shift_baru(pic_id);
create index shift_baru_sesi on pos_kas_internal.shift_baru(sesi_id,mulai_at);
alter table pos_kas_internal.aturan_shift enable row level security;
alter table pos_kas_internal.shift_baru enable row level security;
revoke all on pos_kas_internal.aturan_shift,pos_kas_internal.shift_baru from public,anon,authenticated;

create function pos_kas_internal.panel_shift() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nama',o.nama,'aktif',coalesce(a.aktif,false),'ada_pin',a.pin_hash is not null,'versi',coalesce(a.versi,0)) order by o.nama),'[]'::jsonb)
 from public.outlet o left join pos_kas_internal.aturan_shift a on a.outlet_id=o.id
 where o.deleted_at is null and matur_internal.admin_pos_outlet(o.id)
$$;
create function public.panel_alur_shift_pos() returns jsonb language sql security invoker set search_path='' as $$ select pos_kas_internal.panel_shift() $$;
create function pos_kas_internal.atur_shift(o uuid,aktif boolean,pin text,versi integer) returns void language plpgsql security definer set search_path='' as $$
declare a pos_kas_internal.aturan_shift;
begin
 if not matur_internal.admin_pos_outlet(o) then raise exception 'Hanya admin outlet yang berwenang';end if;
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||o));
 insert into pos_kas_internal.aturan_shift(outlet_id) values(o) on conflict do nothing;
 select * into a from pos_kas_internal.aturan_shift where outlet_id=o for update;
 if versi is distinct from a.versi then raise exception 'Pengaturan sudah berubah. Muat ulang dahulu';end if;
 if coalesce(pin,'')<>'' and pin !~ '^[0-9]{4,6}$' then raise exception 'PIN outlet harus 4–6 angka';end if;
 if aktif and a.pin_hash is null and coalesce(pin,'')='' then raise exception 'Isi PIN outlet sebelum mengaktifkan alur shift';end if;
 update pos_kas_internal.aturan_shift set aktif=atur_shift.aktif,pin_hash=case when coalesce(pin,'')='' then a.pin_hash else extensions.crypt(pin,extensions.gen_salt('bf')) end,versi=a.versi+1,diubah_at=clock_timestamp() where outlet_id=o;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'atur_alur_shift_pos','outlet',o::text,jsonb_build_object('aktif',aktif,'pin_diubah',coalesce(pin,'')<>''));
end $$;
create function public.atur_alur_shift_pos(p_outlet uuid,p_aktif boolean,p_pin text,p_versi integer) returns void language sql security invoker set search_path='' as $$ select pos_kas_internal.atur_shift(p_outlet,p_aktif,p_pin,p_versi) $$;

-- Ringkasan periodik dihitung dari ledger yang sama, termasuk transaksi offline yang terlambat masuk.
create function pos_kas_internal.ringkas_shift(sid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'sesi_id',s.sesi_id,'nama',s.nama,'pic_id',s.pic_id,'label',s.label,'mulai_at',s.mulai_at,'selesai_at',s.selesai_at,'awal',s.awal,'aktual',s.aktual,'catatan',s.catatan,'laporan',s.laporan,'tim',s.tim,
 'tunai',coalesce(t.tunai,0),'non_tunai',coalesce(t.non_tunai,0),'jumlah',coalesce(t.jumlah,0),'void',coalesce(v.jumlah,0),
 'pengeluaran',coalesce(b.jumlah,0),'keluar',coalesce(k.jumlah,0),'seharusnya',s.awal+coalesce(t.tunai,0)-coalesce(b.jumlah,0)-coalesce(k.jumlah,0),
 'selisih',s.aktual-(s.awal+coalesce(t.tunai,0)-coalesce(b.jumlah,0)-coalesce(k.jumlah,0)))
 from pos_kas_internal.shift_baru s
 left join lateral(select sum(p.nominal) filter(where p.metode='tunai') tunai,sum(p.nominal) filter(where p.metode<>'tunai') non_tunai,count(distinct t.id) jumlah from public.transaksi t join public.pembayaran p on p.transaksi_id=t.id where t.sesi_kas_id=s.sesi_id and t.status='lunas' and t.created_at>=s.mulai_at and (s.selesai_at is null or t.created_at<s.selesai_at)) t on true
 left join lateral(select count(*) jumlah from public.transaksi t where t.sesi_kas_id=s.sesi_id and t.status='void' and t.created_at>=s.mulai_at and (s.selesai_at is null or t.created_at<s.selesai_at)) v on true
 left join lateral(select sum(jumlah) jumlah from public.biaya_outlet where sesi_kas_id=s.sesi_id and sumber='laci' and deleted_at is null and created_at>=s.mulai_at and (s.selesai_at is null or created_at<s.selesai_at)) b on true
 left join lateral(select sum(jumlah) jumlah from public.pos_kas_keluar where sesi_id=s.sesi_id and created_at>=s.mulai_at and (s.selesai_at is null or created_at<s.selesai_at)) k on true where s.id=sid
$$;
create function pos_kas_internal.roster_shift(o uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nama',u.nama,'foto_path',p.foto_path,'terjadwal',j.label is not null,'label',coalesce(j.label,'Pengganti')) order by (j.label is not null) desc,u.nama),'[]'::jsonb)
 from public.pengguna u left join public.profil_karyawan p on p.pengguna_id=u.id
 left join lateral(select string_agg(distinct sh.nama||' '||to_char(sh.jam_mulai,'HH24:MI')||'–'||to_char(sh.jam_selesai,'HH24:MI'),', ') label from public.jadwal_shift j join public.shift_outlet sh on sh.id=j.shift_id where j.pengguna_id=u.id and j.outlet_id=o and j.status='terbit' and j.tanggal=(now() at time zone 'Asia/Jakarta')::date) j on true
 where u.status='aktif' and not u.akun_tablet and exists(select 1 from public.penugasan t where t.pengguna_id=u.id and t.outlet_id=o and t.peran in ('kasir','barista','spv'))
$$;
-- Status selalu mempersiapkan kas seperti mode bebas. Aktivasi berlaku pada pembukaan berikutnya,
-- bukan di tengah kas/transaksi yang sedang berlangsung.
create function pos_kas_internal.status_shift(o uuid,d text,t text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;s uuid;sh pos_kas_internal.shift_baru;mulai timestamptz;ubah timestamptz;aktif boolean;
begin
 r:=pos_kas_internal.siapkan_langsung(o,d,t);s:=(r#>>'{sesi,id}')::uuid;
 select dibuka_at into mulai from public.sesi_kas where id=s;
 select a.aktif,a.diubah_at into aktif,ubah from pos_kas_internal.aturan_shift a where outlet_id=o;
 select * into sh from pos_kas_internal.shift_baru where sesi_id=s and selesai_at is null;
 if sh.id is not null or (coalesce(aktif,false) and mulai>=ubah) then
  r:=r||jsonb_build_object('alur_shift',true,'shift_aktif',pos_kas_internal.ringkas_shift(sh.id),'pilihan',pos_kas_internal.roster_shift(o),'boleh',sh.id is not null and exists(select 1 from pos_kas_internal.shift_unlock z where z.sesi_id=s and z.perangkat_id=pos_kas_internal.perangkat_langsung(o,d) and z.token_hash=encode(extensions.digest(coalesce(nullif(t,''),d),'sha256'),'hex')));
  if sh.id is not null then r:=r||jsonb_build_object('operator',jsonb_build_object('id',sh.pic_id,'nama',sh.nama,'kasir',true));end if;
 end if;
 return r;
end $$;
create or replace function public.status_pos_tim(p_outlet uuid,p_device text,p_token text,p_perbarui boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select pos_kas_internal.status_shift(p_outlet,p_device,p_token) $$;

create function pos_kas_internal.verifier_pin(o uuid,d text,pin text) returns text language plpgsql security definer set search_path='' as $$
declare dev uuid:=pos_kas_internal.perangkat_langsung(o,d);a pos_kas_internal.aturan_shift;percobaan pos_kas_internal.pin_percobaan;
begin
 if dev is null then raise exception 'Akun perangkat tidak sesuai';end if;
 select * into a from pos_kas_internal.aturan_shift where outlet_id=o;
 insert into pos_kas_internal.pin_percobaan(perangkat_id) values(dev) on conflict do nothing;
 select * into percobaan from pos_kas_internal.pin_percobaan where perangkat_id=dev for update;
 if percobaan.sejak<clock_timestamp()-interval '1 minute' then update pos_kas_internal.pin_percobaan set jumlah=0,sejak=clock_timestamp() where perangkat_id=dev;percobaan.jumlah:=0;end if;
 if percobaan.jumlah>=8 then return 'Terlalu banyak percobaan PIN. Tunggu satu menit lalu coba lagi';end if;
 if a.pin_hash is null or extensions.crypt(pin,a.pin_hash) is distinct from a.pin_hash then
  update pos_kas_internal.pin_percobaan set jumlah=jumlah+1 where perangkat_id=dev;return 'PIN outlet tidak sesuai';
 end if;
 update pos_kas_internal.pin_percobaan set jumlah=0 where perangkat_id=dev;
 return null;
end $$;
revoke all on function pos_kas_internal.verifier_pin(uuid,text,text) from public,anon,authenticated;

-- Semua transisi memakai satu lock outlet dan request_id: retry tidak menggandakan shift.
create function pos_kas_internal.proses_shift(o uuid,d text,t text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;s uuid;sh pos_kas_internal.shift_baru;baru pos_kas_internal.shift_baru;u public.pengguna;a pos_kas_internal.aturan_shift;h jsonb;fisik bigint;pic uuid;v_label text;alasan text:=trim(coalesce(p->>'alasan',''));w timestamptz;req uuid:=(p->>'request_id')::uuid;aksi text:=p->>'aksi';hasil jsonb;dev uuid;percobaan pos_kas_internal.pin_percobaan;notes jsonb;erreur text;
begin
 if pos_kas_internal.perangkat_langsung(o,d) is null then raise exception 'Masuk kembali dengan akun outlet';end if;
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||o));
 if req is null then raise exception 'Identitas permintaan wajib';end if;
 if octet_length(p::text)>64000 then raise exception 'Catatan terlalu panjang';end if;
 notes:=coalesce(p->'laporan','{}')-'request_tutup';
 if jsonb_typeof(notes)<>'object' then raise exception 'Format laporan tidak valid';end if;
 notes:=jsonb_build_object('stok',left(coalesce(notes->>'stok',''),6000),'barang',left(coalesce(notes->>'barang',''),6000),'order',left(coalesce(notes->>'order',''),6000),'non_tunai_aktual',(notes->>'non_tunai_aktual')::bigint);
 if (notes->>'non_tunai_aktual')::bigint<0 or (notes->>'non_tunai_aktual')::bigint>1000000000000 then raise exception 'Non tunai aktual tidak valid';end if;
 select * into baru from pos_kas_internal.shift_baru where request_id=req;
 if baru.id is not null then
  if not exists(select 1 from public.sesi_kas where id=baru.sesi_id and outlet_id=o) then raise exception 'Permintaan tidak sesuai outlet';end if;
  if baru.request_hash is distinct from encode(extensions.digest((p-'pin')::text,'sha256'),'hex') then raise exception 'Identitas permintaan sudah dipakai untuk data lain';end if;
  if aksi='mulai' then
   erreur:=pos_kas_internal.verifier_pin(o,d,p->>'pin');
   if erreur is not null then return jsonb_build_object('error',erreur);end if;
   insert into pos_kas_internal.shift_unlock(perangkat_id,sesi_id,token_hash) values(pos_kas_internal.perangkat_langsung(o,d),baru.sesi_id,encode(extensions.digest(coalesce(nullif(t,''),d),'sha256'),'hex')) on conflict(perangkat_id,sesi_id) do update set token_hash=excluded.token_hash;
  end if;
  return jsonb_build_object('ok',true,'id',baru.id);
 end if;
 -- Penutupan retry menggunakan request tersimpan pada laporan.
 if exists(select 1 from pos_kas_internal.shift_baru b join public.sesi_kas sk on sk.id=b.sesi_id where sk.outlet_id=o and b.laporan->>'request_tutup'=req::text) then return jsonb_build_object('ok',true);end if;
 r:=pos_kas_internal.status_shift(o,d,t);s:=(r#>>'{sesi,id}')::uuid;
 if not coalesce((r->>'alur_shift')::boolean,false) then raise exception 'Alur shift mulai berlaku setelah kas berjalan ditutup';end if;
 select * into sh from pos_kas_internal.shift_baru where sesi_id=s and selesai_at is null for update;
 if aksi in ('serah','tutup','draft') and not coalesce((r->>'boleh')::boolean,false) then raise exception 'Masukkan PIN outlet untuk melanjutkan shift dahulu';end if;
 if (p->>'shift_id')::uuid is distinct from sh.id then raise exception 'Shift sudah berubah. Muat ulang untuk melanjutkan';end if;
 if aksi is null or aksi not in ('mulai','serah','tutup','draft','lanjut') then raise exception 'Aksi tidak dikenal';end if;
 if aksi='draft' then
  if sh.id is null then raise exception 'Belum ada shift';end if;
  update pos_kas_internal.shift_baru set laporan=notes where id=sh.id;
  return jsonb_build_object('ok',true);
 end if;
 if aksi in ('mulai','serah','lanjut') then
  select * into a from pos_kas_internal.aturan_shift where outlet_id=o;
  dev:=pos_kas_internal.perangkat_langsung(o,d);
  erreur:=pos_kas_internal.verifier_pin(o,d,p->>'pin');
  if erreur is not null then return jsonb_build_object('error',erreur);end if;
  if aksi='lanjut' then
   if sh.id is null then raise exception 'Shift sudah berubah. Muat ulang';end if;
   insert into pos_kas_internal.shift_unlock(perangkat_id,sesi_id,token_hash) values(dev,s,encode(extensions.digest(coalesce(nullif(t,''),d),'sha256'),'hex')) on conflict(perangkat_id,sesi_id) do update set token_hash=excluded.token_hash;
   return jsonb_build_object('ok',true,'id',sh.id);
  end if;
  pic:=(p->>'pic_id')::uuid;
  select * into u from public.pengguna where id=pic and status='aktif' and not akun_tablet and exists(select 1 from public.penugasan where pengguna_id=pic and outlet_id=o and peran in ('kasir','barista','spv'));
  if u.id is null then raise exception 'Pilih staf aktif outlet';end if;
  select x->>'label' into v_label from jsonb_array_elements(pos_kas_internal.roster_shift(o)) x where x->>'id'=pic::text and (x->>'terjadwal')::boolean;
  if v_label is null and length(alasan)<3 then raise exception 'Isi alasan memilih petugas pengganti';end if;
  v_label:=coalesce(v_label,'Pengganti');
 end if;
 if aksi='mulai' then
  if sh.id is not null or exists(select 1 from pos_kas_internal.shift_baru where sesi_id=s) then raise exception 'Shift sudah dimulai';end if;
  fisik:=(p->>'modal')::bigint;
  if fisik is null or fisik<0 or fisik>1000000000000 then raise exception 'Isi modal awal yang valid';end if;
  perform pos_kas_internal.modal_langsung(s,d,fisik);
  insert into pos_kas_internal.shift_baru(sesi_id,pic_id,nama,label,awal,alasan,request_id) values(s,pic,u.nama,v_label,fisik,alasan,req) returning * into baru;
 else
  if sh.id is null then raise exception 'Belum ada shift aktif';end if;
  fisik:=(p->>'aktual')::bigint;h:=pos_kas_internal.ringkas_shift(sh.id);
  if fisik is null or fisik<0 or fisik>1000000000000 then raise exception 'Isi uang fisik termasuk modal';end if;
  if fisik<>(h->>'seharusnya')::bigint and length(trim(coalesce(p->>'catatan','')))<3 then raise exception 'Isi catatan selisih kas';end if;
  w:=clock_timestamp();
  update pos_kas_internal.shift_baru set selesai_at=w,aktual=fisik,catatan=left(coalesce(p->>'catatan',''),1000),laporan=notes||jsonb_build_object('request_tutup',req) where id=sh.id;
  if aksi='serah' then
   insert into pos_kas_internal.shift_baru(sesi_id,pic_id,nama,label,mulai_at,awal,alasan,request_id) values(s,pic,u.nama,v_label,w,fisik,alasan,req) returning * into baru;
  else
   hasil:=pos_kas_internal.tutup_langsung(s,d,fisik,p->>'catatan',array(select jsonb_array_elements_text(coalesce(p->'pending','[]')))::uuid[]);
  end if;
 end if;
 if baru.id is not null then
  insert into pos_kas_internal.shift_unlock(perangkat_id,sesi_id,token_hash) values(dev,s,encode(extensions.digest(coalesce(nullif(t,''),d),'sha256'),'hex')) on conflict(perangkat_id,sesi_id) do update set token_hash=excluded.token_hash;
  update pos_kas_internal.shift_baru set request_hash=encode(extensions.digest((p-'pin')::text,'sha256'),'hex'),tim=(select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','nama',x->>'nama')),'[]') from jsonb_array_elements(pos_kas_internal.roster_shift(o)) x where x->>'id'=pic::text or ((x->>'terjadwal')::boolean and x->>'label'=v_label)) where id=baru.id;
 end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'shift_pos_'||aksi,'sesi_kas',s::text,jsonb_build_object('shift_id',coalesce(baru.id,sh.id),'pic_id',pic,'aktual',fisik));
 return jsonb_build_object('ok',true,'id',coalesce(baru.id,sh.id));
end $$;
create function public.proses_alur_shift_pos(p_outlet uuid,p_device text,p_token text,p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select pos_kas_internal.proses_shift(p_outlet,p_device,p_token,p) $$;

-- Guard server-side: UI bukan sumber otorisasi. Mesin harga/stok/idempotensi tetap dipakai.
create function pos_kas_internal.checkout_shift(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;hasil jsonb;s uuid:=(p->>'sesi_id')::uuid;sh pos_kas_internal.shift_baru;w timestamptz;off boolean:=coalesce((p->>'sinkron_offline')::boolean,false);
begin
 if not exists(select 1 from public.pengguna where id=auth.uid() and akun_tablet) then return pos_kas_internal.checkout_langsung(p);end if;
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||(p->>'outlet_id')));
 -- Retry transaksi lama harus tetap berhasil setelah pergantian/penutupan.
 if exists(select 1 from public.transaksi where client_id=(p->>'client_id')::uuid) then return pos_kas_internal.checkout_langsung(p);end if;
 if not off then
  r:=pos_kas_internal.status_shift((p->>'outlet_id')::uuid,p->>'device_token',p->>'pos_token');
  if coalesce((r->>'alur_shift')::boolean,false) and not (r->>'boleh')::boolean then raise exception 'Pilih petugas dan mulai shift dahulu';end if;
 end if;
 w:=case when off then (p->>'waktu_asli')::timestamptz else clock_timestamp() end;
 if off and exists(select 1 from pos_kas_internal.aturan_shift a join public.sesi_kas k on k.outlet_id=a.outlet_id where k.id=s and a.aktif and k.dibuka_at>=a.diubah_at) and not exists(select 1 from pos_kas_internal.shift_baru where sesi_id=s) then raise exception 'Mulai shift sebelum transaksi offline';end if;
 select * into sh from pos_kas_internal.shift_baru where sesi_id=s and mulai_at<=w and (selesai_at is null or selesai_at>w) order by mulai_at desc limit 1;
 hasil:=pos_kas_internal.checkout_langsung(p);
 if not off then update public.transaksi set created_at=w where id=(hasil->>'id')::uuid;end if;
 if sh.id is not null then update public.transaksi set operator_id=sh.pic_id,operator_nama=sh.nama where id=(hasil->>'id')::uuid;end if;
 return hasil;
end $$;
create or replace function public.buat_transaksi(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select pos_kas_internal.checkout_shift(p) $$;

create function pos_kas_internal.laporan_shift(o uuid,d text,sid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare h jsonb;
begin
 if pos_kas_internal.perangkat_langsung(o,d) is null and not matur_internal.admin_pos_outlet(o) then raise exception 'Tidak berwenang';end if;
 if not exists(select 1 from public.sesi_kas where id=sid and outlet_id=o) then raise exception 'Kas tidak sesuai outlet';end if;
 h:=matur_internal.kas_ringkas(sid);
 return jsonb_build_object('outlet',(select nama from public.outlet where id=o),'kas',h,'sesi',(select to_jsonb(s)||jsonb_build_object('selisih',s.fisik_akhir-(h->>'seharusnya')::bigint) from public.sesi_kas s where id=sid),
 'shifts',coalesce((select jsonb_agg(pos_kas_internal.ringkas_shift(id) order by mulai_at) from pos_kas_internal.shift_baru where sesi_id=sid),'[]'::jsonb),
 'pengeluaran',coalesce((select jsonb_agg(jsonb_build_object('keterangan',keterangan,'jumlah',jumlah) order by created_at) from public.biaya_outlet where sesi_kas_id=sid and sumber='laci' and deleted_at is null),'[]'::jsonb),
 'kanal',coalesce((select jsonb_object_agg(kanal,total) from (select kanal,sum(total) total from public.transaksi where sesi_kas_id=sid and status='lunas' group by kanal) x),'{}'::jsonb),
 'barang_datang',coalesce((select jsonb_agg(jsonb_build_object('nomor',k.nomor,'tanggal',k.tanggal,'status',k.status,'items',(select coalesce(jsonb_agg(jsonb_build_object('nama',i.nama,'qty',i.qty_diterima,'satuan',i.satuan,'catatan',i.catatan)),'[]'::jsonb) from public.item_kiriman i where i.kiriman_id=k.id)) order by k.created_at) from public.kiriman k join public.sesi_kas s on s.id=sid where k.outlet_id=o and k.deleted_at is null and k.diterima_at>=s.dibuka_at and (s.ditutup_at is null or k.diterima_at<=s.ditutup_at)),'[]'::jsonb),
 'sementara',exists(select 1 from public.pos_perangkat where outlet_id=o and status='aktif' and (antrean_jumlah>0 or antrean_at is null or antrean_at<now()-interval '2 minutes')) or exists(select 1 from matur_internal.pos_pending where sesi_id=sid));
end $$;
create function public.laporan_alur_shift_pos(p_outlet uuid,p_device text,p_sesi uuid) returns jsonb language sql security invoker set search_path='' as $$ select pos_kas_internal.laporan_shift(p_outlet,p_device,p_sesi) $$;
-- Jangan beri akses tabel atau helper; RPC terbatas memeriksa uid/outlet sendiri.
revoke all on function pos_kas_internal.ringkas_shift(uuid),pos_kas_internal.roster_shift(uuid) from public,anon,authenticated;
revoke all on function pos_kas_internal.panel_shift(),pos_kas_internal.atur_shift(uuid,boolean,text,integer),pos_kas_internal.status_shift(uuid,text,text),pos_kas_internal.proses_shift(uuid,text,text,jsonb),pos_kas_internal.checkout_shift(jsonb),pos_kas_internal.laporan_shift(uuid,text,uuid) from public,anon;
grant execute on function pos_kas_internal.panel_shift(),pos_kas_internal.atur_shift(uuid,boolean,text,integer),pos_kas_internal.status_shift(uuid,text,text),pos_kas_internal.proses_shift(uuid,text,text,jsonb),pos_kas_internal.checkout_shift(jsonb),pos_kas_internal.laporan_shift(uuid,text,uuid) to authenticated;
revoke all on function public.panel_alur_shift_pos(),public.atur_alur_shift_pos(uuid,boolean,text,integer),public.proses_alur_shift_pos(uuid,text,text,jsonb),public.laporan_alur_shift_pos(uuid,text,uuid) from public,anon;
grant execute on function public.panel_alur_shift_pos(),public.atur_alur_shift_pos(uuid,boolean,text,integer),public.proses_alur_shift_pos(uuid,text,text,jsonb),public.laporan_alur_shift_pos(uuid,text,uuid) to authenticated;
-- Tutup/modal dari klien lama tidak boleh melewati serah-terima alur baru.
create or replace function public.atur_modal_pos(p_sesi uuid,p_device text,p_jumlah bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from pos_kas_internal.shift_baru where sesi_id=p_sesi) then raise exception 'Modal awal sudah dicatat. Gunakan serah terima untuk pergantian petugas';end if;
 perform pos_kas_internal.modal_langsung(p_sesi,p_device,p_jumlah);
end $$;
create or replace function public.tutup_kas_outlet(p_sesi uuid,p_device text,p_kode text,p_pin text,p_aktual bigint,p_catatan text,p_pending uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from pos_kas_internal.shift_baru where sesi_id=p_sesi and selesai_at is null) then raise exception 'Gunakan Selesai & Serah Terima Shift atau Tutup Operasional';end if;
 return pos_kas_internal.tutup_langsung(p_sesi,p_device,p_aktual,p_catatan,p_pending);
end $$;
-- Foto profil tetap privat. Tablet hanya boleh membaca foto staf aktif outlet miliknya.
create function public.foto_staf_pos(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profil_karyawan p join public.pengguna u on u.id=p.pengguna_id and u.status='aktif'
 join public.penugasan t on t.pengguna_id=u.id and t.peran in ('kasir','barista','spv')
 join public.pos_perangkat d on d.outlet_id=t.outlet_id and d.akun_id=auth.uid() and d.status='aktif'
 join matur_internal.pos_outlet_akses a on a.outlet_id=d.outlet_id and a.aktif and a.deleted_at is null and d.kredensial_at>=a.diubah_at
 where p.foto_path=p_path)
$$;
revoke all on function public.foto_staf_pos(text) from public,anon;
grant execute on function public.foto_staf_pos(text) to authenticated;
create policy foto_staf_pos on storage.objects for select to authenticated using(bucket_id='profil' and public.foto_staf_pos(name));
create function pos_kas_internal.riwayat_shift(o uuid,d text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if pos_kas_internal.perangkat_langsung(o,d) is null and not matur_internal.admin_pos_outlet(o) then raise exception 'Tidak berwenang';end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.dibuka_at desc) from (
  select s.id,s.tanggal_shift,s.dibuka_at,s.ditutup_at,s.fisik_akhir,s.selisih from public.sesi_kas s where s.outlet_id=o and exists(select 1 from pos_kas_internal.shift_baru b where b.sesi_id=s.id) order by s.dibuka_at desc limit 60
 ) x),'[]'::jsonb);
end $$;
create function public.riwayat_alur_shift_pos(p_outlet uuid,p_device text) returns jsonb language sql security invoker set search_path='' as $$ select pos_kas_internal.riwayat_shift(p_outlet,p_device) $$;
revoke all on function pos_kas_internal.riwayat_shift(uuid,text),public.riwayat_alur_shift_pos(uuid,text) from public,anon;
grant execute on function pos_kas_internal.riwayat_shift(uuid,text),public.riwayat_alur_shift_pos(uuid,text) to authenticated;
