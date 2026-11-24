-- Actual distributions and report meetings are separate from official report figures.
create schema if not exists laporan_lanjut_internal;
revoke all on schema laporan_lanjut_internal from public,anon;
grant usage on schema laporan_lanjut_internal to authenticated;
create function laporan_lanjut_internal.pusat() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and public.punya_peran('{owner,admin_pusat,finance}')$$;
create function laporan_lanjut_internal.boleh(l uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.laporan_bulanan x where x.id=l and x.mode='asli' and x.deleted_at is null and (laporan_lanjut_internal.pusat() or (public.peran_di_outlet(x.outlet_id,'{mitra}') and x.mitra_disetujui and x.mitra_buka_at<=now()) or (public.punya_peran('{manajer_area}') and public.boleh_outlet(x.outlet_id))))
$$;
revoke all on function laporan_lanjut_internal.pusat(),laporan_lanjut_internal.boleh(uuid) from public,anon;
grant execute on function laporan_lanjut_internal.pusat(),laporan_lanjut_internal.boleh(uuid) to authenticated;

-- Stable source positions, not fuzzy recipient aliases, identify payment entitlements.
create function laporan_lanjut_internal.hak(l uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('key',x.key,'nama',x.nama,'jenis',x.jenis,'jumlah',x.jumlah,'bank',x.bank,'rekening',x.rekening) order by x.key),'[]') from (
 select 'transfer:'||i::text key,coalesce(nullif(t->>'atas_nama',''),t->>'keterangan') nama,t->>'keterangan' jenis,(t->>'jumlah')::numeric jumlah,t->>'bank' bank,t->>'no_rekening' rekening
 from public.laporan_bulanan b cross join jsonb_array_elements(b.transfer) with ordinality tt(t,i) where b.id=l and jsonb_array_length(coalesce(b.transfer,'[]'))>0
 union all
 select 'bagi:'||i::text,t->>'nama','Bagi hasil '||(t->>'persen')||'%',(t->>'jumlah')::numeric,null,null
 from public.laporan_bulanan b cross join jsonb_array_elements(b.bagi_hasil) with ordinality tt(t,i) where b.id=l and (jsonb_array_length(coalesce(b.transfer,'[]'))=0 or (t->>'nama' ~* '(pengelola|pusat)' and not exists(select 1 from jsonb_array_elements(b.transfer) tr where (coalesce(tr->>'atas_nama','')||' '||coalesce(tr->>'keterangan','')) ~* '(pengelola|pusat)')))
 ) x where jumlah>0
$$;
revoke all on function laporan_lanjut_internal.hak(uuid) from public,anon,authenticated;
create function public.hak_pembayaran_laporan(l uuid) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if not laporan_lanjut_internal.boleh(l) then raise exception 'Laporan tidak dapat diakses';end if;
 return laporan_lanjut_internal.baca_hak(l);
end $$;
create function laporan_lanjut_internal.baca_hak(l uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not laporan_lanjut_internal.boleh(l) then raise exception 'Laporan tidak dapat diakses';end if;return laporan_lanjut_internal.hak(l);end $$;
revoke all on function laporan_lanjut_internal.baca_hak(uuid),public.hak_pembayaran_laporan(uuid) from public,anon;
grant execute on function laporan_lanjut_internal.baca_hak(uuid),public.hak_pembayaran_laporan(uuid) to authenticated;

create table public.laporan_bayar(
 id uuid primary key default gen_random_uuid(),laporan_id uuid not null references public.laporan_bulanan(id),penerima_key text not null,hak_snapshot jsonb not null,
 jumlah numeric not null check(jumlah>0),pembulatan numeric not null default 0 check(abs(pembulatan)<=1),tanggal date not null,metode text not null check(metode in('transfer','tunai')),bukti text,
 catatan text not null,status text not null default 'tercatat' check(status in('tercatat','batal')),versi int not null default 1,
 dibuat_oleh uuid not null references public.pengguna(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index laporan_bayar_laporan_idx on public.laporan_bayar(laporan_id,penerima_key);
create index laporan_bayar_bukti_idx on public.laporan_bayar(bukti) where bukti is not null;
create index laporan_bayar_actor_idx on public.laporan_bayar(dibuat_oleh);
create table public.laporan_bayar_riwayat(id uuid primary key default gen_random_uuid(),bayar_id uuid not null references public.laporan_bayar(id),laporan_id uuid not null references public.laporan_bulanan(id),sebelum jsonb,sesudah jsonb not null,alasan text not null,aktor uuid not null references public.pengguna(id),created_at timestamptz not null default now());
create index laporan_bayar_riwayat_bayar_idx on public.laporan_bayar_riwayat(bayar_id);
create index laporan_bayar_riwayat_laporan_idx on public.laporan_bayar_riwayat(laporan_id);
create index laporan_bayar_bukti_lama_idx on public.laporan_bayar_riwayat((sebelum->>'bukti'));
create index laporan_bayar_bukti_baru_idx on public.laporan_bayar_riwayat((sesudah->>'bukti'));
create index laporan_bayar_riwayat_actor_idx on public.laporan_bayar_riwayat(aktor);
alter table public.laporan_bayar enable row level security;
alter table public.laporan_bayar_riwayat enable row level security;
grant select on public.laporan_bayar,public.laporan_bayar_riwayat to authenticated;
revoke insert,update,delete on public.laporan_bayar,public.laporan_bayar_riwayat from public,anon,authenticated;
create policy bayar_read on public.laporan_bayar for select to authenticated using(laporan_lanjut_internal.boleh(laporan_id));
create policy bayar_riwayat_read on public.laporan_bayar_riwayat for select to authenticated using(laporan_lanjut_internal.boleh(laporan_id));

create table public.laporan_meeting(
 id uuid primary key default gen_random_uuid(),laporan_id uuid not null references public.laporan_bulanan(id),judul text not null,agenda text not null,
 jenis text not null check(jenis in('online','tatap_muka')),waktu timestamptz not null,durasi int not null check(durasi between 15 and 480),lokasi text not null default '',
 peserta uuid[] not null,diusulkan_oleh uuid not null references public.pengguna(id),pengusul_pusat boolean not null,
 status text not null check(status in('diajukan','jadwal_pengganti','terjadwal','selesai','batal')),notulen text not null default '',tindak_lanjut text not null default '',
 grup uuid,versi int not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index laporan_meeting_laporan_idx on public.laporan_meeting(laporan_id,waktu);
create index laporan_meeting_waktu_idx on public.laporan_meeting(waktu,id);
create index laporan_meeting_actor_idx on public.laporan_meeting(diusulkan_oleh);
create table public.laporan_meeting_riwayat(id uuid primary key default gen_random_uuid(),meeting_id uuid not null references public.laporan_meeting(id),laporan_id uuid not null references public.laporan_bulanan(id),sebelum jsonb,sesudah jsonb not null,alasan text not null,aktor uuid not null references public.pengguna(id),created_at timestamptz not null default now());
create index laporan_meeting_riwayat_meeting_idx on public.laporan_meeting_riwayat(meeting_id);
create index laporan_meeting_riwayat_laporan_idx on public.laporan_meeting_riwayat(laporan_id);
create index laporan_meeting_riwayat_actor_idx on public.laporan_meeting_riwayat(aktor);
alter table public.laporan_meeting enable row level security;
alter table public.laporan_meeting_riwayat enable row level security;
grant select on public.laporan_meeting,public.laporan_meeting_riwayat to authenticated;
revoke insert,update,delete on public.laporan_meeting,public.laporan_meeting_riwayat from public,anon,authenticated;
create policy meeting_read on public.laporan_meeting for select to authenticated using(laporan_lanjut_internal.boleh(laporan_id) and ((select laporan_lanjut_internal.pusat()) or (select auth.uid())=any(peserta)));
create policy meeting_history_read on public.laporan_meeting_riwayat for select to authenticated using(exists(select 1 from public.laporan_meeting m where m.id=meeting_id));

create table laporan_lanjut_internal.perintah(id uuid primary key,aktor uuid not null,payload jsonb not null,hasil jsonb not null);
alter table laporan_lanjut_internal.perintah enable row level security;
revoke all on laporan_lanjut_internal.perintah from public,anon,authenticated;

create function laporan_lanjut_internal.peserta(l uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare o uuid;begin
 if not laporan_lanjut_internal.boleh(l) then raise exception 'Laporan tidak dapat diakses';end if;select outlet_id into o from public.laporan_bulanan where id=l;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nama',u.nama) order by u.nama),'[]') from public.pengguna u where u.status='aktif' and exists(select 1 from public.penugasan t where t.pengguna_id=u.id and ((t.peran in('owner','admin_pusat','finance') and (t.outlet_id is null or t.outlet_id=o)) or(t.peran='mitra' and t.outlet_id=o))));
end $$;
create function public.peserta_meeting_laporan(l uuid) returns jsonb language sql security invoker set search_path='' as $$select laporan_lanjut_internal.peserta(l)$$;
revoke all on function laporan_lanjut_internal.peserta(uuid),public.peserta_meeting_laporan(uuid) from public,anon;
grant execute on function laporan_lanjut_internal.peserta(uuid),public.peserta_meeting_laporan(uuid) to authenticated;

create function laporan_lanjut_internal.simpan(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();l uuid:=(p->>'laporan_id')::uuid;req uuid:=(p->>'request_id')::uuid;act text:=p->>'aksi';rid uuid:=nullif(p->>'id','')::uuid;
 pusat boolean:=laporan_lanjut_internal.pusat();oldp public.laporan_bayar;np public.laporan_bayar;oldm public.laporan_meeting;nm public.laporan_meeting;
 hak jsonb;prev laporan_lanjut_internal.perintah;hasil jsonb;alasan text:=trim(coalesce(p->>'alasan',''));amt numeric;adj numeric;adj_used numeric;paid numeric;w timestamptz;ps uuid[];eligible uuid[];i int;cnt int;grp uuid:=gen_random_uuid();obj jsonb;outlet uuid;
begin
 if uid is null or not laporan_lanjut_internal.boleh(l) then raise exception 'Laporan tidak dapat diakses';end if;
 if not pusat and not public.punya_peran('{mitra}') then raise exception 'Tidak berwenang';end if;
 if req is null or length(alasan) not between 3 and 2000 or octet_length(p::text)>60000 then raise exception 'Isi alasan 3–2000 karakter dan identitas permintaan';end if;
 perform pg_advisory_xact_lock(hashtext('laporan-perintah:'||req));
 select * into prev from laporan_lanjut_internal.perintah where id=req;
 if found then if prev.aktor<>uid or prev.payload<>p then raise exception 'ID permintaan sudah dipakai';end if;return prev.hasil;end if;
 perform 1 from public.laporan_bulanan where id=l for update;
 select outlet_id into outlet from public.laporan_bulanan where id=l;
 if act in('bayar','batal_bayar') then
  if not pusat then raise exception 'Pembayaran hanya dikelola Akunting/Pusat';end if;
  if rid is not null then select * into oldp from public.laporan_bayar where id=rid and laporan_id=l for update;
   if oldp.id is null or oldp.versi is distinct from (p->>'versi')::int or oldp.status='batal' then raise exception 'Pembayaran berubah/sudah dibatalkan. Muat ulang';end if;
  end if;
  if act='batal_bayar' then
   if oldp.id is null then raise exception 'Pembayaran tidak ditemukan';end if;
   update public.laporan_bayar set status='batal',catatan=alasan,versi=versi+1,updated_at=now() where id=rid returning * into np;
  else
   select v into hak from jsonb_array_elements(laporan_lanjut_internal.hak(l)) v where v->>'key'=p->>'penerima_key';
   if hak is null or hak is distinct from p->'hak_snapshot' or (oldp.id is not null and (oldp.penerima_key<>p->>'penerima_key' or oldp.hak_snapshot<>hak)) then raise exception 'Hak penerima berubah. Periksa laporan terlebih dahulu';end if;
   amt:=(p->>'jumlah')::numeric;adj:=coalesce((p->>'pembulatan')::numeric,0);
   if abs(adj)>1 or amt-adj<=0 then raise exception 'Pembulatan maksimal Rp1 dan alokasi harus positif';end if;
   if amt is null or amt<=0  or amt>1000000000000 or (p->>'tanggal')::date>(now() at time zone 'Asia/Jakarta')::date or (p->>'tanggal') is null then raise exception 'Nominal/tanggal pembayaran tidak valid';end if;
   if p->>'metode' not in('tunai','transfer') then raise exception 'Metode pembayaran tidak valid';end if;
   if p->>'metode'='transfer' and nullif(p->>'bukti','') is null then raise exception 'Bukti transfer wajib diunggah';end if;
   if nullif(p->>'bukti','') is not null and not exists(select 1 from storage.objects where bucket_id='laporan-bukti-bayar' and name=p->>'bukti' and split_part(name,'/',1)=l::text) then raise exception 'Bukti tidak sesuai laporan';end if;
   select coalesce(sum(jumlah-pembulatan),0),coalesce(sum(abs(pembulatan)),0) into paid,adj_used from public.laporan_bayar where laporan_id=l and penerima_key=p->>'penerima_key' and status='tercatat' and (rid is null or id<>rid);
   if adj_used+abs(adj)>1 then raise exception 'Total pembulatan per hak maksimal Rp1';end if;
   if paid+amt-adj>(hak->>'jumlah')::numeric then raise exception 'Pembayaran melebihi hak penerima';end if;
   if rid is null then insert into public.laporan_bayar(laporan_id,penerima_key,hak_snapshot,jumlah,pembulatan,tanggal,metode,bukti,catatan,dibuat_oleh) values(l,p->>'penerima_key',hak,amt,adj,(p->>'tanggal')::date,p->>'metode',nullif(p->>'bukti',''),alasan,uid) returning * into np;
   else update public.laporan_bayar set jumlah=amt,pembulatan=adj,tanggal=(p->>'tanggal')::date,metode=p->>'metode',bukti=nullif(p->>'bukti',''),catatan=alasan,versi=versi+1,updated_at=now() where id=rid returning * into np;end if;
  end if;
  insert into public.laporan_bayar_riwayat(bayar_id,laporan_id,sebelum,sesudah,alasan,aktor) values(np.id,l,case when oldp.id is not null then to_jsonb(oldp) end,to_jsonb(np),alasan,uid);
  hasil:=jsonb_build_object('id',np.id,'ok','Catatan pembayaran tersimpan');
 elsif act in('meeting','jadwal','setuju','batal_meeting','notulen') then
  if rid is not null then select * into oldm from public.laporan_meeting where id=rid and laporan_id=l for update;
   if oldm.id is null or oldm.versi is distinct from (p->>'versi')::int or (not pusat and not uid=any(oldm.peserta)) then raise exception 'Meeting berubah/tidak dapat diakses';end if;
  end if;
  if act='meeting' and rid is null or act='jadwal' and oldm.id is not null then
   if oldm.status in('selesai','batal') then raise exception 'Meeting sudah selesai/dibatalkan';end if;
   w:=(p->>'waktu')::timestamptz;
   if w is null or w<=now() or (p->>'durasi')::int not between 15 and 480 or p->>'jenis' not in('online','tatap_muka') or length(trim(coalesce(p->>'judul',''))) not between 3 and 160 or length(trim(coalesce(p->>'agenda',''))) not between 3 and 4000 then raise exception 'Periksa judul, agenda, waktu mendatang, jenis dan durasi';end if;
   if length(coalesce(p->>'lokasi',''))>1000 or (p->>'jenis'='online' and coalesce(p->>'lokasi','')<>'' and p->>'lokasi' !~ '^https://[^[:space:]]+$') then raise exception 'Tautan online harus HTTPS';end if;
   select coalesce(array_agg((v->>'id')::uuid),'{}') into eligible from jsonb_array_elements(laporan_lanjut_internal.peserta(l)) v;
   select coalesce(array_agg(value::uuid),'{}') into ps from jsonb_array_elements_text(coalesce(p->'peserta','[]'));
   ps:=array(select distinct unnest(ps||array[uid]));
   if not ps<@eligible or cardinality(ps)<2 then raise exception 'Pilih peserta yang berwenang pada outlet ini';end if;
   if not exists(select 1 from public.penugasan t where t.pengguna_id=any(ps) and t.peran='mitra' and t.outlet_id=outlet) or not exists(select 1 from public.penugasan t where t.pengguna_id=any(ps) and t.peran in('finance','owner','admin_pusat')) then raise exception 'Meeting memerlukan Mitra dan Akunting/Pengelola';end if;
   cnt:=case when act='meeting' and pusat then coalesce((p->>'ulang')::int,1) else 1 end;
   if cnt not between 1 and 12 then raise exception 'Jadwal bulanan maksimal 12 per pengajuan';end if;
   for i in 0..cnt-1 loop
    if oldm.id is null then insert into public.laporan_meeting(laporan_id,judul,agenda,jenis,waktu,durasi,lokasi,peserta,diusulkan_oleh,pengusul_pusat,status,grup) values(l,trim(p->>'judul'),trim(p->>'agenda'),p->>'jenis',((w at time zone 'Asia/Jakarta')+make_interval(months=>i)) at time zone 'Asia/Jakarta',(p->>'durasi')::int,trim(coalesce(p->>'lokasi','')),ps,uid,pusat,'diajukan',case when cnt>1 then grp end) returning * into nm;
    else update public.laporan_meeting set judul=trim(p->>'judul'),agenda=trim(p->>'agenda'),jenis=p->>'jenis',waktu=w,durasi=(p->>'durasi')::int,lokasi=trim(coalesce(p->>'lokasi','')),peserta=ps,diusulkan_oleh=uid,pengusul_pusat=pusat,status='jadwal_pengganti',versi=versi+1,updated_at=now() where id=rid returning * into nm;end if;
    insert into public.laporan_meeting_riwayat(meeting_id,laporan_id,sebelum,sesudah,alasan,aktor) values(nm.id,l,case when oldm.id is not null then to_jsonb(oldm) end,to_jsonb(nm),alasan,uid);
    insert into public.notifikasi(pengguna_id,judul,isi,tautan) select v,'Usulan meeting laporan',nm.judul||' · '||to_char(nm.waktu at time zone 'Asia/Jakarta','DD Mon YYYY HH24:MI')||' WIB','/laporan/'||l||'/tindak-lanjut' from unnest(ps) v where v<>uid;
   end loop;
  else
   if oldm.id is null or oldm.status in('selesai','batal') then raise exception 'Meeting tidak dapat diubah';end if;
   if act='setuju' then
    if pusat=oldm.pengusul_pusat or oldm.status not in('diajukan','jadwal_pengganti') then raise exception 'Persetujuan dilakukan pihak penerima usulan';end if;
    if oldm.waktu<=now() or trim(oldm.lokasi)='' then raise exception 'Lengkapi waktu mendatang dan tautan/lokasi sebelum persetujuan';end if;
    update public.laporan_meeting set status='terjadwal',versi=versi+1,updated_at=now() where id=rid returning * into nm;
   elsif act='batal_meeting' then update public.laporan_meeting set status='batal',versi=versi+1,updated_at=now() where id=rid returning * into nm;
   elsif act='notulen' then
    if not pusat or oldm.status<>'terjadwal' or oldm.waktu>now() or length(trim(coalesce(p->>'notulen',''))) not between 3 and 12000 or length(coalesce(p->>'tindak_lanjut',''))>12000 then raise exception 'Notulen diisi Akunting setelah waktu meeting terjadwal';end if;
    update public.laporan_meeting set status='selesai',notulen=trim(p->>'notulen'),tindak_lanjut=coalesce(p->>'tindak_lanjut',''),versi=versi+1,updated_at=now() where id=rid returning * into nm;
   else raise exception 'Aksi meeting tidak valid';end if;
   insert into public.laporan_meeting_riwayat(meeting_id,laporan_id,sebelum,sesudah,alasan,aktor) values(nm.id,l,to_jsonb(oldm),to_jsonb(nm),alasan,uid);
   insert into public.notifikasi(pengguna_id,judul,isi,tautan) select v,'Meeting laporan diperbarui',nm.judul||' · '||nm.status,'/laporan/'||l||'/tindak-lanjut' from unnest(nm.peserta) v where v<>uid;
  end if;
  hasil:=jsonb_build_object('id',nm.id,'ok','Meeting tersimpan');
 else raise exception 'Aksi tidak dikenal';end if;
 insert into laporan_lanjut_internal.perintah values(req,uid,p,hasil);
 return hasil;
end $$;
revoke all on function laporan_lanjut_internal.simpan(jsonb) from public,anon;
grant execute on function laporan_lanjut_internal.simpan(jsonb) to authenticated;
create function public.kelola_laporan_lanjut(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select laporan_lanjut_internal.simpan(p)$$;
revoke all on function public.kelola_laporan_lanjut(jsonb) from public,anon;
grant execute on function public.kelola_laporan_lanjut(jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('laporan-bukti-bayar','laporan-bukti-bayar',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
create function laporan_lanjut_internal.bukti_baca(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.laporan_bayar b where b.bukti=path and laporan_lanjut_internal.boleh(b.laporan_id)) or exists(select 1 from public.laporan_bayar_riwayat h where (h.sesudah->>'bukti'=path or h.sebelum->>'bukti'=path) and laporan_lanjut_internal.boleh(h.laporan_id))
$$;
revoke all on function laporan_lanjut_internal.bukti_baca(text) from public,anon;
grant execute on function laporan_lanjut_internal.bukti_baca(text) to authenticated;
create policy laporan_bukti_insert on storage.objects for insert to authenticated with check(bucket_id='laporan-bukti-bayar' and (select laporan_lanjut_internal.pusat()) and split_part(name,'/',2)=(select auth.uid())::text and exists(select 1 from public.laporan_bulanan l where l.id::text=split_part(name,'/',1) and l.mode='asli' and l.deleted_at is null));
create policy laporan_bukti_read on storage.objects for select to authenticated using(bucket_id='laporan-bukti-bayar' and laporan_lanjut_internal.bukti_baca(name));
