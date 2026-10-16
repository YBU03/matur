-- Same cash session, explicit device handover, bounded offline leases, and human login attribution.
alter table public.pos_perangkat add column login_pengguna_id uuid references public.pengguna;
alter table public.pos_perangkat add column login_at timestamptz;
alter table public.pos_perangkat add column terlihat_at timestamptz;
alter table public.pos_perangkat add column antrean_jumlah int;
alter table public.pos_perangkat add column antrean_at timestamptz;
alter table public.pos_perangkat add column info_perangkat text;
create index on public.pos_perangkat(login_pengguna_id);
create table matur_internal.pos_pindah (
 id uuid primary key default gen_random_uuid(),sesi_id uuid not null references public.sesi_kas,
 asal_id uuid not null references public.pos_perangkat,tujuan_id uuid not null references public.pos_perangkat,
 admin_id uuid not null references public.pengguna,alasan text not null,
 diminta_at timestamptz not null default now(),aman_at timestamptz not null,
 bersih_at timestamptz,selesai_at timestamptz,batal_at timestamptz,risiko_diakui boolean not null default false,
 check(asal_id<>tujuan_id)
);
alter table matur_internal.pos_pindah enable row level security;
create unique index on matur_internal.pos_pindah(sesi_id) where selesai_at is null and batal_at is null;
create index on matur_internal.pos_pindah(asal_id);create index on matur_internal.pos_pindah(tujuan_id);create index on matur_internal.pos_pindah(admin_id);
revoke all on matur_internal.pos_pindah from public,anon,authenticated;

-- Preserve existing tablet/PIN authentication. Record the actual staff identity, never its PIN/password.
do $$ declare d text;begin
 d:=pg_get_functiondef('public.masuk_pos_tablet(text,text,uuid,text,text)'::regprocedure);
 if position('return jsonb_build_object(''email'', v_email' in d)=0 then raise exception 'Struktur masuk POS berubah';end if;
 d:=replace(d,'if dev.outlet_id <> o then','if dev.outlet_id <> o then
      if exists(select 1 from sesi_kas where perangkat_id=dev.id and ditutup_at is null and mode=''asli'') then return jsonb_build_object(''error'',''Tablet masih memiliki sesi kas terbuka. Hubungi admin untuk pindah perangkat.'');end if;');
 d:=replace(d,'return jsonb_build_object(''email'', v_email',
 'update pos_perangkat set login_pengguna_id=uid,login_at=now() where id=dev.id;
  return jsonb_build_object(''email'', v_email');execute d;
 -- Existing registration/admin operations now include Admin Pusat; PIN administration stays unchanged.
 foreach d in array array['atur_tablet_pos(uuid,boolean,text)','minta_tablet_pos(uuid,text,text)','pasang_tablet_pos(uuid,text,text,text,text)','outlet_pasang_tablet()'] loop
  execute replace(pg_get_functiondef(('public.'||d)::regprocedure),'''{owner,hrd,admin_gudang}''','''{owner,hrd,admin_gudang,admin_pusat}''');
 end loop;
end $$;

create or replace function public.minta_pindah_pos(p_sesi uuid,p_rahasia text,p_nama text,p_info text,p_alasan text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare s sesi_kas;target pos_perangkat;rid uuid;batas timestamptz;
begin
 if auth.uid() is null or not punya_peran('{owner,hrd,admin_pusat,admin_gudang}') then raise exception 'Hanya admin perangkat';end if;
 if length(trim(coalesce(p_alasan,'')))<5 or length(trim(coalesce(p_nama,'')))<3 or length(coalesce(p_rahasia,''))<40 then raise exception 'Isi nama perangkat dan alasan minimal 5 karakter';end if;
 select * into s from sesi_kas where id=p_sesi and ditutup_at is null for update;
 if s.id is null or not s.pos_tim then raise exception 'Pindah hanya untuk sesi POS tim yang masih terbuka. Sesi lama perlu pemeriksaan Owner/SPV';end if;
 select * into target from pos_perangkat where id=(select perangkat_id from matur_internal.pos_perangkat_rahasia where hash=encode(digest(p_rahasia,'sha256'),'hex'));
 if target.id is not null and target.outlet_id<>s.outlet_id then raise exception 'Perangkat ini terdaftar pada outlet lain';end if;
 if target.id is null then
  rid:=minta_tablet_pos(s.outlet_id,p_nama,p_rahasia);select * into target from pos_perangkat where id=rid;
 end if;
 if target.id=s.perangkat_id then raise exception 'Sesi sudah berada di perangkat ini';end if;
 select id into rid from matur_internal.pos_pindah where sesi_id=s.id and selesai_at is null and batal_at is null;
 if rid is not null then
  if exists(select 1 from matur_internal.pos_pindah where id=rid and tujuan_id=target.id) then return jsonb_build_object('id',rid,'ulang',true);end if;
  raise exception 'Sudah ada permintaan pindah yang belum selesai';
 end if;
 select greatest(now(),coalesce(max(sampai_at),now())) into batas from matur_internal.pos_izin where sesi_id=s.id and perangkat_id=s.perangkat_id;
 insert into matur_internal.pos_pindah(sesi_id,asal_id,tujuan_id,admin_id,alasan,aman_at) values(s.id,s.perangkat_id,target.id,auth.uid(),left(trim(p_alasan),1000),batas) returning id into rid;
 -- Existing leases retain their offline deadline. Online sales/unlocks freeze immediately.
 update matur_internal.pos_izin set ditarik_at=coalesce(ditarik_at,now()) where sesi_id=s.id and perangkat_id=s.perangkat_id;
 update pos_perangkat set nama=left(trim(p_nama),100),info_perangkat=left(p_info,300),diubah_at=now() where id=target.id;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'minta_pindah_pos','sesi_kas',s.id::text,jsonb_build_object('permintaan',rid,'asal',s.perangkat_id,'tujuan',target.id,'alasan',p_alasan,'aman_at',batas));
 return jsonb_build_object('id',rid,'aman_at',batas);
end $$;
revoke all on function minta_pindah_pos(uuid,text,text,text,text) from public,anon;grant execute on function minta_pindah_pos(uuid,text,text,text,text) to authenticated;

create or replace function public.selesaikan_pindah_pos(p_id uuid,p_rahasia text,p_akui boolean) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare r matur_internal.pos_pindah;s sesi_kas;tid uuid;
begin
 if auth.uid() is null or not punya_peran('{owner,hrd,admin_pusat,admin_gudang}') then raise exception 'Hanya admin perangkat';end if;
 -- All handover and checkout paths lock the cash session before the handover record.
 select sesi_id into tid from matur_internal.pos_pindah where id=p_id;
 select * into s from sesi_kas where id=tid for update;
 select * into r from matur_internal.pos_pindah where id=p_id for update;
 if r.id is null or s.id is null then raise exception 'Permintaan tidak tersedia';end if;
 if not exists(select 1 from matur_internal.pos_perangkat_rahasia where perangkat_id=r.tujuan_id and hash=encode(digest(p_rahasia,'sha256'),'hex')) then raise exception 'Selesaikan dari perangkat tujuan yang sama';end if;
 if r.batal_at is not null then raise exception 'Permintaan sudah dibatalkan';end if;
 if r.selesai_at is not null then return;end if;
 if s.ditutup_at is not null or s.perangkat_id<>r.asal_id then raise exception 'Sesi berubah atau sudah ditutup';end if;
 if r.bersih_at is null and now()<r.aman_at then raise exception 'Tunggu perangkat lama mengunci dan menyinkronkan antrean, atau tunggu izin offline berakhir';end if;
 if r.bersih_at is null and not coalesce(p_akui,false) then raise exception 'Konfirmasi pemeriksaan antrean lama yang belum diketahui';end if;
 update sesi_kas set perangkat_id=r.tujuan_id where id=s.id;
 update pos_perangkat set status='dicabut',diubah_at=now() where id=r.asal_id;
 -- Keep the old tablet identity able to upload historical evidence; it cannot unlock or make new sales.
 update pos_perangkat set status='aktif',disetujui_oleh=auth.uid(),diubah_at=now() where id=r.tujuan_id;
 if exists(select 1 from pos_perangkat where id=r.tujuan_id and akun_id is not null) then
  update pengguna set status='aktif' where id=(select akun_id from pos_perangkat where id=r.tujuan_id) and akun_tablet;
 end if;
 update matur_internal.pos_pindah set selesai_at=now(),risiko_diakui=r.bersih_at is null where id=r.id;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'pindah_pos','sesi_kas',s.id::text,jsonb_build_object('asal',r.asal_id,'tujuan',r.tujuan_id,'permintaan',r.id,'alasan',r.alasan,'antrean_belum_diketahui',r.bersih_at is null));
end $$;
revoke all on function selesaikan_pindah_pos(uuid,text,boolean) from public,anon;grant execute on function selesaikan_pindah_pos(uuid,text,boolean) to authenticated;

create or replace function public.lapor_perangkat_pos(p_rahasia text,p_ids uuid[],p_beku boolean,p_info text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare d pos_perangkat;r matur_internal.pos_pindah;
begin
 select a.* into d from pos_perangkat a join matur_internal.pos_perangkat_rahasia b on b.perangkat_id=a.id where b.hash=encode(digest(p_rahasia,'sha256'),'hex');
 if auth.uid() is null or d.id is null or not peran_di_outlet(d.outlet_id,'{kasir,barista,spv}') or (d.akun_id is not null and d.akun_id<>auth.uid()) then raise exception 'Perangkat tidak sesuai sesi akun';end if;
 if p_ids is null or cardinality(p_ids)>1000 then raise exception 'Antrean tidak valid';end if;
 update pos_perangkat set terlihat_at=now(),antrean_jumlah=cardinality(p_ids),antrean_at=now(),info_perangkat=left(p_info,300) where id=d.id;
 select * into r from matur_internal.pos_pindah where asal_id=d.id and batal_at is null order by diminta_at desc limit 1;
 if r.id is not null and r.selesai_at is null and p_beku and cardinality(p_ids)=0 then
  update matur_internal.pos_pindah set bersih_at=coalesce(bersih_at,now()) where id=r.id;
 end if;
 return jsonb_build_object('beku',r.id is not null and (r.selesai_at is null or exists(select 1 from sesi_kas where id=r.sesi_id and ditutup_at is null and perangkat_id<>d.id)),'pindah_id',r.id);
end $$;
revoke all on function lapor_perangkat_pos(text,uuid[],boolean,text) from public,anon;grant execute on function lapor_perangkat_pos(text,uuid[],boolean,text) to authenticated;

-- The source cannot unlock again after an administrator starts handover.
alter function public.buka_pos_tim(uuid,text,text,text,bigint,uuid[],text) set schema matur_internal;
revoke all on function matur_internal.buka_pos_tim(uuid,text,text,text,bigint,uuid[],text) from public,anon,authenticated;
create function public.buka_pos_tim(p_outlet uuid,p_device text,p_kode text,p_pin text,p_modal bigint,p_anggota uuid[],p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare sid uuid;dev uuid;begin
 dev:=matur_internal.perangkat(p_outlet,p_device);
 select id into sid from sesi_kas where outlet_id=p_outlet and mode='asli' and ditutup_at is null for update;
 if exists(select 1 from matur_internal.pos_pindah where sesi_id=sid and asal_id=dev and selesai_at is null and batal_at is null) then raise exception 'Sesi sedang dipindahkan admin. Tunggu proses pindah selesai';end if;
 return matur_internal.buka_pos_tim(p_outlet,p_device,p_kode,p_pin,p_modal,p_anggota,p_token);
end $$;
revoke all on function buka_pos_tim(uuid,text,text,text,bigint,uuid[],text) from public,anon;grant execute on function buka_pos_tim(uuid,text,text,text,bigint,uuid[],text) to authenticated;

-- Historic offline sales must still sync from the original device after handover, within their original lease.
do $$ declare d text;begin
 d:=pg_get_functiondef('public.buat_transaksi(jsonb)'::regprocedure);
 if position('dev:=matur_internal.perangkat(o,p->>''device_token'');if dev is null' in d)=0 then raise exception 'Struktur checkout berubah';end if;
 d:=replace(d,'dev:=matur_internal.perangkat(o,p->>''device_token'');if dev is null',
 'dev:=matur_internal.perangkat(o,p->>''device_token'');
 if dev is null and off and auth.uid() is not null then
  select pd.id into dev from pos_perangkat pd join matur_internal.pos_perangkat_rahasia pr on pr.perangkat_id=pd.id
  where pr.hash=encode(digest(p->>''device_token'',''sha256''),''hex'') and pd.outlet_id=o
   and peran_di_outlet(o,''{kasir,barista,spv}'') and (pd.akun_id is null or pd.akun_id=auth.uid())
   and exists(select 1 from matur_internal.pos_pindah ph where ph.sesi_id=sid and ph.asal_id=pd.id and ph.selesai_at is not null);
 end if;
 if dev is null');
 d:=replace(d,'and pos_tim and perangkat_id=dev for update;',
 'and pos_tim and (perangkat_id=dev or (off and exists(select 1 from matur_internal.pos_pindah ph where ph.sesi_id=sid and ph.asal_id=dev and ph.selesai_at is not null))) for update;');
 d:=replace(d,'if iz.ditarik_at is not null and w>iz.ditarik_at then',
 'if iz.ditarik_at is not null and w>iz.ditarik_at and not(off and exists(select 1 from matur_internal.pos_pindah ph where ph.sesi_id=sid and ph.asal_id=dev and w<=coalesce(ph.bersih_at,ph.aman_at))) then');
 execute d;
end $$;

-- Restrict public administration to its intended roles; Admin Pusat gets device/session access, not PIN reveal.
alter function public.panel_pos_admin() set schema matur_internal;
revoke all on function matur_internal.panel_pos_admin() from public,anon,authenticated;
create function public.panel_pos_admin() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare base jsonb;devices jsonb;sessions jsonb;outlets jsonb;pindah jsonb;admin boolean:=punya_peran('{owner,hrd,admin_pusat,admin_gudang}');begin
 if auth.uid() is null or not(admin or punya_peran('{spv,finance}')) then raise exception 'Tidak diizinkan';end if;
 if punya_peran('{admin_pusat}') and not punya_peran('{owner,hrd,admin_gudang,spv,finance}') then base:='{"pusat":false,"staf":[],"outlets":[],"devices":[],"sessions":[]}'::jsonb;
 else base:=matur_internal.panel_pos_admin();end if;
 if not admin then return base||jsonb_build_object('perangkat_admin',false,'pindah','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nama',o.nama,'awal',o.pos_awal_menit,'offline',o.pos_offline_menit,'lat',o.absen_lat,'lng',o.absen_lng,'radius',o.absen_radius_meter) order by o.nama),'[]') into outlets from outlet o where mode='asli' and deleted_at is null;
 select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('login_nama',u.nama,'operator_nama',(select p.nama from matur_internal.pos_izin iz join pengguna p on p.id=iz.diverifikasi_oleh where iz.perangkat_id=d.id order by iz.mulai_at desc,iz.id limit 1),'sesi_id',s.id,'pembuka_nama',p.nama) order by d.diubah_at desc),'[]') into devices from pos_perangkat d left join pengguna u on u.id=d.login_pengguna_id left join sesi_kas s on s.perangkat_id=d.id and s.ditutup_at is null and s.mode='asli' left join pengguna p on p.id=s.kasir_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'outlet_id',s.outlet_id,'nama',s.nama_kasir,'buka_at',s.dibuka_at,'batas_at',s.batas_at,'legacy',not s.pos_tim,'ditutup_at',s.ditutup_at,'status',s.rekap_status,'pending',s.pending_offline,'aktual',case when punya_peran('{owner,admin_pusat}') then coalesce(s.fisik_akhir,s.setoran+s.modal_laci) end,'selisih',case when punya_peran('{owner,admin_pusat}') then s.selisih end,'perangkat_id',s.perangkat_id,'pembuka_nama',u.nama,'anggota',(select coalesce(jsonb_agg(jsonb_build_object('nama',m.nama,'gabung_at',m.gabung_at,'keluar_at',m.keluar_at)),'[]') from pos_tim_anggota m where m.sesi_id=s.id)) order by s.dibuka_at desc),'[]') into sessions from (select * from sesi_kas where mode='asli' and (ditutup_at is null or dibuka_at>now()-interval '7 days') order by dibuka_at desc limit 100) s left join pengguna u on u.id=s.kasir_id;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('asal_nama',a.nama,'tujuan_nama',t.nama,'admin_nama',u.nama) order by r.diminta_at desc),'[]') into pindah from (select * from matur_internal.pos_pindah order by diminta_at desc limit 100) r join pos_perangkat a on a.id=r.asal_id join pos_perangkat t on t.id=r.tujuan_id join pengguna u on u.id=r.admin_id;
 return base||jsonb_build_object('perangkat_admin',true,'devices',devices,'sessions',sessions,'outlets',outlets,'pindah',pindah);
end $$;
revoke all on function panel_pos_admin() from public,anon;grant execute on function panel_pos_admin() to authenticated;

create function public.batal_pindah_pos(p_id uuid,p_alasan text) returns void
language plpgsql security definer set search_path=public as $$
declare sid uuid;r matur_internal.pos_pindah;begin
 if auth.uid() is null or not punya_peran('{owner,hrd,admin_pusat,admin_gudang}') then raise exception 'Hanya admin perangkat';end if;
 if length(trim(coalesce(p_alasan,'')))<5 then raise exception 'Alasan minimal 5 karakter';end if;
 select sesi_id into sid from matur_internal.pos_pindah where id=p_id;
 perform 1 from sesi_kas where id=sid for update;
 select * into r from matur_internal.pos_pindah where id=p_id for update;
 if r.id is null or r.selesai_at is not null then raise exception 'Permintaan sudah selesai/tidak tersedia';end if;
 update matur_internal.pos_pindah set batal_at=coalesce(batal_at,now()) where id=p_id;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'batal_pindah_pos','sesi_kas',sid::text,jsonb_build_object('permintaan',p_id,'alasan',p_alasan));
end $$;
revoke all on function batal_pindah_pos(uuid,text) from public,anon;grant execute on function batal_pindah_pos(uuid,text) to authenticated;
