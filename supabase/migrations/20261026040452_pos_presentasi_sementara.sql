-- Pengecualian presentasi POS lengkap; data tetap asli, durasi maksimal 120 menit.
create table pos_kas_internal.presentasi (
 id uuid primary key default gen_random_uuid(),outlet_id uuid not null references public.outlet,
 mulai_at timestamptz not null default now(),sampai_at timestamptz not null,
 admin_id uuid not null references public.pengguna,alasan text not null
);
create index on pos_kas_internal.presentasi(outlet_id,sampai_at);
create index on pos_kas_internal.presentasi(admin_id);
alter table pos_kas_internal.presentasi enable row level security;
revoke all on pos_kas_internal.presentasi from public,anon,authenticated;
create function pos_kas_internal.presentasi_aktif(o uuid,w timestamptz default now()) returns boolean
language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from pos_kas_internal.presentasi where outlet_id=o and w>=mulai_at and w<sampai_at)$$;
create function pos_kas_internal.atur_presentasi(o uuid,menit int,alasan text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(pos_training_internal.admin_testing_outlet(o),false) then raise exception 'Tidak berwenang';end if;
 if menit is null or menit<0 or menit>120 or length(trim(coalesce(alasan,'')))<5 then raise exception 'Isi durasi 0–120 menit dan alasan';end if;
 perform 1 from public.outlet where id=o and deleted_at is null for update;
 if not found then raise exception 'Outlet tidak tersedia';end if;
 update pos_kas_internal.presentasi set sampai_at=now() where outlet_id=o and sampai_at>now();
 if menit>0 then insert into pos_kas_internal.presentasi(outlet_id,sampai_at,admin_id,alasan) values(o,now()+make_interval(mins=>menit),auth.uid(),trim(alasan));end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'atur_presentasi_pos','outlet',o::text,jsonb_build_object('menit',menit,'alasan',trim(alasan)));
end $$;
create function public.atur_presentasi_pos(p_outlet uuid,p_menit int,p_alasan text) returns void language sql security invoker set search_path='' as $$select pos_kas_internal.atur_presentasi(p_outlet,p_menit,p_alasan)$$;
revoke all on function pos_kas_internal.presentasi_aktif(uuid,timestamptz) from public,anon,authenticated;
revoke all on function pos_kas_internal.atur_presentasi(uuid,int,text),public.atur_presentasi_pos(uuid,int,text) from public,anon;
grant execute on function pos_kas_internal.atur_presentasi(uuid,int,text),public.atur_presentasi_pos(uuid,int,text) to authenticated;
-- Token perangkat, akun outlet, PIC, uang fisik dan satu kas tetap divalidasi.
do $$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.pilih_pic_pos_outlet(uuid,text,uuid,bigint,bigint,text,text)'::regprocedure);
 needle:=' if j.id is null then raise exception';
 if position(needle in d)=0 then raise exception 'Guard PIC berubah';end if;
 d:=replace(d,needle,$patch$
 if pos_kas_internal.presentasi_aktif(p_outlet) then
  if not exists(select 1 from pengguna u join penugasan t on t.pengguna_id=u.id where u.id=p_pic and u.status='aktif' and not u.akun_tablet and t.outlet_id=p_outlet and t.peran in ('kasir','barista','spv')) then raise exception 'Pilih petugas outlet aktif';end if;
  select js.*,sh.nama,sh.jam_mulai,sh.jam_selesai into j from jadwal_shift js join shift_outlet sh on sh.id=js.shift_id where js.outlet_id=p_outlet and sh.outlet_id=p_outlet and js.tanggal=(now() at time zone 'Asia/Jakarta')::date and js.status='terbit' order by (js.pengguna_id=p_pic) desc,js.id limit 1;
 end if;
$patch$||needle);
 needle:=' perform pg_advisory_xact_lock(hashtext(''pos-outlet:''||p_outlet));';
 if position(needle in d)=0 then raise exception 'Kunci outlet berubah';end if;
 d:=replace(d,needle,$patch$
 if pos_kas_internal.presentasi_aktif(p_outlet) then select max(sampai_at) into akhir from pos_kas_internal.presentasi where outlet_id=p_outlet and now()>=mulai_at and now()<sampai_at;end if;
$patch$||needle);execute d;
 d:=pg_get_functiondef('public.status_pos_tim(uuid,text,text,boolean)'::regprocedure);
 needle:=' select coalesce(jsonb_agg(jsonb_build_object(''id'',m.pengguna_id';
 if position(needle in d)=0 then raise exception 'Roster POS berubah';end if;
 d:=replace(d,needle,$patch$
 if pos_kas_internal.presentasi_aktif(p_outlet) then
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nama',u.nama,'shift_id',s.shift_id,'tanggal',(now() at time zone 'Asia/Jakarta')::date,'shift','Presentasi sementara','kasir',true) order by u.nama),'[]') into roster from pengguna u where u.status='aktif' and not u.akun_tablet and exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=p_outlet and t.peran in ('kasir','barista','spv'));
 end if;
$patch$||needle);
 d:=replace(d,'''server_at'',now()', '''presentasi'',pos_kas_internal.presentasi_aktif(p_outlet),''server_at'',now()');execute d;
 -- Pemeriksaan kehadiran menerima pengecualian hanya dalam interval presentasi.
 d:=pg_get_functiondef('matur_internal.hadir_kas(uuid,timestamptz,uuid)'::regprocedure);
 needle:='select exists';
 if position(needle in d)=0 then raise exception 'Guard kehadiran berubah';end if;
 d:=replace(d,needle,'select pos_kas_internal.presentasi_aktif((select outlet_id from public.sesi_kas where id=p_sesi),p_w) or exists');execute d;
end $$;
-- Kontrol untuk mengakhiri pengecualian dari panel HRD/Admin Pusat.
do $$ declare d text;needle text:='return jsonb_build_object(''kas'',';begin
 d:=pg_get_functiondef('pos_kas_internal.panel_lanjut()'::regprocedure);
 if position(needle in d)=0 then raise exception 'Panel kas berubah';end if;
 d:=replace(d,needle,$patch$return jsonb_build_object('presentasi',(select coalesce(jsonb_agg(jsonb_build_object('outlet_id',o.id,'outlet',o.nama,'sampai_at',p.sampai_at)),'[]') from pos_kas_internal.presentasi p join public.outlet o on o.id=p.outlet_id where now()>=p.mulai_at and now()<p.sampai_at and pos_training_internal.admin_testing_outlet(o.id)),'kas',$patch$);execute d;
end $$;
