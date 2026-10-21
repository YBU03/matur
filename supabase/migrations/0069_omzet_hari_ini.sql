-- Kartu "Omzet hari ini" (real-time): omzet & struk hari ini sampai sekarang, dibanding kemarin sampai jam yang sama.
-- Security invoker: akses outlet mengikuti RLS transaksi (boleh_outlet).
create or replace function public.omzet_hari_ini(p_outlet uuid default null, p_mode mode_data default 'asli')
returns jsonb language sql stable set search_path = public as $$
  with w as (
    select (now() at time zone 'Asia/Jakarta')::date hari,
           ((now() at time zone 'Asia/Jakarta')::date)::timestamp at time zone 'Asia/Jakarta' awal
  ), t as (
    select tr.outlet_id, tr.total, tr.created_at,
           tr.created_at >= w.awal kini
    from transaksi tr, w
    where tr.status = 'lunas' and tr.mode = p_mode
      and (p_outlet is null or tr.outlet_id = p_outlet)
      and tr.created_at >= w.awal - interval '1 day'
      and tr.created_at <= now()
      and (tr.created_at >= w.awal or tr.created_at <= now() - interval '1 day')
  )
  select jsonb_build_object(
    'hari', (select hari from w),
    'sekarang', now(),
    'omzet', coalesce((select sum(total) from t where kini), 0),
    'trx', (select count(*) from t where kini),
    'terakhir', (select max(created_at) from t where kini),
    'kemarin_omzet', coalesce((select sum(total) from t where not kini), 0),
    'kemarin_trx', (select count(*) from t where not kini),
    'outlet', coalesce((select jsonb_agg(x order by x.omzet desc) from (
        select t.outlet_id, o.nama, sum(t.total) omzet, count(*) trx
        from t join outlet o on o.id = t.outlet_id where t.kini group by 1, 2) x), '[]'),
    'jam', coalesce((select jsonb_agg(x order by x.jam) from (
        select extract(hour from created_at at time zone 'Asia/Jakarta')::int jam, count(*) trx
        from t where kini group by 1) x), '[]')
  );
$$;
revoke all on function public.omzet_hari_ini(uuid, mode_data) from public, anon;
grant execute on function public.omzet_hari_ini(uuid, mode_data) to authenticated;
