-- Pemantauan stok produk jadi titipan (cheesecake, dessert, dll.) per outlet:
-- sisa = Σ setoran masuk − Σ terjual (POS) − Σ keluar untuk marketing; pemakaian harian 28 hari untuk forecast.
alter publication supabase_realtime add table titipan_masuk;

create or replace function stok_titipan(p_outlet uuid, p_mode mode_data default 'asli') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare hari date := (now() at time zone 'Asia/Jakarta')::date; r jsonb;
begin
  if not boleh_outlet(p_outlet) then raise exception 'Tidak diizinkan'; end if;
  with m as (select id, nama, produsen, harga_titip, harga_langsung from menu where titipan and mode = 'asli' and deleted_at is null),
  keluar as (
    select i.menu_id, (t.created_at at time zone 'Asia/Jakarta')::date d, sum(i.qty) q
      from item_transaksi i join transaksi t on t.id = i.transaksi_id
     where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas' and i.menu_id in (select id from m)
     group by 1, 2
    union all
    select (x->>'menu_id')::uuid, pk.tanggal, sum((x->>'qty')::int)
      from produk_keluar pk cross join jsonb_array_elements(pk.items) x
     where pk.outlet_id = p_outlet and pk.mode = p_mode and pk.deleted_at is null and (x->>'menu_id')::uuid in (select id from m)
     group by 1, 2
  ), k as (select menu_id, d, sum(q) q from keluar group by 1, 2),
  masuk as (select menu_id, sum(qty) total, sum(qty) filter (where tanggal = hari) hari_ini, max(created_at) terakhir
              from titipan_masuk where outlet_id = p_outlet and p_mode = 'asli' group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'nama', m.nama, 'produsen', coalesce(m.produsen, '-'), 'harga_titip', coalesce(m.harga_titip, 0), 'harga_jual', m.harga_langsung,
      'masuk_total', coalesce(ms.total, 0), 'masuk_hari_ini', coalesce(ms.hari_ini, 0), 'setor_terakhir', ms.terakhir,
      'keluar_total', coalesce((select sum(q) from k where k.menu_id = m.id), 0),
      'sisa', coalesce(ms.total, 0) - coalesce((select sum(q) from k where k.menu_id = m.id), 0),
      'harian', (select jsonb_agg(jsonb_build_object('tanggal', dd::date, 'pakai', coalesce(k.q, 0)) order by dd)
                   from generate_series(hari - 28, hari, interval '1 day') dd left join k on k.menu_id = m.id and k.d = dd::date)
    ) order by m.produsen, m.nama), '[]') into r
  from m left join masuk ms on ms.menu_id = m.id;
  return r;
end $$;
