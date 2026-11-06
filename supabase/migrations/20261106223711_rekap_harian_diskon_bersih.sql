-- Diskon (mulai 5 Nov): kolom uang = nominal pembayaran per metode (SESUDAH diskon, persis Penjualan POS).
-- Diskon tidak dipotong lagi: 'diskon' = 0 untuk total/laporan, nilainya tetap tampil sebagai 'diskon_info'.
-- 1–4 Nov tidak berubah (bruto per kanal + kolom diskon).
create or replace function public.rekap_harian(p_outlet uuid, p_periode date, p_mode mode_data default 'asli'::mode_data)
returns jsonb language sql stable set search_path to 'public' as $function$
  with trx as (
    select t.id, t.kanal::text kanal, t.subtotal, t.total, t.diskon, public.tgl_op(t.created_at) tgl
      from transaksi t
     where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas'
       and t.created_at >= public.awal_op(date_trunc('month', p_periode)::date)
       and t.created_at < public.awal_op((date_trunc('month', p_periode) + interval '1 month')::date)
  ),
  bayar as (
    select t.id, p.metode::text metode, p.nominal, sum(p.nominal) over (partition by t.id) total_bayar
      from trx t join pembayaran p on p.transaksi_id = t.id
  ),
  kolom as (
    select t.id, t.tgl, t.kanal, b.metode,
           case
             when t.tgl >= date '2026-11-05' then
               case when b.metode is null then (case when t.kanal = 'langsung' or t.kanal = 'tumbler' then 'tunai' else t.kanal end)
                    when b.metode in ('gofood','grabfood','shopeefood','tiktok','ruma_app') then b.metode
                    when b.metode = 'tunai' then 'tunai'
                    else 'non_tunai' end
             else
               case when t.kanal <> 'langsung' then t.kanal
                    when b.metode is null or b.metode = 'tunai' then 'tunai'
                    else 'non_tunai' end
           end kol,
           case when t.tgl >= date '2026-11-05' then coalesce(b.nominal, t.total)
                when b.metode is null or b.total_bayar = 0 then t.subtotal else round(t.subtotal * b.nominal::numeric / b.total_bayar) end nilai,
           case when b.metode is null then false
                when t.kanal = 'langsung' then b.metode in ('gofood','grabfood','shopeefood','tiktok','ruma_app')
                when t.kanal in ('gofood','grabfood','shopeefood','tiktok','ruma_app') then b.metode <> t.kanal
                else false end janggal
      from trx t left join bayar b on b.id = t.id
  ),
  per_trx as (select tgl, id, bool_or(janggal) janggal from kolom group by tgl, id),
  shift as (
    select coalesce(tanggal_shift, public.tgl_op(dibuka_at)) tgl, sum(setoran) setoran, sum(seharusnya) seharusnya, sum(selisih) selisih, count(*) n
      from sesi_kas where outlet_id = p_outlet and mode = p_mode and ditutup_at is not null
       and coalesce(tanggal_shift, public.tgl_op(dibuka_at)) >= date_trunc('month', p_periode)::date
       and coalesce(tanggal_shift, public.tgl_op(dibuka_at)) < (date_trunc('month', p_periode) + interval '1 month')::date
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'tanggal', d.tgl, 'transaksi', coalesce(n.n, 0), 'janggal', coalesce(n.janggal, 0),
      'tunai', coalesce(j.tunai, 0), 'non_tunai', coalesce(j.non_tunai, 0), 'gofood', coalesce(j.gofood, 0), 'grabfood', coalesce(j.grabfood, 0),
      'shopeefood', coalesce(j.shopeefood, 0), 'tiktok', coalesce(j.tiktok, 0), 'ruma_app', coalesce(j.ruma_app, 0), 'tumbler', coalesce(j.tumbler, 0),
      'tumbler_n', coalesce(tb.n, 0), 'tumbler_nilai', coalesce(tb.nilai, 0), 'tumbler_tunai', coalesce(tb.tunai, 0), 'tumbler_nontunai', coalesce(tb.nontunai, 0),
      'rincian_metode', d.tgl >= date '2026-11-05',
      'diskon', case when d.tgl >= date '2026-11-05' then 0 else coalesce(n.diskon, 0) end, 'diskon_info', coalesce(n.diskon, 0), 'setoran', s.setoran, 'seharusnya', s.seharusnya, 'selisih', s.selisih, 'shift', coalesce(s.n, 0)) order by d.tgl), '[]')
  from (select g::date tgl from generate_series(date_trunc('month', p_periode), date_trunc('month', p_periode) + interval '1 month - 1 day', interval '1 day') g) d
  left join (
    select tgl, sum(nilai) filter (where kol = 'tunai') tunai, sum(nilai) filter (where kol = 'non_tunai') non_tunai,
           sum(nilai) filter (where kol = 'gofood') gofood, sum(nilai) filter (where kol = 'grabfood') grabfood,
           sum(nilai) filter (where kol = 'shopeefood') shopeefood, sum(nilai) filter (where kol = 'tiktok') tiktok,
           sum(nilai) filter (where kol = 'ruma_app') ruma_app, sum(nilai) filter (where kol = 'tumbler') tumbler
      from kolom group by tgl
  ) j on j.tgl = d.tgl
  left join (
    select x.tgl, count(*) n, count(*) filter (where p.janggal) janggal, sum(x.diskon) diskon
      from trx x join per_trx p on p.id = x.id group by x.tgl
  ) n on n.tgl = d.tgl
  left join (
    select tgl, count(distinct id) n, sum(nilai) nilai, sum(nilai) filter (where metode = 'tunai' or metode is null) tunai, sum(nilai) filter (where metode is not null and metode <> 'tunai') nontunai
      from kolom where kanal = 'tumbler' group by tgl
  ) tb on tb.tgl = d.tgl
  left join shift s on s.tgl = d.tgl
  where d.tgl <= public.tgl_op(now())
$function$;
