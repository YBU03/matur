-- Rekap harian per kanal penjualan + setoran shift (untuk halaman Catatan Harian, mengikuti sheet "Transaksi" Ruma)
create or replace function rekap_harian(p_outlet uuid, p_periode date, p_mode mode_data default 'asli') returns jsonb
language sql stable set search_path = public as $$
  with trx as (
    select t.id, t.kanal, t.subtotal, t.diskon, (t.created_at at time zone 'Asia/Jakarta')::date tgl
      from transaksi t
     where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas'
       and t.created_at >= (date_trunc('month', p_periode)::timestamp at time zone 'Asia/Jakarta')
       and t.created_at < ((date_trunc('month', p_periode) + interval '1 month')::timestamp at time zone 'Asia/Jakarta')
  ),
  porsi as (
    select t.id, case when sum(p.nominal) > 0 then sum(p.nominal) filter (where p.metode = 'tunai')::numeric / sum(p.nominal) else 1 end tunai
      from trx t left join pembayaran p on p.transaksi_id = t.id where t.kanal = 'langsung' group by t.id
  ),
  baris as (
    select t.tgl,
           case when t.kanal = 'langsung' then round(t.subtotal * coalesce(x.tunai, 1)) else 0 end tunai,
           case when t.kanal = 'langsung' then t.subtotal - round(t.subtotal * coalesce(x.tunai, 1)) else 0 end non_tunai,
           t.kanal, t.subtotal, t.diskon
      from trx t left join porsi x on x.id = t.id
  ),
  shift as (
    select (ditutup_at at time zone 'Asia/Jakarta')::date tgl, sum(setoran) setoran, sum(seharusnya) seharusnya, sum(selisih) selisih, count(*) n
      from sesi_kas where outlet_id = p_outlet and mode = p_mode and ditutup_at is not null
       and ditutup_at >= (date_trunc('month', p_periode)::timestamp at time zone 'Asia/Jakarta')
       and ditutup_at < ((date_trunc('month', p_periode) + interval '1 month')::timestamp at time zone 'Asia/Jakarta')
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'tanggal', d.tgl, 'transaksi', coalesce(j.n, 0),
      'tunai', coalesce(j.tunai, 0), 'non_tunai', coalesce(j.non_tunai, 0), 'gofood', coalesce(j.gofood, 0), 'grabfood', coalesce(j.grabfood, 0),
      'shopeefood', coalesce(j.shopeefood, 0), 'tiktok', coalesce(j.tiktok, 0), 'ruma_app', coalesce(j.ruma_app, 0), 'tumbler', coalesce(j.tumbler, 0),
      'diskon', coalesce(j.diskon, 0), 'setoran', s.setoran, 'seharusnya', s.seharusnya, 'selisih', s.selisih, 'shift', coalesce(s.n, 0)) order by d.tgl), '[]')
  from (select g::date tgl from generate_series(date_trunc('month', p_periode), date_trunc('month', p_periode) + interval '1 month - 1 day', interval '1 day') g) d
  left join (
    select tgl, count(*) n, sum(tunai) tunai, sum(non_tunai) non_tunai,
           sum(subtotal) filter (where kanal = 'gofood') gofood, sum(subtotal) filter (where kanal = 'grabfood') grabfood,
           sum(subtotal) filter (where kanal = 'shopeefood') shopeefood, sum(subtotal) filter (where kanal = 'tiktok') tiktok,
           sum(subtotal) filter (where kanal = 'ruma_app') ruma_app, sum(subtotal) filter (where kanal = 'tumbler') tumbler, sum(diskon) diskon
      from baris group by tgl
  ) j on j.tgl = d.tgl
  left join shift s on s.tgl = d.tgl
  where d.tgl <= (now() at time zone 'Asia/Jakarta')::date
$$;
revoke execute on function rekap_harian(uuid, date, mode_data) from public, anon;
grant execute on function rekap_harian(uuid, date, mode_data) to authenticated;
