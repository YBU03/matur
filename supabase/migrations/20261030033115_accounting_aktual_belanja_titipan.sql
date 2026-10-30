-- Internet adalah kategori beban yang dapat dipilih kasir.
update public.kategori_biaya set harian=true where nama='Biaya Internet/Wifi';

create table public.revisi_aktual_kas(
 id uuid primary key default gen_random_uuid(),sesi_id uuid not null references public.sesi_kas(id),
 lama bigint,baru bigint not null,alasan text not null,pengguna_id uuid not null references public.pengguna(id),
 nama text not null,created_at timestamptz not null default now()
);
create index on public.revisi_aktual_kas(sesi_id,created_at);
alter table public.revisi_aktual_kas enable row level security;
create policy baca on public.revisi_aktual_kas for select to authenticated using(public.punya_peran('{owner,admin_pusat,finance}'));
revoke all on public.revisi_aktual_kas from anon,authenticated;
grant select on public.revisi_aktual_kas to authenticated;
create function operasional_outlet_internal.revisi_aktual(p jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s sesi_kas;v bigint:=(p->>'aktual')::bigint;lama bigint;
begin
 if auth.uid() is null or not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Accounting/Owner/Admin Pusat';end if;
 if v is null or v<0 or v>1000000000000 or length(trim(coalesce(p->>'alasan','')))<3 then raise exception 'Isi nominal valid dan alasan revisi';end if;
 select * into s from sesi_kas where id=(p->>'sesi_id')::uuid for update;
 if s.id is null or s.mode<>'asli' or s.ditutup_at is null then raise exception 'Pilih kas asli yang sudah ditutup';end if;
 if coalesce(s.pending_offline,0)>0 then raise exception 'Tunggu transaksi offline selesai disinkronkan';end if;
 lama:=case when s.pos_tim then s.fisik_akhir else s.setoran end;
 if lama is distinct from (p->>'sebelum')::bigint then raise exception 'Angka sudah berubah. Muat ulang sebelum revisi';end if;
 if lama is not distinct from v then return;end if;
 insert into revisi_aktual_kas(sesi_id,lama,baru,alasan,pengguna_id,nama) values(s.id,lama,v,left(trim(p->>'alasan'),500),auth.uid(),coalesce((select nama from pengguna where id=auth.uid()),'Accounting'));
 update sesi_kas set fisik_akhir=case when s.pos_tim then v else fisik_akhir end,
 setoran=case when s.pos_tim then v-s.modal_laci else v end,
 selisih=case when s.pos_tim then v-s.kas_seharusnya else v-s.seharusnya end where id=s.id;
end $$;
create function public.revisi_aktual_kas(p jsonb) returns void language sql security invoker set search_path='' as $$select operasional_outlet_internal.revisi_aktual(p)$$;

-- Pembelian langsung: biaya dicatat sekali, penerimaan tersendiri menambah stok sekali.
create table public.belanja_bahan_outlet(
 id uuid primary key default gen_random_uuid(),biaya_id uuid not null unique references public.biaya_outlet(id),
 outlet_id uuid not null references public.outlet(id),items jsonb not null,hasil jsonb,
 dibuat_oleh uuid not null references public.pengguna(id),created_at timestamptz not null default now(),
 diterima_at timestamptz,diterima_oleh uuid references public.pengguna(id),nama_penerima text,catatan text
);
create index on public.belanja_bahan_outlet(outlet_id,created_at);
alter table public.belanja_bahan_outlet enable row level security;
create policy baca on public.belanja_bahan_outlet for select to authenticated using(public.punya_peran('{owner,admin_pusat,finance,admin_gudang}') or public.peran_di_outlet(outlet_id,'{kasir,barista,spv}'));
revoke all on public.belanja_bahan_outlet from anon,authenticated;
grant select on public.belanja_bahan_outlet to authenticated;
create function operasional_outlet_internal.belanja_bahan(p jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare bid uuid;x jsonb;b bahan;isi jsonb:='[]';r belanja_bahan_outlet;q numeric;
begin
 -- Otorisasi, tanggal, kas dan idempotensi uang memakai jalur POS yang sama.
 bid:=operasional_outlet_internal.catat_pengeluaran_pos(p);
 if not exists(select 1 from biaya_outlet bo join kategori_biaya k on k.id=bo.kategori_id where bo.id=bid and k.nama='Bahan Baku' and bo.deleted_at is null) then raise exception 'Rincian bahan hanya untuk pembelian Bahan Baku aktif';end if;
 if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 100 then raise exception 'Isi 1–100 bahan pembelian';end if;
 if exists(select 1 from jsonb_array_elements(p->'items') z group by z->>'bahan_id' having count(*)>1) then raise exception 'Bahan berulang';end if;
 for x in select * from jsonb_array_elements(p->'items') loop
  select * into b from bahan where id=(x->>'bahan_id')::uuid and mode='asli' and deleted_at is null;
  q:=(x->>'qty')::numeric;
  if b.id is null or q is null or q<=0 or q>999999999 or q<>round(q,3) or q::text in ('NaN','Infinity','-Infinity') then raise exception 'Bahan atau jumlah tidak valid';end if;
  isi:=isi||jsonb_build_array(jsonb_build_object('bahan_id',b.id,'nama',b.nama,'satuan',b.satuan_pakai,'qty',q));
 end loop;
 select * into r from belanja_bahan_outlet where biaya_id=bid;
 if r.id is not null then
  if r.items<>isi then raise exception 'Pembelian sudah tersimpan dengan rincian berbeda';end if;
  return r.id;
 end if;
 insert into belanja_bahan_outlet(biaya_id,outlet_id,items,dibuat_oleh) values(bid,(p->>'outlet_id')::uuid,isi,auth.uid()) returning id into bid;
 return bid;
end $$;
create function public.catat_belanja_bahan(p jsonb) returns uuid language sql security invoker set search_path='' as $$select operasional_outlet_internal.belanja_bahan(p)$$;
create function operasional_outlet_internal.terima_belanja(p jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r belanja_bahan_outlet;x jsonb;y jsonb;hasil jsonb:='[]';q numeric;
begin
 select * into r from belanja_bahan_outlet where id=(p->>'id')::uuid for update;
 if auth.uid() is null or r.id is null or not (punya_peran('{owner,admin_pusat}') or peran_di_outlet(r.outlet_id,'{kasir,barista,spv}')) then raise exception 'Penerimaan hanya oleh petugas outlet terkait';end if;
 if r.diterima_at is not null then
  if r.hasil is distinct from p->'items' or coalesce(r.catatan,'')<>coalesce(left(trim(p->>'catatan'),500),'') then raise exception 'Penerimaan sudah dikonfirmasi dengan hasil berbeda';end if;
  return;
 end if;
 perform 1 from biaya_outlet where id=r.biaya_id and deleted_at is null for update;
 if not found then raise exception 'Pengeluaran sudah dihapus';end if;
 if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items')<>jsonb_array_length(r.items) or exists(select 1 from jsonb_array_elements(p->'items') z group by z->>'bahan_id' having count(*)>1) then raise exception 'Periksa seluruh bahan tanpa duplikasi';end if;
 for x in select * from jsonb_array_elements(r.items) order by value->>'bahan_id' loop
  select value into y from jsonb_array_elements(p->'items') where value->>'bahan_id'=x->>'bahan_id';q:=(y->>'qty')::numeric;
  if q is null or q<0 or q>(x->>'qty')::numeric or q<>round(q,3) or q::text in ('NaN','Infinity','-Infinity') then raise exception 'Jumlah diterima harus 0 sampai jumlah dibeli';end if;
  if q<>(x->>'qty')::numeric and length(trim(coalesce(p->>'catatan','')))<3 then raise exception 'Catat alasan barang kurang/rusak/tidak sesuai';end if;
  if q>0 then perform geser_stok('asli',r.outlet_id,(x->>'bahan_id')::uuid,q,'pembelian',r.id,'Penerimaan pembelian langsung');end if;
 end loop;
 update belanja_bahan_outlet set hasil=p->'items',diterima_at=now(),diterima_oleh=auth.uid(),nama_penerima=(select nama from pengguna where id=auth.uid()),catatan=left(trim(p->>'catatan'),500) where id=r.id;
end $$;
create function public.terima_belanja_bahan(p jsonb) returns void language sql security invoker set search_path='' as $$select operasional_outlet_internal.terima_belanja(p)$$;
create function operasional_outlet_internal.jaga_belanja() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if exists(select 1 from belanja_bahan_outlet where biaya_id=old.id) and (tg_op='DELETE' or new.jumlah is distinct from old.jumlah or new.kategori_id is distinct from old.kategori_id or new.outlet_id is distinct from old.outlet_id or new.tanggal is distinct from old.tanggal or new.deleted_at is distinct from old.deleted_at or new.mode is distinct from old.mode) then raise exception 'Pembelian terkait penerimaan: nominal, kategori, tanggal dan penghapusannya dilindungi. Gunakan koreksi terpisah agar riwayat stok tetap cocok.';end if;
 return new;end $$;
create trigger jaga_belanja before update or delete on public.biaya_outlet for each row execute function operasional_outlet_internal.jaga_belanja();

-- Rentang inklusif; stok awal mencakup seluruh pergerakan sebelum periode.
create function operasional_outlet_internal.titipan_rentang(o uuid,a date,b date) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare hasil jsonb;
begin
 if auth.uid() is null or not boleh_outlet(o) then raise exception 'Tidak diizinkan';end if;
 if a is null or b is null or b<a or b-a>366 then raise exception 'Rentang tanggal tidak valid';end if;
 with m as (select * from menu where titipan and mode='asli' and deleted_at is null),
 jual as (
 select i.menu_id,(t.created_at at time zone 'Asia/Jakarta')::date tanggal,i.qty from item_transaksi i join transaksi t on t.id=i.transaksi_id where t.outlet_id=o and t.mode='asli' and t.status='lunas' and t.created_at<((b+1)::timestamp at time zone 'Asia/Jakarta')
 union all
 select (x->>'menu_id')::uuid,pk.tanggal,(x->>'qty')::int from produk_keluar pk cross join jsonb_array_elements(pk.items) x where pk.outlet_id=o and pk.mode='asli' and pk.deleted_at is null and pk.tanggal<=b),
 j as (select menu_id,coalesce(sum(qty) filter(where tanggal<a),0) awal,coalesce(sum(qty) filter(where tanggal>=a),0) periode from jual group by menu_id),
 ms as (select menu_id,coalesce(sum(qty) filter(where tanggal<a),0) awal,coalesce(sum(qty) filter(where tanggal>=a and qty>0),0) masuk,coalesce(-sum(qty) filter(where tanggal>=a and qty<0),0) keluar from titipan_masuk where outlet_id=o and tanggal<=b group by menu_id)
 select coalesce(jsonb_agg(jsonb_build_object('menu_id',m.id,'nama',m.nama,'produsen',coalesce(m.produsen,'-'),'harga',m.harga_titip,'awal',coalesce(ms.awal,0)-coalesce(j.awal,0),'masuk',coalesce(ms.masuk,0),'keluar',coalesce(ms.keluar,0),'terjual',coalesce(j.periode,0),'sisa',coalesce(ms.awal,0)+coalesce(ms.masuk,0)-coalesce(ms.keluar,0)-coalesce(j.awal,0)-coalesce(j.periode,0),'tagihan',coalesce(j.periode,0)*m.harga_titip) order by m.produsen,m.nama),'[]') into hasil from m left join ms on ms.menu_id=m.id left join j on j.menu_id=m.id;
 return hasil;
end $$;
create function public.rekap_titipan_rentang(p_outlet uuid,p_awal date,p_akhir date) returns jsonb language sql security invoker set search_path='' as $$select operasional_outlet_internal.titipan_rentang(p_outlet,p_awal,p_akhir)$$;
revoke all on function operasional_outlet_internal.revisi_aktual(jsonb),operasional_outlet_internal.belanja_bahan(jsonb),operasional_outlet_internal.terima_belanja(jsonb),operasional_outlet_internal.jaga_belanja(),operasional_outlet_internal.titipan_rentang(uuid,date,date) from public,anon,authenticated;
grant execute on function operasional_outlet_internal.revisi_aktual(jsonb),operasional_outlet_internal.belanja_bahan(jsonb),operasional_outlet_internal.terima_belanja(jsonb),operasional_outlet_internal.titipan_rentang(uuid,date,date) to authenticated;
revoke all on function public.revisi_aktual_kas(jsonb),public.catat_belanja_bahan(jsonb),public.terima_belanja_bahan(jsonb),public.rekap_titipan_rentang(uuid,date,date) from public,anon;
grant execute on function public.revisi_aktual_kas(jsonb),public.catat_belanja_bahan(jsonb),public.terima_belanja_bahan(jsonb),public.rekap_titipan_rentang(uuid,date,date) to authenticated;
