-- Rincian baca saja untuk heatmap per tanggal. Tetap memakai hak SELECT dan RLS transaksi.
create or replace function public.jam_penjualan_tanggal(
  p_outlet uuid, p_dari date, p_sampai date, p_mode public.mode_data default 'asli'::public.mode_data
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with t as (
    select public.tgl_op(tr.created_at) as tgl,
      extract(hour from tr.created_at at time zone 'Asia/Jakarta')::int as jam,
      tr.sumber_penjualan
    from public.transaksi tr
    where (select auth.uid()) is not null
      and tr.status = 'lunas' and tr.mode = p_mode
      and (p_outlet is null or tr.outlet_id = p_outlet)
      and (p_outlet is not null or exists (
        select 1 from public.outlet o where o.id = tr.outlet_id and o.tampil_dashboard_pos
      ))
      and tr.created_at >= public.awal_op(p_dari)
      and tr.created_at < public.awal_op(p_sampai + 1)
      and public.tgl_op(tr.created_at) between p_dari and p_sampai
  )
  select jsonb_build_object(
    'cells', coalesce((select jsonb_agg(x order by x.tgl, x.jam) from (
      select tgl, jam, count(*) as trx from t where sumber_penjualan is null group by tgl, jam
    ) x), '[]'::jsonb),
    'tanpa_jam', (select count(*) from t where sumber_penjualan is not null)
  );
$$;
revoke all on function public.jam_penjualan_tanggal(uuid,date,date,public.mode_data) from public, anon;
grant execute on function public.jam_penjualan_tanggal(uuid,date,date,public.mode_data) to authenticated;
comment on function public.jam_penjualan_tanggal(uuid,date,date,public.mode_data) is 'Agregat jumlah transaksi per tanggal operasional dan jam WIB. Impor tanpa waktu transaksi tidak dijadikan jam perkiraan.';
