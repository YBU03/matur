-- Outlet credentials are independent of personal employee identities.
create table matur_internal.pos_outlet_akses (
 outlet_id uuid primary key references public.outlet, username text not null unique,
 password_hash text not null, aktif boolean not null default true,
 admin_id uuid not null references public.pengguna, diubah_at timestamptz not null default now()
);
create index on matur_internal.pos_outlet_akses(admin_id);
alter table matur_internal.pos_outlet_akses enable row level security;
create table matur_internal.pos_login_gagal(username text not null, at timestamptz not null default now());
create index on matur_internal.pos_login_gagal(username,at);
alter table matur_internal.pos_login_gagal enable row level security;
alter table public.pos_perangkat add column kredensial_at timestamptz;
alter table public.sesi_kas add column kas_harian boolean not null default false;
create table public.pos_serah_terima (
 id uuid primary key default gen_random_uuid(), sesi_id uuid not null references sesi_kas,
 pic_id uuid not null references pengguna, shift_id uuid not null references shift_outlet,
 tanggal date not null, mulai_at timestamptz not null default now(), selesai_at timestamptz,
 pic_sebelum_id uuid references pengguna, fisik bigint, seharusnya bigint, catatan text not null default ''
);
create unique index pos_satu_pic on pos_serah_terima(sesi_id) where selesai_at is null;
create index on pos_serah_terima(pic_id);create index on pos_serah_terima(pic_sebelum_id);create index on pos_serah_terima(shift_id);
alter table public.pos_serah_terima enable row level security;
create policy baca on public.pos_serah_terima for select to authenticated using(exists(select 1 from sesi_kas s where s.id=sesi_id and boleh_outlet(s.outlet_id)));
grant select on public.pos_serah_terima to authenticated;
create function matur_internal.admin_pos_outlet(o uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from pengguna u join penugasan t on t.pengguna_id=u.id where u.id=auth.uid() and u.status='aktif' and
 (t.peran in ('owner','admin_pusat') or (t.peran in ('hrd','admin_gudang') and (t.outlet_id is null or t.outlet_id=o))))
$$;
revoke all on function matur_internal.admin_pos_outlet(uuid) from public,anon,authenticated;
create function public.panel_akses_pos_outlet() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nama',o.nama,'username',a.username,'aktif',coalesce(a.aktif,false),'diubah_at',a.diubah_at) order by o.nama),'[]')
 from outlet o left join matur_internal.pos_outlet_akses a on a.outlet_id=o.id
 where o.deleted_at is null and matur_internal.admin_pos_outlet(o.id)
$$;
create function public.atur_akses_pos_outlet(p_outlet uuid,p_username text,p_password text,p_aktif boolean) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare un text:=lower(trim(p_username)); old matur_internal.pos_outlet_akses;
begin
 if not matur_internal.admin_pos_outlet(p_outlet) then raise exception 'Tidak berwenang mengelola outlet ini';end if;
 if not exists(select 1 from outlet where id=p_outlet and deleted_at is null) then raise exception 'Outlet tidak ditemukan';end if;
 if un !~ '^[a-z0-9][a-z0-9._-]{2,49}$' then raise exception 'Username 3–50 karakter: huruf kecil, angka, titik, garis bawah atau strip';end if;
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||p_outlet));
 select * into old from matur_internal.pos_outlet_akses where outlet_id=p_outlet for update;
 if (old.outlet_id is null or coalesce(p_password,'')<>'') and (length(coalesce(p_password,''))<10 or octet_length(p_password)>72) then raise exception 'Password minimal 10 karakter';end if;
 insert into matur_internal.pos_outlet_akses(outlet_id,username,password_hash,aktif,admin_id)
 values(p_outlet,un,crypt(p_password,gen_salt('bf')),p_aktif,auth.uid())
 on conflict(outlet_id) do update set username=excluded.username,password_hash=case when coalesce(p_password,'')='' then old.password_hash else excluded.password_hash end,aktif=p_aktif,admin_id=auth.uid(),diubah_at=now();
 if not p_aktif or coalesce(p_password,'')<>'' then
  update matur_internal.pos_izin set ditarik_at=coalesce(ditarik_at,now()) where perangkat_id in(select id from pos_perangkat where outlet_id=p_outlet);
 end if;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'atur_akses_pos_outlet','outlet',p_outlet::text,jsonb_build_object('username',un,'aktif',p_aktif,'password_diganti',coalesce(p_password,'')<>''));
end $$;
revoke all on function public.panel_akses_pos_outlet(),public.atur_akses_pos_outlet(uuid,text,text,boolean) from public,anon;
grant execute on function public.panel_akses_pos_outlet(),public.atur_akses_pos_outlet(uuid,text,text,boolean) to authenticated;
create or replace function public.masuk_pos_outlet(p_username text, p_sandi text, p_rahasia text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid; h text; v_nama text; outlets jsonb; o uuid; v_outlet text; dev pos_perangkat; akun uuid; v_email text;
  cred matur_internal.pos_outlet_akses;
  hash_dev text := encode(digest(coalesce(p_rahasia,''),'sha256'),'hex');
begin
  if length(coalesce(p_rahasia,'')) < 40 or length(coalesce(p_password,'')) < 24 then return jsonb_build_object('error','Identitas perangkat tidak valid'); end if;
  if (select count(*) from matur_internal.pos_login_gagal where at>now()-interval '15 minutes' and username=lower(trim(coalesce(p_username,''))))>=8 then
    return jsonb_build_object('error','Terlalu banyak percobaan. Coba lagi 15 menit lagi.');end if;
  select * into cred from matur_internal.pos_outlet_akses where username=lower(trim(p_username)) and aktif;
  if cred.outlet_id is null or coalesce(p_sandi,'')='' or octet_length(p_sandi)>72 or crypt(p_sandi,cred.password_hash)<>cred.password_hash then
    insert into matur_internal.pos_login_gagal(username) values(left(lower(trim(coalesce(p_username,''))),100));
    return jsonb_build_object('error','Username atau password outlet salah, atau akses belum aktif.');end if;
  o:=cred.outlet_id;uid:=cred.admin_id;
  if not exists(select 1 from outlet where id=o and deleted_at is null) then return jsonb_build_object('error','Outlet tidak aktif');end if;
  select nama into v_outlet from outlet where id = o;

  -- perangkat yang sama (cookie) dipakai ulang; berpindah outlet hanya bila staf bertugas di outlet baru
  select d.* into dev from pos_perangkat d join matur_internal.pos_perangkat_rahasia r on r.perangkat_id = d.id where r.hash = hash_dev;
  if dev.id is not null and dev.status = 'dicabut' then
    return jsonb_build_object('error','Tablet ini dicabut aksesnya oleh admin. Hubungi HRD/Admin Gudang.');
  end if;
  if dev.id is not null and dev.akun_id is not null then
    akun := dev.akun_id;
    if dev.outlet_id <> o then
      if exists(select 1 from sesi_kas where perangkat_id=dev.id and ditutup_at is null) then return jsonb_build_object('error','Tutup sesi outlet sebelumnya sebelum mengganti outlet.');end if;
      update pos_perangkat set outlet_id = o, diubah_at = now() where id = dev.id;
      update penugasan set outlet_id = o where pengguna_id = akun and peran = 'tablet';
    end if;
    update pos_perangkat set status = 'aktif', diubah_at = now() where id = dev.id;
    update pengguna set status = 'aktif' where id = akun;
  else
    if (select count(*) from pos_perangkat where outlet_id = o and status = 'aktif' and akun_id is not null) >= 10 then
      return jsonb_build_object('error','Batas 10 tablet aktif per outlet tercapai. Minta admin mencabut tablet lama.');
    end if;
    akun := gen_random_uuid();
    v_email := 'tablet-' || substr(replace(akun::text,'-',''),1,12) || '@tablet.matur.id';
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', akun, 'authenticated', 'authenticated', v_email,
      crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nama', 'Tablet ' || v_outlet), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), akun, akun::text, jsonb_build_object('sub', akun::text, 'email', v_email), 'email', now(), now(), now());
    insert into pengguna (id, nama, email, status, akun_tablet) values (akun, 'Tablet ' || v_outlet, v_email, 'aktif', true);
    insert into penugasan (pengguna_id, peran, outlet_id) values (akun, 'tablet', o);
    if dev.id is null then
      insert into pos_perangkat (outlet_id, nama, status, diminta_oleh, disetujui_oleh, mode, akun_id)
        values (o, 'Tablet ' || v_outlet, 'aktif', uid, uid, 'kasir', akun) returning * into dev;
      insert into matur_internal.pos_perangkat_rahasia values (dev.id, hash_dev);
    else
      update pos_perangkat set outlet_id = o, akun_id = akun, status = 'aktif', diubah_at = now() where id = dev.id;
    end if;
  end if;
  select email into v_email from pengguna where id = akun;
  update pos_perangkat set login_at=now(),login_pengguna_id=null,kredensial_at=cred.diubah_at where id=dev.id;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = akun;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru)
    values (uid, 'masuk_tablet_pos', 'pos_perangkat', dev.id::text, jsonb_build_object('outlet', v_outlet));
  return jsonb_build_object('email', v_email, 'outlet_id', o, 'outlet', v_outlet, 'nama', v_outlet);
end $$;

revoke all on function masuk_pos_outlet(text,text,text,text) from public;
grant execute on function masuk_pos_outlet(text,text,text,text) to anon,authenticated;
-- The old personal PIN login is no longer a public entry point.
revoke all on function masuk_pos_tablet(text,text,uuid,text,text) from public,anon,authenticated;

create table matur_internal.pos_hadir_riwayat (
 sesi_id uuid not null references public.sesi_kas, absensi_id uuid not null references public.absensi,
 mulai_at timestamptz not null default now(), primary key(sesi_id,absensi_id)
);
create index on matur_internal.pos_hadir_riwayat(absensi_id);
alter table matur_internal.pos_hadir_riwayat enable row level security;
create function matur_internal.hadir_kas(p_sesi uuid,p_w timestamptz,p_shift uuid default null) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from matur_internal.pos_hadir_riwayat h join absensi a on a.id=h.absensi_id join jadwal_shift j on j.id=a.jadwal_id join shift_outlet sh on sh.id=j.shift_id join pengguna u on u.id=a.pengguna_id and u.status='aktif'
 where h.sesi_id=p_sesi and h.mulai_at<=p_w and a.masuk_at<=p_w and (a.pulang_at is null or a.pulang_at>p_w)
 and j.status='terbit' and (p_shift is null or j.shift_id=p_shift)
 and exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=a.outlet_id and t.peran in ('kasir','barista','spv'))
 and p_w<=((j.tanggal+sh.jam_selesai+case when sh.jam_selesai<=sh.jam_mulai then interval '1 day' else interval '0' end) at time zone 'Asia/Jakarta'))
$$;
revoke all on function matur_internal.hadir_kas(uuid,timestamptz,uuid) from public,anon,authenticated;

create function public.pilih_pic_pos_outlet(p_outlet uuid,p_device text,p_pic uuid,p_modal bigint,p_fisik bigint,p_catatan text,p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare dev uuid; s sesi_kas; j record; awal timestamptz; akhir timestamptz; cfg outlet; prev pos_serah_terima; kr jsonb; iz uuid; resetrow matur_internal.pos_reset;
begin
 dev:=matur_internal.perangkat(p_outlet,p_device);
 if dev is null or not exists(select 1 from pos_perangkat where id=dev and akun_id=auth.uid()) then raise exception 'Masuk menggunakan akun POS outlet pada perangkat ini';end if;
 if not exists(select 1 from matur_internal.pos_outlet_akses where outlet_id=p_outlet and aktif and diubah_at<=(select kredensial_at from pos_perangkat where id=dev)) then raise exception 'Akses POS outlet berubah atau dinonaktifkan. Keluar lalu masuk ulang menggunakan username/password outlet';end if;
 if length(coalesce(p_token,''))<40 then raise exception 'Token tidak valid';end if;
 select * into cfg from outlet where id=p_outlet and deleted_at is null;
 select js.*,sh.nama,sh.jam_mulai,sh.jam_selesai into j from absensi a
 join pengguna u on u.id=a.pengguna_id and u.status='aktif' and not u.akun_tablet
 join jadwal_shift js on js.id=a.jadwal_id and js.status='terbit' join shift_outlet sh on sh.id=js.shift_id
 where a.pengguna_id=p_pic and a.outlet_id=p_outlet and js.outlet_id=p_outlet and a.pulang_at is null and a.masuk_at>now()-interval '20 hours'
 and exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=p_outlet and t.peran in ('kasir','barista','spv'))
 and now() between ((js.tanggal+sh.jam_mulai) at time zone 'Asia/Jakarta')-make_interval(mins=>cfg.pos_awal_menit)
 and ((js.tanggal+sh.jam_selesai+case when sh.jam_selesai<=sh.jam_mulai then interval '1 day' else interval '0' end) at time zone 'Asia/Jakarta')
 order by a.masuk_at desc limit 1;
 if j.id is null then raise exception 'PIC harus sesuai jadwal shift terbit, sudah Clock In dan belum Clock Out';end if;
 akhir:=(j.tanggal+j.jam_selesai+case when j.jam_selesai<=j.jam_mulai then interval '1 day' else interval '0' end) at time zone 'Asia/Jakarta';
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||p_outlet));
 select * into s from sesi_kas where outlet_id=p_outlet and mode='asli' and ditutup_at is null for update;
 if s.id is not null then
  if not s.pos_tim then raise exception 'Sesi lama harus ditutup admin dengan hitungan fisik dahulu';end if;
  if exists(select 1 from matur_internal.pos_pindah where sesi_id=s.id and selesai_at is null and batal_at is null) then raise exception 'Selesaikan perpindahan perangkat di admin dahulu';end if;
  if s.perangkat_id is null then
   select * into resetrow from matur_internal.pos_reset where sesi_id=s.id and selesai_at is null for update;
   if resetrow.id is null then raise exception 'Minta admin mereset akses perangkat';end if;
   if resetrow.asal_id is distinct from dev then
    insert into matur_internal.pos_pindah(sesi_id,asal_id,tujuan_id,admin_id,alasan,aman_at,selesai_at,risiko_diakui)
    values(s.id,resetrow.asal_id,dev,resetrow.admin_id,resetrow.alasan,now(),now(),true);
   end if;
   update matur_internal.pos_reset set tujuan_id=dev,selesai_at=now() where id=resetrow.id;
   update sesi_kas set perangkat_id=dev where id=s.id;s.perangkat_id:=dev;
  end if;
  if s.perangkat_id<>dev then raise exception 'Kas berjalan di perangkat lain. Gunakan Pindah Perangkat atau Reset Akses dari admin';end if;
  -- Prevent carrying an abandoned daily drawer into a new operating day.
  if s.kas_harian and s.tanggal_shift<>j.tanggal and now()>s.batas_at then raise exception 'Tutup kas hari sebelumnya dahulu sebelum membuka kas baru';end if;
  select * into prev from pos_serah_terima where sesi_id=s.id and selesai_at is null for update;
  if prev.id is null or prev.pic_id<>p_pic or prev.shift_id<>j.shift_id or prev.tanggal<>j.tanggal then
   if p_fisik is null or p_fisik<0 then raise exception 'Konfirmasi uang fisik serah terima, tanpa input modal ulang';end if;
   if matur_internal.pindah_menunggu(s.id)>0 then raise exception 'Selesaikan sinkronisasi perangkat asal sebelum serah terima';end if;
   kr:=matur_internal.kas_ringkas(s.id);
   if p_fisik<>(kr->>'seharusnya')::bigint and length(trim(coalesce(p_catatan,'')))<3 then raise exception 'Catatan wajib jika uang fisik berbeda';end if;
   update pos_serah_terima set selesai_at=now() where id=prev.id;
   insert into pos_serah_terima(sesi_id,pic_id,shift_id,tanggal,pic_sebelum_id,fisik,seharusnya,catatan)
   values(s.id,p_pic,j.shift_id,j.tanggal,coalesce(prev.pic_id,s.kasir_id),p_fisik,(kr->>'seharusnya')::bigint,left(coalesce(p_catatan,''),1000));
  end if;
 else
  if p_modal is null or p_modal<0 then raise exception 'Isi modal awal laci sekali saat membuka kas harian';end if;
  if exists(select 1 from sesi_kas where outlet_id=p_outlet and mode='asli' and kas_harian and tanggal_shift=j.tanggal) then raise exception 'Kas tanggal ini sudah ditutup. Hubungi admin untuk pengecualian';end if;
  insert into sesi_kas(outlet_id,kasir_id,modal_laci,dibuka_oleh,nama_kasir,pos_tim,kas_harian,perangkat_id,shift_id,tanggal_shift,batas_at)
  values(p_outlet,p_pic,p_modal,auth.uid(),j.nama||' · Tim',true,true,dev,j.shift_id,j.tanggal,akhir) returning * into s;
  insert into pos_serah_terima(sesi_id,pic_id,shift_id,tanggal,fisik,seharusnya) values(s.id,p_pic,j.shift_id,j.tanggal,p_modal,p_modal);
 end if;
 -- The cash session remains unchanged; the current shift/PIC and attendance team advance.
 update sesi_kas set kas_harian=true,shift_id=j.shift_id,batas_at=akhir,nama_kasir=j.nama||' · Tim' where id=s.id;
 insert into pos_tim_anggota(sesi_id,pengguna_id,absensi_id,nama)
 select distinct on(a.pengguna_id) s.id,a.pengguna_id,a.id,u.nama from absensi a join jadwal_shift js on js.id=a.jadwal_id and js.status='terbit' join pengguna u on u.id=a.pengguna_id and u.status='aktif'
 where a.outlet_id=p_outlet and a.pulang_at is null and js.shift_id=j.shift_id and js.tanggal=j.tanggal
 and exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=p_outlet and t.peran in ('kasir','barista','spv'))
 order by a.pengguna_id,a.masuk_at desc
 on conflict(sesi_id,pengguna_id) do update set absensi_id=excluded.absensi_id,keluar_at=null;
 insert into matur_internal.pos_hadir_riwayat(sesi_id,absensi_id)
 select s.id,a.id from absensi a join jadwal_shift js on js.id=a.jadwal_id where a.outlet_id=p_outlet and a.pulang_at is null and js.shift_id=j.shift_id and js.tanggal=j.tanggal and js.status='terbit'
 on conflict do nothing;
 update matur_internal.pos_izin set ditarik_at=coalesce(ditarik_at,now()) where sesi_id=s.id and ditarik_at is null;
 insert into matur_internal.pos_izin(sesi_id,perangkat_id,diverifikasi_oleh,token_hash,sampai_at,katalog)
 values(s.id,dev,p_pic,encode(digest(p_token,'sha256'),'hex'),least(akhir,now()+make_interval(mins=>cfg.pos_offline_menit)),matur_internal.katalog_pos()) returning id into iz;
 update pos_perangkat set login_pengguna_id=p_pic,login_at=now() where id=dev;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'pilih_pic_pos_outlet','sesi_kas',s.id::text,jsonb_build_object('pic',p_pic,'shift',j.shift_id,'modal_tetap',s.modal_laci));
 return jsonb_build_object('sesi_id',s.id,'izin_id',iz);
end $$;
revoke all on function pilih_pic_pos_outlet(uuid,text,uuid,bigint,bigint,text,text) from public,anon;
grant execute on function pilih_pic_pos_outlet(uuid,text,uuid,bigint,bigint,text,text) to authenticated;

-- Adapt the existing cash close engine, preserving pending queue and reconciliation logic.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.tutup_pos_tim(uuid,text,text,text,bigint,text,uuid[])'::regprocedure);
 d:=replace(d,'public.tutup_pos_tim(', 'public.tutup_kas_outlet(');
 d:=replace(d,'select pengguna_id into uid from matur_internal.pos_pin where kode=lower(trim(p_kode));',
 'select i.diverifikasi_oleh into uid from matur_internal.pos_izin i join pos_perangkat pd on pd.id=i.perangkat_id and pd.akun_id=auth.uid() where i.sesi_id=s.id and i.perangkat_id=dev and i.ditarik_at is null and i.sampai_at>now() and i.token_hash=encode(extensions.digest(p_pin,''sha256''),''hex'') order by i.mulai_at desc limit 1;');
 d:=replace(d,'if not matur_internal.cek_pin_tim(uid,p_pin,dev) then', 'if uid is null or not s.kas_harian or not exists(select 1 from matur_internal.pos_outlet_akses where outlet_id=s.outlet_id and aktif) then');
 d:=replace(d,' return h||jsonb_build_object(', ' update public.pos_serah_terima set selesai_at=now() where sesi_id=s.id and selesai_at is null; return h||jsonb_build_object(');
 execute d;
end $$;
revoke all on function tutup_kas_outlet(uuid,text,text,text,bigint,text,uuid[]) from public,anon;
grant execute on function tutup_kas_outlet(uuid,text,text,text,bigint,text,uuid[]) to authenticated;

-- Existing permission/queue engines continue to serve legacy sessions unchanged.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.status_pos_tim(uuid,text,text,boolean)'::regprocedure);
 d:=replace(d,'''legacy'',not s.pos_tim,','''kas_harian'',s.kas_harian,''legacy'',not s.pos_tim,');
 d:=replace(d,'verifier:=exists(', 'verifier:=(not s.kas_harian or exists(select 1 from matur_internal.pos_outlet_akses where outlet_id=p_outlet and aktif and diubah_at<=dev.kredensial_at)) and exists(');
 d:=replace(d,'and a.masuk_at>now()-interval ''20 hours'';', 'and a.masuk_at>now()-interval ''20 hours'' and exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=p_outlet and t.peran in (''kasir'',''barista'',''spv'')) and now() between ((j.tanggal+sh.jam_mulai) at time zone ''Asia/Jakarta'')-make_interval(mins=>cfg.pos_awal_menit) and ((j.tanggal+sh.jam_selesai+case when sh.jam_selesai<=sh.jam_mulai then interval ''1 day'' else interval ''0'' end) at time zone ''Asia/Jakarta'');');
 d:=replace(d,'''kasir'',exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=p_outlet and t.peran in (''kasir'',''spv''))) from pengguna', '''kasir'',(s.kas_harian or exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=p_outlet and t.peran in (''kasir'',''spv'')))) from pengguna');
 execute d;
 d:=pg_get_functiondef('public.buat_transaksi(jsonb)'::regprocedure);
 d:=replace(d,'tugas.peran in (''kasir'',''spv''))', '(tugas.peran in (''kasir'',''spv'') or (s.kas_harian and tugas.peran=''barista'')))');
 d:=replace(d,'w:=(p->>''waktu_asli'')::timestamptz;', 'if s.kas_harian and not off and not exists(select 1 from matur_internal.pos_outlet_akses where outlet_id=o and aktif) then raise exception ''Akses POS outlet dinonaktifkan'';end if; w:=(p->>''waktu_asli'')::timestamptz;');
 execute d;
end $$;

-- Daily sessions cannot fall back to staff-PIN APIs.
do $$ declare d text;begin
 d:=pg_get_functiondef('public.buka_pos_tim(uuid,text,text,text,bigint,uuid[],text)'::regprocedure);
 d:=replace(d,'begin','begin
 if exists(select 1 from sesi_kas where outlet_id=p_outlet and kas_harian and ditutup_at is null) then raise exception ''Gunakan akun POS outlet dan pilih PIC'';end if;');execute d;
 d:=pg_get_functiondef('public.tutup_pos_tim(uuid,text,text,text,bigint,text,uuid[])'::regprocedure);
 d:=replace(d,'begin','begin
 if exists(select 1 from sesi_kas where id=p_sesi and kas_harian) then raise exception ''Gunakan tutup kas harian dari akun POS outlet'';end if;');execute d;
end $$;

-- Device and drawer administration is restricted to assigned outlets for HRD/warehouse.
do $$ declare spec record;d text;begin
 for spec in select * from (values
 ('public.atur_tablet_pos(uuid,boolean,text)','(select outlet_id from pos_perangkat where id=p_id)'),
 ('public.minta_pindah_pos(uuid,text,text,text,text)','(select outlet_id from sesi_kas where id=p_sesi)'),
 ('public.selesaikan_pindah_pos(uuid,text,boolean)','(select s.outlet_id from matur_internal.pos_pindah p join sesi_kas s on s.id=p.sesi_id where p.id=p_id)'),
 ('public.batal_pindah_pos(uuid,text)','(select s.outlet_id from matur_internal.pos_pindah p join sesi_kas s on s.id=p.sesi_id where p.id=p_id)'),
 ('public.perpanjang_pos_tim(uuid,integer,text)','(select outlet_id from sesi_kas where id=p_sesi)'),
 ('public.tutup_pos_lama(uuid,bigint,text)','(select outlet_id from sesi_kas where id=p_sesi)')
 ) as x(sig,expr) loop
 d:=pg_get_functiondef(spec.sig::regprocedure);
 d:=replace(d,'begin','begin
 if exists(select 1 from penugasan where pengguna_id=auth.uid() and peran in (''hrd'',''admin_gudang'')) and not matur_internal.admin_pos_outlet('||spec.expr||') then raise exception ''Outlet di luar kewenangan'';end if;');
 execute d;
 end loop;
end $$;

do $$ declare d text;begin
 d:=pg_get_functiondef('public.status_pos_tim(uuid,text,text,boolean)'::regprocedure);
 d:=replace(d,'''roster'',roster,','''pic'',(select jsonb_build_object(''id'',p.pic_id,''nama'',u.nama) from pos_serah_terima p join pengguna u on u.id=p.pic_id where p.sesi_id=s.id and p.selesai_at is null),''roster'',roster,');execute d;
 d:=pg_get_functiondef('public.reset_akses_pos(uuid,text)'::regprocedure);
 d:=replace(d,'begin','begin
 if exists(select 1 from penugasan where pengguna_id=auth.uid() and peran in (''hrd'',''admin_gudang'')) and (p_outlet is not null and not matur_internal.admin_pos_outlet(p_outlet) or p_outlet is null and exists(select 1 from outlet where deleted_at is null and not matur_internal.admin_pos_outlet(id))) then raise exception ''Pilih outlet dalam kewenangan Anda'';end if;');execute d;
end $$;

-- Scope admin read data too, rather than relying on frontend filters.
alter function public.panel_pos_admin() rename to panel_pos_perangkat;
alter function public.panel_pos_perangkat() set schema matur_internal;
revoke all on function matur_internal.panel_pos_perangkat() from public,anon,authenticated;
create function public.panel_pos_admin() returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb; ids uuid[];
begin
 r:=matur_internal.panel_pos_perangkat();
 if exists(select 1 from penugasan where pengguna_id=auth.uid() and peran in ('hrd','admin_gudang')) then
  select coalesce(array_agg(o.id),'{}') into ids from outlet o where matur_internal.admin_pos_outlet(o.id);
  r:=r||jsonb_build_object(
   'outlets',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(r->'outlets') x where (x->>'id')::uuid=any(ids)),
   'devices',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(r->'devices') x where (x->>'outlet_id')::uuid=any(ids)),
   'sessions',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(r->'sessions') x where (x->>'outlet_id')::uuid=any(ids)),
   'staf',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(r->'staf') x where exists(select 1 from jsonb_array_elements(x->'tugas') t where (t->>'outlet_id')::uuid=any(ids)))
  );
  r:=r||jsonb_build_object('pindah',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(r->'pindah') x where exists(select 1 from jsonb_array_elements(r->'sessions') s where s->>'id'=x->>'sesi_id')));
 end if;
 return r||jsonb_build_object('serah',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'sesi_id',p.sesi_id,'outlet_id',s.outlet_id,'pic',u.nama,'sebelum',v.nama,'shift',sh.nama,'mulai_at',p.mulai_at,'selesai_at',p.selesai_at,'fisik',p.fisik,'seharusnya',p.seharusnya,'catatan',p.catatan) order by p.mulai_at desc),'[]')
 from pos_serah_terima p join sesi_kas s on s.id=p.sesi_id join pengguna u on u.id=p.pic_id left join pengguna v on v.id=p.pic_sebelum_id join shift_outlet sh on sh.id=p.shift_id
 where p.mulai_at>now()-interval '7 days' and exists(select 1 from jsonb_array_elements(r->'outlets') x where x->>'id'=s.outlet_id::text)));
end $$;
revoke all on function public.panel_pos_admin() from public,anon;
grant execute on function public.panel_pos_admin() to authenticated;
do $$ declare d text;begin
 d:=pg_get_functiondef('public.atur_operasional_outlet(uuid,integer,integer,double precision,double precision,integer)'::regprocedure);
 d:=replace(d,'begin','begin
 if not matur_internal.admin_pos_outlet(p_outlet) then raise exception ''Outlet di luar kewenangan'';end if;');execute d;
end $$;
-- A forgotten clock-out from S1 must not keep S2/S3 online after their entire team leaves.
do $$ declare d text;begin
 d:=pg_get_functiondef('public.status_pos_tim(uuid,text,text,boolean)'::regprocedure);
 d:=replace(d,'where m.sesi_id=s.id and m.keluar_at is null and a.pulang_at is null);','where m.sesi_id=s.id and m.keluar_at is null and a.pulang_at is null and (not s.kas_harian or exists(select 1 from jadwal_shift js where js.id=a.jadwal_id and js.shift_id=s.shift_id and js.status=''terbit'')));');execute d;
end $$;
do $$ declare d text;old text;begin
 d:=pg_get_functiondef('public.status_pos_tim(uuid,text,text,boolean)'::regprocedure);
 d:=replace(d,'if s.id is not null and dev.status=', 'if s.kas_harian then active_tim:=matur_internal.hadir_kas(s.id,now(),s.shift_id);end if;
 if s.id is not null and dev.status=');execute d;
 d:=pg_get_functiondef('public.buat_transaksi(jsonb)'::regprocedure);
 old:='if not exists(select 1 from pos_tim_anggota m join absensi a on a.id=m.absensi_id join pengguna u on u.id=m.pengguna_id and u.status=''aktif''
 where m.sesi_id=sid and m.gabung_at<=w and (m.keluar_at is null or m.keluar_at>w) and a.masuk_at<=w and (a.pulang_at is null or a.pulang_at>w)) then';
 if position(old in d)=0 then raise exception 'Guard kehadiran transaksi tidak ditemukan';end if;
 d:=replace(d,old,'if (s.kas_harian and not matur_internal.hadir_kas(sid,w)) or (not s.kas_harian and '||substring(old from 4 for length(old)-8)||') then');execute d;
end $$;
revoke all on matur_internal.pos_outlet_akses,matur_internal.pos_login_gagal,matur_internal.pos_hadir_riwayat from public,anon,authenticated;
drop policy baca on public.pos_serah_terima;
create policy baca on public.pos_serah_terima for select to authenticated using(exists(
 select 1 from sesi_kas s join penugasan t on t.pengguna_id=(select auth.uid()) join pengguna u on u.id=t.pengguna_id and u.status='aktif'
 where s.id=sesi_id and (t.peran in ('owner','admin_pusat','finance') or t.peran in ('hrd','admin_gudang') and (t.outlet_id is null or t.outlet_id=s.outlet_id) or t.outlet_id=s.outlet_id and t.peran in ('kasir','barista','spv','tablet'))
));
