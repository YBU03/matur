create table public.pengaturan_dokumen_gudang (
 id boolean primary key default true check(id),
 alamat text not null check(length(trim(alamat)) between 10 and 600),
 logo_path text, versi integer not null default 0,
 updated_at timestamptz not null default now()
);
insert into public.pengaturan_dokumen_gudang(alamat) values
 ('Jl. Raya Pengalusan No.6, Kompas, Pengalusan, Kec. Mrebet, Kabupaten Purbalingga, Jawa Tengah 53352');
alter table public.pengaturan_dokumen_gudang enable row level security;
create policy baca on public.pengaturan_dokumen_gudang for select to authenticated using(
 exists(select 1 from public.pengguna where id=(select auth.uid()) and status='aktif'));
revoke all on public.pengaturan_dokumen_gudang from anon,authenticated;
grant select on public.pengaturan_dokumen_gudang to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('dokumen-gudang','dokumen-gudang',false,2097152,array['image/png','image/jpeg']);
create policy gudang_logo_baca on storage.objects for select to authenticated using(
 bucket_id='dokumen-gudang' and exists(select 1 from public.pengguna where id=(select auth.uid()) and status='aktif'));
create policy gudang_logo_tambah on storage.objects for insert to authenticated with check(
 bucket_id='dokumen-gudang' and (select gudang_internal.boleh(true)) and name ~ '^logo/[0-9a-f-]{36}\.(png|jpg)$');
create policy gudang_logo_buang on storage.objects for delete to authenticated using(
 bucket_id='dokumen-gudang' and (select gudang_internal.boleh(true)) and not exists(select 1 from public.pengaturan_dokumen_gudang g where g.logo_path=name));

create function gudang_internal.dokumen(p_alamat text,p_logo text,p_versi integer) returns void language plpgsql security definer set search_path='' as $$
declare lama public.pengaturan_dokumen_gudang;
begin
 if not gudang_internal.boleh(true) then raise exception 'Hanya admin gudang/pusat/owner aktif';end if;
 if p_alamat is null or length(trim(p_alamat)) not between 10 and 600 then raise exception 'Alamat wajib 10-600 karakter';end if;
 if p_logo is not null and (p_logo !~ '^logo/[0-9a-f-]{36}\.(png|jpg)$' or not exists(select 1 from storage.objects where bucket_id='dokumen-gudang' and name=p_logo)) then raise exception 'Logo belum berhasil diunggah';end if;
 select * into lama from public.pengaturan_dokumen_gudang where id for update;
 if p_versi is distinct from lama.versi then raise exception 'Pengaturan sudah berubah. Muat ulang dahulu';end if;
 update public.pengaturan_dokumen_gudang set alamat=trim(p_alamat),logo_path=p_logo,versi=versi+1,updated_at=now() where id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,nilai_lama,nilai_baru) values(auth.uid(),'pengaturan_dokumen_gudang','pengaturan_dokumen_gudang',to_jsonb(lama),jsonb_build_object('alamat',trim(p_alamat),'logo_path',p_logo));
end $$;
create function public.atur_dokumen_gudang(p_alamat text,p_logo text,p_versi integer) returns void language sql security invoker set search_path='' as $$select gudang_internal.dokumen(p_alamat,p_logo,p_versi)$$;

create table public.invoice_penyesuaian_gudang (
 kiriman_id uuid primary key references public.kiriman(id),
 nilai bigint not null check(nilai between -1000000000000 and 1000000000000),
 keterangan text not null check(length(keterangan)<=500 and (nilai=0 or length(trim(keterangan))>=3)),
 versi integer not null, updated_at timestamptz not null default now()
);
alter table public.invoice_penyesuaian_gudang enable row level security;
create policy baca on public.invoice_penyesuaian_gudang for select to authenticated using(
 exists(select 1 from public.kiriman k where k.id=kiriman_id));
revoke all on public.invoice_penyesuaian_gudang from anon,authenticated;
grant select on public.invoice_penyesuaian_gudang to authenticated;
create function gudang_internal.invoice(p_id uuid,p_nilai bigint,p_keterangan text,p_versi integer) returns void language plpgsql security definer set search_path='' as $$
declare k public.kiriman;lama public.invoice_penyesuaian_gudang;barang numeric;
begin
 if not gudang_internal.boleh(true) then raise exception 'Hanya admin gudang/pusat/owner aktif';end if;
 select * into k from public.kiriman where id=p_id and mode='asli' and deleted_at is null for update;
 if k.id is null or k.status<>'diterima' or k.pemeriksaan_status<>'selesai' then raise exception 'Selesaikan pemeriksaan barang dahulu sebelum penyesuaian invoice';end if;
 if p_nilai is null or abs(p_nilai::numeric)>1000000000000 or length(coalesce(p_keterangan,''))>500 or (p_nilai<>0 and length(trim(coalesce(p_keterangan,'')))<3) then raise exception 'Nilai/alasan penyesuaian tidak valid';end if;
 select coalesce(sum(round(coalesce(qty_diterima,0)*harga)),0) into barang from public.item_kiriman where kiriman_id=p_id;
 if barang+p_nilai<0 then raise exception 'Total invoice tidak boleh negatif';end if;
 select * into lama from public.invoice_penyesuaian_gudang where kiriman_id=p_id;
 if p_versi is distinct from coalesce(lama.versi,0) then raise exception 'Penyesuaian sudah berubah. Muat ulang dahulu';end if;
 insert into public.invoice_penyesuaian_gudang(kiriman_id,nilai,keterangan,versi) values(p_id,p_nilai,trim(coalesce(p_keterangan,'')),coalesce(lama.versi,0)+1)
 on conflict(kiriman_id) do update set nilai=excluded.nilai,keterangan=excluded.keterangan,versi=excluded.versi,updated_at=now();
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'penyesuaian_invoice','kiriman',p_id::text,to_jsonb(lama),jsonb_build_object('nilai',p_nilai,'keterangan',trim(coalesce(p_keterangan,''))));
end $$;
create function public.atur_penyesuaian_invoice(p_id uuid,p_nilai bigint,p_keterangan text,p_versi integer) returns void language sql security invoker set search_path='' as $$select gudang_internal.invoice(p_id,p_nilai,p_keterangan,p_versi)$$;

alter function gudang_internal.laporan(date,date,uuid,uuid) rename to laporan_barang;
revoke all on function gudang_internal.laporan_barang(date,date,uuid,uuid) from public,anon,authenticated;
create function gudang_internal.laporan(awal date,akhir date,ol uuid,bh uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare hasil jsonb;
begin
 if not gudang_internal.boleh() then raise exception 'Tidak berwenang membaca laporan gudang';end if;
 hasil:=gudang_internal.laporan_barang(awal,akhir,ol,bh);
 return hasil||jsonb_build_object('invoice',coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'nomor',k.nomor,'outlet',o.nama,'kepemilikan',coalesce(k.kepemilikan_snapshot,o.kepemilikan),'tanggal',(k.diterima_at at time zone 'Asia/Jakarta')::date,'nilai',a.nilai,'keterangan',a.keterangan)) from public.invoice_penyesuaian_gudang a join public.kiriman k on k.id=a.kiriman_id join public.outlet o on o.id=k.outlet_id where k.mode='asli' and k.deleted_at is null and k.status='diterima' and a.nilai<>0 and (k.diterima_at at time zone 'Asia/Jakarta')::date between awal and akhir and (ol is null or k.outlet_id=ol) and bh is null),'[]'::jsonb));
end $$;
revoke all on function gudang_internal.dokumen(text,text,integer),gudang_internal.invoice(uuid,bigint,text,integer),gudang_internal.laporan(date,date,uuid,uuid) from public,anon;
grant execute on function gudang_internal.dokumen(text,text,integer),gudang_internal.invoice(uuid,bigint,text,integer),gudang_internal.laporan(date,date,uuid,uuid) to authenticated;
revoke all on function public.atur_dokumen_gudang(text,text,integer),public.atur_penyesuaian_invoice(uuid,bigint,text,integer) from public,anon;
grant execute on function public.atur_dokumen_gudang(text,text,integer),public.atur_penyesuaian_invoice(uuid,bigint,text,integer) to authenticated;
