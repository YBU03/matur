-- DSB-01..05: ringkasan penjualan untuk dashboard. SECURITY INVOKER → RLS tetap berlaku
-- (owner melihat semua outlet, SPV/kasir hanya outletnya).
create index if not exists transaksi_mode_waktu on transaksi (mode, created_at);
create index if not exists item_transaksi_trx on item_transaksi (transaksi_id);

create or replace function ringkasan_penjualan(p_outlet uuid, p_dari date, p_sampai date, p_mode mode_data default 'asli')
returns jsonb language sql stable security invoker set search_path = public as $$
  with t as (
    select t.*, (t.created_at at time zone 'Asia/Jakarta') as lokal
    from transaksi t
    where t.status = 'lunas' and t.mode = p_mode
      and (p_outlet is null or t.outlet_id = p_outlet)
      and t.created_at >= (p_dari::timestamp at time zone 'Asia/Jakarta')
      and t.created_at <  ((p_sampai + 1)::timestamp at time zone 'Asia/Jakarta')
  )
  select jsonb_build_object(
    'kpi', (select jsonb_build_object('omzet', coalesce(sum(total), 0), 'trx', count(*), 'hpp', coalesce(sum(hpp_teoritis), 0), 'diskon', coalesce(sum(diskon), 0)) from t),
    'harian', coalesce((select jsonb_agg(x order by x.tgl) from (
        select lokal::date as tgl, outlet_id, sum(total) as omzet, count(*) as trx from t group by 1, 2) x), '[]'),
    'kanal', coalesce((select jsonb_agg(x order by x.omzet desc) from (
        select kanal, sum(total) as omzet, count(*) as trx from t group by 1) x), '[]'),
    'jam', coalesce((select jsonb_agg(x) from (
        select extract(isodow from lokal)::int as dow, extract(hour from lokal)::int as jam, count(*) as trx from t group by 1, 2) x), '[]'),
    'menu', coalesce((select jsonb_agg(x order by x.qty desc) from (
        select m.nama, sum(i.qty) as qty, sum(i.qty * i.harga) as omzet
        from t join item_transaksi i on i.transaksi_id = t.id join menu m on m.id = i.menu_id
        group by m.id, m.nama) x), '[]'),
    'outlet', coalesce((select jsonb_agg(x order by x.omzet desc) from (
        select t.outlet_id, o.nama, sum(t.total) as omzet, count(*) as trx, sum(t.hpp_teoritis) as hpp
        from t join outlet o on o.id = t.outlet_id group by 1, 2) x), '[]'),
    'shift_terbuka', (select count(*) from sesi_kas s where s.ditutup_at is null and s.mode = p_mode
                        and (p_outlet is null or s.outlet_id = p_outlet))
  );
$$;
revoke execute on function ringkasan_penjualan(uuid, date, date, mode_data) from public, anon;
grant execute on function ringkasan_penjualan(uuid, date, date, mode_data) to authenticated;
