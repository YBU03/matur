-- Campaign & Promo untuk Mitra: hanya baca, hanya promo aktif yang berlaku di outlet Mitra sendiri.
-- Tidak menampilkan pembuat/pengubah promo atau data pelanggan. Tidak menambah tabel.
create or replace function promo_internal.mitra(o uuid, d date, s date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare hr_ini date := public.tgl_op(now());
begin
 if o is null or not (public.peran_di_outlet(o, '{mitra}') or promo_internal.pusat()) then raise exception 'Tidak diizinkan'; end if;
 if d is null or s is null or s < d or s - d > 92 then raise exception 'Pilih periode maksimal 92 hari'; end if;
 return jsonb_build_object(
  'hari_ini', hr_ini,
  'promo', coalesce((select jsonb_agg(jsonb_build_object(
    'id', r.id, 'nama', r.nama, 'aktif', r.aktif, 'cakupan', coalesce(r.cakupan, 'item'), 'nilai_voucher', r.nilai_voucher, 'minimum_belanja', r.minimum_belanja,
    'mulai', r.mulai, 'selesai', r.selesai, 'jam_mulai', r.jam_mulai, 'jam_selesai', r.jam_selesai, 'slot', r.slot, 'hari', r.hari,
    'semua_outlet', r.semua_outlet, 'outlet_ids', '[]'::jsonb, 'kuota', r.kuota, 'per_menu', r.per_menu, 'bersama', r.bersama, 'boleh_manual', r.boleh_manual,
    'subsidi', r.subsidi, 'nama_subsidi', r.nama_subsidi, 'versi', r.versi,
    'aturan', coalesce((select jsonb_agg(a || jsonb_build_object('menu_nama', m.nama, 'kemasan', to_jsonb(m)->>'kemasan', 'harga_langsung', m.harga_langsung, 'harga_ojol', m.harga_ojol))
      from jsonb_array_elements(r.aturan) a left join public.menu m on m.id = (a->>'menu_id')::uuid), '[]'::jsonb),
    'berakhir_at', promo_internal.akhir_slot(r, now()),
    'sisa_kuota', promo_internal.sisa_kuota(r, o, hr_ini)
   ) order by r.mulai desc, r.nama)
   from promo_internal.promo r
   where r.aktif and (r.semua_outlet or o = any(r.outlet_ids)) and r.selesai >= hr_ini - 60), '[]'::jsonb),
  'kuota', coalesce((select jsonb_agg(z order by z->>'tanggal' desc, z->>'promo', z->>'menu') from (
   select jsonb_build_object('tanggal', tanggal, 'promo_id', promo_id, 'promo', promo, 'outlet', outlet, 'menu', menu, 'kuota', kuota,
    'terpakai', max(kumulatif), 'habis_at', min(waktu) filter (where kumulatif >= kuota)) z
   from (
    select r.tanggal, x.id promo_id, x.nama promo, x.kuota,
     case when x.bersama then 'Semua outlet (kuota bersama)' else 'Outlet ini' end outlet,
     case when x.per_menu then coalesce(m.nama, 'Menu') else null end menu,
     t.created_at waktu,
     sum(q.n) over (partition by x.id, r.tanggal, case when x.bersama then null else r.outlet_id end, q.k order by t.created_at, t.id) kumulatif,
     r.outlet_id
    from promo_internal.pesanan r
    join promo_internal.promo x on x.id = r.promo_id and x.kuota is not null and x.aktif and (x.semua_outlet or o = any(x.outlet_ids))
    join public.transaksi t on t.id = r.transaksi_id
    cross join lateral (select case when x.per_menu then e.key else 'semua' end k, sum(e.value::integer) n from jsonb_each_text(r.rincian) e group by 1) q
    left join public.menu m on x.per_menu and m.id::text = q.k
    where r.status = 'pakai' and r.tanggal between d and s and (x.bersama or r.outlet_id = o)
   ) a group by tanggal, promo_id, promo, outlet, menu, kuota
  ) b), '[]'::jsonb),
  'pemakaian', coalesce((select jsonb_agg(jsonb_build_object('tanggal', tanggal, 'promo_id', promo_id, 'promo', promo, 'transaksi', trx, 'item', item, 'potongan', potongan, 'subsidi', subsidi) order by tanggal desc, promo)
   from (
    select r.tanggal, r.promo_id, r.snapshot->>'nama' promo, count(*) trx,
     sum((select sum(v::integer) from jsonb_each_text(r.rincian) e(k, v))) item, sum(r.diskon) potongan,
     bool_or(coalesce((r.snapshot->>'subsidi')::boolean, false)) subsidi
    from promo_internal.pesanan r join public.transaksi t on t.id = r.transaksi_id
    where r.status = 'pakai' and r.outlet_id = o and r.tanggal between d and s and t.status = 'lunas'
    group by r.tanggal, r.promo_id, r.snapshot->>'nama'
   ) p), '[]'::jsonb)
 );
end $$;

create or replace function public.promo_mitra(o uuid, d date, s date) returns jsonb
language sql set search_path = '' as $$select promo_internal.mitra(o,d,s)$$;

revoke all on function promo_internal.mitra(uuid, date, date) from public, anon;
grant execute on function promo_internal.mitra(uuid, date, date) to authenticated;
revoke all on function public.promo_mitra(uuid, date, date) from public, anon;
grant execute on function public.promo_mitra(uuid, date, date) to authenticated;
notify pgrst, 'reload schema';
