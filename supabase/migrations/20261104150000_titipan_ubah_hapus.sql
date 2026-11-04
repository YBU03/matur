-- Edit & hapus catatan pergerakan titipan (dengan audit), hak akses sama dengan pencatatan.
-- BELUM DITERAPKAN ke produksi: menunggu persetujuan konfirmasi Supabase.
create or replace function matur_internal.boleh_kelola_titipan(p_outlet uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select gudang_pusat() or punya_peran('{finance}') or peran_di_outlet(p_outlet, '{kasir,spv}') or (punya_peran('{hrd}') and boleh_outlet(p_outlet));
$$;

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
  perform pg_advisory_xact_lock(hashtext('titipan:' || r.outlet_id || ':' || r.menu_id));
  if p_qty < 0 and p_qty < r.qty then
    select coalesce(sum(qty), 0) into sisa from titipan_masuk where outlet_id = r.outlet_id and menu_id = r.menu_id and id <> r.id;
    select coalesce(sum(i.qty), 0) into jual from item_transaksi i join transaksi t on t.id = i.transaksi_id
      where t.outlet_id = r.outlet_id and t.mode = 'asli' and t.status = 'lunas' and i.menu_id = r.menu_id;
    select jual + coalesce(sum((x->>'qty')::numeric), 0) into jual from produk_keluar pk cross join jsonb_array_elements(pk.items) x
      where pk.outlet_id = r.outlet_id and pk.deleted_at is null and x->>'menu_id' = r.menu_id::text;
    if -p_qty > greatest(sisa - jual, 0) then raise exception 'Retur/rusak melebihi sisa titipan'; end if;
  end if;
  update titipan_masuk set qty = p_qty, tanggal = p_tanggal, jenis = j, catatan = c where id = r.id;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (auth.uid(), 'ubah_titipan', 'titipan_masuk', r.id::text, to_jsonb(r), jsonb_build_object('qty', p_qty, 'tanggal', p_tanggal, 'jenis', j, 'catatan', c));
  return jsonb_build_object('ok', 'Catatan titipan diperbarui.');
end $$;

create or replace function public.hapus_titipan_masuk(p_id uuid, p_alasan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r titipan_masuk;
begin
  select * into r from titipan_masuk where id = p_id for update;
  if r.id is null then raise exception 'Catatan titipan tidak ditemukan'; end if;
  if not matur_internal.boleh_kelola_titipan(r.outlet_id) then raise exception 'Anda tidak punya akses mengelola titipan di outlet ini'; end if;
  delete from titipan_masuk where id = r.id;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (auth.uid(), 'hapus_titipan', 'titipan_masuk', r.id::text, to_jsonb(r), jsonb_build_object('alasan', nullif(left(trim(coalesce(p_alasan, '')), 200), '')));
  return jsonb_build_object('ok', 'Catatan titipan dihapus.');
end $$;

revoke all on function matur_internal.boleh_kelola_titipan(uuid) from public, anon;
grant execute on function matur_internal.boleh_kelola_titipan(uuid) to authenticated;
revoke all on function public.ubah_titipan_masuk(uuid, integer, date, text, text) from public, anon;
grant execute on function public.ubah_titipan_masuk(uuid, integer, date, text, text) to authenticated;
revoke all on function public.hapus_titipan_masuk(uuid, text) from public, anon;
grant execute on function public.hapus_titipan_masuk(uuid, text) to authenticated;
