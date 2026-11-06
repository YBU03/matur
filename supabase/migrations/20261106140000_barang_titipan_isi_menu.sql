-- STATUS: menunggu diterapkan (persetujuan Supabase). Titipan per BARANG (pcs/gram) + isi tiap menu titipan (sesuai PDF revisi akunting 5 Nov 2026).
-- HPP per porsi (menu.harga_titip) otomatis = Σ isi × harga satuan, sehingga mesin transaksi POS tidak berubah.
create table if not exists public.barang_titipan (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  kelompok text not null default 'snack' check (kelompok in ('dessert','snack','lain')),
  satuan text not null default 'pcs' check (length(trim(satuan)) between 1 and 20),
  harga numeric(14,2) not null default 0 check (harga >= 0),
  produsen_id uuid references public.produsen_titipan(id),
  produsen text,
  keterangan text,
  aktif boolean not null default true,
  urutan int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.isi_titipan (
  menu_id uuid not null references public.menu(id) on delete cascade,
  barang_id uuid not null references public.barang_titipan(id),
  qty numeric(12,3) not null check (qty > 0),
  primary key (menu_id, barang_id)
);
alter table public.barang_titipan enable row level security;
alter table public.isi_titipan enable row level security;
create policy baca on public.barang_titipan for select to authenticated using (true);
create policy baca on public.isi_titipan for select to authenticated using (true);
grant select on public.barang_titipan, public.isi_titipan to authenticated;

alter table public.titipan_masuk add column if not exists barang_id uuid references public.barang_titipan(id);
alter table public.titipan_masuk alter column menu_id drop not null;
alter table public.titipan_masuk drop constraint if exists titipan_masuk_menu_atau_barang;
alter table public.titipan_masuk add constraint titipan_masuk_menu_atau_barang check (menu_id is not null or barang_id is not null);
create index if not exists titipan_masuk_barang on public.titipan_masuk(outlet_id, barang_id);

create or replace function matur_internal.boleh_atur_titipan() returns boolean
language sql stable security definer set search_path = public as $$ select punya_peran('{owner,admin_pusat,finance,hrd,admin_gudang}') $$;

-- HPP per porsi = Σ isi × harga satuan (dibulatkan rupiah); menu tanpa isi tidak diubah
create or replace function matur_internal.sinkron_harga_titip(p_menu uuid) returns void
language sql security definer set search_path = public as $$
  update menu m set harga_titip = x.hpp
    from (select round(sum(i.qty * b.harga))::bigint hpp from isi_titipan i join barang_titipan b on b.id = i.barang_id where i.menu_id = p_menu) x
   where m.id = p_menu and x.hpp is not null and m.harga_titip is distinct from x.hpp;
$$;

-- terjual per barang (seluruh waktu s/d tanggal) untuk cek sisa
create or replace function matur_internal.terjual_barang_titipan(p_outlet uuid, p_barang uuid, p_sampai date) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(i.qty * it.qty) from item_transaksi i join transaksi t on t.id = i.transaksi_id join isi_titipan it on it.menu_id = i.menu_id
     where t.outlet_id = p_outlet and t.mode = 'asli' and t.status = 'lunas' and it.barang_id = p_barang and public.tgl_op(t.created_at) <= p_sampai), 0)
   + coalesce((select sum((x->>'qty')::numeric * it.qty) from produk_keluar pk cross join jsonb_array_elements(pk.items) x join isi_titipan it on it.menu_id::text = x->>'menu_id'
     where pk.outlet_id = p_outlet and pk.mode = 'asli' and pk.deleted_at is null and it.barang_id = p_barang and pk.tanggal <= p_sampai), 0);
$$;

create or replace function public.simpan_barang_titipan(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid := nullif(p->>'id', '')::uuid; n text := left(trim(coalesce(p->>'nama', '')), 80); lama barang_titipan; m uuid;
begin
  if not matur_internal.boleh_atur_titipan() then raise exception 'Hanya Owner/Admin Pusat/Finance/HRD/Admin Gudang'; end if;
  if length(n) < 2 then raise exception 'Nama barang minimal 2 huruf'; end if;
  if coalesce((p->>'harga')::numeric, -1) < 0 then raise exception 'Harga satuan tidak valid'; end if;
  if exists (select 1 from barang_titipan where lower(nama) = lower(n) and id is distinct from bid) then raise exception 'Barang "%" sudah ada', n; end if;
  if bid is null then
    insert into barang_titipan(nama, kelompok, satuan, harga, produsen_id, produsen, keterangan, aktif, urutan)
    values (n, coalesce(nullif(p->>'kelompok', ''), 'snack'), coalesce(nullif(trim(p->>'satuan'), ''), 'pcs'), (p->>'harga')::numeric,
            nullif(p->>'produsen_id', '')::uuid, nullif(trim(p->>'produsen'), ''), nullif(left(trim(p->>'keterangan'), 300), ''), coalesce((p->>'aktif')::boolean, true),
            coalesce((p->>'urutan')::int, (select coalesce(max(urutan), 0) + 1 from barang_titipan)))
    returning id into bid;
  else
    select * into lama from barang_titipan where id = bid for update;
    if lama.id is null then raise exception 'Barang tidak ditemukan'; end if;
    update barang_titipan set nama = n, kelompok = coalesce(nullif(p->>'kelompok', ''), kelompok), satuan = coalesce(nullif(trim(p->>'satuan'), ''), satuan),
      harga = (p->>'harga')::numeric, produsen_id = nullif(p->>'produsen_id', '')::uuid, produsen = nullif(trim(p->>'produsen'), ''),
      keterangan = nullif(left(trim(p->>'keterangan'), 300), ''), aktif = coalesce((p->>'aktif')::boolean, aktif), updated_at = now() where id = bid;
    for m in select menu_id from isi_titipan where barang_id = bid loop perform matur_internal.sinkron_harga_titip(m); end loop;
  end if;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru) values (auth.uid(), 'simpan_barang_titipan', 'barang_titipan', bid::text, to_jsonb(lama), p);
  return bid;
end $$;

create or replace function public.hapus_barang_titipan(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b barang_titipan; m uuid;
begin
  if not matur_internal.boleh_atur_titipan() then raise exception 'Hanya Owner/Admin Pusat/Finance/HRD/Admin Gudang'; end if;
  select * into b from barang_titipan where id = p_id for update;
  if b.id is null then raise exception 'Barang tidak ditemukan'; end if;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama) values (auth.uid(), 'hapus_barang_titipan', 'barang_titipan', p_id::text, to_jsonb(b));
  if exists (select 1 from titipan_masuk where barang_id = p_id) then
    update barang_titipan set aktif = false, updated_at = now() where id = p_id;
    return jsonb_build_object('ok', 'Barang sudah punya riwayat setoran, jadi dinonaktifkan (riwayat tetap utuh).');
  end if;
  for m in select menu_id from isi_titipan where barang_id = p_id loop
    delete from isi_titipan where menu_id = m and barang_id = p_id;
    perform matur_internal.sinkron_harga_titip(m);
  end loop;
  delete from barang_titipan where id = p_id;
  return jsonb_build_object('ok', 'Barang titipan dihapus.');
end $$;

-- isi satu menu: [{barang_id, qty}] (mengganti seluruh isi); HPP per porsi ikut diperbarui
create or replace function public.simpan_isi_titipan(p_menu uuid, p_isi jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x jsonb; lama jsonb; hpp bigint;
begin
  if not matur_internal.boleh_atur_titipan() then raise exception 'Hanya Owner/Admin Pusat/Finance/HRD/Admin Gudang'; end if;
  if not exists (select 1 from menu where id = p_menu and titipan and deleted_at is null) then raise exception 'Pilih menu titipan'; end if;
  if jsonb_typeof(coalesce(p_isi, '[]')) <> 'array' then raise exception 'Isi tidak valid'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('barang_id', barang_id, 'qty', qty)), '[]') into lama from isi_titipan where menu_id = p_menu;
  delete from isi_titipan where menu_id = p_menu;
  for x in select * from jsonb_array_elements(coalesce(p_isi, '[]')) loop
    if coalesce((x->>'qty')::numeric, 0) <= 0 then raise exception 'Jumlah isi harus lebih dari 0'; end if;
    insert into isi_titipan(menu_id, barang_id, qty) values (p_menu, (x->>'barang_id')::uuid, (x->>'qty')::numeric)
      on conflict (menu_id, barang_id) do update set qty = isi_titipan.qty + excluded.qty;
  end loop;
  perform matur_internal.sinkron_harga_titip(p_menu);
  select harga_titip into hpp from menu where id = p_menu;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru) values (auth.uid(), 'simpan_isi_titipan', 'menu', p_menu::text, lama, p_isi);
  return jsonb_build_object('ok', 'Isi menu disimpan · HPP per porsi ' || replace(to_char(hpp, 'FM999,999,999'), ',', '.'), 'hpp', hpp);
end $$;

-- rekap per barang (pcs/gram): awal, masuk, retur/rusak, terjual (+ asal per menu), sisa, tagihan
create or replace function public.rekap_titipan_barang(p_outlet uuid, p_awal date, p_akhir date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare hasil jsonb;
begin
  if auth.uid() is null or not boleh_outlet(p_outlet) then raise exception 'Tidak diizinkan'; end if;
  if p_awal is null or p_akhir is null or p_akhir < p_awal or p_akhir - p_awal > 366 then raise exception 'Rentang tanggal tidak valid'; end if;
  with jual as (
    select it.barang_id, i.menu_id, public.tgl_op(t.created_at) tanggal, i.qty porsi, i.qty * it.qty jumlah
      from item_transaksi i join transaksi t on t.id = i.transaksi_id join isi_titipan it on it.menu_id = i.menu_id
     where t.outlet_id = p_outlet and t.mode = 'asli' and t.status = 'lunas' and t.created_at < public.awal_op(p_akhir + 1)
    union all
    select it.barang_id, it.menu_id, pk.tanggal, (x->>'qty')::numeric, (x->>'qty')::numeric * it.qty
      from produk_keluar pk cross join jsonb_array_elements(pk.items) x join isi_titipan it on it.menu_id::text = x->>'menu_id'
     where pk.outlet_id = p_outlet and pk.mode = 'asli' and pk.deleted_at is null and pk.tanggal <= p_akhir
  ),
  j as (select barang_id, coalesce(sum(jumlah) filter (where tanggal < p_awal), 0) awal, coalesce(sum(jumlah) filter (where tanggal >= p_awal), 0) periode from jual group by 1),
  asal as (select barang_id, jsonb_agg(jsonb_build_object('menu', m.nama, 'porsi', s.porsi, 'jumlah', s.jumlah) order by s.jumlah desc) asal
     from (select barang_id, menu_id, sum(porsi) porsi, sum(jumlah) jumlah from jual where tanggal >= p_awal group by 1, 2) s join menu m on m.id = s.menu_id group by 1),
  ms as (select barang_id, coalesce(sum(qty) filter (where tanggal < p_awal), 0) awal, coalesce(sum(qty) filter (where tanggal >= p_awal and qty > 0), 0) masuk,
            coalesce(-sum(qty) filter (where tanggal >= p_awal and qty < 0), 0) keluar
       from titipan_masuk where outlet_id = p_outlet and barang_id is not null and tanggal <= p_akhir group by 1)
  select coalesce(jsonb_agg(jsonb_build_object('barang_id', b.id, 'nama', b.nama, 'kelompok', b.kelompok, 'satuan', b.satuan, 'harga', b.harga,
      'produsen', coalesce(b.produsen, '-'), 'keterangan', b.keterangan, 'aktif', b.aktif,
      'awal', coalesce(ms.awal, 0) - coalesce(j.awal, 0), 'masuk', coalesce(ms.masuk, 0), 'keluar', coalesce(ms.keluar, 0), 'terjual', coalesce(j.periode, 0),
      'sisa', coalesce(ms.awal, 0) + coalesce(ms.masuk, 0) - coalesce(ms.keluar, 0) - coalesce(j.awal, 0) - coalesce(j.periode, 0),
      'tagihan', round(coalesce(j.periode, 0) * b.harga), 'asal', coalesce(a.asal, '[]'))
      order by case b.kelompok when 'dessert' then 0 when 'snack' then 1 else 2 end, b.urutan, b.nama), '[]') into hasil
    from barang_titipan b left join ms on ms.barang_id = b.id left join j on j.barang_id = b.id left join asal a on a.barang_id = b.id
   where b.aktif or ms.barang_id is not null or j.barang_id is not null;
  return hasil;
end $$;

-- validasi catatan titipan: barang (baru) atau menu (lama)
create or replace function matur_internal.cek_titipan() returns trigger
language plpgsql security definer set search_path = public as $$
declare sisa numeric; jual numeric;
begin
  if new.qty = 0 or new.tanggal > (now() at time zone 'Asia/Jakarta')::date then raise exception 'Jumlah/tanggal titipan tidak valid'; end if;
  if new.barang_id is not null then
    if not exists (select 1 from barang_titipan where id = new.barang_id and aktif) then raise exception 'Pilih barang titipan aktif'; end if;
  elsif not exists (select 1 from menu where id = new.menu_id and mode = 'asli' and titipan and deleted_at is null) then raise exception 'Pilih menu titipan aktif'; end if;
  if new.qty < 0 and new.jenis = 'masuk' then new.jenis := 'koreksi'; end if;
  if (new.qty < 0 or new.jenis <> 'masuk') and length(trim(coalesce(new.catatan, ''))) < 3 then raise exception 'Catatan wajib untuk retur/rusak/koreksi'; end if;
  if new.jenis in ('retur', 'rusak') and new.qty > 0 then raise exception 'Retur/rusak harus mengurangi stok'; end if;
  perform pg_advisory_xact_lock(hashtext('titipan:' || new.outlet_id || ':' || coalesce(new.barang_id, new.menu_id)));
  if new.qty < 0 and new.jenis in ('retur', 'rusak') then
    if new.barang_id is not null then
      select coalesce(sum(qty), 0) into sisa from titipan_masuk where outlet_id = new.outlet_id and barang_id = new.barang_id;
      jual := matur_internal.terjual_barang_titipan(new.outlet_id, new.barang_id, new.tanggal);
    else
      select coalesce(sum(qty), 0) into sisa from titipan_masuk where outlet_id = new.outlet_id and menu_id = new.menu_id;
      select coalesce(sum(i.qty), 0) into jual from item_transaksi i join transaksi t on t.id = i.transaksi_id where t.outlet_id = new.outlet_id and t.mode = 'asli' and t.status = 'lunas' and i.menu_id = new.menu_id;
    end if;
    if -new.qty > greatest(sisa - jual, 0) then raise exception 'Retur/rusak melebihi sisa titipan'; end if;
  end if;
  return new;
end $$;

-- ubah catatan titipan (barang atau menu)
create or replace function public.ubah_titipan_masuk(p_id uuid, p_qty integer, p_tanggal date, p_jenis text, p_catatan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r titipan_masuk; j text := coalesce(nullif(trim(p_jenis), ''), 'masuk'); c text := nullif(left(trim(coalesce(p_catatan, '')), 200), ''); sisa numeric; jual numeric;
begin
  select * into r from titipan_masuk where id = p_id for update;
  if r.id is null then raise exception 'Catatan titipan tidak ditemukan'; end if;
  if not matur_internal.boleh_kelola_titipan(r.outlet_id) then raise exception 'Anda tidak punya akses mengelola titipan di outlet ini'; end if;
  if j not in ('masuk', 'retur', 'rusak', 'koreksi') then raise exception 'Jenis pencatatan tidak valid'; end if;
  if coalesce(p_qty, 0) = 0 then raise exception 'Jumlah tidak boleh 0'; end if;
  if p_tanggal is null or p_tanggal > (now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal tidak valid'; end if;
  if j in ('retur', 'rusak') and p_qty > 0 then p_qty := -p_qty; end if;
  if j = 'masuk' and p_qty < 0 then j := 'koreksi'; end if;
  if (p_qty < 0 or j <> 'masuk') and length(coalesce(c, '')) < 3 then raise exception 'Catatan wajib untuk retur/rusak/koreksi (min. 3 huruf)'; end if;
  perform pg_advisory_xact_lock(hashtext('titipan:' || r.outlet_id || ':' || coalesce(r.barang_id, r.menu_id)));
  if p_qty < 0 and p_qty < r.qty and j in ('retur', 'rusak') then
    if r.barang_id is not null then
      select coalesce(sum(qty), 0) into sisa from titipan_masuk where outlet_id = r.outlet_id and barang_id = r.barang_id and id <> r.id;
      jual := matur_internal.terjual_barang_titipan(r.outlet_id, r.barang_id, p_tanggal);
    else
      select coalesce(sum(qty), 0) into sisa from titipan_masuk where outlet_id = r.outlet_id and menu_id = r.menu_id and id <> r.id;
      select coalesce(sum(i.qty), 0) into jual from item_transaksi i join transaksi t on t.id = i.transaksi_id
        where t.outlet_id = r.outlet_id and t.mode = 'asli' and t.status = 'lunas' and i.menu_id = r.menu_id;
    end if;
    if -p_qty > greatest(sisa - jual, 0) then raise exception 'Retur/rusak melebihi sisa titipan'; end if;
  end if;
  update titipan_masuk set qty = p_qty, tanggal = p_tanggal, jenis = j, catatan = c where id = r.id;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (auth.uid(), 'ubah_titipan', 'titipan_masuk', r.id::text, to_jsonb(r), jsonb_build_object('qty', p_qty, 'tanggal', p_tanggal, 'jenis', j, 'catatan', c));
  return jsonb_build_object('ok', 'Catatan titipan diperbarui.');
end $$;

revoke all on function public.simpan_barang_titipan(jsonb), public.hapus_barang_titipan(uuid), public.simpan_isi_titipan(uuid, jsonb), public.rekap_titipan_barang(uuid, date, date) from public, anon;
grant execute on function public.simpan_barang_titipan(jsonb), public.hapus_barang_titipan(uuid), public.simpan_isi_titipan(uuid, jsonb), public.rekap_titipan_barang(uuid, date, date) to authenticated;
revoke all on function matur_internal.sinkron_harga_titip(uuid), matur_internal.terjual_barang_titipan(uuid, uuid, date), matur_internal.boleh_atur_titipan() from public, anon;
grant execute on function matur_internal.terjual_barang_titipan(uuid, uuid, date), matur_internal.boleh_atur_titipan() to authenticated;

-- ── isi awal sesuai PDF revisi akunting (5 Nov 2026) ──
do $$
declare pr uuid := (select produsen_id from menu where titipan and produsen = 'Bu Ratna' and produsen_id is not null limit 1);
  b record; bid uuid; m record;
begin
  for b in select * from (values
    ('New York Cheesecake','dessert','pcs',12000::numeric,'1 porsi 1 pcs',1),
    ('Burnt Cheesecake','dessert','pcs',10271,'1 porsi 1 pcs',2),
    ('Strawberry Crumble','dessert','pcs',12000,'1 porsi 1 pcs',3),
    ('Blueberry Crumble','dessert','pcs',12000,'1 porsi 1 pcs',4),
    ('Matcha Cheesecake','dessert','pcs',10606,'1 porsi 1 pcs',5),
    ('Ice Berg Cheesecake','dessert','pcs',10590,'1 porsi 1 pcs',6),
    ('Cheesecake Ubi Ungu','dessert','pcs',11000,'1 porsi 1 pcs',7),
    ('Dimsum Goreng','snack','pcs',2764,'1 porsi 4 pcs',11),
    ('Sosis','snack','pcs',2208,'didapat dari penjualan menu Sosis Goreng 4 pcs/porsi dan Mix Platter 3 pcs/porsi',12),
    ('Nugget','snack','pcs',1832,'didapat dari penjualan menu Mix Platter 3 pcs/porsi',13),
    ('Cireng','snack','pcs',1725,'1 porsi 5 pcs',14),
    ('French Fries','snack','gram',77,'didapat dari penjualan menu French Fries 100 gr/porsi dan Mix Platter 50 gr/porsi',15),
    ('Durian Goreng','snack','pcs',1886,'1 porsi 4 pcs',16),
    ('Lumpia Ayam','snack','pcs',1954,'1 porsi 4 pcs',17)
  ) v(nama, kelompok, satuan, harga, ket, urut) loop
    insert into barang_titipan(nama, kelompok, satuan, harga, produsen_id, produsen, keterangan, urutan)
    values (b.nama, b.kelompok, b.satuan, b.harga, pr, 'Bu Ratna', b.ket, b.urut) on conflict (nama) do nothing;
  end loop;
  for m in select * from (values
    ('New York Cheesecake','New York Cheesecake',1::numeric), ('Burnt Cheesecake','Burnt Cheesecake',1), ('Strawberry Crumble','Strawberry Crumble',1),
    ('Blueberry Crumble Cheesecake','Blueberry Crumble',1), ('Matcha Cheesecake','Matcha Cheesecake',1), ('Ice Berg Cheesecake','Ice Berg Cheesecake',1),
    ('Cheesecake Ubi Ungu','Cheesecake Ubi Ungu',1), ('Dimsum','Dimsum Goreng',4), ('Sosis Goreng','Sosis',4), ('Cireng','Cireng',5),
    ('French Fries','French Fries',100), ('Durian Goreng','Durian Goreng',4), ('Lumpia Ayam','Lumpia Ayam',4),
    ('Mix Platter','Sosis',3), ('Mix Platter','Nugget',3), ('Mix Platter','French Fries',50)
  ) v(menu, barang, qty) loop
    insert into isi_titipan(menu_id, barang_id, qty)
    select x.id, (select id from barang_titipan where nama = m.barang), m.qty from menu x where x.nama = m.menu and x.titipan and x.mode = 'asli' and x.deleted_at is null
    on conflict (menu_id, barang_id) do nothing;
  end loop;
  for m in select distinct menu_id from isi_titipan loop perform matur_internal.sinkron_harga_titip(m.menu_id); end loop;
end $$;
