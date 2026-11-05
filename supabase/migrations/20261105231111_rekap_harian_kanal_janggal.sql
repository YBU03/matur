-- Catatan Harian kembali dikelompokkan per KANAL (angka 1–2 Nov yang sudah direkonsiliasi akunting tetap),
-- ditambah hitungan transaksi "janggal" (kanal ≠ metode bayar) agar salah input kasir langsung terlihat.
create or replace function public.rekap_harian(p_outlet uuid, p_periode date, p_mode mode_data default 'asli'::mode_data)
returns jsonb language sql stable set search_path to 'public' as $function$
  with trx as (
    select t.id, t.kanal, t.subtotal, t.diskon, public.tgl_op(t.created_at) tgl
      from transaksi t
     where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'lunas'
       and t.created_at >= public.awal_op(date_trunc('month', p_periode)::date)
       and t.created_at < public.awal_op((date_trunc('month', p_periode) + interval '1 month')::date)
  ),
  porsi as (
    select t.id, case when sum(p.nominal) > 0 then coalesce(sum(p.nominal) filter (where p.metode = 'tunai'), 0)::numeric / sum(p.nominal) else 1 end tunai,
           bool_or(case when t.kanal = 'langsung' then p.metode::text in ('gofood','grabfood','shopeefood','tiktok','ruma_app')
                        when t.kanal::text in ('gofood','grabfood','shopeefood','tiktok','ruma_app') then p.metode::text <> t.kanal::text
                        else false end) janggal
      from trx t left join pembayaran p on p.transaksi_id = t.id group by t.id
  ),
  baris as (
    select t.tgl,
           case when t.kanal = 'langsung' then round(t.subtotal * coalesce(x.tunai, 1)) else 0 end tunai,
           case when t.kanal = 'langsung' then t.subtotal - round(t.subtotal * coalesce(x.tunai, 1)) else 0 end non_tunai,
           t.kanal, t.subtotal, t.diskon, coalesce(x.janggal, false) janggal
      from trx t left join porsi x on x.id = t.id
  ),
  shift as (
    select coalesce(tanggal_shift, public.tgl_op(dibuka_at)) tgl, sum(setoran) setoran, sum(seharusnya) seharusnya, sum(selisih) selisih, count(*) n
      from sesi_kas where outlet_id = p_outlet and mode = p_mode and ditutup_at is not null
       and coalesce(tanggal_shift, public.tgl_op(dibuka_at)) >= date_trunc('month', p_periode)::date
       and coalesce(tanggal_shift, public.tgl_op(dibuka_at)) < (date_trunc('month', p_periode) + interval '1 month')::date
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'tanggal', d.tgl, 'transaksi', coalesce(j.n, 0), 'janggal', coalesce(j.janggal, 0),
      'tunai', coalesce(j.tunai, 0), 'non_tunai', coalesce(j.non_tunai, 0), 'gofood', coalesce(j.gofood, 0), 'grabfood', coalesce(j.grabfood, 0),
      'shopeefood', coalesce(j.shopeefood, 0), 'tiktok', coalesce(j.tiktok, 0), 'ruma_app', coalesce(j.ruma_app, 0), 'tumbler', coalesce(j.tumbler, 0),
      'diskon', coalesce(j.diskon, 0), 'setoran', s.setoran, 'seharusnya', s.seharusnya, 'selisih', s.selisih, 'shift', coalesce(s.n, 0)) order by d.tgl), '[]')
  from (select g::date tgl from generate_series(date_trunc('month', p_periode), date_trunc('month', p_periode) + interval '1 month - 1 day', interval '1 day') g) d
  left join (
    select tgl, count(*) n, count(*) filter (where janggal) janggal, sum(tunai) tunai, sum(non_tunai) non_tunai,
           sum(subtotal) filter (where kanal = 'gofood') gofood, sum(subtotal) filter (where kanal = 'grabfood') grabfood,
           sum(subtotal) filter (where kanal = 'shopeefood') shopeefood, sum(subtotal) filter (where kanal = 'tiktok') tiktok,
           sum(subtotal) filter (where kanal = 'ruma_app') ruma_app, sum(subtotal) filter (where kanal = 'tumbler') tumbler, sum(diskon) diskon
      from baris group by tgl
  ) j on j.tgl = d.tgl
  left join shift s on s.tgl = d.tgl
  where d.tgl <= public.tgl_op(now())
$function$;
