-- Lookup berbasis sesi agar pembacaan harian tidak memindai seluruh transaksi/biaya.
create index if not exists transaksi_sesi_harian_idx on public.transaksi(sesi_kas_id,created_at) where status not in ('draft','dihapus');
create index if not exists biaya_sesi_harian_idx on public.biaya_outlet(sesi_kas_id,tanggal) where deleted_at is null;
-- Tanggal pembukaan kas bukan tanggal penjualan. Jangan memindahkan transaksi/setoran aktual.
create function rekonsiliasi_internal.tanggal_sesi(sid uuid) returns date
language sql stable security definer set search_path='' as $$
 select coalesce((select max(public.tgl_op(t.created_at)) from public.transaksi t where t.sesi_kas_id=s.id and t.status not in ('draft','dihapus')),
 (select max(b.tanggal) from public.biaya_outlet b where b.sesi_kas_id=s.id and b.deleted_at is null),
 case when s.ditutup_at is null then public.tgl_op(now()) else coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at)) end)
 from public.sesi_kas s where s.id=sid and auth.uid() is not null and public.boleh_outlet(s.outlet_id)
$$;
create function rekonsiliasi_internal.cocok_sesi(sid uuid,d date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.sesi_kas s where s.id=sid and auth.uid() is not null and public.boleh_outlet(s.outlet_id)
 and (rekonsiliasi_internal.tanggal_sesi(s.id)=d or (s.ditutup_at is null and d=public.tgl_op(now())) or exists(select 1 from public.transaksi t where t.sesi_kas_id=s.id and t.status not in ('draft','dihapus') and public.tgl_op(t.created_at)=d)))
$$;
create function rekonsiliasi_internal.daftar_sesi(o uuid,d date,a date,md public.mode_data) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat,finance,spv}') or not public.boleh_outlet(o) then raise exception 'Tidak diizinkan';end if;
 if d is null or a is null or a<=d or a-d>366 then raise exception 'Periode tidak valid';end if;
 return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('tanggal_catatan',rekonsiliasi_internal.tanggal_sesi(s.id),'tanggal_terkait',hr.hari,'tanggal_valid',(select array_agg(distinct tgl) from (select rekonsiliasi_internal.tanggal_sesi(s.id) tgl union select public.tgl_op(now()) where s.ditutup_at is null union select public.tgl_op(z.created_at) from public.transaksi z where z.sesi_kas_id=s.id and z.status not in ('draft','dihapus')) v),'hitung',matur_internal.kas_ringkas(s.id)) order by s.dibuka_at)
 from public.sesi_kas s cross join lateral (select array_agg(distinct tgl order by tgl) hari from (
 select rekonsiliasi_internal.tanggal_sesi(s.id) tgl union select public.tgl_op(now()) where s.ditutup_at is null union select public.tgl_op(t.created_at) from public.transaksi t where t.sesi_kas_id=s.id and t.status not in ('draft','dihapus')
 union select b.tanggal from public.biaya_outlet b where b.sesi_kas_id=s.id and b.deleted_at is null) q) hr
 where s.outlet_id=o and s.mode=md and exists(select 1 from unnest(hr.hari) t where t>=d and t<a)), '[]');
end $$;
create function public.sesi_catatan_harian(o uuid,d date,a date,md public.mode_data default 'asli') returns jsonb
language sql security invoker set search_path='' as $$select rekonsiliasi_internal.daftar_sesi(o,d,a,md)$$;
revoke all on function rekonsiliasi_internal.tanggal_sesi(uuid),rekonsiliasi_internal.cocok_sesi(uuid,date),rekonsiliasi_internal.daftar_sesi(uuid,date,date,public.mode_data) from public,anon,authenticated;
grant execute on function rekonsiliasi_internal.tanggal_sesi(uuid),rekonsiliasi_internal.cocok_sesi(uuid,date),rekonsiliasi_internal.daftar_sesi(uuid,date,date,public.mode_data) to authenticated;
revoke all on function public.sesi_catatan_harian(uuid,date,date,public.mode_data) from public,anon;
grant execute on function public.sesi_catatan_harian(uuid,date,date,public.mode_data) to authenticated;

-- Rekap setoran satu kali pada tanggal aktivitas terakhir; nilai aktual tidak berubah.
do $$declare f text;begin
 f:=pg_get_functiondef('public.rekap_harian(uuid,date,public.mode_data)'::regprocedure);
 if position('coalesce(tanggal_shift, public.tgl_op(dibuka_at))' in f)=0 then raise exception 'Pola rekap_harian berubah';end if;
 f:=replace(f,'coalesce(tanggal_shift, public.tgl_op(dibuka_at))','rekonsiliasi_internal.tanggal_sesi(sesi_kas.id)');execute f;
 -- Pemeriksaan memasukkan semua tanggal aktivitas shift, bukan hanya label tanggal buka.
 f:=pg_get_functiondef('rekonsiliasi_internal.periksa(uuid)'::regprocedure);
 f:=replace(f,'t:=coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at));','t:=rekonsiliasi_internal.tanggal_sesi(s.id);');
 f:=replace(f,'coalesce(sk.tanggal_shift,public.tgl_op(sk.dibuka_at))','rekonsiliasi_internal.tanggal_sesi(sk.id)');
 f:=replace(f,'coalesce(x.tanggal_shift,public.tgl_op(x.dibuka_at))','rekonsiliasi_internal.tanggal_sesi(x.id)');
 f:=replace(f,'or x.tanggal=t','or rekonsiliasi_internal.cocok_sesi(s.id,x.tanggal)');
 f:=replace(f,'''ditutup_at'',x.ditutup_at) order by', $r$'ditutup_at',x.ditutup_at,'tanggal_terkait',coalesce((select jsonb_agg(distinct tgl) from (select public.tgl_op(z.created_at) tgl from public.transaksi z where z.sesi_kas_id=x.id and z.status not in ('draft','dihapus') union select public.tgl_op(now()) where x.ditutup_at is null) dz),'[]'::jsonb)) order by$r$);
 f:=replace(f,'''sidik'',md5(to_jsonb(x)::text)', '''tanggal_sesuai'',rekonsiliasi_internal.cocok_sesi(x.sesi_kas_id,x.tanggal),''sidik'',md5(to_jsonb(x)::text)');
 execute f;
 f:=pg_get_functiondef('rekonsiliasi_internal.koreksi(jsonb)'::regprocedure);
 if position('coalesce(x.tanggal_shift,public.tgl_op(x.dibuka_at))=v_tanggal' in f)=0 then raise exception 'Pola koreksi berubah';end if;
 f:=replace(f,'coalesce(x.tanggal_shift,public.tgl_op(x.dibuka_at))=v_tanggal','rekonsiliasi_internal.cocok_sesi(x.id,v_tanggal)');
 f:=replace(f,' or s.ditutup_at is null','');
 f:=replace(f,'coalesce(s.tanggal_shift,public.tgl_op(s.dibuka_at))','rekonsiliasi_internal.tanggal_sesi(s.id)');
 f:=replace(f,'Pilih kas tertutup tanpa antrean offline; kas aktif dikelola dari POS','Tunggu antrean offline selesai atau pilih kas outlet yang sesuai');
 execute f;
end $$;

-- Hubungkan hanya ke kas yang cocok; jangan menelan kesalahan dengan diam-diam mengosongkan hubungan.
create or replace function public.tempel_sesi_biaya() returns trigger language plpgsql security definer set search_path='' as $$
declare pilihan uuid[];
begin
 if current_setting('matur.biaya_final',true)='1' then return new;end if;
 if new.sumber='pusat' then new.sesi_kas_id:=null;return new;end if;
 if tg_op='UPDATE' and (new.tanggal is distinct from old.tanggal or new.sumber is distinct from old.sumber) and new.sesi_kas_id is not distinct from old.sesi_kas_id then new.sesi_kas_id:=null;end if;
 if new.sesi_kas_id is not null and not exists(select 1 from public.sesi_kas s where s.id=new.sesi_kas_id and s.outlet_id=new.outlet_id and s.mode=new.mode and rekonsiliasi_internal.cocok_sesi(s.id,new.tanggal)) then raise exception 'Pilih shift yang sesuai tanggal pengeluaran';end if;
 if new.sesi_kas_id is null then
  select array_agg(s.id) into pilihan from public.sesi_kas s where s.outlet_id=new.outlet_id and s.mode=new.mode and s.ditutup_at is null and rekonsiliasi_internal.cocok_sesi(s.id,new.tanggal);
  if cardinality(pilihan)=1 then new.sesi_kas_id:=pilihan[1];end if;
 end if;
 if new.sesi_kas_id is null and (tg_op='INSERT' or new.tanggal is distinct from old.tanggal or new.sumber is distinct from old.sumber or new.sesi_kas_id is distinct from old.sesi_kas_id) then raise exception 'Pilih shift untuk pengeluaran laci; gunakan Akunting untuk tanggal lama';end if;
 return new;
end $$;
revoke all on function public.tempel_sesi_biaya() from public,anon,authenticated;

create or replace function operasional_outlet_internal.catat_pengeluaran_pos(p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare o uuid:=(p->>'outlet_id')::uuid; req uuid:=(p->>'request_id')::uuid; sid uuid:=nullif(p->>'sesi_id','')::uuid;
 k uuid:=(p->>'kategori_id')::uuid; j numeric:=(p->>'jumlah')::numeric; v_sumber text:=p->>'sumber';
 d date:=coalesce((p->>'tanggal')::date,public.tgl_op(now())); bid uuid;s public.sesi_kas;pilihan uuid[];h jsonb;als text:=trim(p->>'alasan');
 acct boolean:=public.punya_peran('{owner,admin_pusat,finance}');
begin
 if auth.uid() is null or not public.boleh_outlet(o) or not (acct or public.peran_di_outlet(o,'{kasir,barista,spv}')) then raise exception 'Anda tidak berwenang mencatat pengeluaran outlet ini';end if;
 if octet_length(p::text)>500000 then raise exception 'Data terlalu besar';end if;
 if req is null then raise exception 'Identitas penyimpanan diperlukan';end if;
 perform pg_advisory_xact_lock(hashtextextended(req::text,0));
 select id into bid from public.biaya_outlet where request_id=req and outlet_id=o and dibuat_oleh=auth.uid();
 if bid is not null then
  if exists(select 1 from public.biaya_outlet where id=bid and (kategori_id is distinct from k or jumlah is distinct from j or sumber is distinct from v_sumber or tanggal is distinct from d or (sid is not null and sesi_kas_id is distinct from sid) or coalesce(keterangan,'') is distinct from coalesce(nullif(left(trim(p->>'keterangan'),200),''),''))) then raise exception 'Permintaan sudah tersimpan dengan isi berbeda. Muat ulang riwayat sebelum mencatat lagi.';end if;
  return bid;
 end if;
 if j is null or j<=0 or j<>round(j) or j>1000000000000 or v_sumber not in ('laci','pusat') or v_sumber is null then raise exception 'Nominal atau sumber pembayaran tidak valid';end if;
 if not exists(select 1 from public.outlet where id=o and deleted_at is null and mode='asli') then raise exception 'Outlet tidak tersedia';end if;
 if not exists(select 1 from public.kategori_biaya where id=k) then raise exception 'Pilih kategori pengeluaran yang tersedia';end if;
 perform id from public.outlet where id=o for update;
 if v_sumber='laci' then
  if sid is null then
   select array_agg(x.id) into pilihan from public.sesi_kas x where x.outlet_id=o and x.mode='asli' and x.pos_tim and (x.ditutup_at is null or acct) and rekonsiliasi_internal.cocok_sesi(x.id,d);
   if cardinality(pilihan)<>1 or pilihan is null then raise exception 'Pilih shift yang benar untuk tanggal pengeluaran';end if;sid:=pilihan[1];
  end if;
  select * into s from public.sesi_kas where id=sid for update;
  if s.id is null or s.outlet_id<>o or s.mode<>'asli' or not s.pos_tim or not rekonsiliasi_internal.cocok_sesi(s.id,d) then raise exception 'Kas atau tanggal tidak sesuai. Pilih shift yang benar';end if;
  if s.ditutup_at is not null and (not acct or coalesce(s.pending_offline,0)>0) then raise exception 'Kas sudah ditutup atau masih ada antrean offline. Hubungi Akunting';end if;
  if d<>public.tgl_op(now()) and not acct then raise exception 'Pengeluaran laci POS harus dicatat untuk hari ini';end if;
  if s.ditutup_at is not null and length(coalesce(als,''))<3 then raise exception 'Isi alasan penambahan pengeluaran pada kas tertutup';end if;
 else sid:=null;end if;
 if s.ditutup_at is not null then perform set_config('matur.biaya_final','1',true);end if;
 insert into public.biaya_outlet(outlet_id,tanggal,kategori_id,jumlah,keterangan,sumber,sesi_kas_id,dibuat_oleh,request_id)
 values(o,d,k,j,nullif(left(trim(p->>'keterangan'),200),''),v_sumber,sid,auth.uid(),req) returning id into bid;
 if s.ditutup_at is not null then
  perform set_config('matur.biaya_final','',true);
  h:=matur_internal.kas_ringkas(s.id);
  update public.sesi_kas set kas_seharusnya=(h->>'seharusnya')::bigint,seharusnya=(h->>'seharusnya')::bigint-modal_laci,selisih=setoran-((h->>'seharusnya')::bigint-modal_laci) where id=s.id;
 end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'tambah_pengeluaran_terhubung','biaya_outlet',bid::text,jsonb_build_object('outlet_id',o,'tanggal',d,'sesi_kas_id',sid,'jumlah',j,'alasan',left(als,500),'setoran_tetap',s.setoran));
 return bid;
end $$;
