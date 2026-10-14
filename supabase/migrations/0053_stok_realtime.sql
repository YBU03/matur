-- Stok real-time: stok berkurang otomatis tiap transaksi POS (resep), dipantau gudang, kasir/SPV, akunting.
-- stok_realtime(): stok kini + pemakaian harian 28 hari (untuk smart forecast) + stok saat tutup shift + pemakaian per shift.
-- kirim_notif_stok(): push notifikasi bahan di bawah batas minimum (maks. 1x / 12 jam per bahan per lokasi).

alter publication supabase_realtime add table stok;

create or replace function stok_realtime(p_outlet uuid, p_mode mode_data default 'asli') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hari date := (now() at time zone 'Asia/Jakarta')::date;
  awal timestamptz := ((hari - 28)::timestamp at time zone 'Asia/Jakarta');
  v_tutup timestamptz; v_bahan jsonb; v_shift jsonb;
begin
  if p_outlet is null then
    if not punya_peran('{owner,admin_pusat,finance,admin_gudang}') then raise exception 'Tidak diizinkan'; end if;
  elsif not boleh_outlet(p_outlet) then raise exception 'Tidak diizinkan';
  end if;
  if p_outlet is not null then
    select max(ditutup_at) into v_tutup from sesi_kas where outlet_id = p_outlet and mode = p_mode and ditutup_at is not null;
  end if;

  with g as (
    select m.bahan_id, (m.created_at at time zone 'Asia/Jakarta')::date d,
           -sum(m.jumlah) filter (where m.jenis in ('pemakaian','void','marketing','waste','kiriman_keluar','kiriman_batal','transfer_keluar')) pakai,
           sum(m.jumlah) filter (where m.jenis in ('pembelian','kiriman_masuk','transfer_masuk')) masuk
      from mutasi_stok m
     where m.mode = p_mode and m.outlet_id is not distinct from p_outlet and m.created_at >= awal
     group by 1, 2
  ), b as (
    select bh.* from bahan bh
     where bh.mode = 'asli' and bh.deleted_at is null
       and (exists (select 1 from resep r where r.bahan_id = bh.id and r.deleted_at is null)
            or exists (select 1 from stok s where s.bahan_id = bh.id and s.mode = p_mode and s.outlet_id is not distinct from p_outlet)
            or exists (select 1 from g where g.bahan_id = bh.id))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'nama', b.nama, 'kategori', b.kategori, 'satuan', b.satuan_pakai, 'satuan_beli', b.satuan_beli,
      'konversi', coalesce(nullif(b.konversi, 0), 1), 'stok_min', coalesce(b.stok_min, 0), 'harga', round(nilai_bahan(b), 2),
      'stok', coalesce(s.jumlah, 0), 'diubah', s.updated_at,
      'stok_tutup', case when v_tutup is not null then coalesce(s.jumlah, 0) - coalesce((select sum(m.jumlah) from mutasi_stok m where m.bahan_id = b.id and m.mode = p_mode and m.outlet_id is not distinct from p_outlet and m.created_at > v_tutup), 0) end,
      'masuk_hari_ini', coalesce((select g.masuk from g where g.bahan_id = b.id and g.d = hari), 0),
      'harian', (select jsonb_agg(jsonb_build_object('tanggal', dd::date, 'pakai', coalesce(g.pakai, 0)) order by dd)
                   from generate_series(hari - 28, hari, interval '1 day') dd left join g on g.bahan_id = b.id and g.d = dd::date)
    ) order by b.kategori, b.nama), '[]')
    into v_bahan
    from b left join stok s on s.bahan_id = b.id and s.mode = p_mode and s.outlet_id is not distinct from p_outlet;

  if p_outlet is not null then
    select coalesce(jsonb_agg(x order by x->>'dibuka_at' desc), '[]') into v_shift from (
      select jsonb_build_object('id', s.id, 'kasir', s.nama_kasir, 'dibuka_at', s.dibuka_at, 'ditutup_at', s.ditutup_at,
        'transaksi', (select count(*) from transaksi t where t.sesi_kas_id = s.id and t.status = 'lunas'),
        'bahan', (select coalesce(jsonb_agg(y order by (y->>'jumlah')::numeric desc), '[]') from (
                    select jsonb_build_object('nama', bh.nama, 'satuan', bh.satuan_pakai, 'jumlah', -sum(m.jumlah)) y
                      from mutasi_stok m join transaksi t on t.id = m.ref_id join bahan bh on bh.id = m.bahan_id
                     where t.sesi_kas_id = s.id and m.jenis = 'pemakaian'
                     group by bh.id, bh.nama, bh.satuan_pakai
                     order by -sum(m.jumlah) desc limit 6) z)) x
      from sesi_kas s where s.outlet_id = p_outlet and s.mode = p_mode
      order by s.dibuka_at desc limit 6) q;
  end if;
  return jsonb_build_object('hari', hari, 'tutup_terakhir', v_tutup, 'bahan', v_bahan, 'shift', coalesce(v_shift, '[]'));
end $$;

create table if not exists notif_stok (
  lokasi text not null,
  bahan_id uuid not null references bahan on delete cascade,
  dikirim_at timestamptz not null default now(),
  primary key (lokasi, bahan_id)
);
alter table notif_stok enable row level security;

create or replace function kirim_notif_stok() returns int language plpgsql security definer set search_path = public as $$
declare v_payload jsonb; v_secret text; v_n int; jam int := extract(hour from now() at time zone 'Asia/Jakarta');
begin
  if jam < 7 or jam > 21 then return 0; end if;
  with lok as (
    select o.id outlet_id, o.id::text kunci, o.nama from outlet o where o.mode = 'asli' and o.deleted_at is null
       and exists (select 1 from stok s where s.outlet_id = o.id and s.mode = 'asli')
    union all select null, 'gudang', 'Gudang Pusat'
  ), rendah as (
    select l.kunci, l.outlet_id, l.nama lokasi, b.id bahan_id, b.nama, s.jumlah, b.stok_min, coalesce(nullif(b.konversi, 0), 1) k, b.satuan_beli, b.satuan_pakai
      from lok l join stok s on s.outlet_id is not distinct from l.outlet_id and s.mode = 'asli'
      join bahan b on b.id = s.bahan_id and b.deleted_at is null and coalesce(b.stok_min, 0) > 0
     where s.jumlah < b.stok_min
       and (l.outlet_id is null or exists (select 1 from resep r where r.bahan_id = b.id and r.deleted_at is null))
       and not exists (select 1 from notif_stok n where n.lokasi = l.kunci and n.bahan_id = b.id and n.dikirim_at > now() - interval '12 hours')
  ), catat as (
    insert into notif_stok (lokasi, bahan_id) select kunci, bahan_id from rendah
    on conflict (lokasi, bahan_id) do update set dikirim_at = now() returning lokasi
  ), per_lok as (
    select kunci, outlet_id, lokasi, count(*) n,
           string_agg(nama || ' sisa ' || case when k > 1 then trim(to_char(greatest(jumlah, 0) / k, 'FM999990.0')) || ' ' || coalesce(satuan_beli, '') else trim(to_char(greatest(jumlah, 0), 'FM999990.##')) || ' ' || coalesce(satuan_pakai, '') end, ', ' order by jumlah / stok_min) daftar
      from rendah group by kunci, outlet_id, lokasi
  ), penerima as (
    select distinct p.kunci, t.pengguna_id from per_lok p join penugasan t
      on (t.peran in ('owner','admin_pusat','admin_gudang') and t.outlet_id is null)
      or (p.outlet_id is not null and t.outlet_id = p.outlet_id and t.peran = 'spv')
  )
  select jsonb_agg(jsonb_build_object('endpoint', l.endpoint, 'p256dh', l.p256dh, 'auth', l.auth,
           'judul', '⚠ Stok menipis · ' || p.lokasi,
           'isi', left(p.daftar, 220) || case when p.n > 3 then ' (' || p.n || ' bahan)' else '' end || '. Segera restock.',
           'url', '/stok-realtime?lokasi=' || p.kunci)), count(*)
    into v_payload, v_n
    from per_lok p join penerima r on r.kunci = p.kunci join push_langganan l on l.pengguna_id = r.pengguna_id
   where exists (select 1 from catat);
  if coalesce(v_n, 0) = 0 then return 0; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  perform net.http_post(url := 'https://matoer.vercel.app/api/push/kirim', body := jsonb_build_object('pesan', v_payload),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret));
  return v_n;
end $$;
revoke execute on function kirim_notif_stok() from public, anon, authenticated;

-- dijadwalkan tiap jam (menit ke-7):
--   select cron.schedule('notif-stok', '7 * * * *', 'select public.kirim_notif_stok()');
