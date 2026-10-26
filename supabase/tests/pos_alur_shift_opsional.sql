-- Fixture sementara di transaksi rollback, tanpa mengubah outlet/kas asli.
begin;
do $$
declare admin uuid;o uuid:=gen_random_uuid();staf uuid;un text:='alur-'||replace(o::text,'-','');login jsonb;uid uuid;
begin
 select p.pengguna_id into admin from public.penugasan p join public.pengguna u on u.id=p.pengguna_id where p.peran='owner' and u.status='aktif' limit 1;
 select u.id into staf from public.pengguna u join public.penugasan p on p.pengguna_id=u.id where u.status='aktif' and not u.akun_tablet and p.peran in ('barista','kasir','spv') limit 1;
 if admin is null or staf is null then raise exception 'Perlu owner dan staf aktif untuk fixture';end if;
 insert into public.outlet(id,nama) values(o,'Alur shift fixture rollback');
 insert into public.penugasan(pengguna_id,peran,outlet_id) values(staf,'barista',o);
 perform set_config('request.jwt.claim.sub',admin::text,true);
 perform public.atur_akses_pos_outlet(o,un,'UjiAlurShift-123',true);
 perform public.atur_alur_shift_pos(o,true,'839241',0);
 -- Fixture satu transaksi memakai now() tetap; tirukan konfigurasi dari request sebelumnya.
 update pos_kas_internal.aturan_shift set diubah_at=now()-interval '1 second' where outlet_id=o;
 login:=public.masuk_pos_outlet(un,'UjiAlurShift-123',repeat('s',64),repeat('r',48));
 select id into uid from public.pengguna where email=login->>'email';
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('test.outlet',o::text,true);perform set_config('test.staf',staf::text,true);
end $$;
set local role authenticated;
do $$
declare o uuid:=current_setting('test.outlet')::uuid;r jsonb;sh uuid;sid uuid;req uuid:=gen_random_uuid();p jsonb;
begin
 r:=public.status_pos_tim(o,repeat('s',64),'',false);
 if not (r->>'alur_shift')::boolean or (r->>'boleh')::boolean then raise exception 'Alur baru tidak meminta petugas';end if;
 sid:=(r#>>'{sesi,id}')::uuid;
 p:=jsonb_build_object('aksi','mulai','request_id',req,'pic_id',current_setting('test.staf'),'pin','839241','modal',200000,'alasan','Fixture pengganti');
 perform public.proses_alur_shift_pos(o,repeat('s',64),'',p);
 perform public.proses_alur_shift_pos(o,repeat('s',64),'',p);
 r:=public.status_pos_tim(o,repeat('s',64),'',false);sh:=(r#>>'{shift_aktif,id}')::uuid;
 if not (r->>'boleh')::boolean then raise exception 'Shift belum bisa bertransaksi';end if;
 p:=jsonb_build_object('aksi','serah','request_id',gen_random_uuid(),'shift_id',sh,'pic_id',current_setting('test.staf'),'pin','839241','aktual',195000,'catatan','Uji selisih lima ribu','alasan','Fixture pergantian');
 perform public.proses_alur_shift_pos(o,repeat('s',64),'',p);
 perform public.proses_alur_shift_pos(o,repeat('s',64),'',p);
 r:=public.status_pos_tim(o,repeat('s',64),'',false);sh:=(r#>>'{shift_aktif,id}')::uuid;
 if (r#>>'{shift_aktif,awal}')::bigint<>195000 then raise exception 'Saldo fisik tidak diteruskan';end if;
 if (r#>>'{sesi,modal}')::bigint<>200000 then raise exception 'Modal awal berubah';end if;
 p:=jsonb_build_object('aksi','tutup','request_id',gen_random_uuid(),'shift_id',sh,'aktual',195000,'catatan','Tutup fixture','pending','[]'::jsonb,'laporan',jsonb_build_object('stok','Cup 240'));
 perform public.proses_alur_shift_pos(o,repeat('s',64),'',p);
 perform public.proses_alur_shift_pos(o,repeat('s',64),'',p);
 r:=public.laporan_alur_shift_pos(o,repeat('s',64),sid);
 if jsonb_array_length(r->'shifts')<>2 then raise exception 'Duplikasi shift';end if;
 if (r#>>'{shifts,0,selisih}')::bigint<>-5000 or (r#>>'{shifts,1,selisih}')::bigint<>0 then raise exception 'Selisih terbawa ke shift baru';end if;
 if r#>>'{shifts,1,laporan,stok}'<>'Cup 240' then raise exception 'Laporan tidak tersimpan';end if;
end $$;
reset role;
select 'PASS: PIN outlet, mulai, serah terima, saldo aktual, selisih terpisah, laporan dan retry authenticated; seluruh fixture ROLLBACK' as result;
rollback;
