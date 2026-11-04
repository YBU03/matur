-- Tong sampah penjualan (Owner/Admin Pusat/Finance): hapus → status 'dihapus' (bisa dipulihkan), stok & kas otomatis menyesuaikan.
-- Koreksi kanal/metode bayar untuk salah klik. Rekap kas harian memakai tanggal shift kas.
alter table public.transaksi add column if not exists dihapus_at timestamptz, add column if not exists dihapus_oleh uuid,
  add column if not exists dihapus_alasan text, add column if not exists status_sebelum text;

create schema if not exists koreksi_internal;
revoke all on schema koreksi_internal from public, anon;
grant usage on schema koreksi_internal to authenticated;

create or replace function koreksi_internal.geser_kas(p_sesi uuid, p_delta bigint) returns void language sql security definer set search_path = '' as $$
  update public.sesi_kas set seharusnya = coalesce(seharusnya, 0) + p_delta, kas_seharusnya = coalesce(kas_seharusnya, 0) + p_delta,
    selisih = coalesce(setoran, 0) - (coalesce(seharusnya, 0) + p_delta)
  where id = p_sesi and ditutup_at is not null and p_delta <> 0
$$;

create or replace function public.hapus_transaksi(p_id uuid, p_alasan text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transaksi; r record; tunai bigint;
begin
  if not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Finance'; end if;
  if length(trim(coalesce(p_alasan, ''))) < 3 then raise exception 'Alasan hapus wajib diisi'; end if;
  select * into t from transaksi where id = p_id for update;
  if t.id is null or t.status = 'dihapus' then raise exception 'Transaksi tidak ditemukan atau sudah di tempat sampah'; end if;
  if t.status = 'lunas' then
    for r in select bahan_id, sum(jumlah) jml from mutasi_stok where ref_id = t.id and jenis in ('pemakaian', 'void', 'koreksi') group by bahan_id having sum(jumlah) <> 0 loop
      perform geser_stok(t.mode, t.outlet_id, r.bahan_id, -r.jml, 'void', t.id, 'Hapus transaksi #' || t.nomor);
    end loop;
    select coalesce(sum(nominal), 0) into tunai from pembayaran where transaksi_id = t.id and metode = 'tunai';
    perform koreksi_internal.geser_kas(t.sesi_kas_id, -tunai);
  end if;
  update transaksi set status_sebelum = status, status = 'dihapus', dihapus_at = now(), dihapus_oleh = auth.uid(), dihapus_alasan = trim(p_alasan) where id = t.id;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru) values (auth.uid(), 'hapus_transaksi', 'transaksi', t.id::text, jsonb_build_object('alasan', trim(p_alasan), 'nomor', t.nomor, 'total', t.total, 'status_sebelum', t.status));
  return jsonb_build_object('ok', 'Transaksi #' || t.nomor || ' dipindah ke tempat sampah.');
end $$;

create or replace function public.pulihkan_transaksi(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transaksi; r record; tunai bigint;
begin
  if not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Finance'; end if;
  select * into t from transaksi where id = p_id for update;
  if t.id is null or t.status <> 'dihapus' then raise exception 'Transaksi tidak ada di tempat sampah'; end if;
  if coalesce(t.status_sebelum, 'lunas') = 'lunas' then
    for r in select bahan_id, sum(jumlah) jml from mutasi_stok where ref_id = t.id and jenis = 'pemakaian' group by bahan_id having sum(jumlah) <> 0 loop
      perform geser_stok(t.mode, t.outlet_id, r.bahan_id, r.jml, 'koreksi', t.id, 'Pulihkan transaksi #' || t.nomor);
    end loop;
    select coalesce(sum(nominal), 0) into tunai from pembayaran where transaksi_id = t.id and metode = 'tunai';
    perform koreksi_internal.geser_kas(t.sesi_kas_id, tunai);
  end if;
  update transaksi set status = coalesce(status_sebelum, 'lunas'), status_sebelum = null, dihapus_at = null, dihapus_oleh = null, dihapus_alasan = null where id = t.id;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru) values (auth.uid(), 'pulihkan_transaksi', 'transaksi', t.id::text, jsonb_build_object('nomor', t.nomor));
  return jsonb_build_object('ok', 'Transaksi #' || t.nomor || ' dipulihkan.');
end $$;

create or replace function public.koreksi_transaksi(p_id uuid, p_kanal kanal_jual, p_metode metode_bayar, p_alasan text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t transaksi; b pembayaran; n int; delta bigint := 0;
begin
  if not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Finance'; end if;
  if length(trim(coalesce(p_alasan, ''))) < 3 then raise exception 'Alasan koreksi wajib diisi'; end if;
  select * into t from transaksi where id = p_id for update;
  if t.id is null or t.status <> 'lunas' then raise exception 'Hanya transaksi lunas yang bisa dikoreksi'; end if;
  if p_metode is not null then
    select count(*) into n from pembayaran where transaksi_id = t.id;
    if n <> 1 then raise exception 'Metode bayar hanya bisa diubah untuk transaksi dengan satu pembayaran'; end if;
    select * into b from pembayaran where transaksi_id = t.id;
    if b.metode <> p_metode then
      if b.metode = 'tunai' then delta := -b.nominal; elsif p_metode = 'tunai' then delta := b.nominal; end if;
      update pembayaran set metode = p_metode, diterima = case when p_metode = 'tunai' then coalesce(diterima, nominal) else null end where id = b.id;
      perform koreksi_internal.geser_kas(t.sesi_kas_id, delta);
    end if;
  end if;
  if p_kanal is not null and p_kanal <> t.kanal then update transaksi set kanal = p_kanal where id = t.id; end if;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru) values (auth.uid(), 'koreksi_transaksi', 'transaksi', t.id::text,
    jsonb_build_object('kanal', t.kanal, 'metode', b.metode), jsonb_build_object('kanal', coalesce(p_kanal, t.kanal), 'metode', coalesce(p_metode, b.metode), 'alasan', trim(p_alasan)));
  return jsonb_build_object('ok', 'Transaksi #' || t.nomor || ' dikoreksi.');
end $$;

revoke all on function koreksi_internal.geser_kas(uuid, bigint) from public, anon, authenticated;
revoke all on function public.hapus_transaksi(uuid, text), public.pulihkan_transaksi(uuid), public.koreksi_transaksi(uuid, kanal_jual, metode_bayar, text) from public, anon;
grant execute on function public.hapus_transaksi(uuid, text), public.pulihkan_transaksi(uuid), public.koreksi_transaksi(uuid, kanal_jual, metode_bayar, text) to authenticated;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.rekap_harian(uuid,date,mode_data)'::regprocedure);
  if position('select public.tgl_op(ditutup_at) tgl, sum(setoran)' in d) = 0 then raise exception 'pola rekap kas'; end if;
  d := replace(d, 'select public.tgl_op(ditutup_at) tgl, sum(setoran)', 'select coalesce(tanggal_shift, public.tgl_op(dibuka_at)) tgl, sum(setoran)');
  d := replace(d, $q$and ditutup_at >= public.awal_op(date_trunc('month', p_periode)::date)
       and ditutup_at < public.awal_op((date_trunc('month', p_periode) + interval '1 month')::date)$q$,
       $q$and coalesce(tanggal_shift, public.tgl_op(dibuka_at)) >= date_trunc('month', p_periode)::date
       and coalesce(tanggal_shift, public.tgl_op(dibuka_at)) < (date_trunc('month', p_periode) + interval '1 month')::date$q$);
  execute d;

  d := pg_get_functiondef('public.laporan_operasional(text,uuid,date,date,mode_data,uuid)'::regprocedure);
  if position($q$select jsonb_build_object('waktu', t.created_at, 'nomor', t.nomor,$q$ in d) = 0 then raise exception 'pola transaksi'; end if;
  d := replace(d, $q$select jsonb_build_object('waktu', t.created_at, 'nomor', t.nomor,$q$,
    $q$select jsonb_build_object('id', t.id, 'waktu', t.created_at, 'nomor', t.nomor,
        'kategori', (select string_agg(distinct km.nama, ', ') from item_transaksi i2 join menu m2 on m2.id = i2.menu_id join kategori_menu km on km.id = m2.kategori_id where i2.transaksi_id = t.id),
        'dihapus_alasan', t.dihapus_alasan, 'dihapus_at', t.dihapus_at,$q$);
  execute d;
end $$;
