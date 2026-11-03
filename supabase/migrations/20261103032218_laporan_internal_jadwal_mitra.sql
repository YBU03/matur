-- Draft kerja tidak pernah disimpan pada tabel laporan resmi.
create table public.laporan_internal (
 outlet_id uuid not null references public.outlet(id),
 periode date not null check (extract(day from periode)=1),
 sumber text not null default 'otomatis' check(sumber in ('otomatis','manual','impor')),
 isian jsonb not null default '{}', baseline jsonb not null default '{}',
 snapshot jsonb, alasan text not null default '',
 buka_at timestamptz, updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 primary key(outlet_id,periode)
);
alter table public.laporan_internal enable row level security;
create policy kelola on public.laporan_internal for all to authenticated
 using(public.punya_peran('{owner,admin_pusat,finance}'))
 with check(public.punya_peran('{owner,admin_pusat,finance}'));
grant select,insert,update on public.laporan_internal to authenticated;
revoke all on public.laporan_internal from anon;
-- Nilai bawaan awal menjaga akses seluruh laporan lama, nilai bawaan selanjutnya tertutup.
alter table public.laporan_bulanan add column mitra_disetujui boolean not null default true,
 add column mitra_buka_at timestamptz not null default now();
alter table public.laporan_bulanan alter column mitra_disetujui set default false;
drop policy baca on public.laporan_bulanan;
create policy baca on public.laporan_bulanan for select to authenticated using (
 public.punya_peran('{owner,admin_pusat,finance}')
 or (public.peran_di_outlet(outlet_id,'{mitra}') and mitra_disetujui and mitra_buka_at <= now())
 or (public.punya_peran('{manajer_area}') and public.boleh_outlet(outlet_id))
);
-- Hanya metadata periode; tidak mengembalikan angka, nama karyawan, atau isi draft.
create function public.periode_laporan(p_outlet uuid)
returns table(periode date, laporan_id uuid, buka_at timestamptz, disetujui boolean, terbuka boolean, ada_draft boolean, sumber text)
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not (public.punya_peran('{owner,admin_pusat,finance}') or public.peran_di_outlet(p_outlet,'{mitra}') or (public.punya_peran('{manajer_area}') and public.boleh_outlet(p_outlet))) then raise exception 'Tidak diizinkan'; end if;
 return query
 with bulan as (
 select date_trunc('month',public.tgl_op(now())::timestamp)::date d
 union select l.periode from public.laporan_bulanan l where l.outlet_id=p_outlet and l.mode='asli' and l.deleted_at is null
 union select i.periode from public.laporan_internal i where i.outlet_id=p_outlet
 union select distinct date_trunc('month',public.tgl_op(t.created_at)::timestamp)::date from public.transaksi t where t.outlet_id=p_outlet and t.mode='asli' and t.status='lunas'
 union select distinct date_trunc('month',b.tanggal::timestamp)::date from public.biaya_outlet b where b.outlet_id=p_outlet and b.mode='asli' and b.deleted_at is null
 union select distinct date_trunc('month',m.tanggal::timestamp)::date from public.penjualan_manual m where m.outlet_id=p_outlet and m.mode='asli' and m.deleted_at is null
 union select distinct date_trunc('month',k.diterima_at at time zone 'Asia/Jakarta')::date from public.kiriman k where k.outlet_id=p_outlet and k.mode='asli' and k.status='diterima'
 )
 select b.d,l.id,case when l.mitra_disetujui then l.mitra_buka_at else i.buka_at end,
 coalesce(l.mitra_disetujui,false),coalesce(l.mitra_disetujui and l.mitra_buka_at<=now(),false),
 i.outlet_id is not null,coalesce(i.sumber,'otomatis')
 from bulan b left join public.laporan_bulanan l on l.outlet_id=p_outlet and l.periode=b.d and l.mode='asli' and l.deleted_at is null
 left join public.laporan_internal i on i.outlet_id=p_outlet and i.periode=b.d
 where b.d is not null order by b.d desc;
end $$;
revoke all on function public.periode_laporan(uuid) from public,anon;
grant execute on function public.periode_laporan(uuid) to authenticated;
-- Daftar staf historis berdasarkan jadwal terbit/absen bulan bersangkutan; master hanya fallback bulan berjalan.
create function public.karyawan_laporan(p_outlet uuid,p_periode date) returns table(nama text)
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat,finance}') then raise exception 'Tidak diizinkan'; end if;
 return query with staf as (
 select j.pengguna_id from public.jadwal_shift j where j.outlet_id=p_outlet and j.status='terbit' and j.tanggal>=p_periode and j.tanggal<(p_periode+interval '1 month')
 union select a.pengguna_id from public.absensi a where a.outlet_id=p_outlet and a.tanggal>=p_periode and a.tanggal<(p_periode+interval '1 month')
 ), historis as (select distinct p.nama from staf s join public.pengguna p on p.id=s.pengguna_id)
 select h.nama from historis h
 union select k.nama from public.karyawan k where not exists(select 1 from historis) and p_periode=date_trunc('month',public.tgl_op(now())::timestamp)::date and k.outlet_id=p_outlet and k.mode='asli' and k.status='aktif' and k.deleted_at is null
 order by 1;
end $$;
revoke all on function public.karyawan_laporan(uuid,date) from public,anon;
grant execute on function public.karyawan_laporan(uuid,date) to authenticated;

-- Satu transaksi: kunci draft dan bekukan versi resmi; jangan pernah membuka draft secara langsung.
create function public.setujui_laporan_mitra(p_outlet uuid,p_periode date,p_versi timestamptz,p_ganti boolean default false) returns uuid
language plpgsql security invoker set search_path=public as $$
declare d public.laporan_internal; hasil uuid;
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat,finance}') then raise exception 'Tidak diizinkan'; end if;
 select * into d from public.laporan_internal where outlet_id=p_outlet and periode=p_periode for update;
 if not found or d.updated_at<>p_versi then raise exception 'Draft berubah. Muat ulang dan periksa kembali.'; end if;
 if d.buka_at is null or d.snapshot is null then raise exception 'Simpan laporan dan tentukan jadwal buka terlebih dahulu.'; end if;
 if not p_ganti and exists(select 1 from public.laporan_bulanan where outlet_id=p_outlet and periode=p_periode and mode='asli' and deleted_at is null) then raise exception 'Laporan resmi sudah ada. Konfirmasi revisi terlebih dahulu.'; end if;
 insert into public.laporan_bulanan
 select (jsonb_populate_record(null::public.laporan_bulanan,d.snapshot || jsonb_build_object('id',gen_random_uuid(),'outlet_id',p_outlet,'periode',p_periode,'mode','asli','created_at',now(),'deleted_at',null,'mitra_disetujui',true,'mitra_buka_at',d.buka_at))).*
 on conflict(outlet_id,periode,mode) do update set
 nama_outlet=excluded.nama_outlet,
 mitra=excluded.mitra,
 pj_laporan=excluded.pj_laporan,
 karyawan=excluded.karyawan,
 modal_awal=excluded.modal_awal,
 persediaan_awal=excluded.persediaan_awal,
 pembelian=excluded.pembelian,
 persediaan_akhir=excluded.persediaan_akhir,
 pendapatan=excluded.pendapatan,
 diskon=excluded.diskon,
 persen_sedekah=excluded.persen_sedekah,
 sedekah=excluded.sedekah,
 beban=excluded.beban,
 bagi_hasil=excluded.bagi_hasil,
 transfer=excluded.transfer,
 tgl_terbit=excluded.tgl_terbit,
 kota_terbit=excluded.kota_terbit,
 penandatangan=excluded.penandatangan,
 jabatan_penandatangan=excluded.jabatan_penandatangan,
 catatan=excluded.catatan,
 laba_bersih=excluded.laba_bersih,
 tagihan_titipan=excluded.tagihan_titipan,
 rincian_titipan=excluded.rincian_titipan, mitra_disetujui=true,mitra_buka_at=excluded.mitra_buka_at,deleted_at=null
 returning id into hasil;
 return hasil;
end $$;
revoke all on function public.setujui_laporan_mitra(uuid,date,timestamptz,boolean) from public,anon;
grant execute on function public.setujui_laporan_mitra(uuid,date,timestamptz,boolean) to authenticated;
create function public.simpan_laporan_internal(p_data jsonb,p_versi timestamptz) returns timestamptz
language plpgsql security invoker set search_path=public as $$
declare hasil timestamptz; o uuid := (p_data->>'outlet_id')::uuid; p date := (p_data->>'periode')::date;
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat,finance}') then raise exception 'Tidak diizinkan'; end if;
 if (p_data->'snapshot'->>'outlet_id')::uuid<>o or (p_data->'snapshot'->>'periode')::date<>p then raise exception 'Outlet/periode tidak cocok'; end if;
 insert into public.laporan_internal(outlet_id,periode,sumber,isian,baseline,snapshot,alasan,buka_at,updated_at,updated_by)
 values(o,p,p_data->>'sumber',p_data->'isian',p_data->'baseline',p_data->'snapshot',coalesce(p_data->>'alasan',''),(p_data->>'buka_at')::timestamptz,clock_timestamp(),auth.uid())
 on conflict(outlet_id,periode) do update set sumber=excluded.sumber,isian=excluded.isian,baseline=excluded.baseline,snapshot=excluded.snapshot,alasan=excluded.alasan,buka_at=excluded.buka_at,updated_at=excluded.updated_at,updated_by=excluded.updated_by
 where laporan_internal.updated_at=p_versi returning updated_at into hasil;
 if hasil is null then raise exception 'Draft sudah diubah pengguna lain. Muat ulang sebelum menyimpan.'; end if;
 return hasil;
end $$;
revoke all on function public.simpan_laporan_internal(jsonb,timestamptz) from public,anon;
grant execute on function public.simpan_laporan_internal(jsonb,timestamptz) to authenticated;
