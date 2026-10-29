-- Jam khusus menggunakan definisi shift tersendiri untuk satu penugasan.
-- Seluruh pembaca absensi/POS/gaji tetap memakai FK shift_id yang sama.
alter table public.shift_outlet add column induk_shift_id uuid references public.shift_outlet(id), add column khusus_jadwal_id uuid unique references public.jadwal_shift(id) on delete set null;
create index shift_induk_idx on public.shift_outlet(induk_shift_id);
alter table public.shift_outlet add constraint shift_khusus_bukan_template check(induk_shift_id is null or not aktif);
alter table public.jadwal_shift add column versi integer not null default 0;
create schema jadwal_internal;
revoke all on schema jadwal_internal from public,anon;
grant usage on schema jadwal_internal to authenticated;

create function jadwal_internal.jaga_riwayat() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('sdm:'||old.outlet_id::text,0));
 if tg_op='DELETE' or (new.shift_id,new.pengguna_id,new.tanggal,new.outlet_id) is distinct from (old.shift_id,old.pengguna_id,old.tanggal,old.outlet_id) then
  if exists(select 1 from absensi where jadwal_id=old.id or (outlet_id=old.outlet_id and pengguna_id=old.pengguna_id and tanggal=old.tanggal)) then raise exception 'Jadwal sudah memiliki absensi. Riwayat tidak diubah; gunakan koreksi absensi melalui HRD.';end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 new.versi:=old.versi+1;return new;
end $$;
create trigger jadwal_jaga_riwayat before update or delete on public.jadwal_shift for each row execute function jadwal_internal.jaga_riwayat();
create function jadwal_internal.jaga_absen() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('sdm:'||new.outlet_id::text,0));
 if new.jadwal_id is not null and not exists(select 1 from jadwal_shift where id=new.jadwal_id and outlet_id=new.outlet_id and pengguna_id=new.pengguna_id and tanggal=new.tanggal and status='terbit') then raise exception 'Jadwal berubah saat absensi diproses. Muat ulang dan coba lagi.';end if;
 return new;
end $$;
create trigger jadwal_jaga_absen before insert on public.absensi for each row execute function jadwal_internal.jaga_absen();
create function jadwal_internal.jaga_jam() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('sdm:'||old.outlet_id::text,0));
 if (new.jam_mulai,new.jam_selesai) is distinct from (old.jam_mulai,old.jam_selesai) and exists(select 1 from jadwal_shift j join absensi a on a.jadwal_id=j.id where j.shift_id=old.id) then raise exception 'Jam ini sudah digunakan pada absensi. Tambahkan template shift baru atau gunakan jam khusus tanggal untuk jadwal yang belum absen.';end if;
 return new;
end $$;
create trigger jadwal_jaga_jam before update on public.shift_outlet for each row execute function jadwal_internal.jaga_jam();

create function jadwal_internal.harian(p jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare aksi text:=p->>'aksi';o uuid:=(p->>'outlet_id')::uuid;jid uuid:=(p->>'id')::uuid;uid uuid:=(p->>'pengguna_id')::uuid;
 d date:=(p->>'tanggal')::date;sid uuid:=(p->>'shift_id')::uuid;j jadwal_shift;sh shift_outlet;lama jsonb;custom_id uuid;dest jadwal_shift;izin pengajuan_izin;hasil uuid;
begin
 if auth.uid() is null or not kelola_sdm(o) then raise exception 'Hanya Owner/HRD atau SPV outlet ini yang dapat mengelola jadwal';end if;
 if octet_length(p::text)>100000 then raise exception 'Data terlalu besar';end if;
 perform pg_advisory_xact_lock(hashtextextended('sdm:'||o::text,0));
 if jid is not null then
  select * into j from jadwal_shift where id=jid and outlet_id=o for update;
  if j.id is null then raise exception 'Jadwal tidak ditemukan. Muat ulang';end if;
  if p ? 'versi' and j.versi is distinct from (p->>'versi')::int then raise exception 'Jadwal sudah berubah. Muat ulang sebelum mengedit';end if;
  lama:=to_jsonb(j);
 end if;
 if aksi='hapus' then
  if j.id is null then raise exception 'Pilih jadwal yang akan dihapus';end if;
  delete from jadwal_shift where id=j.id;hasil:=j.id;
 elsif aksi in ('simpan','tambah') then
  if d is null or uid is null then raise exception 'Tanggal dan orang wajib diisi';end if;
  if not exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id and u.status='aktif' where t.outlet_id=o and t.pengguna_id=uid and t.peran in ('kasir','barista','spv')) then raise exception 'Pilih staf aktif yang bertugas di outlet ini';end if;
  select * into sh from shift_outlet where id=sid and outlet_id=o and induk_shift_id is null;
  if sh.id is null or not sh.aktif then raise exception 'Pilih template shift yang aktif';end if;
  if exists(select 1 from pengajuan_izin where pengguna_id=uid and tanggal=d and status='disetujui') then raise exception 'Staf sedang libur/izin/sakit pada tanggal pilihan';end if;
  if exists(select 1 from jadwal_shift x join shift_outlet sx on sx.id=x.shift_id where x.outlet_id=o and x.pengguna_id=uid and x.tanggal=d and x.id is distinct from j.id and coalesce(sx.induk_shift_id,sx.id)=sid) then raise exception 'Orang ini sudah terdaftar di shift dan tanggal tersebut';end if;
  if exists(select 1 from absensi where outlet_id=o and pengguna_id=uid and tanggal=d) then raise exception 'Tanggal tujuan sudah memiliki absensi staf tersebut';end if;
  if aksi='simpan' and j.id is null then raise exception 'Jadwal tidak ditemukan';end if;
  if j.id is null then
   insert into jadwal_shift(outlet_id,shift_id,pengguna_id,tanggal,status,dibuat_oleh) values(o,sid,uid,d,case when coalesce((p->>'terbit')::boolean,false) then 'terbit' else 'draft' end,auth.uid()) returning * into j;
  end if;
  if coalesce((p->>'khusus')::boolean,false) then
   if p->>'mulai' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p->>'selesai' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p->>'mulai' is null or p->>'selesai' is null or p->>'mulai'=p->>'selesai' then raise exception 'Isi jam khusus mulai dan selesai yang berbeda';end if;
   if exists(select 1 from absensi where jadwal_id=j.id) then raise exception 'Jadwal sudah memiliki absensi';end if;
   insert into shift_outlet(outlet_id,nama,jam_mulai,jam_selesai,min_orang,urutan,aktif,induk_shift_id,khusus_jadwal_id)
   values(o,sh.nama||' (khusus)',(p->>'mulai')::time,(p->>'selesai')::time,0,sh.urutan,false,sh.id,j.id)
   on conflict(khusus_jadwal_id) do update set nama=excluded.nama,jam_mulai=excluded.jam_mulai,jam_selesai=excluded.jam_selesai,induk_shift_id=excluded.induk_shift_id returning id into custom_id;
   sid:=custom_id;
  end if;
  update jadwal_shift set shift_id=sid,pengguna_id=uid,tanggal=d where id=j.id;hasil:=j.id;
 elsif aksi='tandai' then
  if exists(select 1 from absensi where outlet_id=o and pengguna_id=uid and tanggal=d) then raise exception 'Staf sudah memiliki absensi pada tanggal ini';end if;
  if p->>'jenis' not in ('libur','izin','sakit') or p->>'jenis' is null then raise exception 'Pilih libur, izin atau sakit';end if;
  if not exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id and u.status='aktif' where t.outlet_id=o and t.pengguna_id=uid and t.peran in ('kasir','barista','spv')) then raise exception 'Staf tidak bertugas di outlet ini';end if;
  if d is null then raise exception 'Tanggal wajib diisi';end if;
  if exists(select 1 from pengajuan_izin where pengguna_id=uid and tanggal=d and status in ('menunggu','disetujui')) then raise exception 'Sudah ada izin/libur pada tanggal ini';end if;
  insert into pengajuan_izin(outlet_id,pengguna_id,jenis,tanggal,alasan,status,diputus_oleh,diputus_at) values(o,uid,p->>'jenis',d,nullif(trim(p->>'alasan'),''),'disetujui',auth.uid(),now()) returning id into hasil;
  delete from jadwal_shift where outlet_id=o and pengguna_id=uid and tanggal=d;
 elsif aksi in ('libur_masuk','libur_ganti','libur_pindah') then
  if d is null or uid is null then raise exception 'Tanggal dan staf wajib diisi';end if;
  if exists(select 1 from absensi where outlet_id=o and pengguna_id=uid and tanggal=d) then raise exception 'Tanggal ini sudah memiliki absensi';end if;
  if exists(select 1 from jadwal_shift where outlet_id=o and pengguna_id=uid and tanggal=d) then raise exception 'Staf sudah memiliki jadwal di tanggal ini. Muat ulang';end if;
  -- Hanya libur yang bisa diubah; izin/sakit wajib dibatalkan lewat persetujuan.
  if exists(select 1 from pengajuan_izin where pengguna_id=uid and tanggal=d and status in ('menunggu','disetujui') and (jenis<>'libur' or outlet_id<>o)) then raise exception 'Staf memiliki izin/sakit atau libur outlet lain';end if;
  update pengajuan_izin set status='dibatalkan',diputus_oleh=auth.uid(),diputus_at=now() where outlet_id=o and pengguna_id=uid and tanggal=d and jenis='libur' and status in ('menunggu','disetujui');
  if aksi='libur_ganti' then
   if j.id is null or j.pengguna_id=uid or j.tanggal<>d then raise exception 'Pilih jadwal rekan pada tanggal yang sama';end if;
   if exists(select 1 from jadwal_shift where outlet_id=o and pengguna_id=j.pengguna_id and tanggal=d and id<>j.id) then raise exception 'Rekan memiliki beberapa shift. Atur semua shift terlebih dahulu sebelum menukar libur';end if;
   -- Jam khusus milik penugasan tetap ikut saat orang diganti.
   perform jadwal_internal.harian(jsonb_build_object('aksi','tandai','outlet_id',o,'pengguna_id',j.pengguna_id,'tanggal',d,'jenis','libur','alasan','Pertukaran libur oleh pengelola'));
   select coalesce(induk_shift_id,id) into sid from shift_outlet where id=j.shift_id;
   hasil:=jadwal_internal.harian(jsonb_build_object('aksi','tambah','outlet_id',o,'shift_id',sid,'pengguna_id',uid,'tanggal',d,'terbit',j.status='terbit','khusus',(select induk_shift_id is not null from shift_outlet where id=j.shift_id),'mulai',(select to_char(jam_mulai,'HH24:MI') from shift_outlet where id=j.shift_id),'selesai',(select to_char(jam_selesai,'HH24:MI') from shift_outlet where id=j.shift_id)));
  elsif aksi='libur_pindah' then
   if j.id is null or j.pengguna_id<>uid or j.tanggal=d then raise exception 'Pilih tanggal kerja tujuan yang berbeda';end if;
   if exists(select 1 from jadwal_shift where outlet_id=o and pengguna_id=uid and tanggal=j.tanggal and id<>j.id) then raise exception 'Tanggal tujuan memiliki beberapa shift. Atur semua shift dahulu';end if;
   select * into sh from shift_outlet where id=j.shift_id;
   hasil:=jadwal_internal.harian(jsonb_build_object('aksi','tambah','outlet_id',o,'shift_id',coalesce(sh.induk_shift_id,sh.id),'pengguna_id',uid,'tanggal',d,'terbit',j.status='terbit','khusus',sh.induk_shift_id is not null,'mulai',to_char(sh.jam_mulai,'HH24:MI'),'selesai',to_char(sh.jam_selesai,'HH24:MI')));
   perform jadwal_internal.harian(jsonb_build_object('aksi','tandai','outlet_id',o,'pengguna_id',uid,'tanggal',j.tanggal,'jenis','libur','alasan','Libur dipindahkan oleh pengelola'));
  else
   hasil:=jadwal_internal.harian(jsonb_build_object('aksi','tambah','outlet_id',o,'shift_id',sid,'pengguna_id',uid,'tanggal',d,'terbit',coalesce((p->>'terbit')::boolean,false)));
  end if;
 else raise exception 'Aksi jadwal tidak dikenal';end if;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'jadwal_harian_'||aksi,'jadwal_shift',hasil::text,lama,p);
 return hasil;
end $$;
revoke all on function jadwal_internal.jaga_riwayat(),jadwal_internal.jaga_absen(),jadwal_internal.jaga_jam() from public,anon,authenticated;
revoke all on function jadwal_internal.harian(jsonb) from public,anon;
grant execute on function jadwal_internal.harian(jsonb) to authenticated;
create function public.kelola_jadwal_harian(p jsonb) returns uuid language sql security invoker set search_path='' as $$ select jadwal_internal.harian(p) $$;
revoke all on function public.kelola_jadwal_harian(jsonb) from public,anon;
grant execute on function public.kelola_jadwal_harian(jsonb) to authenticated;

-- Clock In/Out mengambil kunci outlet sebelum memilih jam/jadwal (bukan setelah hitung telat).
do $patch$
declare f regprocedure:=to_regprocedure('public.absen_karyawan(uuid,text,text,double precision,double precision,real,text,uuid)');s text;needle text:='perform pg_advisory_xact_lock(hashtext(''absen:''||uid));';
begin
 if f is not null then
  s:=pg_get_functiondef(f);
  if position(needle in s)=0 then raise exception 'Definisi absen_karyawan berubah, periksa integrasi';end if;
  execute replace(s,needle,needle||E'\n perform pg_advisory_xact_lock(hashtextextended(''sdm:''||p_outlet::text,0));');
 end if;
end $patch$;
