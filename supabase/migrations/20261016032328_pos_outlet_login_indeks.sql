-- A stable primary key for login attempts and accurate shared-account audit identity.
alter table matur_internal.pos_login_gagal add column id bigint generated always as identity primary key;
do $$ declare d text;begin
 d:=pg_get_functiondef('public.masuk_pos_outlet(text,text,text,text)'::regprocedure);
 d:=replace(d,'values (uid, ''masuk_tablet_pos'',', 'values (akun, ''masuk_pos_outlet'',');execute d;
end $$;
-- Preserve explicit admin extensions for the current shift without extending past shifts.
create or replace function matur_internal.hadir_kas(p_sesi uuid,p_w timestamptz,p_shift uuid default null) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from matur_internal.pos_hadir_riwayat h join sesi_kas s on s.id=h.sesi_id join absensi a on a.id=h.absensi_id join jadwal_shift j on j.id=a.jadwal_id join shift_outlet sh on sh.id=j.shift_id join pengguna u on u.id=a.pengguna_id and u.status='aktif'
 where h.sesi_id=p_sesi and h.mulai_at<=p_w and a.masuk_at<=p_w and (a.pulang_at is null or a.pulang_at>p_w)
 and j.status='terbit' and (p_shift is null or j.shift_id=p_shift)
 and exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=a.outlet_id and t.peran in ('kasir','barista','spv'))
 and p_w<=greatest(((j.tanggal+sh.jam_selesai+case when sh.jam_selesai<=sh.jam_mulai then interval '1 day' else interval '0' end) at time zone 'Asia/Jakarta'),case when j.shift_id=s.shift_id then s.batas_at else null end))
$$;
