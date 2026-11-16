-- HRD may review generic registrations; warehouse retains the employee marker.
create or replace function public.setujui_staf(p_uid uuid, p_peran peran, p_outlet uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
 if not pengelola_staf() then raise exception 'Tidak diizinkan'; end if;
 if p_peran is null or p_peran not in ('kasir','barista') then raise exception 'Hanya peran Kasir atau Barista'; end if;
 if not exists(select 1 from outlet where id=p_outlet and mode='asli' and deleted_at is null) then raise exception 'Pilih outlet aktif'; end if;
 perform 1 from pengguna where id=p_uid and status='menunggu' and not akun_tablet
   and (punya_peran('{hrd}') or permintaan->>'jenis'='staf_outlet') for update;
 if not found or exists(select 1 from penugasan where pengguna_id=p_uid) then raise exception 'Pendaftar sudah diproses atau tidak diizinkan'; end if;
 update pengguna set status='aktif' where id=p_uid;
 insert into penugasan(pengguna_id,peran,outlet_id) values(p_uid,p_peran,p_outlet);
end $$;
create or replace function public.tolak_staf(p_uid uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not pengelola_staf() then raise exception 'Tidak diizinkan'; end if;
 perform 1 from pengguna where id=p_uid and status='menunggu' and not akun_tablet
   and (punya_peran('{hrd}') or permintaan->>'jenis'='staf_outlet') for update;
 if not found or exists(select 1 from penugasan where pengguna_id=p_uid) then raise exception 'Pendaftar sudah diproses atau tidak diizinkan'; end if;
 update pengguna set status='ditolak' where id=p_uid;
end $$;
revoke all on function public.setujui_staf(uuid,peran,uuid),public.tolak_staf(uuid) from public,anon;
grant execute on function public.setujui_staf(uuid,peran,uuid),public.tolak_staf(uuid) to authenticated;

-- Narrow self-service capability: never accepts a target user or salary components.
create or replace function matur_internal.simpan_rekening_sendiri(p_bank text,p_nomor text,p_nama text) returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); nomor text:=regexp_replace(coalesce(p_nomor,''),'\s','','g');
begin
 if uid is null or not exists(select 1 from pengguna u where u.id=uid and u.status='aktif' and not u.akun_tablet)
   or not exists(select 1 from penugasan where pengguna_id=uid and peran in ('kasir','barista','spv')) then raise exception 'Hanya rekening pribadi karyawan aktif'; end if;
 if length(trim(coalesce(p_bank,''))) not between 2 and 80 or length(trim(coalesce(p_nama,''))) not between 2 and 120
   or nomor !~ '^[0-9]{6,34}$' then raise exception 'Isi bank, nomor rekening 6–34 angka, dan nama pemilik'; end if;
 insert into gaji_staf(pengguna_id,bank,no_rekening,atas_nama) values(uid,trim(p_bank),nomor,trim(p_nama))
 on conflict(pengguna_id) do update set bank=excluded.bank,no_rekening=excluded.no_rekening,atas_nama=excluded.atas_nama,updated_at=now();
end $$;
revoke all on function matur_internal.simpan_rekening_sendiri(text,text,text) from public,anon;
grant execute on function matur_internal.simpan_rekening_sendiri(text,text,text) to authenticated;
create or replace function public.simpan_rekening_sendiri(p_bank text,p_nomor text,p_nama text) returns void
language sql security invoker set search_path='' as $$select matur_internal.simpan_rekening_sendiri(p_bank,p_nomor,p_nama)$$;
revoke all on function public.simpan_rekening_sendiri(text,text,text) from public,anon;
grant execute on function public.simpan_rekening_sendiri(text,text,text) to authenticated;

-- Read-only report. Existing parent/item RLS remains the final outlet boundary.
create or replace function public.data_void(p_outlet uuid,p_dari date,p_sampai date,p_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
begin
 if auth.uid() is null or not punya_peran('{owner,admin_pusat,finance,hrd,admin_gudang,manajer_area,spv,kasir,barista,tablet}') then raise exception 'Tidak diizinkan'; end if;
 if p_dari is null or p_sampai is null or p_sampai<p_dari or p_sampai-p_dari>366 then raise exception 'Rentang tanggal maksimal 367 hari'; end if;
 return coalesce((select jsonb_agg(r order by r.void_at desc nulls last,r.id) from (
  select t.id,t.nomor,t.outlet_id,o.nama outlet,t.created_at,t.void_at,t.total,t.subtotal,t.diskon,
   coalesce(nullif(t.void_nama,''),g.nama,'Tidak dicatat') pelaku,
   coalesce(nullif(t.void_kategori,''),'Tidak dicatat') kategori,t.void_alasan alasan,
   coalesce((select jsonb_agg(jsonb_build_object('nama',i.nama,'qty',i.qty,'harga',i.harga) order by i.nama,i.id) from item_transaksi i where i.transaksi_id=t.id),'[]'::jsonb) items
  from transaksi t join outlet o on o.id=t.outlet_id left join pengguna g on g.id=t.void_oleh
  where t.mode='asli' and t.status='void' and (p_outlet is null or t.outlet_id=p_outlet)
   and ((p_id is not null and t.id=p_id) or (p_id is null and t.void_at>=p_dari::timestamp at time zone 'Asia/Jakarta' and t.void_at<(p_sampai+1)::timestamp at time zone 'Asia/Jakarta'))
 ) r),'[]'::jsonb);
end $$;
revoke all on function public.data_void(uuid,date,date,uuid) from public,anon;
grant execute on function public.data_void(uuid,date,date,uuid) to authenticated;
create index if not exists transaksi_void_waktu_idx on public.transaksi(outlet_id,void_at,id) where mode='asli' and status='void';

-- Change only notification destination, leaving void/payment/stock behavior intact.
do $$declare src text;begin
 select pg_get_functiondef('public.void_pos_langsung(uuid,text,uuid,text,text,text)'::regprocedure) into src;
 if position('''/laporan-pos/void?outlet='' || p_outlet' in src)=0 then raise exception 'Tautan void berubah; periksa definisi sebelum migrasi'; end if;
 execute replace(src,'''/laporan-pos/void?outlet='' || p_outlet','''/void?transaksi='' || t.id');
end $$;
-- Old notifications: match only exact cancellation timestamp + outlet + daily number, uniquely.
with cocok as (
 select n.id,min(t.id::text) tid from notifikasi n join transaksi t
 on n.created_at=t.void_at and n.tautan='/laporan-pos/void?outlet='||t.outlet_id
 and n.judul like 'Void POS #'||t.nomor||' · %'
 where t.status='void' and t.mode='asli' group by n.id having count(*)=1
) update notifikasi n set tautan='/void?transaksi='||c.tid from cocok c where n.id=c.id;
