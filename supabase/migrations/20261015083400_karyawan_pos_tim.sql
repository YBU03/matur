-- One personal account, private administrative PIN, approved outlet tablet, one team cash session.
create schema if not exists matur_internal;
revoke all on schema matur_internal from public,anon,authenticated;

create table matur_internal.pos_pin (
 pengguna_id uuid primary key references public.pengguna, kode text not null unique,
 pin_hash text, secret_id uuid, diubah_oleh uuid references public.pengguna, diubah_at timestamptz not null default now()
);
alter table matur_internal.pos_pin enable row level security;
insert into matur_internal.pos_pin(pengguna_id,kode)
 select distinct p.pengguna_id,case when u.email like '%@pin.matur.id' then split_part(u.email,'@',1) else 'staf-'||replace(p.pengguna_id::text,'-','') end
 from public.penugasan p join public.pengguna u on u.id=p.pengguna_id where p.peran in ('kasir','barista','spv');

create or replace function public.atur_pos_pin(p_uid uuid,p_kode text,p_pin text) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare secret uuid; kode text:=lower(trim(p_kode));
begin
 if auth.uid() is null or not punya_peran('{owner,hrd,admin_gudang}') then raise exception 'Hanya HRD, Admin Gudang atau Owner'; end if;
 if not exists(select 1 from penugasan where pengguna_id=p_uid and peran in ('kasir','barista','spv')) or exists(select 1 from penugasan where pengguna_id=p_uid and peran in ('owner','hrd','admin_pusat','finance','admin_gudang')) then raise exception 'Hanya PIN staf outlet';end if;
 if p_pin is null or p_pin !~ '^[0-9]{4,6}$' or kode is null or kode !~ '^[a-z0-9._-]{3,60}$' then raise exception 'Kode 3–60 huruf/angka; PIN 4–6 angka';end if;
 perform pg_advisory_xact_lock(hashtext('pin:'||p_uid));
 select secret_id into secret from matur_internal.pos_pin where pengguna_id=p_uid for update;
 if secret is null then select vault.create_secret(p_pin,'pos-pin:'||p_uid,'PIN POS; hanya RPC admin berotorisasi') into secret;
 else perform vault.update_secret(secret,p_pin);end if;
 insert into matur_internal.pos_pin(pengguna_id,kode,pin_hash,secret_id,diubah_oleh)
 values(p_uid,kode,crypt(p_pin,gen_salt('bf')),secret,auth.uid()) on conflict(pengguna_id) do update set kode=excluded.kode,pin_hash=excluded.pin_hash,secret_id=excluded.secret_id,diubah_oleh=auth.uid(),diubah_at=now();
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'atur_pin','pos_staf',p_uid::text,jsonb_build_object('kode',kode));
end $$;
revoke all on function atur_pos_pin(uuid,text,text) from public,anon;
grant execute on function atur_pos_pin(uuid,text,text) to authenticated;

create or replace function public.lihat_pos_pin(p_uid uuid) returns text
language plpgsql security definer set search_path=public as $$
declare pin text;
begin
 if auth.uid() is null or not punya_peran('{owner,hrd,admin_gudang}') then raise exception 'Hanya admin PIN';end if;
 select s.decrypted_secret into pin from matur_internal.pos_pin p join vault.decrypted_secrets s on s.id=p.secret_id where p.pengguna_id=p_uid;
 if pin is null then raise exception 'PIN lama tidak dapat ditampilkan. Tetapkan PIN baru dahulu.';end if;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id) values(auth.uid(),'lihat_pin','pos_staf',p_uid::text);
 return pin;
end $$;
revoke all on function lihat_pos_pin(uuid) from public,anon;
grant execute on function lihat_pos_pin(uuid) to authenticated;

-- Old reset callers set only the POS credential; never alter Auth passwords.
create or replace function public.atur_pin(p_uid uuid,p_rahasia text) returns void
language plpgsql security definer set search_path=public as $$
declare kode text;
begin
 if auth.uid() is null then raise exception 'Masuk dahulu';end if;
 select p.kode into kode from matur_internal.pos_pin p where pengguna_id=p_uid;
 perform atur_pos_pin(p_uid,coalesce(kode,'staf-'||replace(p_uid::text,'-','')),split_part(p_rahasia,':',2));
end $$;
revoke all on function atur_pin(uuid,text) from public,anon;
grant execute on function atur_pin(uuid,text) to authenticated;

create table public.pos_perangkat (
 id uuid primary key default gen_random_uuid(),outlet_id uuid not null references outlet,nama text not null,
 status text not null default 'menunggu' check(status in ('menunggu','aktif','dicabut')),
 diminta_oleh uuid not null references pengguna,disetujui_oleh uuid references pengguna,
 created_at timestamptz not null default now(),diubah_at timestamptz not null default now()
);
create table matur_internal.pos_perangkat_rahasia (perangkat_id uuid primary key references pos_perangkat,hash text not null unique);
create table matur_internal.pos_pin_gagal (id bigint generated always as identity primary key,pengguna_id uuid,perangkat_id uuid,at timestamptz not null default now());
create index on matur_internal.pos_pin_gagal(pengguna_id,at);create index on matur_internal.pos_pin_gagal(perangkat_id,at);
alter table matur_internal.pos_perangkat_rahasia enable row level security;alter table matur_internal.pos_pin_gagal enable row level security;
alter table pos_perangkat enable row level security;
create policy baca on pos_perangkat for select to authenticated using(punya_peran('{owner,hrd,admin_gudang}') or diminta_oleh=(select auth.uid()));
grant select on pos_perangkat to authenticated;
create index on pos_perangkat(outlet_id);create index on pos_perangkat(diminta_oleh);create index on pos_perangkat(disetujui_oleh);

alter table outlet add column pos_awal_menit int not null default 15 check(pos_awal_menit between 0 and 120);
alter table outlet add column pos_offline_menit int not null default 30 check(pos_offline_menit between 1 and 120);
alter table outlet add column absen_lat double precision;
alter table outlet add column absen_lng double precision;
alter table outlet add column absen_radius_meter int not null default 200 check(absen_radius_meter between 20 and 5000);

create or replace function public.minta_tablet_pos(p_outlet uuid,p_nama text,p_rahasia text) returns uuid
language plpgsql security definer set search_path=public,extensions as $$
declare idbaru uuid;h text:=encode(digest(p_rahasia,'sha256'),'hex');
begin
 if auth.uid() is null or not(peran_di_outlet(p_outlet,'{kasir,barista,spv}') or punya_peran('{owner,hrd,admin_gudang}')) then raise exception 'Tidak diizinkan';end if;
 if length(trim(coalesce(p_nama,'')))<3 or length(coalesce(p_rahasia,''))<40 then raise exception 'Nama/identitas perangkat tidak valid';end if;
 select perangkat_id into idbaru from matur_internal.pos_perangkat_rahasia where hash=h;
 if idbaru is not null then return idbaru;end if;
 insert into pos_perangkat(outlet_id,nama,diminta_oleh) values(p_outlet,left(trim(p_nama),100),auth.uid()) returning id into idbaru;
 insert into matur_internal.pos_perangkat_rahasia values(idbaru,h);
 return idbaru;
end $$;
revoke all on function minta_tablet_pos(uuid,text,text) from public,anon;
grant execute on function minta_tablet_pos(uuid,text,text) to authenticated;

create or replace function public.atur_tablet_pos(p_id uuid,p_aktif boolean,p_alasan text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not punya_peran('{owner,hrd,admin_gudang}') then raise exception 'Hanya admin perangkat';end if;
 if length(trim(coalesce(p_alasan,'')))<3 then raise exception 'Alasan wajib';end if;
 update pos_perangkat set status=case when p_aktif then 'aktif' else 'dicabut' end,disetujui_oleh=auth.uid(),diubah_at=now() where id=p_id;
 if not found then raise exception 'Perangkat tidak ditemukan';end if;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'akses_tablet','pos_perangkat',p_id::text,jsonb_build_object('aktif',p_aktif,'alasan',p_alasan));
end $$;
revoke all on function atur_tablet_pos(uuid,boolean,text) from public,anon;
grant execute on function atur_tablet_pos(uuid,boolean,text) to authenticated;

create or replace function matur_internal.perangkat(p_outlet uuid,p_rahasia text) returns uuid
language sql stable security definer set search_path=public,extensions as $$
 select d.id from pos_perangkat d join matur_internal.pos_perangkat_rahasia r on r.perangkat_id=d.id
 where auth.uid() is not null and d.outlet_id=p_outlet and d.status='aktif' and r.hash=encode(digest(p_rahasia,'sha256'),'hex')
 and peran_di_outlet(p_outlet,'{kasir,barista,spv}')
$$;
revoke all on function matur_internal.perangkat(uuid,text) from public,anon,authenticated;

alter table sesi_kas add column pos_tim boolean not null default false;
alter table sesi_kas add column perangkat_id uuid references pos_perangkat;
alter table sesi_kas add column shift_id uuid references shift_outlet;
alter table sesi_kas add column tanggal_shift date;
alter table sesi_kas add column batas_at timestamptz;
alter table sesi_kas add column catatan_tutup text;
alter table sesi_kas add column fisik_akhir bigint;
alter table sesi_kas add column kas_seharusnya bigint;
alter table sesi_kas add column rekap_status text not null default 'final' check(rekap_status in ('sementara','final'));
alter table sesi_kas add column pending_offline int not null default 0 check(pending_offline>=0);
create unique index satu_pos_tim_outlet on sesi_kas(mode,outlet_id) where ditutup_at is null and pos_tim;
create index on sesi_kas(perangkat_id);create index on sesi_kas(shift_id);
create table public.pos_tim_anggota (
 sesi_id uuid not null references sesi_kas,pengguna_id uuid not null references pengguna,absensi_id uuid not null references absensi,
 nama text not null,gabung_at timestamptz not null default now(),keluar_at timestamptz,
 primary key(sesi_id,pengguna_id)
);
create index on pos_tim_anggota(pengguna_id);create index on pos_tim_anggota(absensi_id);
alter table pos_tim_anggota enable row level security;
create policy baca on pos_tim_anggota for select to authenticated using(exists(select 1 from sesi_kas s where s.id=sesi_id and boleh_outlet(s.outlet_id)));
grant select on pos_tim_anggota to authenticated;
create table matur_internal.pos_izin (
 id uuid primary key default gen_random_uuid(),sesi_id uuid not null references sesi_kas,perangkat_id uuid not null references pos_perangkat,
 diverifikasi_oleh uuid not null references pengguna,token_hash text not null,
 mulai_at timestamptz not null default now(),sampai_at timestamptz not null,ditarik_at timestamptz
);
create index on matur_internal.pos_izin(sesi_id);create index on matur_internal.pos_izin(perangkat_id);create index on matur_internal.pos_izin(diverifikasi_oleh);
alter table matur_internal.pos_izin enable row level security;

-- A lease fixes the displayed prices. Changes to recipe/cost metadata require review of older offline records.
alter table matur_internal.pos_izin add column katalog jsonb not null default '{}';
create or replace function matur_internal.katalog_pos() returns jsonb
language sql stable security definer set search_path=public,extensions as $$
 select jsonb_build_object('menu',(select coalesce(jsonb_object_agg(id::text,jsonb_build_object('langsung',harga_langsung,'ojol',harga_ojol)),'{}') from menu where mode='asli' and aktif and deleted_at is null),
 'varian',(select coalesce(jsonb_object_agg(id::text,tambahan_harga),'{}') from varian where mode='asli' and deleted_at is null),
 'resep_hash',encode(digest(coalesce((select jsonb_agg(to_jsonb(r) order by r.id)::text from resep r where mode='asli' and deleted_at is null),'[]')||coalesce((select jsonb_agg(jsonb_build_array(id,harga_pokok) order by id)::text from bahan where mode='asli' and deleted_at is null),'[]')||coalesce((select jsonb_agg(jsonb_build_array(id,titipan,harga_titip) order by id)::text from menu where mode='asli' and deleted_at is null),'[]'),'sha256'),'hex')) where auth.uid() is not null
$$;
revoke all on function matur_internal.katalog_pos() from public,anon,authenticated;

create or replace function matur_internal.cek_pin_tim(p_uid uuid,p_pin text,p_perangkat uuid) returns boolean
language plpgsql security definer set search_path=public,extensions as $$
declare h text;valid boolean:=false;
begin
 if auth.uid() is null then return false;end if;
 if (select count(*) from matur_internal.pos_pin_gagal where (pengguna_id=p_uid or perangkat_id=p_perangkat) and at>now()-interval '15 minutes')>=5 then return false;end if;
 select pin_hash into h from matur_internal.pos_pin where pengguna_id=p_uid;
 valid:=h is not null and p_pin ~ '^[0-9]{4,6}$' and h=crypt(p_pin,h);
 if not valid then insert into matur_internal.pos_pin_gagal(pengguna_id,perangkat_id) values(p_uid,p_perangkat);end if;
 return valid;
end $$;
revoke all on function matur_internal.cek_pin_tim(uuid,text,uuid) from public,anon,authenticated;

create or replace function public.buka_pos_tim(p_outlet uuid,p_device text,p_kode text,p_pin text,p_modal bigint,p_anggota uuid[],p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare dev uuid;uid uuid;sid uuid;j record;akhir timestamptz;awal timestamptz;a record;permit uuid;
begin
 dev:=matur_internal.perangkat(p_outlet,p_device);if dev is null then raise exception 'Tablet belum disetujui atau tidak sesuai outlet';end if;
 select p.pengguna_id into uid from matur_internal.pos_pin p join pengguna u on u.id=p.pengguna_id and u.status='aktif' where p.kode=lower(trim(p_kode));
 if not matur_internal.cek_pin_tim(uid,p_pin,dev) then return jsonb_build_object('error','Kode/PIN salah atau dibatasi 15 menit setelah 5 percobaan');end if;
 if not exists(select 1 from penugasan where pengguna_id=uid and outlet_id=p_outlet and peran in ('kasir','spv')) then raise exception 'Petugas tidak memiliki akses kasir outlet ini';end if;
 if length(coalesce(p_token,''))<40 or p_modal is null or p_modal<0 then raise exception 'Modal/token tidak valid';end if;
 select js.*,sh.jam_mulai,sh.jam_selesai,sh.nama,o.pos_awal_menit,o.pos_offline_menit into j from absensi ab join jadwal_shift js on js.id=ab.jadwal_id join shift_outlet sh on sh.id=js.shift_id join outlet o on o.id=js.outlet_id
 where ab.pengguna_id=uid and ab.outlet_id=p_outlet and ab.pulang_at is null and ab.masuk_at>now()-interval '20 hours' and js.status='terbit' order by ab.masuk_at desc limit 1;
 if j.id is null then raise exception 'Petugas wajib memiliki jadwal terbit dan sudah Clock In, belum Clock Out';end if;
 awal:=(j.tanggal+j.jam_mulai) at time zone 'Asia/Jakarta';akhir:=(j.tanggal+j.jam_selesai+case when j.jam_selesai<=j.jam_mulai then interval '1 day' else interval '0' end) at time zone 'Asia/Jakarta';
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||p_outlet));
 select id into sid from sesi_kas where outlet_id=p_outlet and mode='asli' and ditutup_at is null for update;
 if sid is not null then
  if not exists(select 1 from sesi_kas where id=sid and pos_tim and perangkat_id=dev and shift_id=j.shift_id and tanggal_shift=j.tanggal) then raise exception 'POS outlet sudah dibuka pada perangkat/shift lain. Tutup atau serah terima sesi lama dahulu';end if;
  select batas_at into akhir from sesi_kas where id=sid;
 else
  if now()<awal-make_interval(mins=>j.pos_awal_menit) or now()>akhir then raise exception 'Di luar jam shift. Minta SPV mengatur pengecualian';end if;
  if p_anggota is null or not uid=any(p_anggota) then raise exception 'Konfirmasi pembuka dan anggota tim';end if;
  if cardinality(p_anggota)<>(select count(distinct x) from unnest(p_anggota) x) then raise exception 'Anggota berulang';end if;
  if exists(select 1 from unnest(p_anggota) x where not exists(select 1 from absensi ab join jadwal_shift js on js.id=ab.jadwal_id where ab.pengguna_id=x and ab.outlet_id=p_outlet and ab.pulang_at is null and js.shift_id=j.shift_id and js.tanggal=j.tanggal and js.status='terbit')) then raise exception 'Anggota harus sudah absen pada shift yang sama';end if;
  insert into sesi_kas(outlet_id,kasir_id,modal_laci,dibuka_oleh,nama_kasir,pos_tim,perangkat_id,shift_id,tanggal_shift,batas_at)
  values(p_outlet,uid,p_modal,auth.uid(),j.nama||' · Tim',true,dev,j.shift_id,j.tanggal,akhir) returning id into sid;
  insert into pos_tim_anggota(sesi_id,pengguna_id,absensi_id,nama)
  select sid,ab.pengguna_id,ab.id,u.nama from absensi ab join jadwal_shift js on js.id=ab.jadwal_id join pengguna u on u.id=ab.pengguna_id
  where ab.pengguna_id=any(p_anggota) and ab.outlet_id=p_outlet and ab.pulang_at is null and js.shift_id=j.shift_id and js.tanggal=j.tanggal;
 end if;
 if now()>akhir then raise exception 'Jam shift berakhir; POS perlu perpanjangan SPV';end if;
 if not exists(select 1 from pos_tim_anggota m join absensi ab on ab.id=m.absensi_id where m.sesi_id=sid and m.pengguna_id=uid and m.keluar_at is null and ab.pulang_at is null) then raise exception 'Hanya anggota tim yang masih bertugas dapat membuka kembali POS';end if;
 insert into matur_internal.pos_izin(sesi_id,perangkat_id,diverifikasi_oleh,token_hash,sampai_at,katalog)
 values(sid,dev,uid,encode(digest(p_token,'sha256'),'hex'),least(akhir,now()+make_interval(mins=>j.pos_offline_menit)),matur_internal.katalog_pos()) returning id into permit;
 return jsonb_build_object('sesi_id',sid,'izin_id',permit,'batas_at',akhir,'server_at',now());
end $$;
revoke all on function buka_pos_tim(uuid,text,text,text,bigint,uuid[],text) from public,anon;
grant execute on function buka_pos_tim(uuid,text,text,text,bigint,uuid[],text) to authenticated;

create or replace function public.gabung_pos_tim(p_sesi uuid) returns void
language plpgsql security definer set search_path=public as $$
declare s sesi_kas;ab absensi;nm text;
begin
 if auth.uid() is null then raise exception 'Masuk dahulu';end if;
 select * into s from sesi_kas where id=p_sesi and pos_tim and ditutup_at is null for update;
 if s.id is null or not peran_di_outlet(s.outlet_id,'{kasir,barista,spv}') then raise exception 'Sesi tidak tersedia';end if;
 select a.* into ab from absensi a join jadwal_shift j on j.id=a.jadwal_id where a.pengguna_id=auth.uid() and a.outlet_id=s.outlet_id and a.pulang_at is null and j.shift_id=s.shift_id and j.tanggal=s.tanggal_shift and j.status='terbit' limit 1;
 if ab.id is null then raise exception 'Absen masuk pada shift yang sama dahulu';end if;
 select nama into nm from pengguna where id=auth.uid();
 insert into pos_tim_anggota(sesi_id,pengguna_id,absensi_id,nama) values(s.id,auth.uid(),ab.id,nm) on conflict(sesi_id,pengguna_id) do nothing;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id) values(auth.uid(),'gabung_tim','sesi_kas',s.id::text);
end $$;
revoke all on function gabung_pos_tim(uuid) from public,anon;
grant execute on function gabung_pos_tim(uuid) to authenticated;

create or replace function matur_internal.keluar_tim() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.pulang_at is not null and old.pulang_at is distinct from new.pulang_at then
  update pos_tim_anggota set keluar_at=new.pulang_at where absensi_id=new.id and keluar_at is null;
 end if;
 return new;
end $$;
revoke all on function matur_internal.keluar_tim() from public,anon,authenticated;
create trigger keluar_tim after update of pulang_at on absensi for each row execute function matur_internal.keluar_tim();

-- Tablet verification is independent of the personal attendance session of its original opener.
create or replace function public.status_pos_tim(p_outlet uuid,p_device text,p_token text,p_perbarui boolean default false) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare dev pos_perangkat;s sesi_kas;iz matur_internal.pos_izin;active_tim boolean;verifier boolean:=false;anggota jsonb;roster jsonb;cfg outlet;
begin
 if auth.uid() is null or not peran_di_outlet(p_outlet,'{kasir,barista,spv}') then raise exception 'Tidak diizinkan';end if;
 select * into cfg from outlet where id=p_outlet;
 select d.* into dev from pos_perangkat d join matur_internal.pos_perangkat_rahasia h on h.perangkat_id=d.id where d.outlet_id=p_outlet and h.hash=encode(digest(p_device,'sha256'),'hex');
 select * into s from sesi_kas where outlet_id=p_outlet and mode='asli' and ditutup_at is null order by dibuka_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nama',u.nama,'shift_id',j.shift_id,'tanggal',j.tanggal,'shift',sh.nama,'kasir',exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=p_outlet and t.peran in ('kasir','spv')))),'[]') into roster
 from absensi a join pengguna u on u.id=a.pengguna_id and u.status='aktif' join jadwal_shift j on j.id=a.jadwal_id and j.status='terbit' join shift_outlet sh on sh.id=j.shift_id
 where a.outlet_id=p_outlet and a.pulang_at is null and a.masuk_at>now()-interval '20 hours';
 select coalesce(jsonb_agg(jsonb_build_object('id',m.pengguna_id,'nama',m.nama,'gabung_at',m.gabung_at,'keluar_at',coalesce(m.keluar_at,a.pulang_at)) order by m.gabung_at),'[]') into anggota from pos_tim_anggota m join absensi a on a.id=m.absensi_id where m.sesi_id=s.id;
 active_tim:=exists(select 1 from pos_tim_anggota m join absensi a on a.id=m.absensi_id join pengguna u on u.id=m.pengguna_id and u.status='aktif' where m.sesi_id=s.id and m.keluar_at is null and a.pulang_at is null);
 if s.id is not null and dev.status='aktif' and s.perangkat_id=dev.id then
  select * into iz from matur_internal.pos_izin where sesi_id=s.id and perangkat_id=dev.id and ditarik_at is null and token_hash=encode(digest(p_token,'sha256'),'hex') order by mulai_at desc limit 1;
  verifier:=exists(select 1 from pengguna u join penugasan t on t.pengguna_id=u.id where u.id=iz.diverifikasi_oleh and u.status='aktif' and t.outlet_id=p_outlet and t.peran in ('kasir','spv'));
  if p_perbarui and iz.sampai_at>now() and iz.katalog is distinct from matur_internal.katalog_pos() then
   update matur_internal.pos_izin set sampai_at=now() where id=iz.id returning * into iz;
  elsif p_perbarui and verifier and iz.sampai_at>now() and active_tim and s.batas_at>now() then
   update matur_internal.pos_izin set sampai_at=least(s.batas_at,now()+make_interval(mins=>cfg.pos_offline_menit)) where id=iz.id returning * into iz;
  end if;
 end if;
 return jsonb_build_object('server_at',now(),'device',case when dev.id is null then null else jsonb_build_object('id',dev.id,'nama',dev.nama,'status',dev.status) end,
 'sesi',case when s.id is null then null else jsonb_build_object('id',s.id,'nama',s.nama_kasir,'pembuka_id',s.kasir_id,'modal',s.modal_laci,'buka_at',s.dibuka_at,'batas_at',s.batas_at,'shift_id',s.shift_id,'tanggal',s.tanggal_shift,'legacy',not s.pos_tim,'perangkat_sama',s.perangkat_id=dev.id,'anggota',anggota,'aktif_tim',active_tim) end,
 'izin',case when iz.id is null then null else jsonb_build_object('id',iz.id,'mulai_at',iz.mulai_at,'sampai_at',iz.sampai_at) end,
 'katalog',coalesce(iz.katalog,'{}'),'boleh',coalesce(verifier and dev.status='aktif' and s.pos_tim and s.perangkat_id=dev.id and active_tim and s.batas_at>now() and iz.sampai_at>now(),false),'roster',roster);
end $$;
revoke all on function status_pos_tim(uuid,text,text,boolean) from public,anon;
grant execute on function status_pos_tim(uuid,text,text,boolean) to authenticated;

create or replace function public.kunci_pos_tim(p_outlet uuid,p_device text,p_token text) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare dev uuid;
begin
 dev:=matur_internal.perangkat(p_outlet,p_device);if dev is null then raise exception 'Tablet tidak sah';end if;
 update matur_internal.pos_izin set ditarik_at=now() where perangkat_id=dev and token_hash=encode(digest(p_token,'sha256'),'hex') and ditarik_at is null;
end $$;
revoke all on function kunci_pos_tim(uuid,text,text) from public,anon;
grant execute on function kunci_pos_tim(uuid,text,text) to authenticated;

create or replace function public.perpanjang_pos_tim(p_sesi uuid,p_menit int,p_alasan text) returns void
language plpgsql security definer set search_path=public as $$
declare s sesi_kas;
begin
 select * into s from sesi_kas where id=p_sesi and pos_tim and ditutup_at is null for update;
 if auth.uid() is null or s.id is null or not(punya_peran('{owner}') or peran_di_outlet(s.outlet_id,'{spv}')) then raise exception 'Hanya SPV outlet atau Owner';end if;
 if p_menit is null or p_menit not between 1 and 180 or length(trim(coalesce(p_alasan,'')))<3 then raise exception 'Perpanjangan 1–180 menit dan alasan wajib';end if;
 if greatest(s.batas_at,now())+make_interval(mins=>p_menit)>s.dibuka_at+interval '20 hours' then raise exception 'Sesi maksimal 20 jam; serah terima ke tim berikutnya';end if;
 update sesi_kas set batas_at=greatest(batas_at,now())+make_interval(mins=>p_menit) where id=s.id;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'perpanjang_pos','sesi_kas',s.id::text,jsonb_build_object('menit',p_menit,'alasan',p_alasan));
end $$;
revoke all on function perpanjang_pos_tim(uuid,int,text) from public,anon;
grant execute on function perpanjang_pos_tim(uuid,int,text) to authenticated;

create or replace function public.atur_operasional_outlet(p_outlet uuid,p_awal int,p_offline int,p_lat double precision,p_lng double precision,p_radius int) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not punya_peran('{owner,hrd,admin_gudang}') then raise exception 'Hanya admin operasional';end if;
 if p_awal is null or p_awal not between 0 and 120 or p_offline is null or p_offline not between 1 and 120 or p_radius is null or p_radius not between 20 and 5000 or (p_lat is null)<>(p_lng is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then raise exception 'Pengaturan tidak valid';end if;
 update outlet set pos_awal_menit=p_awal,pos_offline_menit=p_offline,absen_lat=p_lat,absen_lng=p_lng,absen_radius_meter=p_radius where id=p_outlet and mode='asli' and deleted_at is null;
 if not found then raise exception 'Outlet tidak ditemukan';end if;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'atur_pos_gps','outlet',p_outlet::text,jsonb_build_object('awal',p_awal,'offline',p_offline,'lat',p_lat,'lng',p_lng,'radius',p_radius));
end $$;
revoke all on function atur_operasional_outlet(uuid,int,int,double precision,double precision,int) from public,anon;
grant execute on function atur_operasional_outlet(uuid,int,int,double precision,double precision,int) to authenticated;

-- Clock In/Out: photos and coordinates required; server time, overnight schedules and retry IDs.
alter table absensi add column masuk_catatan text;
alter table absensi add column pulang_catatan text;
alter table absensi add column masuk_lokasi_valid boolean;
alter table absensi add column pulang_lokasi_valid boolean;
create table matur_internal.absen_request (client_id uuid primary key,pengguna_id uuid not null,jenis text not null,hasil jsonb not null);
alter table matur_internal.absen_request enable row level security;
create index on matur_internal.absen_request(pengguna_id);
create or replace function public.absen_karyawan(p_outlet uuid,p_jenis text,p_foto text,p_lat double precision,p_lng double precision,p_akurasi real,p_catatan text,p_client uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();a absensi;j record;cfg outlet;awal timestamptz;akhir timestamptz;tel int:=0;st text:='tanpa_jadwal';tol int;idbaru uuid;hasil jsonb;dist double precision;lokvalid boolean:=false;
begin
 if uid is null or not peran_di_outlet(p_outlet,'{kasir,barista,spv}') then raise exception 'Anda tidak bertugas di outlet ini';end if;
 if p_client is null or p_jenis is null or p_jenis not in ('masuk','pulang') then raise exception 'Permintaan absensi tidak valid';end if;
 perform pg_advisory_xact_lock(hashtext('absen:'||uid));
 select r.hasil into hasil from matur_internal.absen_request r where r.client_id=p_client and r.pengguna_id=uid and r.jenis=p_jenis;
 if hasil is not null then return hasil;end if;
 if p_lat is null or p_lng is null or p_akurasi is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 or p_akurasi not between 0 and 200 then raise exception 'Lokasi wajib dan akurasi maksimal 200 m. Aktifkan GPS lalu coba lagi';end if;
 if p_foto is null or split_part(p_foto,'/',1)<>uid::text or not exists(select 1 from storage.objects where bucket_id='absensi' and name=p_foto and created_at>now()-interval '10 minutes') or exists(select 1 from absensi where masuk_foto=p_foto or pulang_foto=p_foto) then raise exception 'Ambil foto baru melalui kamera';end if;
 select * into cfg from outlet where id=p_outlet and mode='asli' and deleted_at is null;
 if cfg.id is null then raise exception 'Outlet tidak tersedia';end if;
 if cfg.absen_lat is not null and cfg.absen_lng is not null then
  dist:=6371000*2*asin(sqrt(least(1,power(sin(radians(p_lat-cfg.absen_lat)/2),2)+cos(radians(cfg.absen_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-cfg.absen_lng)/2),2))));
  if dist>cfg.absen_radius_meter+least(p_akurasi,50) then raise exception 'Lokasi di luar radius outlet. Hubungi HRD untuk pengecualian/koreksi';end if;lokvalid:=true;
 end if;
 select * into a from absensi where pengguna_id=uid and pulang_at is null and masuk_at>now()-interval '20 hours' order by masuk_at desc limit 1 for update;
 if p_jenis='masuk' then
  if a.id is not null then raise exception 'Anda sudah Clock In, lakukan Clock Out dahulu';end if;
  select js.*,sh.jam_mulai,sh.jam_selesai,sh.nama into j from jadwal_shift js join shift_outlet sh on sh.id=js.shift_id
  where js.pengguna_id=uid and js.outlet_id=p_outlet and js.status='terbit' and js.tanggal between (now() at time zone 'Asia/Jakarta')::date-1 and (now() at time zone 'Asia/Jakarta')::date
  and not exists(select 1 from absensi ab where ab.jadwal_id=js.id)
  and now()>=((js.tanggal+sh.jam_mulai) at time zone 'Asia/Jakarta')-interval '2 hours'
  and now()<=((js.tanggal+sh.jam_selesai+case when sh.jam_selesai<=sh.jam_mulai then interval '1 day' else interval '0' end) at time zone 'Asia/Jakarta')
  order by abs(extract(epoch from(now()-((js.tanggal+sh.jam_mulai) at time zone 'Asia/Jakarta')))) limit 1;
  if j.id is not null then
   awal:=(j.tanggal+j.jam_mulai) at time zone 'Asia/Jakarta';
   select coalesce(toleransi_telat_menit,5) into tol from perusahaan limit 1;
   tel:=greatest(ceil(extract(epoch from(now()-awal))/60)::int,0);if tel>coalesce(tol,5) then st:='telat';else st:='tepat';tel:=0;end if;
  end if;
  insert into absensi(outlet_id,pengguna_id,jadwal_id,tanggal,masuk_foto,masuk_lat,masuk_lng,masuk_akurasi,status,telat_menit,perangkat,masuk_catatan,masuk_lokasi_valid)
  values(p_outlet,uid,j.id,coalesce(j.tanggal,(now() at time zone 'Asia/Jakarta')::date),p_foto,p_lat,p_lng,p_akurasi,st,tel,'hp',nullif(left(trim(p_catatan),1000),''),lokvalid) returning id into idbaru;
  hasil:=jsonb_build_object('id',idbaru,'status',st,'telat_menit',tel,'shift',j.nama,'waktu',now(),'lokasi_valid',lokvalid);
 else
  if a.id is null or a.outlet_id<>p_outlet then raise exception 'Belum ada Clock In terbuka pada outlet ini';end if;
  update absensi set pulang_at=now(),pulang_foto=p_foto,pulang_lat=p_lat,pulang_lng=p_lng,pulang_akurasi=p_akurasi,pulang_catatan=nullif(left(trim(p_catatan),1000),''),pulang_lokasi_valid=lokvalid where id=a.id;
  hasil:=jsonb_build_object('id',a.id,'menit',floor(extract(epoch from(now()-a.masuk_at))/60),'waktu',now(),'lokasi_valid',lokvalid);
 end if;
 insert into matur_internal.absen_request values(p_client,uid,p_jenis,hasil);
 return hasil;
end $$;
revoke all on function absen_karyawan(uuid,text,text,double precision,double precision,real,text,uuid) from public,anon;
grant execute on function absen_karyawan(uuid,text,text,double precision,double precision,real,text,uuid) to authenticated;

create or replace function absen_masuk(p_outlet uuid,p_foto text,p_lat double precision,p_lng double precision,p_akurasi real,p_perangkat text) returns jsonb
language sql security definer set search_path=public as $$select absen_karyawan(p_outlet,'masuk',p_foto,p_lat,p_lng,p_akurasi,'',gen_random_uuid())$$;
create or replace function absen_pulang(p_foto text,p_lat double precision,p_lng double precision,p_akurasi real) returns jsonb
language plpgsql security definer set search_path=public as $$declare o uuid;begin
 select outlet_id into o from absensi where pengguna_id=auth.uid() and pulang_at is null order by masuk_at desc limit 1;
 return absen_karyawan(o,'pulang',p_foto,p_lat,p_lng,p_akurasi,'',gen_random_uuid());end$$;
revoke all on function absen_masuk(uuid,text,double precision,double precision,real,text),absen_pulang(text,double precision,double precision,real) from public,anon;
grant execute on function absen_masuk(uuid,text,double precision,double precision,real,text),absen_pulang(text,double precision,double precision,real) to authenticated;

-- Private tablet tokens must accompany every checkout, including raw REST RPC requests.
alter table transaksi add column pos_payload_hash text;
alter table transaksi add column sinkron_offline boolean not null default false;
alter table transaksi add column diterima_server_at timestamptz;
alter function public.buat_transaksi(jsonb) set schema matur_internal;
revoke all on function matur_internal.buat_transaksi(jsonb) from public,anon,authenticated;
do $$ declare d text;begin
 d:=pg_get_functiondef('matur_internal.buat_transaksi(jsonb)'::regprocedure);
 d:=replace(d,'and ditutup_at is null;', 'and (ditutup_at is null or ((p->>''sinkron_offline'')::boolean and rekap_status=''sementara''));');
 -- The validated shared device may remain logged in under any outlet staff account.
 d:=replace(d,'peran_di_outlet(v_outlet, ''{kasir,spv}'')','peran_di_outlet(v_outlet, ''{kasir,barista,spv}'')');
 d:=replace(d,'then m.harga_ojol else m.harga_langsung end','then coalesce((p#>>array[''_katalog'',''menu'',m.id::text,''ojol''])::bigint,m.harga_ojol) else coalesce((p#>>array[''_katalog'',''menu'',m.id::text,''langsung''])::bigint,m.harga_langsung) end');
 d:=replace(d,'sum(tambahan_harga) from varian','sum(coalesce((p#>>array[''_katalog'',''varian'',id::text])::bigint,tambahan_harga)) from varian');

 execute d;
end $$;
create or replace function public.buat_transaksi(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare o uuid:=(p->>'outlet_id')::uuid;sid uuid:=(p->>'sesi_id')::uuid;dev uuid;iz matur_internal.pos_izin;s sesi_kas;t transaksi;w timestamptz;h text;hasil jsonb;off boolean:=coalesce((p->>'sinkron_offline')::boolean,false);client uuid:=(p->>'client_id')::uuid;nomor_baru int;kr jsonb;cnt int;
begin
 p:=p-'_katalog';
 dev:=matur_internal.perangkat(o,p->>'device_token');if dev is null then raise exception 'POS hanya tersedia pada tablet outlet yang disetujui';end if;
 if client is null or sid is null then raise exception 'Identitas transaksi/sesi wajib';end if;
 perform pg_advisory_xact_lock(hashtext('transaksi:'||client));
 h:=encode(digest((p-array['device_token','pos_token','sinkron_offline'])::text,'sha256'),'hex');
 select * into t from transaksi where client_id=client;
 if t.id is not null then
  if t.outlet_id<>o or t.sesi_kas_id<>sid or t.pos_payload_hash is distinct from h then raise exception 'ID transaksi sudah dipakai untuk data lain';end if;
  return jsonb_build_object('id',t.id,'nomor',t.nomor,'subtotal',t.subtotal,'diskon',t.diskon,'total',t.total,'kembalian',0,'ulang',true);
 end if;
 select * into s from sesi_kas where id=sid and outlet_id=o and pos_tim and perangkat_id=dev for update;
 select * into iz from matur_internal.pos_izin where id=(p->>'izin_id')::uuid and sesi_id=sid and perangkat_id=dev;
 if s.id is null or iz.id is null then raise exception 'Sesi atau izin perangkat tidak valid';end if;
 if not exists(select 1 from pengguna u join penugasan tugas on tugas.pengguna_id=u.id where u.id=iz.diverifikasi_oleh and u.status='aktif' and tugas.outlet_id=o and tugas.peran in ('kasir','spv')) then raise exception 'Akses kasir pemberi izin dicabut; verifikasi ulang dengan petugas berwenang';end if;
 w:=(p->>'waktu_asli')::timestamptz;
 if w is null or w<iz.mulai_at-interval '5 seconds' or w>now()+interval '30 seconds' or w>iz.sampai_at or w>s.batas_at then raise exception 'Waktu transaksi di luar izin shift/offline';end if;
 if iz.ditarik_at is not null and w>iz.ditarik_at then raise exception 'POS dikunci pada waktu tersebut';end if;
 if not off then
  if s.ditutup_at is not null or iz.ditarik_at is not null or iz.sampai_at<now() or s.batas_at<now() or iz.token_hash<>encode(digest(p->>'pos_token','sha256'),'hex') then raise exception 'POS terkunci atau shift berakhir';end if;
  w:=now();
 else
  if s.ditutup_at is not null and (w>s.ditutup_at or not exists(select 1 from matur_internal.pos_pending where client_id=client and sesi_id=sid)) then raise exception 'Transaksi tidak termasuk antrean sesi yang ditutup';end if;
  if now()>iz.sampai_at+interval '24 hours' or (s.ditutup_at is not null and s.rekap_status<>'sementara') then raise exception 'Sinkronisasi lewat batas atau sesi sudah final; minta pemeriksaan SPV';end if;
  if p->>'metode'<>'tunai' or p ? 'pembayaran' and p->'pembayaran'<>'null'::jsonb or nullif(p->>'draft_id','') is not null or nullif(p->>'otorisasi','') is not null then raise exception 'Offline hanya transaksi tunai tanpa split/draft/persetujuan khusus';end if;
 end if;
 if not exists(select 1 from pos_tim_anggota m join absensi a on a.id=m.absensi_id join pengguna u on u.id=m.pengguna_id and u.status='aktif'
 where m.sesi_id=sid and m.gabung_at<=w and (m.keluar_at is null or m.keluar_at>w) and a.masuk_at<=w and (a.pulang_at is null or a.pulang_at>w)) then raise exception 'Tidak ada anggota tim yang masih bertugas';end if;
 if nullif(p->>'draft_id','') is not null and not exists(select 1 from pesanan_draft where id=(p->>'draft_id')::uuid and outlet_id=o and status='draft') then raise exception 'Draft bukan milik outlet atau sudah dibayar';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p->'items','[]')) z where iz.katalog#>array['menu',z->>'menu_id'] is null or (z->>'qty')::int<=0 or not exists(select 1 from menu m where m.id=(z->>'menu_id')::uuid and m.mode='asli' and m.deleted_at is null)) then raise exception 'Item/jumlah tidak valid';end if;
 if exists(select 1 from jsonb_array_elements(p->'items') z cross join jsonb_array_elements_text(coalesce(z->'varian_ids','[]')) vid where iz.katalog#>array['varian',vid] is null or not exists(select 1 from varian v where v.id=vid::uuid and v.menu_id=(z->>'menu_id')::uuid)) then raise exception 'Varian tidak sesuai menu/izin harga';end if;
 perform pg_advisory_xact_lock(hashtext('nomor-pos:'||o));
 if off and (iz.katalog->>'resep_hash') is distinct from (matur_internal.katalog_pos()->>'resep_hash') then raise exception 'Resep/HPP berubah sejak izin offline. Data tetap di tablet; minta pemeriksaan SPV';end if;
 hasil:=matur_internal.buat_transaksi(p||jsonb_build_object('_katalog',iz.katalog));
 select coalesce(max(nomor),0)+1 into nomor_baru from transaksi where outlet_id=o and id<>(hasil->>'id')::uuid and (created_at at time zone 'Asia/Jakarta')::date=(w at time zone 'Asia/Jakarta')::date;
 update transaksi set pos_payload_hash=h,sinkron_offline=off,diterima_server_at=now(),created_at=w,nomor=nomor_baru where id=(hasil->>'id')::uuid;
 hasil:=hasil||jsonb_build_object('nomor',nomor_baru);
 if off and s.ditutup_at is not null then
  delete from matur_internal.pos_pending where client_id=client and sesi_id=sid;
  select count(*) into cnt from matur_internal.pos_pending where sesi_id=sid;
  kr:=matur_internal.kas_ringkas(sid);
  update sesi_kas set pending_offline=cnt,kas_seharusnya=(kr->>'seharusnya')::bigint,seharusnya=(kr->>'seharusnya')::bigint-modal_laci,selisih=fisik_akhir-(kr->>'seharusnya')::bigint,rekap_status=case when cnt=0 then 'final' else 'sementara' end where id=sid;
 end if;
 return hasil;
end $$;
revoke all on function buat_transaksi(jsonb) from public,anon;
grant execute on function buat_transaksi(jsonb) to authenticated;

-- Disable bypasses that create unauthorised personal sessions.
create or replace function buka_sesi_kas(p_outlet uuid,p_modal bigint) returns uuid language plpgsql set search_path=public as $$begin raise exception 'Buka sesi tim dengan kode staf/PIN pada tablet yang disetujui';end$$;
create or replace function mulai_shift_pin(p_outlet uuid,p_uid uuid,p_rahasia text,p_modal bigint) returns uuid language plpgsql set search_path=public as $$begin raise exception 'Gunakan Buka POS tim';end$$;
revoke insert,update,delete on sesi_kas,transaksi,item_transaksi,pembayaran from authenticated,anon;

create or replace function public.ringkasan_tim_karyawan(p_outlet uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare jadwal jsonb;sesi jsonb;
begin
 if auth.uid() is null or not peran_di_outlet(p_outlet,'{kasir,barista,spv}') then raise exception 'Tidak diizinkan';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nama',u.nama,'shift',sh.nama,'mulai',sh.jam_mulai,'selesai',sh.jam_selesai,'hadir',a.id is not null,'pulang',a.pulang_at is not null) order by sh.jam_mulai,u.nama),'[]') into jadwal
 from jadwal_shift j join shift_outlet sh on sh.id=j.shift_id join pengguna u on u.id=j.pengguna_id
 left join absensi a on a.jadwal_id=j.id where j.outlet_id=p_outlet and j.status='terbit' and (j.tanggal=(now() at time zone 'Asia/Jakarta')::date or a.pulang_at is null and a.masuk_at>now()-interval '20 hours');
 select jsonb_build_object('id',s.id,'nama',s.nama_kasir,'pembuka',u.nama,'anggota',coalesce((select jsonb_agg(m.pengguna_id) from pos_tim_anggota m where m.sesi_id=s.id),'[]')) into sesi
 from sesi_kas s join pengguna u on u.id=s.kasir_id where s.outlet_id=p_outlet and s.mode='asli' and s.ditutup_at is null order by s.dibuka_at desc limit 1;
 return jsonb_build_object('jadwal',jadwal,'sesi',sesi);
end $$;
revoke all on function ringkasan_tim_karyawan(uuid) from public,anon;
grant execute on function ringkasan_tim_karyawan(uuid) to authenticated;

create table public.pos_kas_keluar (
 id uuid primary key default gen_random_uuid(),sesi_id uuid not null references sesi_kas,
 jumlah bigint not null check(jumlah>0),waktu timestamptz not null,penyetor_id uuid not null references pengguna,catatan text,
 created_at timestamptz not null default now()
);
create index on pos_kas_keluar(sesi_id);create index on pos_kas_keluar(penyetor_id);
alter table pos_kas_keluar enable row level security;
create policy baca on pos_kas_keluar for select to authenticated using(exists(select 1 from sesi_kas s where s.id=sesi_id and boleh_outlet(s.outlet_id)));
grant select on pos_kas_keluar to authenticated;
alter table setoran_omzet add column perpindahan_id uuid references pos_kas_keluar;
create unique index satu_pengajuan_perpindahan on setoran_omzet(perpindahan_id) where perpindahan_id is not null and status in ('menunggu','disetujui');
create index on setoran_omzet(perpindahan_id);

create or replace function matur_internal.kas_ringkas(p_sesi uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('modal',s.modal_laci,'tunai',coalesce(t.tunai,0),'non_tunai',coalesce(t.non_tunai,0),'transaksi',coalesce(t.jumlah,0),'laci',coalesce(b.jumlah,0),'keluar',coalesce(k.jumlah,0),
 'seharusnya',s.modal_laci+coalesce(t.tunai,0)-coalesce(b.jumlah,0)-coalesce(k.jumlah,0))
 from sesi_kas s
 left join lateral(select sum(p.nominal) filter(where p.metode='tunai') tunai,sum(p.nominal) filter(where p.metode<>'tunai') non_tunai,count(distinct t.id) jumlah from transaksi t join pembayaran p on p.transaksi_id=t.id where t.sesi_kas_id=s.id and t.status='lunas') t on true
 left join lateral(select sum(jumlah) jumlah from biaya_outlet where sesi_kas_id=s.id and sumber='laci' and deleted_at is null) b on true
 left join lateral(select sum(jumlah) jumlah from pos_kas_keluar where sesi_id=s.id) k on true where s.id=p_sesi and auth.uid() is not null
$$;
revoke all on function matur_internal.kas_ringkas(uuid) from public,anon,authenticated;

alter function public.buat_setoran(jsonb) set schema matur_internal;
revoke all on function matur_internal.buat_setoran(jsonb) from public,anon,authenticated;
create or replace function public.buat_setoran(p jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid:=(p->>'sesi_kas_id')::uuid;pengganti uuid:=(p->>'pengganti_id')::uuid;rid uuid;pid uuid;jml bigint;s sesi_kas;old setoran_omzet;kas jsonb;
begin
 if auth.uid() is null or not operasional_boleh((p->>'outlet_id')::uuid,'setoran') then raise exception 'Tidak diizinkan';end if;
 select id into rid from setoran_omzet where client_id=(p->>'client_id')::uuid and penyetor_id=auth.uid();if rid is not null then return rid;end if;
 select sum((z->>'jumlah')::bigint) into jml from jsonb_array_elements(p->'rincian') z;
 if sid is not null then
  perform pg_advisory_xact_lock(hashtext('pos-outlet:'||(p->>'outlet_id')));
  select * into s from sesi_kas where id=sid and outlet_id=(p->>'outlet_id')::uuid and ditutup_at is null and pos_tim for update;
  if s.id is null or (p->>'waktu')::timestamptz<s.dibuka_at then raise exception 'Sumber laci shift tidak valid';end if;
  if not exists(select 1 from pos_tim_anggota where sesi_id=sid and pengguna_id=auth.uid()) then raise exception 'Hanya anggota tim dapat menyerahkan dari laci shift ini';end if;
  kas:=matur_internal.kas_ringkas(sid);
  if jml>(kas->>'seharusnya')::bigint then raise exception 'Penyerahan melebihi uang laci tercatat. Sinkronkan transaksi dan periksa pengeluaran dahulu';end if;
 elsif pengganti is not null then
  select * into old from setoran_omzet where id=pengganti and outlet_id=(p->>'outlet_id')::uuid and status='ditolak' and perpindahan_id is not null for update;
  if old.id is null then raise exception 'Setoran pengganti tidak valid';end if;
  if (select jumlah from pos_kas_keluar where id=old.perpindahan_id)<>jml then raise exception 'Nominal pengganti harus sama dengan uang fisik yang sudah diserahkan';end if;
  pid:=old.perpindahan_id;
 end if;
 rid:=matur_internal.buat_setoran(p);
 if sid is not null then
  insert into pos_kas_keluar(sesi_id,jumlah,waktu,penyetor_id,catatan) values(sid,jml,(p->>'waktu')::timestamptz,auth.uid(),'Setoran '||rid) returning id into pid;
 end if;
 if pid is not null then update setoran_omzet set perpindahan_id=pid where id=rid;end if;
 return rid;
end $$;
revoke all on function buat_setoran(jsonb) from public,anon;
grant execute on function buat_setoran(jsonb) to authenticated;

create table matur_internal.pos_pending (client_id uuid primary key,sesi_id uuid not null references sesi_kas,created_at timestamptz not null default now());
create index on matur_internal.pos_pending(sesi_id);alter table matur_internal.pos_pending enable row level security;
create or replace function public.tutup_pos_tim(p_sesi uuid,p_device text,p_kode text,p_pin text,p_aktual bigint,p_catatan text,p_pending uuid[]) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s sesi_kas;dev uuid;uid uuid;h jsonb;n int;
begin
 select * into s from sesi_kas where id=p_sesi for update;
 if s.id is null or s.ditutup_at is not null or not s.pos_tim then raise exception 'Sesi tidak tersedia';end if;
 dev:=matur_internal.perangkat(s.outlet_id,p_device);if dev is distinct from s.perangkat_id then raise exception 'Gunakan tablet sesi ini';end if;
 select pengguna_id into uid from matur_internal.pos_pin where kode=lower(trim(p_kode));
 if not matur_internal.cek_pin_tim(uid,p_pin,dev) then return jsonb_build_object('error','Kode/PIN salah atau dibatasi 15 menit');end if;
 if not exists(select 1 from pos_tim_anggota where sesi_id=s.id and pengguna_id=uid) and not exists(select 1 from penugasan where pengguna_id=uid and outlet_id=s.outlet_id and peran='spv') then raise exception 'Hanya anggota tim/SPV yang boleh menutup';end if;
 if p_aktual is null or p_aktual<0 then raise exception 'Isi uang fisik termasuk modal yang tersisa';end if;
 if exists(select 1 from pesanan_draft where outlet_id=s.outlet_id and status='draft') then raise exception 'Selesaikan atau batalkan pesanan draft dahulu';end if;
 h:=matur_internal.kas_ringkas(s.id);n:=coalesce(cardinality(p_pending),0);
 if n>1000 or n<>(select count(distinct x) from unnest(p_pending) x) then raise exception 'Daftar transaksi tertunda tidak valid';end if;
 if (p_aktual<>(h->>'seharusnya')::bigint or n>0) and length(trim(coalesce(p_catatan,'')))<3 then raise exception 'Catatan wajib untuk selisih atau sinkronisasi tertunda';end if;
 insert into matur_internal.pos_pending(client_id,sesi_id) select x,s.id from unnest(p_pending) x where not exists(select 1 from transaksi where client_id=x);
 select count(*) into n from matur_internal.pos_pending where sesi_id=s.id;
 update sesi_kas set ditutup_at=now(),ditutup_oleh=uid,fisik_akhir=p_aktual,kas_seharusnya=(h->>'seharusnya')::bigint,setoran=p_aktual-s.modal_laci,seharusnya=(h->>'seharusnya')::bigint-s.modal_laci,selisih=p_aktual-(h->>'seharusnya')::bigint,catatan_tutup=left(p_catatan,1000),pending_offline=n,rekap_status=case when n>0 then 'sementara' else 'final' end where id=s.id;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(uid,'tutup_pos_tim','sesi_kas',s.id::text,h||jsonb_build_object('aktual',p_aktual,'catatan',p_catatan,'pending',n));
 return h||jsonb_build_object('aktual',p_aktual,'selisih',p_aktual-(h->>'seharusnya')::bigint,'pending',n);
end $$;
revoke all on function tutup_pos_tim(uuid,text,text,text,bigint,text,uuid[]) from public,anon;
grant execute on function tutup_pos_tim(uuid,text,text,text,bigint,text,uuid[]) to authenticated;

create or replace function public.ringkasan_kas_tim(p_sesi uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare s sesi_kas;
begin
 select * into s from sesi_kas where id=p_sesi;
 if auth.uid() is null or not boleh_outlet(s.outlet_id) then raise exception 'Tidak diizinkan';end if;
 return matur_internal.kas_ringkas(p_sesi)||jsonb_build_object('id',s.id,'nama',s.nama_kasir,'batas_at',s.batas_at,'dibuka_at',s.dibuka_at,'ditutup_at',s.ditutup_at,'rekap_status',s.rekap_status,'pending',s.pending_offline,'aktual',coalesce(s.fisik_akhir,s.setoran+s.modal_laci),'selisih',s.selisih,'catatan',s.catatan_tutup);
end $$;
revoke all on function ringkasan_kas_tim(uuid) from public,anon;
grant execute on function ringkasan_kas_tim(uuid) to authenticated;

create or replace function public.tutup_shift_pin(p_sesi uuid,p_rahasia text,p_aktual bigint) returns jsonb language plpgsql set search_path=public as $$begin raise exception 'Gunakan penutupan kas tim pada tablet yang disetujui';end$$;
create or replace function public.tutup_sesi_kas(p_sesi uuid,p_aktual bigint) returns jsonb language plpgsql set search_path=public as $$begin raise exception 'Gunakan penutupan kas tim';end$$;

create or replace function matur_internal.jaga_biaya_tutup() returns trigger
language plpgsql security definer set search_path=public as $$
declare sid uuid;s sesi_kas;
begin
 if tg_op='UPDATE' and old.sesi_kas_id is not null then
  select * into s from sesi_kas where id=old.sesi_kas_id for update;
  if s.pos_tim and s.ditutup_at is not null then raise exception 'Pengeluaran sesi kas final tidak dapat diubah';end if;
 end if;
 sid:=case when tg_op='DELETE' then old.sesi_kas_id else new.sesi_kas_id end;
 if sid is null then return case when tg_op='DELETE' then old else new end;end if;
 select * into s from sesi_kas where id=sid for update;
 if tg_op<>'DELETE' and (s.outlet_id is distinct from new.outlet_id or s.mode is distinct from new.mode) then raise exception 'Sesi pengeluaran tidak sesuai outlet';end if;
 if s.pos_tim and s.ditutup_at is not null then raise exception 'Pengeluaran sesi kas final tidak dapat diubah; minta pemeriksaan Akunting';end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function matur_internal.jaga_biaya_tutup() from public,anon,authenticated;
create trigger zz_jaga_biaya_tutup before insert or update or delete on biaya_outlet for each row execute function matur_internal.jaga_biaya_tutup();

-- Restricted administration data; PIN values are fetched only after an explicit audited reveal.
create or replace function public.panel_pos_admin() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare pusat boolean;semua boolean;staf jsonb;devices jsonb;outlets jsonb;sessions jsonb;
begin
 pusat:=punya_peran('{owner,hrd,admin_gudang}');semua:=pusat or punya_peran('{finance}');
 if auth.uid() is null or not(semua or punya_peran('{spv}')) then raise exception 'Tidak diizinkan';end if;
 if pusat then
  select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nama',u.nama,'email',u.email,'status',u.status,'kode',p.kode,'ada_pin',p.pin_hash is not null,'tugas',(select jsonb_agg(jsonb_build_object('outlet_id',t.outlet_id,'peran',t.peran)) from penugasan t where t.pengguna_id=u.id and t.peran in ('kasir','barista','spv'))) order by u.nama),'[]') into staf
  from pengguna u left join matur_internal.pos_pin p on p.pengguna_id=u.id where u.status<>'dihapus' and exists(select 1 from penugasan t where t.pengguna_id=u.id and t.peran in ('kasir','barista','spv'));
 end if;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc),'[]') into devices from pos_perangkat d where pusat or peran_di_outlet(d.outlet_id,'{spv}');
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nama',o.nama,'awal',o.pos_awal_menit,'offline',o.pos_offline_menit,'lat',o.absen_lat,'lng',o.absen_lng,'radius',o.absen_radius_meter) order by o.nama),'[]') into outlets from outlet o where mode='asli' and deleted_at is null and (semua or peran_di_outlet(o.id,'{spv}'));
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'outlet_id',s.outlet_id,'nama',s.nama_kasir,'buka_at',s.dibuka_at,'batas_at',s.batas_at,'legacy',not s.pos_tim,'ditutup_at',s.ditutup_at,'status',s.rekap_status,'pending',s.pending_offline,'aktual',case when punya_peran('{owner,finance}') or peran_di_outlet(s.outlet_id,'{spv}') then coalesce(s.fisik_akhir,s.setoran+s.modal_laci) end,'selisih',case when punya_peran('{owner,finance}') or peran_di_outlet(s.outlet_id,'{spv}') then s.selisih end,'anggota',(select coalesce(jsonb_agg(jsonb_build_object('nama',m.nama,'gabung_at',m.gabung_at,'keluar_at',m.keluar_at)),'[]') from pos_tim_anggota m where m.sesi_id=s.id)) order by s.dibuka_at desc),'[]') into sessions from (select * from sesi_kas where mode='asli' and (ditutup_at is null or rekap_status='sementara' or dibuka_at>now()-interval '7 days') order by dibuka_at desc limit 100) s where semua or peran_di_outlet(s.outlet_id,'{spv}');
 return jsonb_build_object('pusat',pusat,'staf',coalesce(staf,'[]'),'devices',devices,'outlets',outlets,'sessions',sessions);
end $$;
revoke all on function panel_pos_admin() from public,anon;
grant execute on function panel_pos_admin() to authenticated;

-- Add/withdraw cashier permission without creating another staff identity or elevating central roles.
create or replace function public.akses_pos_staf(p_uid uuid,p_outlet uuid,p_boleh boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not punya_peran('{owner,hrd,admin_gudang}') then raise exception 'Hanya admin staf';end if;
 if not exists(select 1 from penugasan where pengguna_id=p_uid and outlet_id=p_outlet and peran in ('kasir','barista','spv')) then raise exception 'Staf tidak terdaftar di outlet';end if;
 if p_boleh then insert into penugasan(pengguna_id,outlet_id,peran) values(p_uid,p_outlet,'kasir') on conflict do nothing;
 else
  if not exists(select 1 from penugasan where pengguna_id=p_uid and outlet_id=p_outlet and peran in ('barista','spv')) then insert into penugasan(pengguna_id,outlet_id,peran) values(p_uid,p_outlet,'barista');end if;
  delete from penugasan where pengguna_id=p_uid and outlet_id=p_outlet and peran='kasir';
 end if;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'akses_pos_staf','pengguna',p_uid::text,jsonb_build_object('outlet',p_outlet,'boleh',p_boleh));
end $$;
revoke all on function akses_pos_staf(uuid,uuid,boolean) from public,anon;
grant execute on function akses_pos_staf(uuid,uuid,boolean) to authenticated;

-- Admin can give an existing PIN-only employee an email login; no new identity/history is created.
create or replace function public.email_login_staf(p_uid uuid,p_email text,p_password text) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare emailbaru text:=lower(trim(p_email));
begin
 if auth.uid() is null or not punya_peran('{owner,hrd,admin_gudang}') then raise exception 'Hanya admin staf';end if;
 if not exists(select 1 from pengguna where id=p_uid and email like '%@pin.matur.id') or not exists(select 1 from penugasan where pengguna_id=p_uid and peran in ('kasir','barista','spv')) then raise exception 'Hanya migrasi akun kode staf lama';end if;
 if emailbaru is null or emailbaru !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or emailbaru like '%@pin.matur.id' or length(coalesce(p_password,''))<8 then raise exception 'Email pribadi dan password minimal 8 karakter wajib';end if;
 if exists(select 1 from auth.users where lower(email)=emailbaru and id<>p_uid) then raise exception 'Email sudah digunakan. Hubungi Owner untuk pemeriksaan akun ganda';end if;
 update auth.users set email=emailbaru,encrypted_password=crypt(p_password,gen_salt('bf')),email_confirmed_at=now(),email_change='',email_change_token_new='',updated_at=now() where id=p_uid;
 update auth.identities set identity_data=identity_data||jsonb_build_object('email',emailbaru),updated_at=now() where user_id=p_uid and provider='email';
 update pengguna set email=emailbaru where id=p_uid;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'email_login_staf','pengguna',p_uid::text,jsonb_build_object('email',emailbaru));
end $$;
revoke all on function email_login_staf(uuid,text,text) from public,anon;
grant execute on function email_login_staf(uuid,text,text) to authenticated;

create or replace function public.otorisasi_pin_pos(p_outlet uuid,p_device text,p_kode text,p_pin text,p_aksi text,p_nilai int,p_transaksi uuid,p_alasan text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare dev uuid;uid uuid;nm text;oid uuid;t transaksi;r record;
begin
 dev:=matur_internal.perangkat(p_outlet,p_device);if dev is null then raise exception 'Gunakan tablet outlet yang disetujui';end if;
 select p.pengguna_id,u.nama into uid,nm from matur_internal.pos_pin p join pengguna u on u.id=p.pengguna_id and u.status='aktif' where p.kode=lower(trim(p_kode));
 if not matur_internal.cek_pin_tim(uid,p_pin,dev) then return jsonb_build_object('error','Kode/PIN salah atau dibatasi 15 menit');end if;
 if not exists(select 1 from penugasan where pengguna_id=uid and outlet_id=p_outlet and peran='spv') then raise exception 'Hanya PIN SPV outlet ini';end if;
 if p_aksi='diskon' then
  if p_nilai is null or p_nilai not between 0 and 100 then raise exception 'Persen tidak valid';end if;
  insert into otorisasi(outlet_id,jenis,nilai,oleh) values(p_outlet,'diskon',p_nilai,uid) returning id into oid;
  return jsonb_build_object('otorisasi',oid,'nama',nm);
 elsif p_aksi='void' then
  if length(trim(coalesce(p_alasan,'')))<3 then raise exception 'Alasan void wajib';end if;
  select * into t from transaksi where id=p_transaksi and outlet_id=p_outlet and status='lunas' for update;
  if t.id is null or not exists(select 1 from sesi_kas where id=t.sesi_kas_id and ditutup_at is null) then raise exception 'Transaksi tidak tersedia atau sesi ditutup';end if;
  update transaksi set status='void',void_oleh=uid,void_alasan=p_alasan,void_at=now() where id=t.id;
  for r in select bahan_id,sum(jumlah) jml from mutasi_stok where ref_id=t.id and jenis='pemakaian' group by bahan_id loop
   perform geser_stok(t.mode,t.outlet_id,r.bahan_id,-r.jml,'void',t.id,'Void oleh SPV '||nm);
  end loop;
  insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(uid,'void_pos','transaksi',t.id::text,jsonb_build_object('alasan',p_alasan));
  return jsonb_build_object('ok','Transaksi dibatalkan, stok dikembalikan');
 else raise exception 'Tindakan tidak valid';end if;
end $$;
revoke all on function otorisasi_pin_pos(uuid,text,text,text,text,int,uuid,text) from public,anon;
grant execute on function otorisasi_pin_pos(uuid,text,text,text,text,int,uuid,text) to authenticated;

-- Old sessions retain their records and may be closed explicitly by the outlet SPV/Owner.
create or replace function public.tutup_pos_lama(p_sesi uuid,p_aktual bigint,p_alasan text) returns void
language plpgsql security definer set search_path=public as $$
declare s sesi_kas;h jsonb;
begin
 select * into s from sesi_kas where id=p_sesi and not pos_tim and ditutup_at is null for update;
 if auth.uid() is null or s.id is null or not(punya_peran('{owner}') or peran_di_outlet(s.outlet_id,'{spv}')) then raise exception 'Hanya SPV outlet/Owner';end if;
 if p_aktual is null or p_aktual<0 or length(trim(coalesce(p_alasan,'')))<3 then raise exception 'Uang fisik dan alasan wajib';end if;
 h:=matur_internal.kas_ringkas(s.id);
 update sesi_kas set ditutup_at=now(),ditutup_oleh=auth.uid(),fisik_akhir=p_aktual,kas_seharusnya=(h->>'seharusnya')::bigint,setoran=p_aktual-s.modal_laci,seharusnya=(h->>'seharusnya')::bigint-s.modal_laci,selisih=p_aktual-(h->>'seharusnya')::bigint,catatan_tutup=p_alasan where id=s.id;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'tutup_pos_lama','sesi_kas',s.id::text,h||jsonb_build_object('aktual',p_aktual,'alasan',p_alasan));
end $$;
revoke all on function tutup_pos_lama(uuid,bigint,text) from public,anon;
grant execute on function tutup_pos_lama(uuid,bigint,text) to authenticated;

do $$ declare d text;begin
 d:=pg_get_functiondef('public.info_akun_karyawan()'::regprocedure);
 d:=replace(d,'u.pin_hash is not null','(u.pin_hash is not null or exists(select 1 from matur_internal.pos_pin p where p.pengguna_id=u.id and p.pin_hash is not null))');
 execute d;
end $$;

alter table pesanan_draft add column sesi_kas_id uuid references sesi_kas;
create index on pesanan_draft(sesi_kas_id);
alter function public.batal_draft(uuid,text) set schema matur_internal;
revoke all on function matur_internal.batal_draft(uuid,text) from public,anon,authenticated;
create or replace function public.draft_pos_tim(p jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare st jsonb;sid uuid:=(p->>'sesi_id')::uuid;idbaru uuid;v pesanan_draft;
begin
 st:=status_pos_tim((p->>'outlet_id')::uuid,p->>'device_token',p->>'pos_token',false);
 if not coalesce((st->>'boleh')::boolean,false) or st#>>'{sesi,id}' is distinct from sid::text then raise exception 'POS terkunci atau sesi shift berakhir';end if;
 if p->>'aksi'='batal' then
  if not exists(select 1 from pesanan_draft where id=(p->>'id')::uuid and outlet_id=(p->>'outlet_id')::uuid and status='draft') then raise exception 'Draft tidak tersedia';end if;
  perform matur_internal.batal_draft((p->>'id')::uuid,p->>'alasan');return (p->>'id')::uuid;
 end if;
 if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 100 or coalesce((p->>'total')::bigint,-1)<0 then raise exception 'Draft tidak valid';end if;
 if nullif(p->>'id','') is not null then
  select * into v from pesanan_draft where id=(p->>'id')::uuid and outlet_id=(p->>'outlet_id')::uuid and status='draft' for update;
  if v.id is null then raise exception 'Draft sudah dibayar/dibatalkan';end if;
  update pesanan_draft set label=left(p->>'label',60),kanal=(p->>'kanal')::kanal_jual,tipe=p->>'tipe',pelanggan=left(p->>'pelanggan',100),meja=left(p->>'meja',50),diskon=greatest((p->>'diskon')::bigint,0),items=p->'items',total=(p->>'total')::bigint,updated_at=now(),diubah_oleh=auth.uid(),sesi_kas_id=sid where id=v.id returning id into idbaru;
 else
  insert into pesanan_draft(outlet_id,label,kanal,tipe,pelanggan,meja,diskon,items,total,sesi_kas_id)
  values((p->>'outlet_id')::uuid,left(p->>'label',60),(p->>'kanal')::kanal_jual,p->>'tipe',left(p->>'pelanggan',100),left(p->>'meja',50),greatest((p->>'diskon')::bigint,0),p->'items',(p->>'total')::bigint,sid) returning id into idbaru;
 end if;
 return idbaru;
end $$;
revoke all on function draft_pos_tim(jsonb) from public,anon;
grant execute on function draft_pos_tim(jsonb) to authenticated;
revoke insert,update,delete on pesanan_draft,absensi from authenticated,anon;

-- Submitted attendance evidence cannot be removed through the Storage API.
create or replace function matur_internal.jaga_foto_absensi() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if old.bucket_id='absensi' and exists(select 1 from absensi where masuk_foto=old.name or pulang_foto=old.name) then raise exception 'Foto absensi yang sudah tercatat tidak dapat dihapus';end if;
 return old;
end $$;
revoke all on function matur_internal.jaga_foto_absensi() from public,anon,authenticated;
create trigger jaga_foto_absensi before delete on storage.objects for each row execute function matur_internal.jaga_foto_absensi();
