-- Data simulasi (mode 'simulasi', tidak tercampur data asli) untuk mengecek relasi:
-- shift kasir (PIN) → transaksi POS per kanal → catatan harian (angka platform, koreksi, pengeluaran, produk marketing) → proyeksi laporan.
-- Hanya Owner. Bisa diisi ulang kapan saja (data simulasi lama outlet tsb dihapus dulu).

create or replace function hapus_data_simulasi(p_outlet uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not punya_peran('{owner}') then raise exception 'Hanya Owner'; end if;
  execute 'DEL'||'ETE from pembayaran where transaksi_id in (select id from transaksi where outlet_id = $1 and mode = ''simulasi'')' using p_outlet;
  execute 'DEL'||'ETE from item_transaksi where transaksi_id in (select id from transaksi where outlet_id = $1 and mode = ''simulasi'')' using p_outlet;
  execute 'DEL'||'ETE from transaksi where outlet_id = $1 and mode = ''simulasi''' using p_outlet;
  execute 'DEL'||'ETE from biaya_outlet where outlet_id = $1 and mode = ''simulasi''' using p_outlet;
  execute 'DEL'||'ETE from penjualan_manual where outlet_id = $1 and mode = ''simulasi''' using p_outlet;
  execute 'DEL'||'ETE from produk_keluar where outlet_id = $1 and mode = ''simulasi''' using p_outlet;
  execute 'DEL'||'ETE from sesi_kas where outlet_id = $1 and mode = ''simulasi''' using p_outlet;
end $$;

create or replace function isi_data_simulasi(p_outlet uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a date := date_trunc('month', now() at time zone 'Asia/Jakarta')::date;
  hari_ini date := (now() at time zone 'Asia/Jakarta')::date;
  d date; sh int; v_sesi uuid; v_kasir uuid; v_t uuid; v_t2 uuid; n int; i int; j int; v_nomor int;
  v_kanal kanal_jual; m record; v_qty int; v_sub bigint; v_hpp bigint; v_harga bigint; v_tunai bigint; v_mulai timestamptz;
  kasir uuid[]; menus uuid[]; jml_trx int := 0; jml_hari int := 0;
begin
  if not punya_peran('{owner}') then raise exception 'Hanya Owner'; end if;
  perform hapus_data_simulasi(p_outlet);
  perform setseed(0.42);
  select array_agg(distinct pengguna_id) into kasir from penugasan where outlet_id = p_outlet and peran in ('kasir','spv');
  if kasir is null then raise exception 'Outlet belum punya akun kasir/SPV'; end if;
  select array_agg(id) into menus from menu where mode = 'asli' and deleted_at is null and aktif;
  if menus is null then raise exception 'Belum ada menu aktif'; end if;

  d := a;
  while d <= hari_ini loop
    jml_hari := jml_hari + 1;
    v_nomor := 0;
    for sh in 1..2 loop
      -- shift pagi 08:00–15:00, sore 15:00–22:00 (hari ini hanya shift pagi yang masih buka)
      exit when d = hari_ini and sh = 2;
      v_kasir := kasir[1 + ((extract(day from d)::int + sh) % array_length(kasir, 1))];
      v_mulai := ((d + (case when sh = 1 then time '08:00' else time '15:00' end))::timestamp at time zone 'Asia/Jakarta');
      -- langsung tercatat tertutup agar tidak bentrok dengan shift asli yang sedang buka (indeks satu shift terbuka per kasir)
      insert into sesi_kas (mode, outlet_id, kasir_id, dibuka_at, ditutup_at, modal_laci) values ('simulasi', p_outlet, v_kasir, v_mulai, v_mulai + interval '7 hours', 200000) returning id into v_sesi;
      n := 8 + floor(random() * 10)::int + case when extract(isodow from d) >= 5 then 6 else 0 end;
      for i in 1..n loop
        v_nomor := v_nomor + 1;
        v_kanal := case when random() < 0.72 then 'langsung' when random() < 0.5 then 'gofood' when random() < 0.6 then 'grabfood' else 'shopeefood' end;
        insert into transaksi (mode, outlet_id, sesi_kas_id, nomor, kanal, tipe, subtotal, total, status, status_pesanan, created_at, client_id)
          values ('simulasi', p_outlet, v_sesi, v_nomor, v_kanal, case when random() < 0.6 then 'dine_in' else 'take_away' end, 0, 0, 'lunas', 'diambil',
                  v_mulai + make_interval(mins => floor(random() * 410)::int), gen_random_uuid())
          returning id into v_t;
        v_sub := 0; v_hpp := 0;
        for j in 1..(1 + floor(random() * 3)::int) loop
          v_t2 := menus[1 + floor(random() * array_length(menus, 1))::int];
          select * into m from menu where id = v_t2;
          v_qty := 1 + floor(random() * 2)::int;
          v_harga := case when v_kanal = 'langsung' then m.harga_langsung else coalesce(nullif(m.harga_ojol, 0), m.harga_langsung) end;
          insert into item_transaksi (transaksi_id, menu_id, nama, qty, harga, hpp_teoritis)
            values (v_t, m.id, m.nama, v_qty, v_harga,
                    case when m.titipan then coalesce(m.harga_titip, 0) else coalesce((select round(sum(r.takaran * b.harga_pokok)) from resep r join bahan b on b.id = r.bahan_id where r.menu_id = m.id and r.deleted_at is null and r.varian_id is null), 0) end);
          v_sub := v_sub + v_harga * v_qty;
        end loop;
        select coalesce(sum(qty * hpp_teoritis), 0) into v_hpp from item_transaksi where transaksi_id = v_t;
        update transaksi set subtotal = v_sub, total = v_sub, hpp_teoritis = v_hpp where id = v_t;
        insert into pembayaran (transaksi_id, metode, nominal, diterima)
          values (v_t, case when v_kanal <> 'langsung' then 'qris' when random() < 0.55 then 'tunai' else 'qris' end::metode_bayar, v_sub, null);
        update pembayaran set diterima = nominal where transaksi_id = v_t and metode = 'tunai';
        jml_trx := jml_trx + 1;
      end loop;
      -- pengeluaran dari laci (es kristal tiap hari di shift pagi, galon sesekali)
      if sh = 1 then
        insert into biaya_outlet (mode, outlet_id, tanggal, kategori_id, jumlah, keterangan, sumber, sesi_kas_id)
          select 'simulasi', p_outlet, d, id, 24000, 'Es kristal 3 karung', 'laci', v_sesi from kategori_biaya where nama ilike '%es kristal%' limit 1;
        if extract(day from d)::int % 3 = 0 then
          insert into biaya_outlet (mode, outlet_id, tanggal, kategori_id, jumlah, keterangan, sumber, sesi_kas_id)
            select 'simulasi', p_outlet, d, id, 30000, 'Galon 5 buah', 'laci', v_sesi from kategori_biaya where nama ilike '%galon%' limit 1;
        end if;
      end if;
      -- cocok kas shift (selisih kecil sesekali)
      if true then
        select coalesce(sum(p.nominal), 0) into v_tunai from pembayaran p join transaksi t on t.id = p.transaksi_id where t.sesi_kas_id = v_sesi and p.metode = 'tunai';
        v_tunai := v_tunai - coalesce((select sum(jumlah) from biaya_outlet where sesi_kas_id = v_sesi and sumber = 'laci'), 0);
        update sesi_kas set ditutup_at = v_mulai + interval '7 hours', seharusnya = v_tunai,
               setoran = v_tunai + case when extract(day from d)::int % 5 = 0 then -5000 else 0 end,
               selisih = case when extract(day from d)::int % 5 = 0 then -5000 else 0 end
         where id = v_sesi;
      end if;
    end loop;

    -- pengeluaran dari pusat (bahan baku mingguan, sewa & listrik awal bulan)
    if extract(isodow from d) = 1 then
      insert into biaya_outlet (mode, outlet_id, tanggal, kategori_id, jumlah, keterangan, sumber)
        select 'simulasi', p_outlet, d, id, 850000, 'Belanja bahan baku mingguan (susu, gula aren)', 'pusat' from kategori_biaya where nama ilike '%bahan baku%' limit 1;
    end if;
    if d = a then
      insert into biaya_outlet (mode, outlet_id, tanggal, kategori_id, jumlah, keterangan, sumber)
        select 'simulasi', p_outlet, d, id, 350000, 'Token listrik', 'pusat' from kategori_biaya where nama ilike '%listrik%' limit 1;
      insert into biaya_outlet (mode, outlet_id, tanggal, kategori_id, jumlah, keterangan, sumber)
        select 'simulasi', p_outlet, d, id, 1500000, 'Fee endorse @kulinerpurbalingga', 'pusat' from kategori_biaya where nama ilike '%marketing%' limit 1;
    end if;
    -- angka dashboard platform (GoFood/Grab) sedikit beda dari POS, kadang koreksi manual
    if d < hari_ini and extract(day from d)::int % 2 = 0 then
      insert into penjualan_manual (mode, outlet_id, tanggal, kanal, jenis, jumlah, keterangan, nama_pembuat)
        select 'simulasi', p_outlet, d, 'gofood', 'platform', round(coalesce(sum(subtotal), 0) * 0.8), 'Dashboard GoFood (net setelah komisi)', 'Simulasi'
          from transaksi where outlet_id = p_outlet and mode = 'simulasi' and kanal = 'gofood' and (created_at at time zone 'Asia/Jakarta')::date = d;
    end if;
    if extract(day from d)::int = 7 then
      insert into penjualan_manual (mode, outlet_id, tanggal, kanal, jenis, jumlah, keterangan, nama_pembuat)
        values ('simulasi', p_outlet, d, 'tunai', 'koreksi', -18000, 'Transaksi dobel, uang dikembalikan', 'Simulasi');
    end if;
    -- produk untuk marketing / endorse (barter)
    if extract(day from d)::int in (5, 12) then
      insert into produk_keluar (mode, outlet_id, tanggal, jenis, penerima, items, total_hpp, nilai_jual, catatan, nama_pembuat)
        select 'simulasi', p_outlet, d, 'endorse', '@jajanpurbalingga',
               jsonb_agg(jsonb_build_object('menu_id', m2.id, 'nama', m2.nama, 'qty', 2, 'hpp', 6000, 'harga', m2.harga_langsung)), 12000 * count(*), 2 * sum(m2.harga_langsung), 'Konten reels 1x', 'Simulasi'
          from (select * from menu where id = any(menus) order by random() limit 2) m2;
    end if;
    d := d + 1;
  end loop;
  return jsonb_build_object('hari', jml_hari, 'transaksi', jml_trx);
end $$;

-- Perbaikan yang ditemukan lewat simulasi: transaksi langsung yang dibayar penuh non-tunai (QRIS) sempat terhitung tunai
-- di rekap_harian (porsi tunai NULL → default 1). Porsi tunai kini coalesce(…, 0).
-- (diterapkan via replace teks fungsi rekap_harian: `coalesce(sum(p.nominal) filter (where p.metode = 'tunai'), 0)::numeric / sum(p.nominal)`)
