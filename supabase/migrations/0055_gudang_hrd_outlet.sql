-- Kepemilikan independen dari perjanjian/bagi hasil. Jenis lain dapat diketik sendiri.
alter table outlet add column kepemilikan text;
update outlet set kepemilikan = 'Pusat' where mode = 'asli' and deleted_at is null and nama ilike '%Usman Janatin%';
alter table outlet add constraint kepemilikan_tidak_kosong check (kepemilikan is null or length(trim(kepemilikan)) between 1 and 80);

-- Mode dinamis di sini adalah integrasi penyedia, belum aktif sampai adapter tersedia.
alter table outlet add column qris_mode text not null default 'statis' check (qris_mode in ('statis','dinamis'));
create or replace function atur_qris(p_outlet uuid, p_url text, p_payload text, p_nama text, p_dinamis boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not punya_peran('{owner,admin_pusat,admin_gudang}') then raise exception 'Tidak diizinkan'; end if;
  if nullif(p_payload, '') is not null and p_payload !~ '^000201' then raise exception 'Isi QRIS tidak valid'; end if;
  update outlet set qris_url = nullif(p_url, ''), qris_payload = nullif(p_payload, ''), qris_nama = nullif(trim(p_nama), ''),
    qris_dinamis = false, qris_mode = case when p_dinamis then 'dinamis' else 'statis' end where id = p_outlet;
  if not found then raise exception 'Outlet tidak ditemukan'; end if;
end $$;
revoke execute on function atur_qris(uuid,text,text,text,boolean) from public, anon;
grant execute on function atur_qris(uuid,text,text,text,boolean) to authenticated;

-- HPP + resep + menu baru disimpan atomik; bahan wajib memakai ID dan satuan pakai gudang.
create or replace function tambah_hpp(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare mid uuid; hid uuid; x jsonb; b bahan; komponen jsonb := '[]'; total numeric := 0;
  takaran numeric; seri_hpp text := coalesce(p->>'seri', 'Ice');
begin
  if not punya_peran('{owner,admin_pusat,admin_gudang}') then raise exception 'Tidak diizinkan'; end if;
  if seri_hpp not in ('Ice','Hot','Can') then raise exception 'Seri tidak valid'; end if;
  if jsonb_typeof(p->'bahan') is distinct from 'array' or jsonb_array_length(p->'bahan') not between 1 and 100 then raise exception 'Isi 1–100 bahan'; end if;
  mid := nullif(p->>'menu_id','')::uuid;
  if mid is null then
    if length(trim(coalesce(p->>'nama',''))) not between 1 and 100 or coalesce((p->>'harga')::bigint,0) <= 0 or coalesce((p->>'harga_ojol')::bigint,0) <= 0 then raise exception 'Nama dan harga menu wajib diisi'; end if;
    insert into menu (mode,nama,kategori_id,harga_langsung,harga_ojol,aktif)
      values ('asli',trim(p->>'nama'),nullif(p->>'kategori_id','')::uuid,(p->>'harga')::bigint,(p->>'harga_ojol')::bigint,true) returning id into mid;
  end if;
  perform id from menu where id = mid and mode = 'asli' and deleted_at is null and not coalesce(titipan,false) for update;
  if not found then raise exception 'Pilih menu aktif non-titipan'; end if;
  if exists(select 1 from hpp_menu where menu_id = mid and seri = seri_hpp and deleted_at is null) then raise exception 'HPP seri ini sudah ada'; end if;
  -- POS menggunakan resep dasar. Seri tambahan tidak boleh diam-diam mengganti resep tersebut.
  if exists(select 1 from resep where menu_id = mid and deleted_at is null) then raise exception 'Menu sudah punya resep. Gunakan menu POS baru untuk resep berbeda'; end if;
  if exists(select 1 from jsonb_array_elements(p->'bahan') z group by z->>'id' having count(*) > 1) then raise exception 'Bahan tidak boleh berulang'; end if;
  for x in select * from jsonb_array_elements(p->'bahan') loop
    select * into b from bahan where id = (x->>'id')::uuid and mode = 'asli' and deleted_at is null for share;
    if not found then raise exception 'Bahan tidak ditemukan'; end if;
    takaran := (x->>'qty')::numeric;
    if takaran is null or takaran <= 0 or takaran > 1000000 then raise exception 'Takaran tidak valid'; end if;
    komponen := komponen || jsonb_build_array(jsonb_build_object('nama',b.nama,'qty',takaran,'satuan',b.satuan_pakai,'harga_unit',coalesce(b.harga_pokok,0),'biaya',round(takaran * coalesce(b.harga_pokok,0),4)));
    total := total + takaran * coalesce(b.harga_pokok,0);
    insert into resep (mode,menu_id,bahan_id,takaran) values ('asli',mid,b.id,takaran);
  end loop;
  insert into hpp_menu(menu_id,nama_hpp,seri,komponen,total_hpp)
    select mid,nama,seri_hpp,komponen,round(total,4) from menu where id = mid returning id into hid;
  return hid;
end $$;
revoke execute on function tambah_hpp(jsonb) from public, anon;
grant execute on function tambah_hpp(jsonb) to authenticated;

-- Edit/hapus absensi dengan alasan, audit, perhitungan keterlambatan server, dan kunci gaji final.
create or replace function edit_absensi(p_id uuid, p_masuk timestamptz, p_pulang timestamptz, p_catatan text, p_alasan text, p_hapus boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare a absensi; j record; menit numeric; tol int; st text := 'tanpa_jadwal'; tel int := 0;
begin
  select * into a from absensi where id = p_id for update;
  if not found or not kelola_sdm(a.outlet_id) then raise exception 'Absensi tidak ditemukan atau tidak diizinkan'; end if;
  if length(trim(coalesce(p_alasan,''))) not between 3 and 300 then raise exception 'Alasan wajib 3–300 karakter'; end if;
  perform id from penggajian where mode = 'asli' and outlet_id = a.outlet_id and periode = date_trunc('month',a.tanggal)::date for update;
  if exists(select 1 from penggajian where mode = 'asli' and outlet_id = a.outlet_id and periode = date_trunc('month',a.tanggal)::date and status = 'final') then raise exception 'Gaji bulan ini sudah final. Buka kembali penggajian sebelum mengubah absensi'; end if;
  insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)
    values(auth.uid(),case when p_hapus then 'hapus_absensi' else 'edit_absensi' end,'absensi',p_id::text,to_jsonb(a),jsonb_build_object('alasan',trim(p_alasan),'masuk_at',p_masuk,'pulang_at',p_pulang,'catatan',p_catatan));
  if p_hapus then delete from absensi where id = p_id; return; end if;
  if p_masuk is null or p_masuk > now() or (p_pulang is not null and (p_pulang < p_masuk or p_pulang > now())) then raise exception 'Jam masuk/pulang tidak valid'; end if;
  if (p_masuk at time zone 'Asia/Jakarta')::date not between a.tanggal and a.tanggal + 1 then raise exception 'Jam masuk harus sesuai tanggal kerja'; end if;
  select s.jam_mulai into j from jadwal_shift js join shift_outlet s on s.id = js.shift_id where js.id = a.jadwal_id;
  if found then
    select coalesce(toleransi_telat_menit,5) into tol from perusahaan limit 1;
    menit := extract(epoch from ((p_masuk at time zone 'Asia/Jakarta') - (a.tanggal + j.jam_mulai))) / 60;
    st := 'tepat';
    if menit > coalesce(tol,5) then st := 'telat'; tel := ceil(menit)::int; end if;
  end if;
  update absensi set masuk_at=p_masuk,pulang_at=p_pulang,catatan=nullif(left(trim(p_catatan),300),''),status=st,telat_menit=tel where id=p_id;
end $$;
revoke execute on function edit_absensi(uuid,timestamptz,timestamptz,text,text,boolean) from public, anon;
grant execute on function edit_absensi(uuid,timestamptz,timestamptz,text,text,boolean) to authenticated;


alter table outlet add column qris_penyedia text;
alter table outlet add column qris_merchant_id text;
create or replace function atur_qris_integrasi(p_outlet uuid, p_url text, p_payload text, p_nama text, p_dinamis boolean, p_penyedia text, p_merchant text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform atur_qris(p_outlet,p_url,p_payload,p_nama,p_dinamis);
  update outlet set qris_penyedia=nullif(left(trim(p_penyedia),80),''), qris_merchant_id=nullif(left(trim(p_merchant),120),'') where id=p_outlet;
end $$;
revoke execute on function atur_qris_integrasi(uuid,text,text,text,boolean,text,text) from public, anon;
grant execute on function atur_qris_integrasi(uuid,text,text,text,boolean,text,text) to authenticated;

-- Pengelola memakai RPC audit; staf tetap absen melalui RPC yang sudah ada.
drop policy kelola on absensi;

-- Tantangan API langsung juga tidak boleh menandai pembayaran dinamis lunas secara manual.
create or replace function cek_qris_belum_aktif() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.metode = 'qris' and exists (
    select 1 from transaksi t join outlet o on o.id=t.outlet_id where t.id=new.transaksi_id and o.qris_mode='dinamis'
  ) then raise exception 'QRIS dinamis menunggu konfigurasi penyedia. Pilih metode lain'; end if;
  return new;
end $$;
create trigger qris_menunggu_konfigurasi before insert on pembayaran for each row execute function cek_qris_belum_aktif();
