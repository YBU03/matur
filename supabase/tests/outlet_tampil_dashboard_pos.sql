-- Semua toggle pengujian di-ROLLBACK. Tidak mengubah transaksi atau izin kasir.
begin;
select set_config('request.jwt.claim.sub',(select p.pengguna_id::text from penugasan p join pengguna u on u.id=p.pengguna_id where p.peran='owner' and u.status='aktif' limit 1),true);
set local role authenticated;
do $test$
declare o uuid;r jsonb;v boolean;ditolak boolean;expected bigint;n bigint;
begin
 select id into strict o from outlet where nama='Outlet Demo (uji coba)' and deleted_at is null;
 if (select tampil_dashboard_pos from outlet where id=o) then raise exception 'Demo seharusnya OFF';end if;
 if not boleh_outlet(o) then raise exception 'Izin membaca riwayat hilang';end if;
 r:=ringkasan_penjualan(null,'2026-11-01','2026-11-01');
 if (r->'kpi'->>'omzet')::bigint<>1758000 or (r->'kpi'->>'trx')::int<>38 then raise exception 'Dashboard masih menghitung Demo';end if;
 if exists(select 1 from jsonb_array_elements(r->'outlet')x where x->>'outlet_id'=o::text) then raise exception 'Grafik outlet masih memuat Demo';end if;
 if jsonb_array_length(r->'menu')<>0 then raise exception 'Grafik produk masih menghitung item Demo';end if;
 r:=laporan_operasional('transaksi',o,'2026-11-01','2026-11-01');
 if jsonb_array_length(r)<>9 then raise exception 'Riwayat Demo berubah';end if;
 perform atur_tampil_dashboard_pos(o,false,true);
 r:=ringkasan_penjualan(null,'2026-11-01','2026-11-01');
 if (r->'kpi'->>'omzet')::bigint<>1999000 or (r->'kpi'->>'trx')::int<>47 then raise exception 'ON tidak mengembalikan angka';end if;
 perform atur_tampil_dashboard_pos(o,true,false);
 ditolak:=false;
 begin perform atur_tampil_dashboard_pos(o,true,true);exception when raise_exception then ditolak:=sqlerrm like 'Pengaturan sudah berubah%';end;
 if not ditolak then raise exception 'Edit stale diterima';end if;
 r:=omzet_hari_ini();
 select coalesce(sum(t.total),0) into expected from transaksi t join outlet ol on ol.id=t.outlet_id where ol.tampil_dashboard_pos and t.mode='asli' and t.status='lunas' and t.created_at>=((now() at time zone 'Asia/Jakarta')::date::timestamp at time zone 'Asia/Jakarta') and t.created_at<=now();
 if (r->>'omzet')::bigint<>expected then raise exception 'Kartu omzet tidak sinkron';end if;
 -- Semua outlet OFF harus menghasilkan nol, bukan kembali menghitung semua outlet.
 for o in select id from outlet where mode='asli' and deleted_at is null and tampil_dashboard_pos loop perform atur_tampil_dashboard_pos(o,true,false);end loop;
 r:=ringkasan_penjualan(null,'2026-11-01','2026-11-01');
 if (r->'kpi'->>'trx')::bigint<>0 or jsonb_array_length(r->'menu')<>0 or jsonb_array_length(r->'outlet')<>0 then raise exception 'Semua OFF bocor';end if;
 r:=omzet_hari_ini();if (r->>'trx')::bigint<>0 then raise exception 'Kartu semua OFF bocor';end if;
end $test$;
reset role;
-- HRD tidak berwenang mengubah switch, walaupun mempunyai akses laporan.
select set_config('request.jwt.claim.sub',(select p.pengguna_id::text from penugasan p join pengguna u on u.id=p.pengguna_id where p.peran='hrd' and u.status='aktif' and not exists(select 1 from penugasan op where op.pengguna_id=p.pengguna_id and op.peran in ('owner','admin_pusat')) limit 1),true);
set local role authenticated;
do $test$
declare ditolak boolean:=false;
begin
 begin perform atur_tampil_dashboard_pos((select id from outlet where nama='Outlet Demo (uji coba)' and deleted_at is null),false,true);exception when raise_exception then ditolak:=sqlerrm='Tidak diizinkan';end;
 if not ditolak then raise exception 'HRD dapat mengubah switch';end if;
end $test$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $test$
declare ditolak boolean:=false;
begin
 begin perform atur_tampil_dashboard_pos(null,false,true);exception when insufficient_privilege then ditolak:=true;end;
 if not ditolak then raise exception 'Anon memiliki akses';end if;
end $test$;
reset role;
rollback;
