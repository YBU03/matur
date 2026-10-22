-- Uji dengan fixture sekali pakai dan RLS asli; semua perubahan di-ROLLBACK.
begin;
do $$
declare u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email) values(u,u::text||'@test.invalid');
 insert into public.pengguna(id,nama,email,status) values(u,'Timeline Test',u::text||'@test.invalid','aktif');
 insert into public.penugasan(pengguna_id,peran) values(u,'admin_pusat');
 insert into public.outlet(id,nama) values(o,'Timeline Test');
 insert into public.proyek(id,outlet_id,nama) values(p,o,'Timeline Test');
 insert into public.jadwal_proyek(id,proyek_id,judul,urutan,tgl_rencana) values(a,p,'Pertama',1,'2026-10-01'),(b,p,'Kedua',2,'2026-10-02');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('test.proyek',p::text,true);perform set_config('test.a',a::text,true);perform set_config('test.b',b::text,true);
end $$;
set local role authenticated;
do $$
declare p uuid:=current_setting('test.proyek')::uuid;a uuid:=current_setting('test.a')::uuid;b uuid:=current_setting('test.b')::uuid;n int;
begin
 perform public.simpan_urutan_timeline(p,array[b,a],jsonb_build_object(a::text,1,b::text,2));
 select count(*) into n from public.jadwal_proyek where proyek_id=p and ((id=a and urutan=2 and tgl_rencana='2026-10-01') or (id=b and urutan=1 and tgl_rencana='2026-10-02'));
 if n<>2 then raise exception 'Urutan/tanggal tidak sesuai';end if;
 begin
  perform public.simpan_urutan_timeline(p,array[a,b],jsonb_build_object(a::text,1,b::text,2));
  raise exception 'Data usang diterima';
 exception when others then
  if sqlerrm not like 'Jadwal telah berubah%' then raise;end if;
 end;
end $$;
reset role;
-- Lepas penugasan hanya pada fixture: peran yang tidak berwenang harus ditolak.
delete from public.penugasan where pengguna_id=auth.uid();
set local role authenticated;
do $$
begin
 begin
  perform public.simpan_urutan_timeline(current_setting('test.proyek')::uuid,array[current_setting('test.a')::uuid,current_setting('test.b')::uuid],jsonb_build_object(current_setting('test.a'),2,current_setting('test.b'),1));
  raise exception 'Peran tanpa izin diterima';
 exception when others then
  if sqlerrm not like 'Hanya Owner/Admin Pusat%' then raise;end if;
 end;
end $$;
reset role;
select 'PASS: RLS Admin Pusat, simpan urutan, tanggal tetap, konflik ditolak, tanpa izin ditolak; fixture rollback' as hasil;
rollback;
