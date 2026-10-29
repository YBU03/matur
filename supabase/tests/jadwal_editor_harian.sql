-- Pengujian authenticated terisolasi, tidak mengubah jadwal/absensi asli. Selalu ROLLBACK.
begin;
do $$declare owner_id uuid;o uuid:=gen_random_uuid();u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();s uuid:=gen_random_uuid();begin
 select p.pengguna_id into owner_id from public.penugasan p join public.pengguna x on x.id=p.pengguna_id and x.status='aktif' where p.peran='owner' limit 1;
 if owner_id is null then raise exception 'Owner aktif diperlukan';end if;
 insert into public.outlet(id,nama) values(o,'Jadwal harian fixture rollback');
 insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','jadwal-'||u||'@example.invalid'),(v,'authenticated','authenticated','jadwal-'||v||'@example.invalid');
 insert into public.pengguna(id,nama,status) values(u,'Staf jadwal fixture','aktif'),(v,'Rekan jadwal fixture','aktif');
 insert into public.penugasan(pengguna_id,peran,outlet_id) values(u,'barista',o),(v,'kasir',o);
 insert into public.shift_outlet(id,outlet_id,nama,jam_mulai,jam_selesai,min_orang) values(s,o,'Pagi fixture','08:00','16:00',1);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('test.jadwal_owner',owner_id::text,true);perform set_config('test.jadwal_outlet',o::text,true);perform set_config('test.jadwal_user',u::text,true);perform set_config('test.jadwal_rekan',v::text,true);perform set_config('test.jadwal_shift',s::text,true);
end $$;
set local role authenticated;
do $$declare o uuid:=current_setting('test.jadwal_outlet')::uuid;u uuid:=current_setting('test.jadwal_user')::uuid;v uuid:=current_setting('test.jadwal_rekan')::uuid;s uuid:=current_setting('test.jadwal_shift')::uuid;
 d date:=(now() at time zone 'Asia/Jakarta')::date+10;j uuid;w uuid;p jsonb;rv int;sh public.shift_outlet;
begin
 p:=jsonb_build_object('aksi','tambah','outlet_id',o,'pengguna_id',u,'shift_id',s,'tanggal',d,'terbit',true);
 j:=public.kelola_jadwal_harian(p);
 select versi into rv from public.jadwal_shift where id=j;
 perform public.kelola_jadwal_harian(p||jsonb_build_object('aksi','simpan','id',j,'versi',rv,'khusus',true,'mulai','22:00','selesai','04:00'));
 select s2.* into sh from public.jadwal_shift js join public.shift_outlet s2 on s2.id=js.shift_id where js.id=j;
 if sh.induk_shift_id<>s or sh.jam_mulai<>'22:00'::time or sh.jam_selesai<>'04:00'::time or sh.aktif then raise exception 'Jam khusus tidak tersambung';end if;
 if (select jam_mulai from public.shift_outlet where id=s)<>'08:00'::time then raise exception 'Template ikut berubah';end if;
 -- Resolusi shift yang dipakai absensi dan pembaca jadwal/gaji menggunakan FK asli.
 if not exists(select 1 from public.jadwal_shift js join public.shift_outlet s2 on s2.id=js.shift_id where js.id=j and s2.jam_mulai='22:00') then raise exception 'Relasi jam tidak terbaca';end if;
 perform public.kelola_jadwal_harian(jsonb_build_object('aksi','tandai','outlet_id',o,'pengguna_id',v,'tanggal',d+1,'jenis','libur'));
 w:=public.kelola_jadwal_harian(p||jsonb_build_object('tanggal',d+2,'pengguna_id',v));
 perform public.kelola_jadwal_harian(jsonb_build_object('aksi','libur_pindah','outlet_id',o,'pengguna_id',v,'tanggal',d+1,'id',w,'versi',(select versi from public.jadwal_shift where id=w)));
 if not exists(select 1 from public.pengajuan_izin where pengguna_id=v and tanggal=d+2 and status='disetujui') then raise exception 'Libur tujuan tidak tercatat';end if;
 -- Status libur juga bisa dibuat untuk diri pengelola/SPV, bukan menjadi pengajuan menunggu.
 perform set_config('test.jadwal_attended',j::text,true);
 perform set_config('test.jadwal_date',d::text,true);
end $$;
reset role;
insert into public.absensi(outlet_id,pengguna_id,jadwal_id,tanggal,status) values(current_setting('test.jadwal_outlet')::uuid,current_setting('test.jadwal_user')::uuid,current_setting('test.jadwal_attended')::uuid,current_setting('test.jadwal_date')::date,'tepat');
set local role authenticated;
do $$declare o uuid:=current_setting('test.jadwal_outlet')::uuid;j uuid:=current_setting('test.jadwal_attended')::uuid;begin
 begin perform public.kelola_jadwal_harian(jsonb_build_object('aksi','hapus','outlet_id',o,'id',j,'versi',(select versi from public.jadwal_shift where id=j)));raise exception 'Jadwal sudah absen berhasil dihapus';exception when others then if sqlerrm not like 'Jadwal sudah memiliki absensi%' then raise;end if;end;
 if not exists(select 1 from public.absensi where jadwal_id=j) then raise exception 'Referensi absensi terlepas';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.jadwal_user'),true);
set local role authenticated;
do $$begin
 begin perform public.kelola_jadwal_harian(jsonb_build_object('aksi','hapus','outlet_id',current_setting('test.jadwal_outlet'),'id',current_setting('test.jadwal_attended')));raise exception 'Barista dapat mengelola jadwal';exception when others then if sqlerrm not like 'Hanya Owner/HRD%' then raise;end if;end;
end $$;
reset role;
select 'PASS: authenticated edit/jam khusus/libur atomic/relasi absensi/batas peran; semua fixture ROLLBACK' as result;
rollback;
