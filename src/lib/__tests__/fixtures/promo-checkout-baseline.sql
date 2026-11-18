CREATE OR REPLACE FUNCTION matur_internal.buat_transaksi(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_outlet uuid := (p->>'outlet_id')::uuid;
  v_kanal kanal_jual := (p->>'kanal')::kanal_jual;
  v_sesi uuid; v_id uuid; v_nomor int;
  v_sub bigint := 0; v_hpp bigint := 0; v_diskon bigint := greatest(coalesce((p->>'diskon')::bigint, 0), 0);
  v_total bigint; v_batas int; v_diterima bigint; v_kembali bigint := 0; v_bayar jsonb; v_sum bigint := 0; v_oto otorisasi;
  it jsonb; m menu; v_harga bigint; v_nama text; v_vids uuid[]; v_item_hpp bigint; v_qty int; r record; b jsonb;
begin
  select id into v_id from transaksi where client_id = (p->>'client_id')::uuid;
  if v_id is not null then
    return (select jsonb_build_object('id', id, 'nomor', nomor, 'subtotal', subtotal, 'diskon', diskon, 'total', total, 'kembalian', 0, 'ulang', true) from transaksi where id = v_id);
  end if;
  if not peran_di_outlet(v_outlet, '{kasir,barista,spv}') then raise exception 'Tidak diizinkan bertransaksi di outlet ini'; end if;
  -- sesi aktif perangkat (shift dimulai staf dengan PIN), selain itu shift milik akun yang login
  if nullif(p->>'sesi_id', '') is not null then
    select id into v_sesi from sesi_kas where id = (p->>'sesi_id')::uuid and outlet_id = v_outlet and (ditutup_at is null or ((p->>'sinkron_offline')::boolean and rekap_status='sementara'));
  end if;
  if v_sesi is null then
    select id into v_sesi from sesi_kas where outlet_id = v_outlet and kasir_id = auth.uid() and (ditutup_at is null or ((p->>'sinkron_offline')::boolean and rekap_status='sementara'));
  end if;
  if v_sesi is null then raise exception 'Buka shift terlebih dahulu'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) = 0 then raise exception 'Keranjang kosong'; end if;

  v_id := gen_random_uuid();
  select coalesce(max(nomor), 0) + 1 into v_nomor from transaksi
    where outlet_id = v_outlet and created_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';

  insert into transaksi (draft_id, id, client_id, outlet_id, sesi_kas_id, nomor, kanal, tipe, pelanggan, meja, catatan, subtotal, total)
    values (nullif(p->>'draft_id', '')::uuid, v_id, (p->>'client_id')::uuid, v_outlet, v_sesi, v_nomor, v_kanal, coalesce(p->>'tipe', 'dine_in'),
            nullif(p->>'pelanggan', ''), nullif(p->>'meja', ''), nullif(p->>'catatan', ''), 0, 0);

  for it in select * from jsonb_array_elements(p->'items') loop
    select * into m from menu where id = (it->>'menu_id')::uuid and deleted_at is null and aktif;
    if m.id is null then raise exception 'Menu tidak tersedia'; end if;
    v_qty := greatest((it->>'qty')::int, 1);
    v_vids := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(it->'varian_ids', '[]')) x), '{}');
    perform matur_internal.cek_varian_berulang(m.id,v_vids);
    v_harga := case when v_kanal in ('gofood','grabfood','shopeefood','tiktok') then coalesce((p#>>array['_katalog','menu',m.id::text,'ojol'])::bigint,m.harga_ojol) else coalesce((p#>>array['_katalog','menu',m.id::text,'langsung'])::bigint,m.harga_langsung) end
      + coalesce((select sum(coalesce((p#>>array['_katalog','varian',id::text])::bigint,tambahan_harga)*matur_internal.jumlah_varian(id,v_vids)) from varian where id = any(v_vids) and menu_id = m.id), 0);
    v_nama := m.nama || coalesce(' (' || (select string_agg(nama||case when matur_internal.jumlah_varian(id,v_vids)>1 then ' ×'||matur_internal.jumlah_varian(id,v_vids) else '' end, ', ' order by grup,nama) from varian where id = any(v_vids)) || ')', '');
    v_item_hpp := coalesce((select round(sum(r2.takaran * b2.harga_pokok * case when r2.varian_id is null then 1 else matur_internal.jumlah_varian(r2.varian_id,v_vids) end)) from resep r2 join bahan b2 on b2.id = r2.bahan_id
      where r2.menu_id = m.id and r2.deleted_at is null and (r2.varian_id is null or r2.varian_id = any(v_vids))), 0);
    if m.titipan then v_item_hpp := coalesce(m.harga_titip, 0); end if;
    insert into item_transaksi (transaksi_id, menu_id, varian_ids, nama, qty, harga, hpp_teoritis, catatan)
      values (v_id, m.id, v_vids, v_nama, v_qty, v_harga, v_item_hpp, nullif(it->>'catatan', ''));
    v_sub := v_sub + v_harga * v_qty;
    v_hpp := v_hpp + v_item_hpp * v_qty;
  end loop;

  select batas_diskon_persen into v_batas from perusahaan limit 1;
  if v_diskon > v_sub then raise exception 'Diskon melebihi subtotal'; end if;
  if v_diskon * 100 > v_sub * coalesce(v_batas, 0) and not peran_di_outlet(v_outlet, '{spv}') then
    -- diskon besar: perlu izin SPV sekali pakai (PIN SPV di perangkat kasir)
    select * into v_oto from otorisasi where id = nullif(p->>'otorisasi', '')::uuid and outlet_id = v_outlet and jenis = 'diskon'
      and dipakai_at is null and created_at > now() - interval '10 minutes' for update;
    if v_oto.id is null or v_diskon * 100 > v_sub * v_oto.nilai then
      raise exception 'Diskon di atas % persen perlu persetujuan SPV', v_batas;
    end if;
    update otorisasi set dipakai_at = now() where id = v_oto.id;
    update transaksi set catatan = concat_ws(' · ', catatan, 'Diskon disetujui SPV') where id = v_id;
  end if;
  v_total := v_sub - v_diskon;

  -- pembayaran: satu metode (lama) atau beberapa (split payment)
  v_bayar := case when jsonb_array_length(coalesce(p->'pembayaran', '[]')) > 0 then p->'pembayaran'
                  else jsonb_build_array(jsonb_build_object('metode', p->>'metode', 'nominal', v_total, 'diterima', coalesce((p->>'diterima')::bigint, v_total))) end;
  for b in select * from jsonb_array_elements(v_bayar) loop
    if (b->>'nominal')::bigint <= 0 then raise exception 'Nominal pembayaran tidak valid'; end if;
    v_sum := v_sum + (b->>'nominal')::bigint;
    if b->>'metode' = 'tunai' then
      v_diterima := coalesce((b->>'diterima')::bigint, (b->>'nominal')::bigint);
      if v_diterima < (b->>'nominal')::bigint then raise exception 'Uang diterima kurang'; end if;
      v_kembali := v_kembali + v_diterima - (b->>'nominal')::bigint;
    end if;
  end loop;
  if v_sum <> v_total then raise exception 'Jumlah pembayaran (%) tidak sama dengan total (%)', v_sum, v_total; end if;

  update transaksi set subtotal = v_sub, diskon = v_diskon, total = v_total, hpp_teoritis = v_hpp where id = v_id;
  for b in select * from jsonb_array_elements(v_bayar) loop
    insert into pembayaran (transaksi_id, metode, nominal, diterima)
      values (v_id, (b->>'metode')::metode_bayar, (b->>'nominal')::bigint,
              case when b->>'metode' = 'tunai' then coalesce((b->>'diterima')::bigint, (b->>'nominal')::bigint) end);
  end loop;

  -- kasir → gudang: potong stok bahan di outlet sesuai resep
  for r in
    select ri.bahan_id, sum(ri.takaran * x.qty * case when ri.varian_id is null then 1 else matur_internal.jumlah_varian(ri.varian_id,x.varian_ids) end) jml
      from item_transaksi x join resep ri on ri.menu_id = x.menu_id and ri.deleted_at is null
       and (ri.varian_id is null or ri.varian_id = any(x.varian_ids))
     where x.transaksi_id = v_id group by ri.bahan_id
  loop
    perform geser_stok('asli', v_outlet, r.bahan_id, -r.jml, 'pemakaian', v_id, 'POS #' || v_nomor);
  end loop;

  return jsonb_build_object('id', v_id, 'nomor', v_nomor, 'subtotal', v_sub, 'diskon', v_diskon, 'total', v_total, 'kembalian', v_kembali);
end $function$
