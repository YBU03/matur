alter table public.outlet add column telepon text,add column profil_versi integer not null default 0;
alter table public.pengaturan_dokumen_gudang add column telepon text not null default '62 856-9786-5737';
create table public.dokumen_kiriman_gudang(
 kiriman_id uuid not null references public.kiriman(id),jenis text not null check(jenis in ('invoice','surat-jalan')),
 isi jsonb not null default '{}',terbit jsonb,versi integer not null default 0,
 terbit_at timestamptz,arsip_at timestamptz,updated_at timestamptz not null default now(),primary key(kiriman_id,jenis)
);
alter table public.dokumen_kiriman_gudang enable row level security;
create policy baca on public.dokumen_kiriman_gudang for select to authenticated using(exists(select 1 from public.kiriman k where k.id=kiriman_id));
revoke all on public.dokumen_kiriman_gudang from anon,authenticated;grant select on public.dokumen_kiriman_gudang to authenticated;
create table public.dokumen_kiriman_revisi(
 kiriman_id uuid not null,jenis text not null,versi integer not null,aksi text not null,isi jsonb not null,oleh uuid not null references public.pengguna(id),waktu timestamptz not null default now(),
 primary key(kiriman_id,jenis,versi),foreign key(kiriman_id,jenis) references public.dokumen_kiriman_gudang(kiriman_id,jenis)
);
create index dokumen_kiriman_revisi_oleh on public.dokumen_kiriman_revisi(oleh);
alter table public.dokumen_kiriman_revisi enable row level security;
create policy baca on public.dokumen_kiriman_revisi for select to authenticated using((select gudang_internal.boleh(true)));
revoke all on public.dokumen_kiriman_revisi from anon,authenticated;grant select on public.dokumen_kiriman_revisi to authenticated;

create function gudang_internal.basis_dokumen(kid uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(coalesce(jsonb_agg(jsonb_build_array(i.id,case when k.status='diterima' or k.pemeriksaan_status in ('selesai','selisih') then trim_scale(coalesce(i.qty_diterima,i.qty)) else trim_scale(i.qty) end,i.harga) order by i.id)::text,'[]'))
 from public.kiriman k join public.item_kiriman i on i.kiriman_id=k.id where k.id=kid
$$;
revoke all on function gudang_internal.basis_dokumen(uuid) from public,anon,authenticated;

create function gudang_internal.editor_dokumen(p jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare k public.kiriman;d public.dokumen_kiriman_gudang;cfg public.pengaturan_dokumen_gudang;o public.outlet;tagih jsonb;identitas jsonb;isi_baru jsonb;baris jsonb;v jsonb;i public.item_kiriman;jumlah numeric;disc numeric;tax numeric;vers integer;aksi text:=p->>'aksi';j text:=p->>'jenis';kid uuid:=(p->>'id')::uuid;
begin
 if not gudang_internal.boleh(true) then raise exception 'Hanya admin Gudang/Pusat/Owner aktif';end if;
 if j is null or j not in ('invoice','surat-jalan') or aksi is null or aksi not in ('simpan','terbit','arsip','pulihkan') then raise exception 'Aksi dokumen tidak dikenal';end if;
 select * into k from public.kiriman where id=kid and mode='asli' and deleted_at is null for update;
 if k.id is null then raise exception 'Kiriman tidak ditemukan';end if;
 select * into d from public.dokumen_kiriman_gudang where kiriman_id=kid and jenis=j for update;
 if (p->>'versi')::integer is distinct from coalesce(d.versi,0) then raise exception 'Dokumen sudah berubah. Muat ulang dahulu';end if;
 if aksi in ('arsip','pulihkan') then
  isi_baru:=coalesce(d.isi,'{}'::jsonb);
 else
  if d.arsip_at is not null then raise exception 'Pulihkan dokumen dari arsip dahulu';end if;
  if length(coalesce(p->>'catatan',''))>2000 or length(coalesce(p->>'telepon_gudang',''))>40 or length(trim(coalesce(p->>'telepon_gudang','')))<5 then raise exception 'Catatan/nomor Gudang tidak valid';end if;
  if nullif(p->>'jatuh_tempo','')::date<k.tanggal then raise exception 'Jatuh tempo tidak boleh sebelum tanggal dokumen';end if;
  if p->>'tagih_mode'='manual' then
   if length(trim(coalesce(p#>>'{tagih,nama}','')))<2 or length(coalesce(p#>>'{tagih,nama}',''))>150 or length(coalesce(p#>>'{tagih,alamat}',''))>600 or length(coalesce(p#>>'{tagih,telepon}',''))>40 then raise exception 'Identitas tagihan tidak valid';end if;
   tagih:=jsonb_build_object('nama',trim(p#>>'{tagih,nama}'),'alamat',coalesce(p#>>'{tagih,alamat}',''),'telepon',coalesce(p#>>'{tagih,telepon}',''));
  elsif p->>'tagih_mode' in ('sama','outlet') then
   select * into o from public.outlet where id=case when p->>'tagih_mode'='sama' then k.outlet_id else (p->>'tagih_outlet')::uuid end and mode='asli' and deleted_at is null;
   if o.id is null then raise exception 'Outlet tagihan tidak ditemukan';end if;
   -- Keep saved identities unless the operator explicitly requests a refresh or changes destination.
   if coalesce((p->>'refresh_identitas')::boolean,false)=false and d.isi->>'tagih_mode'=p->>'tagih_mode' and coalesce(d.isi->>'tagih_outlet','')=coalesce(p->>'tagih_outlet','') then tagih:=d.isi#>'{identitas,tagih}';end if;
   tagih:=coalesce(tagih,jsonb_build_object('nama',o.nama,'alamat',o.alamat,'telepon',o.telepon));
  else raise exception 'Pilih tujuan tagihan';end if;
  select * into cfg from public.pengaturan_dokumen_gudang where id;
  if d.isi->'identitas' is not null and not coalesce((p->>'refresh_identitas')::boolean,false) then identitas:=d.isi->'identitas';
  else
   select * into o from public.outlet where id=k.outlet_id;
   identitas:=jsonb_build_object('perusahaan',(select jsonb_build_object('nama',pt.nama,'alamat',cfg.alamat,'email',pt.email,'telepon',p->>'telepon_gudang','logo_path',cfg.logo_path,'judul_ttd',cfg.judul_ttd) from public.perusahaan pt limit 1),'kirim',jsonb_build_object('nama',o.nama,'alamat',o.alamat,'telepon',o.telepon));
  end if;
  identitas:=jsonb_set(identitas,'{tagih}',tagih);
  identitas:=jsonb_set(identitas,'{perusahaan,telepon}',to_jsonb(p->>'telepon_gudang'));
  baris:=coalesce(p->'baris','{}'::jsonb);
  if jsonb_typeof(baris)<>'object' or exists(select 1 from jsonb_object_keys(baris) key where not exists(select 1 from public.item_kiriman where kiriman_id=kid and id::text=key)) then raise exception 'Baris barang tidak valid';end if;
  for i in select * from public.item_kiriman where kiriman_id=kid order by id for share loop
   v:=coalesce(baris->i.id::text,'{}'::jsonb);if jsonb_typeof(v)<>'object' then raise exception 'Isian baris tidak valid';end if;disc:=coalesce((v->>'diskon')::numeric,0);tax:=coalesce((v->>'pajak')::numeric,0);
   jumlah:=round((case when k.status='diterima' or k.pemeriksaan_status in ('selesai','selisih') then coalesce(i.qty_diterima,i.qty) else i.qty end)*i.harga);
   if disc<0 or tax<0 or disc>jumlah or tax>1000000000000 or disc<>trunc(disc) or tax<>trunc(tax) or disc::text in ('NaN','Infinity','-Infinity') or tax::text in ('NaN','Infinity','-Infinity') then raise exception 'Diskon/pajak harus rupiah bulat, diskon maksimal nilai barang: %',i.nama;end if;
   if j='surat-jalan' and (disc<>0 or tax<>0) then raise exception 'Diskon/pajak hanya pada invoice';end if;
  end loop;
  if j='invoice' and (select coalesce(sum(round((case when k.status='diterima' or k.pemeriksaan_status in ('selesai','selisih') then coalesce(x.qty_diterima,x.qty) else x.qty end)*x.harga)-coalesce((baris->x.id::text->>'diskon')::numeric,0)+coalesce((baris->x.id::text->>'pajak')::numeric,0)),0) from public.item_kiriman x where x.kiriman_id=kid)+coalesce((select nilai from public.invoice_penyesuaian_gudang where kiriman_id=kid),0)<0 then raise exception 'Total invoice tidak boleh negatif';end if;
  if aksi='terbit' and not exists(select 1 from public.item_kiriman where kiriman_id=kid) then raise exception 'Tambahkan barang sebelum menerbitkan';end if;
  isi_baru:=jsonb_build_object('jatuh_tempo',nullif(p->>'jatuh_tempo',''),'catatan',coalesce(p->>'catatan',''),'telepon_gudang',p->>'telepon_gudang','tagih_mode',p->>'tagih_mode','tagih_outlet',p->>'tagih_outlet','identitas',identitas,'baris',baris,'basis',gudang_internal.basis_dokumen(kid),'item_basis',(select coalesce(jsonb_object_agg(x.id::text,jsonb_build_object('qty',case when k.status='diterima' or k.pemeriksaan_status in ('selesai','selisih') then coalesce(x.qty_diterima,x.qty) else x.qty end,'harga',x.harga)),'{}'::jsonb) from public.item_kiriman x where x.kiriman_id=kid));
 end if;
 vers:=coalesce(d.versi,0)+1;
 insert into public.dokumen_kiriman_gudang(kiriman_id,jenis,isi,terbit,versi,terbit_at,arsip_at)
 values(kid,j,isi_baru,case when aksi='terbit' then isi_baru else d.terbit end,vers,case when aksi='terbit' then now() else d.terbit_at end,case when aksi='arsip' then now() when aksi='pulihkan' then null else d.arsip_at end)
 on conflict(kiriman_id,jenis) do update set isi=excluded.isi,terbit=excluded.terbit,versi=excluded.versi,terbit_at=excluded.terbit_at,arsip_at=excluded.arsip_at,updated_at=now();
 insert into public.dokumen_kiriman_revisi(kiriman_id,jenis,versi,aksi,isi,oleh) values(kid,j,vers,aksi,isi_baru,auth.uid());
 return vers;
end $$;
create function public.editor_dokumen_gudang(p jsonb) returns integer language sql security invoker set search_path='' as $$select gudang_internal.editor_dokumen(p)$$;

create function gudang_internal.outlet_dokumen(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.outlet;oid uuid:=(p->>'id')::uuid;
begin
 if not gudang_internal.boleh(true) then raise exception 'Hanya admin Gudang/Pusat/Owner aktif';end if;
 if length(trim(coalesce(p->>'nama','')))<2 or length(p->>'nama')>150 or length(coalesce(p->>'alamat',''))>600 or length(coalesce(p->>'telepon',''))>40 then raise exception 'Data outlet tidak valid';end if;
 if oid is not null then select * into o from public.outlet where id=oid and mode='asli' and deleted_at is null for update;if o.id is null or (p->>'versi')::integer is distinct from o.profil_versi then raise exception 'Outlet sudah berubah. Muat ulang dahulu';end if;end if;
 perform pg_advisory_xact_lock(hashtext('outlet-dokumen-nama'));
 if exists(select 1 from public.outlet where mode='asli' and deleted_at is null and lower(trim(nama))=lower(trim(p->>'nama')) and id is distinct from oid) then raise exception 'Nama outlet sudah dipakai';end if;
 if oid is null then insert into public.outlet(nama,alamat,telepon,status) values(trim(p->>'nama'),trim(coalesce(p->>'alamat','')),trim(coalesce(p->>'telepon','')),'pembangunan') returning id into oid;
 else update public.outlet set nama=trim(p->>'nama'),alamat=trim(coalesce(p->>'alamat','')),telepon=trim(coalesce(p->>'telepon','')),profil_versi=profil_versi+1 where id=oid;end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'profil_outlet_gudang','outlet',oid::text,to_jsonb(o),p);
 return oid;
end $$;
create function public.outlet_dokumen_gudang(p jsonb) returns uuid language sql security invoker set search_path='' as $$select gudang_internal.outlet_dokumen(p)$$;
create function gudang_internal.telepon_dokumen(p_nomor text,p_versi integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if not gudang_internal.boleh(true) then raise exception 'Hanya admin Gudang/Pusat/Owner aktif';end if;
 if length(trim(coalesce(p_nomor,''))) not between 5 and 40 then raise exception 'Nomor Gudang wajib 5-40 karakter';end if;
 update public.pengaturan_dokumen_gudang set telepon=trim(p_nomor),versi=versi+1 where id and versi=p_versi;
 if not found then raise exception 'Pengaturan sudah berubah. Muat ulang dahulu';end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,nilai_baru) values(auth.uid(),'telepon_gudang','pengaturan_dokumen_gudang',jsonb_build_object('telepon',trim(p_nomor)));
end $$;
create function public.atur_telepon_gudang(p_nomor text,p_versi integer) returns void language sql security invoker set search_path='' as $$select gudang_internal.telepon_dokumen(p_nomor,p_versi)$$;
revoke all on function gudang_internal.editor_dokumen(jsonb),gudang_internal.outlet_dokumen(jsonb),gudang_internal.telepon_dokumen(text,integer) from public,anon;
grant execute on function gudang_internal.editor_dokumen(jsonb),gudang_internal.outlet_dokumen(jsonb),gudang_internal.telepon_dokumen(text,integer) to authenticated;
revoke all on function public.editor_dokumen_gudang(jsonb),public.outlet_dokumen_gudang(jsonb),public.atur_telepon_gudang(text,integer) from public,anon;
grant execute on function public.editor_dokumen_gudang(jsonb),public.outlet_dokumen_gudang(jsonb),public.atur_telepon_gudang(text,integer) to authenticated;
-- Published invoice modifiers are reported once, never multiplied by receipt rows.
alter function gudang_internal.laporan(date,date,uuid,uuid) rename to laporan_sebelum_dokumen;
revoke all on function gudang_internal.laporan_sebelum_dokumen(date,date,uuid,uuid) from public,anon,authenticated;
create function gudang_internal.laporan(awal date,akhir date,ol uuid,bh uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare hasil jsonb;
begin
 hasil:=gudang_internal.laporan_sebelum_dokumen(awal,akhir,ol,bh);
 return hasil||jsonb_build_object('dokumen',coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'nomor',k.nomor,'outlet',o.nama,'tanggal',(k.diterima_at at time zone 'Asia/Jakarta')::date,'perlu_tinjau',d.terbit->>'basis' is distinct from gudang_internal.basis_dokumen(k.id),'diskon',case when d.terbit->>'basis'=gudang_internal.basis_dokumen(k.id) then coalesce((select sum((v->>'diskon')::numeric) from jsonb_each(d.terbit->'baris') t(key,v)),0) else 0 end,'pajak',case when d.terbit->>'basis'=gudang_internal.basis_dokumen(k.id) then coalesce((select sum((v->>'pajak')::numeric) from jsonb_each(d.terbit->'baris') t(key,v)),0) else 0 end)) from public.dokumen_kiriman_gudang d join public.kiriman k on k.id=d.kiriman_id join public.outlet o on o.id=k.outlet_id where d.jenis='invoice' and d.terbit is not null and k.mode='asli' and k.deleted_at is null and k.status='diterima' and (k.diterima_at at time zone 'Asia/Jakarta')::date between awal and akhir and (ol is null or k.outlet_id=ol) and bh is null),'[]'::jsonb));
end $$;
revoke all on function gudang_internal.laporan(date,date,uuid,uuid) from public,anon;
grant execute on function gudang_internal.laporan(date,date,uuid,uuid) to authenticated;

-- Existing invoice adjustment must validate against the discounted/taxed total too.
do $patch$ declare s text;needle text:='if barang+p_nilai<0 then';begin
 s:=pg_get_functiondef('gudang_internal.invoice(uuid,bigint,text,integer)'::regprocedure);
 if position(needle in s)=0 then raise exception 'Definisi penyesuaian invoice berubah';end if;
 s:=replace(s,needle,$code$
 if exists(select 1 from public.dokumen_kiriman_gudang where kiriman_id=p_id and jenis='invoice' and terbit is not null and terbit->>'basis' is distinct from gudang_internal.basis_dokumen(p_id)) then raise exception 'Periksa ulang dokumen invoice setelah perubahan barang';end if;
 barang:=barang+coalesce((select sum(coalesce((v->>'pajak')::numeric,0)-coalesce((v->>'diskon')::numeric,0)) from public.dokumen_kiriman_gudang d cross join lateral jsonb_each(d.terbit->'baris') t(key,v) where d.kiriman_id=p_id and d.jenis='invoice'),0);
 if barang+p_nilai<0 then
 $code$);
 execute s;
end $patch$;
create function gudang_internal.dokumen_lengkap(p_alamat text,p_logo text,p_versi integer,p_judul text[],p_telepon text) returns void language plpgsql security definer set search_path='' as $$
begin
 if length(trim(coalesce(p_telepon,''))) not between 5 and 40 then raise exception 'Nomor Gudang wajib 5-40 karakter';end if;
 perform gudang_internal.dokumen_ttd(p_alamat,p_logo,p_versi,p_judul);
 update public.pengaturan_dokumen_gudang set telepon=trim(p_telepon) where id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,nilai_baru) values(auth.uid(),'telepon_gudang','pengaturan_dokumen_gudang',jsonb_build_object('telepon',trim(p_telepon)));
end $$;
create function public.atur_dokumen_gudang_lengkap(p_alamat text,p_logo text,p_versi integer,p_judul text[],p_telepon text) returns void language sql security invoker set search_path='' as $$select gudang_internal.dokumen_lengkap(p_alamat,p_logo,p_versi,p_judul,p_telepon)$$;
revoke all on function gudang_internal.dokumen_lengkap(text,text,integer,text[],text),public.atur_dokumen_gudang_lengkap(text,text,integer,text[],text) from public,anon;
grant execute on function gudang_internal.dokumen_lengkap(text,text,integer,text[],text),public.atur_dokumen_gudang_lengkap(text,text,integer,text[],text) to authenticated;
create function gudang_internal.versi_profil_outlet() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.nama,new.alamat,new.telepon) is distinct from (old.nama,old.alamat,old.telepon) then new.profil_versi:=old.profil_versi+1;end if;
 return new;
end $$;
create trigger versi_profil_outlet before update on public.outlet for each row execute function gudang_internal.versi_profil_outlet();
revoke all on function gudang_internal.versi_profil_outlet() from public,anon,authenticated;
