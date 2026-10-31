-- Laporan Pergerakan Stok Gudang & Smart Forecast (hanya membaca mutasi_stok/stok; satu setelan buffer).
create table public.pengaturan_gudang (
 id boolean primary key default true check(id),
 buffer_forecast numeric(5,2) not null default 10 check(buffer_forecast between 0 and 200),
 updated_at timestamptz not null default now()
);
insert into public.pengaturan_gudang default values;
alter table public.pengaturan_gudang enable row level security;
create policy baca on public.pengaturan_gudang for select to authenticated using(
 exists(select 1 from public.pengguna where id=(select auth.uid()) and status='aktif'));
revoke all on public.pengaturan_gudang from anon,authenticated;
grant select on public.pengaturan_gudang to authenticated;

create schema if not exists gudang_internal;

create function gudang_internal.boleh_lihat_stok() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.punya_peran('{owner,admin_pusat,admin_gudang,finance}')
$$;

-- Pergerakan stok Gudang (outlet_id null) per hari/minggu (Senin)/bulan dalam rentang WIB, plus stok awal & akhir.
create function gudang_internal.pergerakan(p_awal date,p_akhir date,p_grain text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare mulai timestamptz; selesai timestamptz;
begin
 if not gudang_internal.boleh_lihat_stok() then raise exception 'Tidak berwenang melihat pergerakan stok';end if;
 if p_awal is null or p_akhir is null or p_akhir<p_awal or p_akhir-p_awal>366 then raise exception 'Rentang tanggal tidak valid (maks. 1 tahun)';end if;
 if p_grain not in ('hari','minggu','bulan') then raise exception 'Pilih harian, mingguan atau bulanan';end if;
 if p_grain='hari' and p_akhir-p_awal>92 then raise exception 'Tampilan harian maksimal 3 bulan';end if;
 mulai:=(p_awal::timestamp at time zone 'Asia/Jakarta');
 selesai:=((p_akhir+1)::timestamp at time zone 'Asia/Jakarta');
 return jsonb_build_object(
  'periode',coalesce((select jsonb_agg(jsonb_build_object('p',p,'b',bahan_id,'masuk',masuk,'keluar',keluar,'waste',waste,'sesuai',sesuai,'lain',lain) order by p) from (
   select (date_trunc(case p_grain when 'hari' then 'day' when 'minggu' then 'week' else 'month' end,(m.created_at at time zone 'Asia/Jakarta')))::date p,m.bahan_id,
    coalesce(sum(m.jumlah) filter (where m.jenis='pembelian'),0) masuk,
    coalesce(-sum(m.jumlah) filter (where m.jenis='kiriman_keluar'),0) keluar,
    coalesce(-sum(m.jumlah) filter (where m.jenis='waste'),0) waste,
    coalesce(sum(m.jumlah) filter (where m.jenis in ('opname','koreksi')),0) sesuai,
    coalesce(sum(m.jumlah) filter (where m.jenis not in ('pembelian','kiriman_keluar','waste','opname','koreksi')),0) lain
   from public.mutasi_stok m where m.mode='asli' and m.outlet_id is null and m.created_at>=mulai and m.created_at<selesai
   group by 1,2) x),'[]'),
  'saldo',coalesce((select jsonb_object_agg(s.bahan_id::text,jsonb_build_array(
    s.jumlah-coalesce((select sum(m.jumlah) from public.mutasi_stok m where m.mode='asli' and m.outlet_id is null and m.bahan_id=s.bahan_id and m.created_at>=mulai),0),
    s.jumlah-coalesce((select sum(m.jumlah) from public.mutasi_stok m where m.mode='asli' and m.outlet_id is null and m.bahan_id=s.bahan_id and m.created_at>=selesai),0)))
   from public.stok s where s.mode='asli' and s.outlet_id is null),'{}'));
end $$;

-- Data forecast: per bulan (WIB) kiriman Gudang→outlet & pemakaian bahan dari penjualan POS, stok sekarang, awal data.
create function gudang_internal.forecast(p_outlet uuid,p_bulan integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare mulai timestamptz;
begin
 if not gudang_internal.boleh_lihat_stok() then raise exception 'Tidak berwenang melihat forecast';end if;
 if p_bulan is null or p_bulan not between 1 and 12 then raise exception 'Jumlah bulan 1-12';end if;
 mulai:=((date_trunc('month',now() at time zone 'Asia/Jakarta')-make_interval(months=>p_bulan))::timestamp at time zone 'Asia/Jakarta');
 return jsonb_build_object(
  'bulan',coalesce((select jsonb_agg(jsonb_build_object('p',p,'b',bahan_id,'kirim',kirim,'pakai',pakai) order by p) from (
   select (date_trunc('month',m.created_at at time zone 'Asia/Jakarta'))::date p,m.bahan_id,
    coalesce(-sum(m.jumlah) filter (where m.outlet_id is null and m.jenis='kiriman_keluar'
      and (p_outlet is null or exists(select 1 from public.kiriman k where k.id=m.ref_id and k.outlet_id=p_outlet))),0) kirim,
    coalesce(-sum(m.jumlah) filter (where m.outlet_id is not null and m.jenis in ('pemakaian','void','marketing')
      and (p_outlet is null or m.outlet_id=p_outlet)),0) pakai
   from public.mutasi_stok m where m.mode='asli' and m.created_at>=mulai
   group by 1,2) x where kirim<>0 or pakai<>0),'[]'),
  'stok_gudang',coalesce((select jsonb_object_agg(bahan_id::text,jumlah) from public.stok where mode='asli' and outlet_id is null),'{}'),
  'stok_outlet',coalesce((select jsonb_object_agg(bahan_id::text,j) from (select bahan_id,sum(jumlah) j from public.stok
     where mode='asli' and outlet_id is not null and (p_outlet is null or outlet_id=p_outlet) group by 1) z),'{}'),
  'awal_data',(select min((created_at at time zone 'Asia/Jakarta')::date) from public.mutasi_stok where mode='asli'
     and ((outlet_id is null and jenis='kiriman_keluar') or (outlet_id is not null and jenis in ('pemakaian','void','marketing')))),
  'hari_ini',(now() at time zone 'Asia/Jakarta')::date,
  'buffer',(select buffer_forecast from public.pengaturan_gudang where id));
end $$;

create function gudang_internal.atur_buffer(p_persen numeric) returns void language plpgsql security definer set search_path='' as $$
declare lama numeric;
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat,admin_gudang}') then raise exception 'Hanya Owner/Admin Pusat/Admin Gudang yang dapat mengubah buffer';end if;
 if p_persen is null or p_persen<0 or p_persen>200 then raise exception 'Buffer 0-200%%';end if;
 select buffer_forecast into lama from public.pengaturan_gudang where id for update;
 update public.pengaturan_gudang set buffer_forecast=round(p_persen,2),updated_at=now() where id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,nilai_lama,nilai_baru) values(auth.uid(),'buffer_forecast','pengaturan_gudang',to_jsonb(lama),to_jsonb(round(p_persen,2)));
end $$;

revoke all on function gudang_internal.boleh_lihat_stok(),gudang_internal.pergerakan(date,date,text),gudang_internal.forecast(uuid,integer),gudang_internal.atur_buffer(numeric) from public,anon;
grant execute on function gudang_internal.boleh_lihat_stok(),gudang_internal.pergerakan(date,date,text),gudang_internal.forecast(uuid,integer),gudang_internal.atur_buffer(numeric) to authenticated;
create function public.pergerakan_stok_gudang(p_awal date,p_akhir date,p_grain text) returns jsonb language sql stable security invoker set search_path='' as $$select gudang_internal.pergerakan(p_awal,p_akhir,p_grain)$$;
create function public.forecast_stok(p_outlet uuid,p_bulan integer) returns jsonb language sql stable security invoker set search_path='' as $$select gudang_internal.forecast(p_outlet,p_bulan)$$;
create function public.atur_buffer_forecast(p_persen numeric) returns void language sql security invoker set search_path='' as $$select gudang_internal.atur_buffer(p_persen)$$;
revoke all on function public.pergerakan_stok_gudang(date,date,text),public.forecast_stok(uuid,integer),public.atur_buffer_forecast(numeric) from public,anon;
grant execute on function public.pergerakan_stok_gudang(date,date,text),public.forecast_stok(uuid,integer),public.atur_buffer_forecast(numeric) to authenticated;
