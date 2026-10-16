-- Administrative recovery: release stale device affinity, keep the same team cash session.
create table matur_internal.pos_reset (
 id uuid primary key default gen_random_uuid(),sesi_id uuid not null references public.sesi_kas,
 asal_id uuid references public.pos_perangkat,tujuan_id uuid references public.pos_perangkat,
 admin_id uuid not null references public.pengguna,alasan text not null,
 diminta_at timestamptz not null default now(),selesai_at timestamptz
);
alter table matur_internal.pos_reset enable row level security;
revoke all on matur_internal.pos_reset from public,anon,authenticated;
create unique index on matur_internal.pos_reset(sesi_id) where selesai_at is null;
create index on matur_internal.pos_reset(asal_id);create index on matur_internal.pos_reset(tujuan_id);create index on matur_internal.pos_reset(admin_id);
create function public.reset_akses_pos(p_outlet uuid,p_alasan text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s sesi_kas;n int:=0;d int;g int;
begin
 if auth.uid() is null or not punya_peran('{owner,admin_pusat,hrd,admin_gudang}') then raise exception 'Hanya admin perangkat';end if;
 if length(trim(coalesce(p_alasan,'')))<5 then raise exception 'Alasan reset minimal 5 karakter';end if;
 -- An offline device cannot receive an immediate revocation. Do not create overlapping sale leases.
 if exists(select 1 from matur_internal.pos_izin i join sesi_kas k on k.id=i.sesi_id where k.ditutup_at is null and (p_outlet is null or k.outlet_id=p_outlet) and i.sampai_at>now()) then raise exception 'Masih ada izin offline yang berlaku. Kunci perangkat asal atau tunggu batas izinnya sebelum reset';end if;
 for s in select * from sesi_kas where mode='asli' and pos_tim and ditutup_at is null and (p_outlet is null or outlet_id=p_outlet) for update loop
  if exists(select 1 from matur_internal.pos_izin where sesi_id=s.id and sampai_at>now()) then raise exception 'Izin offline sesi masih berlaku; tunggu batasnya sebelum reset';end if;
  update matur_internal.pos_pindah set batal_at=now() where sesi_id=s.id and selesai_at is null and batal_at is null;
  update matur_internal.pos_izin set ditarik_at=coalesce(ditarik_at,now()) where sesi_id=s.id;
  if s.perangkat_id is not null then
   insert into matur_internal.pos_reset(sesi_id,asal_id,admin_id,alasan) values(s.id,s.perangkat_id,auth.uid(),left(p_alasan,1000));
   update sesi_kas set perangkat_id=null where id=s.id;
  end if;n:=n+1;
 end loop;
 update pos_perangkat set status='aktif',diubah_at=now(),disetujui_oleh=auth.uid() where p_outlet is null or outlet_id=p_outlet;get diagnostics d=row_count;
 update pengguna set status='aktif' where akun_tablet and id in(select akun_id from pos_perangkat where p_outlet is null or outlet_id=p_outlet);
 delete from matur_internal.pos_pin_gagal where p_outlet is null or pengguna_id in(select pengguna_id from penugasan where outlet_id=p_outlet);get diagnostics g=row_count;
 insert into log_aktivitas(pengguna_id,aksi,entitas,nilai_baru) values(auth.uid(),'reset_akses_pos','pos_perangkat',jsonb_build_object('outlet',p_outlet,'alasan',p_alasan,'sesi_tim',n,'perangkat',d,'counter_pin',g,'transaksi_dihapus',false));
 return jsonb_build_object('sesi_tim',n,'perangkat',d,'counter_pin',g);
end $$;
revoke all on function reset_akses_pos(uuid,text) from public,anon;grant execute on function reset_akses_pos(uuid,text) to authenticated;

-- PIN, published shift, attendance and team membership are still checked before claiming a reset session.
do $$ declare d text;begin
 d:=pg_get_functiondef('matur_internal.buka_pos_tim(uuid,text,text,text,bigint,uuid[],text)'::regprocedure);
 if position(' if sid is not null then' in d)=0 then raise exception 'Struktur buka POS berubah';end if;
 d:=replace(d,' if sid is not null then',
 ' if sid is not null then
  if exists(select 1 from sesi_kas where id=sid and perangkat_id is null and shift_id=j.shift_id and tanggal_shift=j.tanggal) then
   if not exists(select 1 from pos_tim_anggota mm join absensi aa on aa.id=mm.absensi_id where mm.sesi_id=sid and mm.pengguna_id=uid and mm.keluar_at is null and aa.pulang_at is null) then raise exception ''Hanya anggota tim aktif boleh mengambil sesi hasil reset'';end if;
   if not exists(select 1 from matur_internal.pos_reset rr where rr.sesi_id=sid and rr.selesai_at is null) then raise exception ''Sesi belum direset admin'';end if;
   insert into matur_internal.pos_pindah(sesi_id,asal_id,tujuan_id,admin_id,alasan,diminta_at,aman_at,selesai_at,risiko_diakui)
    select sid,rr.asal_id,dev,rr.admin_id,''Pengambilan sesi setelah reset: ''||rr.alasan,rr.diminta_at,rr.diminta_at,now(),true from matur_internal.pos_reset rr where rr.sesi_id=sid and rr.selesai_at is null and rr.asal_id is not null and rr.asal_id<>dev;
   update matur_internal.pos_reset set tujuan_id=dev,selesai_at=now() where sesi_id=sid and selesai_at is null;
   update sesi_kas set perangkat_id=dev where id=sid;
   insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(uid,''ambil_pos_setelah_reset'',''sesi_kas'',sid::text,jsonb_build_object(''perangkat'',dev));
  end if;');
 execute d;
end $$;

do $$ declare d text;begin
 d:=pg_get_functiondef('public.status_pos_tim(uuid,text,text,boolean)'::regprocedure);
 d:=replace(d,'''perangkat_sama'',s.perangkat_id=dev.id','''menunggu_reset'',s.perangkat_id is null and exists(select 1 from matur_internal.pos_reset rr where rr.sesi_id=s.id and rr.selesai_at is null),''perangkat_sama'',s.perangkat_id=dev.id');execute d;
end $$;
