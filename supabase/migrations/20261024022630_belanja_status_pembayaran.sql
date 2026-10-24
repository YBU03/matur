-- Riwayat koreksi pembayaran dipertahankan; nota DP tidak dianggap pesanan lunas.
alter table public.belanja_proyek add column nota_dp boolean not null default false;
alter table public.belanja_proyek_bayar
 add column batal_at timestamptz,
 add column alasan_batal text,
 add column dibatalkan_oleh uuid references public.pengguna,
 add column nama_pembatal text;
create index belanja_bayar_koreksi_oleh on public.belanja_proyek_bayar(dibatalkan_oleh) where dibatalkan_oleh is not null;
alter table public.belanja_proyek_bayar add constraint belanja_koreksi_lengkap check (
 (batal_at is null and alasan_batal is null and dibatalkan_oleh is null and nama_pembatal is null)
 or (batal_at is not null and alasan_batal is not null and length(trim(alasan_batal))>=5 and dibatalkan_oleh is not null and nama_pembatal is not null)
);

create or replace function proyek_internal.bayar_belanja(p_id uuid,p_belanja uuid,p_versi timestamptz,p_data jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare b public.belanja_proyek; jumlah_bayar bigint; terbayar bigint; u uuid:=auth.uid(); nama text;
begin
 if u is null or not coalesce(public.admin_proyek(),false) then raise exception 'Hanya Owner/Admin Pusat';end if;
 select * into b from public.belanja_proyek where id=p_belanja for update;
 if not found or b.batal_at is not null or not exists(select 1 from public.proyek where id=b.proyek_id and deleted_at is null) then raise exception 'Nota tidak tersedia';end if;
 if exists(select 1 from public.belanja_proyek_bayar where id=p_id and batal_at is not null) then raise exception 'Pembayaran sudah dikoreksi. Buat catatan pembayaran baru';end if;
 -- Retry dengan ID pembayaran yang sama tidak menggandakan pembayaran.
 if exists(select 1 from public.belanja_proyek_bayar where id=p_id and belanja_id=p_belanja and dibuat_oleh=u and tanggal=(p_data->>'tanggal')::date and jumlah=(p_data->>'jumlah')::bigint and sumber=p_data->>'sumber' and metode=p_data->>'metode' and coalesce(catatan,'')=coalesce(p_data->>'catatan','')) then return;end if;
 if b.updated_at is distinct from p_versi then raise exception 'Nota sudah berubah. Muat ulang sebelum mencatat pembayaran';end if;
 jumlah_bayar:=(p_data->>'jumlah')::bigint;
 if jumlah_bayar is null or jumlah_bayar<=0 or jumlah_bayar>1000000000000 or p_data->>'tanggal' is null then raise exception 'Tanggal dan nominal pembayaran wajib diisi';end if;
 if (p_data->>'tanggal')::date<b.tanggal then raise exception 'Tanggal pembayaran tidak boleh sebelum tanggal nota';end if;
 select coalesce(sum(jumlah),0) into terbayar from public.belanja_proyek_bayar where belanja_id=p_belanja and batal_at is null;
 if terbayar+jumlah_bayar>b.total then raise exception 'Pembayaran melebihi sisa tagihan';end if;
 select p.nama into nama from public.pengguna p where p.id=u and p.status='aktif';
 if nama is null then raise exception 'Akun tidak aktif';end if;
 insert into public.belanja_proyek_bayar(id,belanja_id,tanggal,jumlah,sumber,metode,catatan,dibuat_oleh,nama_pencatat)
 values(p_id,p_belanja,(p_data->>'tanggal')::date,jumlah_bayar,p_data->>'sumber',p_data->>'metode',nullif(left(p_data->>'catatan',1000),''),u,nama);
 update public.belanja_proyek set updated_at=clock_timestamp() where id=p_belanja;
end $$;

create or replace function proyek_internal.simpan_belanja(p_id uuid,p_proyek uuid,p_versi timestamptz,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.belanja_proyek; r public.item_rab; item jsonb; v_total numeric:=0; v_qty numeric; v_harga bigint; v_tgl date;
 v_rab uuid; v_nama text; v_kategori text; v_satuan text; no_urut int:=0; u uuid:=auth.uid(); nama text; versi timestamptz; bayar bigint;
begin
 if u is null or not coalesce(public.admin_proyek(),false) then raise exception 'Hanya Owner/Admin Pusat';end if;
 select p.nama into nama from public.pengguna p where p.id=u and p.status='aktif';
 if nama is null then raise exception 'Akun tidak aktif';end if;
 perform id from public.proyek where id=p_proyek and deleted_at is null for update;
 if not found then raise exception 'Proyek tidak tersedia';end if;
 select * into b from public.belanja_proyek where id=p_id for update;
 if found then
  if b.proyek_id<>p_proyek or b.batal_at is not null then raise exception 'Nota tidak tersedia';end if;
  if p_versi is null and b.dibuat_oleh=u and b.permintaan_awal=p_data then return p_id;end if;
  if b.updated_at is distinct from p_versi then raise exception 'Nota sudah berubah. Muat ulang sebelum menyimpan';end if;
 elsif p_versi is not null then raise exception 'Nota tidak ditemukan';end if;
 v_tgl:=(p_data->>'tanggal')::date;
 if v_tgl is null or nullif(trim(p_data->>'toko'),'') is null or nullif(trim(p_data->>'penanggung_jawab'),'') is null then raise exception 'Tanggal, toko/penerima dan penanggung jawab wajib diisi';end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' then raise exception 'Isi rincian belanja';end if;
 if jsonb_array_length(p_data->'items') not between 1 and 200 then raise exception 'Isi 1 sampai 200 barang per nota';end if;
 if nullif(p_data->>'nota_path','') is not null and (p_data->>'nota_path') !~ ('^'||p_proyek::text||'/belanja/'||p_id::text||'/[a-f0-9-]+\.(jpg|png|webp|pdf)$') then raise exception 'Lokasi nota tidak valid';end if;
 if nullif(p_data->>'nota_path','') is not null and not exists(select 1 from storage.objects where bucket_id='proyek' and name=p_data->>'nota_path') then raise exception 'Bukti nota belum terunggah';end if;
 for item in select value from jsonb_array_elements(p_data->'items') loop
  v_qty:=(item->>'qty')::numeric;v_harga:=(item->>'harga_satuan')::bigint;
  if v_qty is null or v_qty<=0 or v_qty>1000000 or v_qty<>round(v_qty,3) or v_harga is null or v_harga<0 or v_harga>1000000000000 or round(v_qty*v_harga)>1000000000000 then raise exception 'Jumlah atau harga barang tidak valid (maksimal 3 desimal untuk jumlah)';end if;
  v_rab:=nullif(item->>'item_rab_id','')::uuid;
  if v_rab is not null then
   select * into r from public.item_rab where id=v_rab and proyek_id=p_proyek and deleted_at is null for share;
   if not found then raise exception 'Barang RAB tidak tersedia pada proyek ini';end if;
  elsif nullif(trim(item->>'nama'),'') is null then raise exception 'Nama barang manual wajib diisi';end if;
  v_total:=v_total+round(v_qty*v_harga);
 end loop;
 if v_total<=0 or v_total>1000000000000 then raise exception 'Total nota harus lebih dari nol dan maksimal 1 triliun';end if;
 select coalesce(sum(jumlah),0) into bayar from public.belanja_proyek_bayar where belanja_id=p_id and batal_at is null;
 if bayar>v_total then raise exception 'Total nota tidak boleh lebih kecil dari pembayaran tercatat';end if;
 if exists(select 1 from public.belanja_proyek_bayar where belanja_id=p_id and batal_at is null and tanggal<v_tgl) then raise exception 'Tanggal nota melewati pembayaran yang sudah tercatat';end if;
 if b.id is null then
  insert into public.belanja_proyek(id,proyek_id,tanggal,toko,nomor_nota,penanggung_jawab,catatan,nota_path,total,dibuat_oleh,nama_pencatat,permintaan_awal,nota_dp)
  values(p_id,p_proyek,v_tgl,trim(p_data->>'toko'),nullif(left(trim(p_data->>'nomor_nota'),100),''),trim(p_data->>'penanggung_jawab'),nullif(left(p_data->>'catatan',2000),''),nullif(p_data->>'nota_path',''),v_total,u,nama,p_data,coalesce((p_data->>'nota_dp')::boolean,false));
 else
  update public.belanja_proyek set tanggal=v_tgl,toko=trim(p_data->>'toko'),nomor_nota=nullif(left(trim(p_data->>'nomor_nota'),100),''),penanggung_jawab=trim(p_data->>'penanggung_jawab'),catatan=nullif(left(p_data->>'catatan',2000),''),nota_path=nullif(p_data->>'nota_path',''),total=v_total,nota_dp=coalesce((p_data->>'nota_dp')::boolean,false),updated_at=clock_timestamp() where id=p_id;
  delete from public.belanja_proyek_item where belanja_id=p_id;
 end if;
 for item in select value from jsonb_array_elements(p_data->'items') loop
  no_urut:=no_urut+1;v_rab:=nullif(item->>'item_rab_id','')::uuid;
  if v_rab is not null then
   select * into r from public.item_rab where id=v_rab;
   v_nama:=r.nama;v_kategori:=r.kategori;v_satuan:=r.satuan;
  else
   v_nama:=trim(item->>'nama');v_kategori:=coalesce(nullif(trim(item->>'kategori'),''),'Lainnya');v_satuan:=nullif(left(trim(item->>'satuan'),40),'');
  end if;
  insert into public.belanja_proyek_item(belanja_id,item_rab_id,nama,kategori,satuan,qty,harga_satuan,urutan)
  values(p_id,v_rab,left(v_nama,200),left(v_kategori,100),v_satuan,(item->>'qty')::numeric,(item->>'harga_satuan')::bigint,no_urut);
 end loop;
 if b.id is null and coalesce((p_data->'pembayaran'->>'jumlah')::bigint,0)>0 then
  select updated_at into versi from public.belanja_proyek where id=p_id;
  perform proyek_internal.bayar_belanja((p_data->'pembayaran'->>'id')::uuid,p_id,versi,p_data->'pembayaran');
 end if;
 return p_id;
end $$;

create or replace function proyek_internal.batalkan_belanja(p_id uuid,p_versi timestamptz,p_alasan text)
returns void language plpgsql security definer set search_path='' as $$
declare b public.belanja_proyek;
begin
 if auth.uid() is null or not coalesce(public.admin_proyek(),false) then raise exception 'Hanya Owner/Admin Pusat';end if;
 select * into b from public.belanja_proyek where id=p_id for update;
 if not found or b.batal_at is not null then raise exception 'Nota tidak tersedia';end if;
 if b.updated_at is distinct from p_versi then raise exception 'Nota sudah berubah. Muat ulang';end if;
 if length(trim(coalesce(p_alasan,'')))<5 then raise exception 'Isi alasan pembatalan minimal 5 karakter';end if;
 if exists(select 1 from public.belanja_proyek_bayar where belanja_id=p_id and batal_at is null) then raise exception 'Nota dengan pembayaran tidak dapat dibatalkan agar saldo tidak berubah tanpa pengembalian dana';end if;
 update public.belanja_proyek set batal_at=clock_timestamp(),alasan_batal=left(trim(p_alasan),1000),updated_at=clock_timestamp() where id=p_id;
end $$;

create function proyek_internal.koreksi_bayar_belanja(p_id uuid,p_belanja uuid,p_versi timestamptz,p_alasan text)
returns void language plpgsql security definer set search_path='' as $$
declare b public.belanja_proyek; x public.belanja_proyek_bayar; u uuid:=auth.uid(); nama text;
begin
 if u is null or not coalesce(public.admin_proyek(),false) then raise exception 'Hanya Owner/Admin Pusat';end if;
 select p.nama into nama from public.pengguna p where p.id=u and p.status='aktif';
 if nama is null then raise exception 'Akun tidak aktif';end if;
 if length(trim(coalesce(p_alasan,'')))<5 then raise exception 'Isi alasan koreksi minimal 5 karakter';end if;
 select * into b from public.belanja_proyek where id=p_belanja for update;
 if not found or b.batal_at is not null or not exists(select 1 from public.proyek where id=b.proyek_id and deleted_at is null) then raise exception 'Nota tidak tersedia';end if;
 -- ID kosong berarti mengoreksi seluruh pembayaran aktif menjadi belum dibayar.
 if p_id is null then
  if not exists(select 1 from public.belanja_proyek_bayar where belanja_id=p_belanja and batal_at is null) then
   if exists(select 1 from public.belanja_proyek_bayar where belanja_id=p_belanja and dibatalkan_oleh=u and alasan_batal=left(trim(p_alasan),1000)) then return;end if;
   raise exception 'Nota sudah belum dibayar';
  end if;
  if b.updated_at is distinct from p_versi then raise exception 'Nota sudah berubah. Muat ulang sebelum mengoreksi';end if;
  update public.belanja_proyek_bayar set batal_at=clock_timestamp(),alasan_batal=left(trim(p_alasan),1000),dibatalkan_oleh=u,nama_pembatal=nama where belanja_id=p_belanja and batal_at is null;
  update public.belanja_proyek set updated_at=clock_timestamp() where id=p_belanja;
  return;
 end if;
 select * into x from public.belanja_proyek_bayar where id=p_id and belanja_id=p_belanja for update;
 if not found then raise exception 'Pembayaran tidak ditemukan pada nota ini';end if;
 if x.batal_at is not null then
  if x.dibatalkan_oleh=u and x.alasan_batal=left(trim(p_alasan),1000) then return;end if;
  raise exception 'Pembayaran sudah dikoreksi';
 end if;
 if b.updated_at is distinct from p_versi then raise exception 'Nota sudah berubah. Muat ulang sebelum mengoreksi';end if;
 update public.belanja_proyek_bayar set batal_at=clock_timestamp(),alasan_batal=left(trim(p_alasan),1000),dibatalkan_oleh=u,nama_pembatal=nama where id=p_id;
 update public.belanja_proyek set updated_at=clock_timestamp() where id=p_belanja;
end $$;
create function public.koreksi_bayar_belanja_proyek(p_id uuid,p_belanja uuid,p_versi timestamptz,p_alasan text)
returns void language sql security invoker set search_path='' as $$select proyek_internal.koreksi_bayar_belanja(p_id,p_belanja,p_versi,p_alasan)$$;
revoke all on function proyek_internal.koreksi_bayar_belanja(uuid,uuid,timestamptz,text) from public,anon;
grant execute on function proyek_internal.koreksi_bayar_belanja(uuid,uuid,timestamptz,text) to authenticated;
revoke all on function public.koreksi_bayar_belanja_proyek(uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.koreksi_bayar_belanja_proyek(uuid,uuid,timestamptz,text) to authenticated;
