-- Lanjutkan kas tertutup dengan audit; tidak membuat modal atau sesi kedua.
create schema pos_kas_internal;
revoke all on schema pos_kas_internal from public,anon;
grant usage on schema pos_kas_internal to authenticated;
create table pos_kas_internal.riwayat_lanjut (
 id uuid primary key default gen_random_uuid(),sesi_id uuid not null references public.sesi_kas,
 ditutup_at timestamptz not null,diizinkan_at timestamptz not null default clock_timestamp(),
 admin_id uuid not null references public.pengguna,nama_admin text not null,alasan text not null,
 penutupan jsonb not null,unique(sesi_id,ditutup_at)
);
alter table pos_kas_internal.riwayat_lanjut enable row level security;
revoke all on pos_kas_internal.riwayat_lanjut from public,anon,authenticated;
create index riwayat_lanjut_admin on pos_kas_internal.riwayat_lanjut(admin_id);
create function pos_kas_internal.alasan_tolak(p_sesi uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare s public.sesi_kas;
begin
 select * into s from public.sesi_kas where id=p_sesi;
 if s.id is null or not s.pos_tim or not s.kas_harian or s.mode<>'asli' then return 'Bukan kas harian POS outlet';end if;
 if s.ditutup_at is null then return 'Kas sudah terbuka';end if;
 if not exists(select 1 from public.outlet where id=s.outlet_id and deleted_at is null) then return 'Outlet tidak tersedia';end if;
 if exists(select 1 from public.sesi_kas where outlet_id=s.outlet_id and mode='asli' and (ditutup_at is null or dibuka_at>s.dibuka_at) and id<>s.id) then return 'Sudah ada kas lain yang lebih baru atau masih terbuka';end if;
 if not exists(select 1 from public.jadwal_shift j join public.shift_outlet sh on sh.id=j.shift_id join public.outlet o on o.id=j.outlet_id where j.outlet_id=s.outlet_id and j.tanggal=s.tanggal_shift and j.status='terbit'
 and now() between ((j.tanggal+sh.jam_mulai) at time zone 'Asia/Jakarta')-make_interval(mins=>o.pos_awal_menit) and ((j.tanggal+sh.jam_selesai+case when sh.jam_selesai<=sh.jam_mulai then interval '1 day' else interval '0' end) at time zone 'Asia/Jakarta')) then return 'Hanya kas pada tanggal operasional dan jam shift terbit yang sedang berjalan';end if;
 if coalesce(s.pending_offline,0)>0 or exists(select 1 from matur_internal.pos_pending where sesi_id=s.id) or matur_internal.pindah_menunggu(s.id)>0 or exists(select 1 from matur_internal.pos_pindah where sesi_id=s.id and selesai_at is null and batal_at is null) then return 'Selesaikan sinkronisasi atau perpindahan perangkat dahulu';end if;
 if exists(select 1 from public.laporan_bulanan l where l.outlet_id=s.outlet_id and l.deleted_at is null and l.tgl_terbit is not null and date_trunc('month',l.periode::timestamp)=date_trunc('month',s.tanggal_shift::timestamp)) then return 'Laporan bulanan sudah diterbitkan';end if;
 return null;
end $$;
create function pos_kas_internal.panel_lanjut() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.pengguna u join public.penugasan p on p.pengguna_id=u.id where u.id=auth.uid() and u.status='aktif' and p.peran in ('owner','admin_pusat','hrd')) then raise exception 'Hanya HRD/Admin Pusat/Owner';end if;
 return jsonb_build_object('kas',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'outlet',o.nama,'tanggal',s.tanggal_shift,'ditutup_at',s.ditutup_at,'modal',s.modal_laci,'aktual',s.fisik_akhir,'alasan_tolak',pos_kas_internal.alasan_tolak(s.id)) order by s.ditutup_at desc),'[]')
 from public.sesi_kas s join public.outlet o on o.id=s.outlet_id
 where s.mode='asli' and s.kas_harian and s.pos_tim and s.ditutup_at>now()-interval '7 days' and o.deleted_at is null and pos_training_internal.admin_testing_outlet(s.outlet_id)),
 'riwayat',(select coalesce(jsonb_agg(jsonb_build_object('outlet',x.nama,'tanggal',x.tanggal_shift,'waktu',x.diizinkan_at,'admin',x.nama_admin,'alasan',x.alasan,'ditutup_at',x.ditutup_at,'aktual',x.penutupan->'fisik_akhir') order by x.diizinkan_at desc),'[]') from (
 select r.*,o.nama,s.tanggal_shift from pos_kas_internal.riwayat_lanjut r join public.sesi_kas s on s.id=r.sesi_id join public.outlet o on o.id=s.outlet_id where pos_training_internal.admin_testing_outlet(s.outlet_id) order by r.diizinkan_at desc limit 30) x));
end $$;
create function pos_kas_internal.izinkan_lanjut(p_sesi uuid,p_ditutup timestamptz,p_alasan text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.sesi_kas; o uuid; tolak text; akhir timestamptz; nama text;
begin
 select outlet_id into o from public.sesi_kas where id=p_sesi;
 if not coalesce(pos_training_internal.admin_testing_outlet(o),false) then raise exception 'Tidak berwenang melanjutkan kas outlet ini';end if;
 if length(trim(coalesce(p_alasan,'')))<5 or length(p_alasan)>1000 then raise exception 'Isi alasan 5–1000 karakter';end if;
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||o));
 select * into s from public.sesi_kas where id=p_sesi for update;
 if s.ditutup_at is null and exists(select 1 from pos_kas_internal.riwayat_lanjut where sesi_id=s.id and ditutup_at=p_ditutup) then return;end if;
 if p_ditutup is null or s.ditutup_at is distinct from p_ditutup then raise exception 'Status kas sudah berubah. Muat ulang halaman';end if;
 tolak:=pos_kas_internal.alasan_tolak(s.id);if tolak is not null then raise exception '%',tolak;end if;
 select max((j.tanggal+sh.jam_selesai+case when sh.jam_selesai<=sh.jam_mulai then interval '1 day' else interval '0' end) at time zone 'Asia/Jakarta') into akhir
 from public.jadwal_shift j join public.shift_outlet sh on sh.id=j.shift_id join public.outlet ot on ot.id=j.outlet_id where j.outlet_id=o and j.tanggal=s.tanggal_shift and j.status='terbit'
 and now() between ((j.tanggal+sh.jam_mulai) at time zone 'Asia/Jakarta')-make_interval(mins=>ot.pos_awal_menit) and ((j.tanggal+sh.jam_selesai+case when sh.jam_selesai<=sh.jam_mulai then interval '1 day' else interval '0' end) at time zone 'Asia/Jakarta');
 select u.nama into nama from public.pengguna u where u.id=auth.uid();
 insert into pos_kas_internal.riwayat_lanjut(sesi_id,ditutup_at,admin_id,nama_admin,alasan,penutupan) values(s.id,s.ditutup_at,auth.uid(),nama,trim(p_alasan),to_jsonb(s));
 -- Semua izin lama dicabut. PIC harus memeriksa uang fisik dan masuk ulang.
 update matur_internal.pos_izin set ditarik_at=coalesce(ditarik_at,now()) where sesi_id=s.id;
 update public.pos_serah_terima set selesai_at=coalesce(selesai_at,now()) where sesi_id=s.id and selesai_at is null;
 update public.sesi_kas set ditutup_at=null,ditutup_oleh=null,fisik_akhir=null,kas_seharusnya=null,setoran=null,seharusnya=null,selisih=null,catatan_tutup=null,dihitung_at=null,dihitung_oleh=null,tutup_otomatis=false,rekap_status='sementara',batas_at=akhir where id=s.id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'izinkan_lanjut_kas','sesi_kas',s.id::text,to_jsonb(s),jsonb_build_object('alasan',trim(p_alasan),'modal_tetap',s.modal_laci));
end $$;
create function public.panel_lanjut_kas_pos() returns jsonb language sql stable security invoker set search_path='' as $$select pos_kas_internal.panel_lanjut()$$;
create function public.izinkan_lanjut_kas_pos(p_sesi uuid,p_ditutup timestamptz,p_alasan text) returns void language sql security invoker set search_path='' as $$select pos_kas_internal.izinkan_lanjut(p_sesi,p_ditutup,p_alasan)$$;
revoke all on function pos_kas_internal.alasan_tolak(uuid) from public,anon,authenticated;
revoke all on function pos_kas_internal.panel_lanjut(),pos_kas_internal.izinkan_lanjut(uuid,timestamptz,text),public.panel_lanjut_kas_pos(),public.izinkan_lanjut_kas_pos(uuid,timestamptz,text) from public,anon;
grant execute on function pos_kas_internal.panel_lanjut(),pos_kas_internal.izinkan_lanjut(uuid,timestamptz,text),public.panel_lanjut_kas_pos(),public.izinkan_lanjut_kas_pos(uuid,timestamptz,text) to authenticated;
