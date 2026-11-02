-- Hanya visibilitas dashboard, bukan izin POS/status operasional atau penghapusan data.
alter table public.outlet add column tampil_dashboard_pos boolean not null default true;
comment on column public.outlet.tampil_dashboard_pos is 'Sertakan outlet pada pilihan dan agregat Dashboard POS. Riwayat/laporan eksplisit tetap tersedia.';
update public.outlet set tampil_dashboard_pos=false where nama='Outlet Demo (uji coba)' and mode='asli' and deleted_at is null;

create or replace function public.atur_tampil_dashboard_pos(p_outlet uuid,p_sebelum boolean,p_tampil boolean) returns boolean
language plpgsql security invoker set search_path=public as $$
declare hasil boolean;
begin
 if auth.uid() is null or not punya_peran('{owner,admin_pusat}') then raise exception 'Tidak diizinkan';end if;
 if p_sebelum is null or p_tampil is null then raise exception 'Pilihan tidak valid';end if;
 update outlet set tampil_dashboard_pos=p_tampil where id=p_outlet and mode='asli' and deleted_at is null and tampil_dashboard_pos=p_sebelum returning tampil_dashboard_pos into hasil;
 if not found then raise exception 'Pengaturan sudah berubah atau outlet tidak tersedia. Muat ulang halaman.';end if;
 return hasil;
end $$;
revoke all on function public.atur_tampil_dashboard_pos(uuid,boolean,boolean) from public,anon;
grant execute on function public.atur_tampil_dashboard_pos(uuid,boolean,boolean) to authenticated;

CREATE OR REPLACE FUNCTION public.ringkasan_penjualan(p_outlet uuid, p_dari date, p_sampai date, p_mode mode_data DEFAULT 'asli'::mode_data)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with t as (
    select t.*, (t.created_at at time zone 'Asia/Jakarta') as lokal
    from transaksi t
    where t.status = 'lunas' and t.mode = p_mode
      and (p_outlet is null or t.outlet_id = p_outlet)
      and (p_outlet is not null or exists(select 1 from outlet od where od.id=t.outlet_id and od.tampil_dashboard_pos))
      and t.created_at >= (p_dari::timestamp at time zone 'Asia/Jakarta')
      and t.created_at <  ((p_sampai + 1)::timestamp at time zone 'Asia/Jakarta')
  )
  select jsonb_build_object(
    'kpi', (select jsonb_build_object('omzet', coalesce(sum(total), 0), 'trx', count(*), 'impor_tanpa_rincian', count(*) filter(where sumber_penjualan is not null), 'hpp', coalesce(sum(hpp_teoritis), 0), 'diskon', coalesce(sum(diskon), 0)) from t),
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
    'kategori', coalesce((select jsonb_agg(x order by x.omzet desc) from (
        select coalesce(k.nama, 'Tanpa kategori') as nama, sum(i.qty) as qty, sum(i.qty * i.harga) as omzet
        from t join item_transaksi i on i.transaksi_id = t.id join menu m on m.id = i.menu_id
        left join kategori_menu k on k.id = m.kategori_id
        group by 1) x), '[]'),
    'outlet', coalesce((select jsonb_agg(x order by x.omzet desc) from (
        select t.outlet_id, o.nama, sum(t.total) as omzet, count(*) as trx, sum(t.hpp_teoritis) as hpp
        from t join outlet o on o.id = t.outlet_id group by 1, 2) x), '[]'),
    'shift_terbuka', (select count(*) from sesi_kas s where s.ditutup_at is null and s.mode = p_mode
                        and (p_outlet is null or s.outlet_id = p_outlet)
                        and (p_outlet is not null or exists(select 1 from outlet od where od.id=s.outlet_id and od.tampil_dashboard_pos)))
  );
$function$;


CREATE OR REPLACE FUNCTION public.omzet_hari_ini(p_outlet uuid DEFAULT NULL::uuid, p_mode mode_data DEFAULT 'asli'::mode_data)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with w as (
    select (now() at time zone 'Asia/Jakarta')::date hari,
           ((now() at time zone 'Asia/Jakarta')::date)::timestamp at time zone 'Asia/Jakarta' awal
  ), t as (
    select tr.outlet_id, tr.total, tr.created_at,
           tr.created_at >= w.awal kini
    from transaksi tr, w
    where tr.status = 'lunas' and tr.mode = p_mode
      and (p_outlet is null or tr.outlet_id = p_outlet)
      and (p_outlet is not null or exists(select 1 from outlet od where od.id=tr.outlet_id and od.tampil_dashboard_pos))
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
$function$;


CREATE OR REPLACE FUNCTION public.pantau_pos(p_outlet uuid, p_dari date, p_sampai date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare hasil jsonb;
begin
  if not exists (select 1 from matur_internal.outlet_pantau()) then raise exception 'Tidak diizinkan'; end if;
  if p_outlet is not null and p_outlet not in (select matur_internal.outlet_pantau()) then raise exception 'Outlet tidak diizinkan'; end if;
  if p_sampai < p_dari or p_sampai - p_dari > 400 then raise exception 'Rentang tanggal tidak valid (maks. 400 hari)'; end if;
  with semua as (
    select tr.*, (tr.created_at at time zone 'Asia/Jakarta') lokal
    from transaksi tr
    where tr.mode = 'asli'
      and tr.outlet_id in (select matur_internal.outlet_pantau())
      and (p_outlet is null or tr.outlet_id = p_outlet)
      and exists(select 1 from outlet od where od.id=tr.outlet_id and od.tampil_dashboard_pos)
      and tr.created_at >= (p_dari::timestamp at time zone 'Asia/Jakarta')
      and tr.created_at <  ((p_sampai + 1)::timestamp at time zone 'Asia/Jakarta')
  ), t as (select * from semua where status = 'lunas')
  select jsonb_build_object(
    'kpi', (select jsonb_build_object('omzet', coalesce(sum(total), 0), 'trx', count(*), 'impor_tanpa_rincian', count(*) filter(where sumber_penjualan is not null), 'diskon', coalesce(sum(diskon), 0),
                                      'void', (select count(*) from semua where status = 'void')) from t),
    'harian', coalesce((select jsonb_agg(x order by x.tgl) from (
        select lokal::date tgl, outlet_id, sum(total) omzet, count(*) trx from t group by 1, 2) x), '[]'),
    'kanal', coalesce((select jsonb_agg(x order by x.omzet desc) from (
        select kanal, sum(total) omzet, count(*) trx from t group by 1) x), '[]'),
    'jam', coalesce((select jsonb_agg(x) from (
        select extract(isodow from lokal)::int dow, extract(hour from lokal)::int jam, count(*) trx, sum(total) omzet from t group by 1, 2) x), '[]'),
    'menu', coalesce((select jsonb_agg(x order by x.qty desc, x.omzet desc) from (
        select m.nama, sum(i.qty) qty, sum(i.qty * i.harga) omzet
        from t join item_transaksi i on i.transaksi_id = t.id join menu m on m.id = i.menu_id
        group by m.id, m.nama) x), '[]'),
    'outlet', coalesce((select jsonb_agg(x order by x.omzet desc) from (
        select t.outlet_id, o.nama, sum(t.total) omzet, count(*) trx
        from t join outlet o on o.id = t.outlet_id group by 1, 2) x), '[]')
  ) into hasil;
  return hasil;
end $function$;


CREATE OR REPLACE FUNCTION public.pantau_pos_periode(p_outlet uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t date := (now() at time zone 'Asia/Jakarta')::date;
  awal_bln date := date_trunc('month', t)::date;
  per jsonb := '[]';
  r record;
begin
  if not exists (select 1 from matur_internal.outlet_pantau()) then raise exception 'Tidak diizinkan'; end if;
  if p_outlet is not null and p_outlet not in (select matur_internal.outlet_pantau()) then raise exception 'Outlet tidak diizinkan'; end if;
  for r in
    select * from (values
      ('hari',   'Hari ini',        t,                                   t,                     t - 1,                                 t - 1),
      ('kemarin','Kemarin',         t - 1,                               t - 1,                 t - 2,                                 t - 2),
      ('3',      '3 hari terakhir', t - 2,                               t,                     t - 5,                                 t - 3),
      ('7',      '7 hari terakhir', t - 6,                               t,                     t - 13,                                t - 7),
      ('bulan_lalu','Bulan lalu',   (awal_bln - interval '1 month')::date, awal_bln - 1,        (awal_bln - interval '2 month')::date, (awal_bln - interval '1 month')::date - 1),
      ('90',     '3 bulan terakhir',t - 89,                              t,                     t - 179,                               t - 90)
    ) v(kode, label, dari, sampai, p_dari, p_sampai)
  loop
    per := per || jsonb_build_object('kode', r.kode, 'label', r.label, 'dari', r.dari, 'sampai', r.sampai,
      'omzet', s.omzet, 'trx', s.trx, 'prev_omzet', s.prev_omzet, 'prev_trx', s.prev_trx)
    from (
      select coalesce(sum(x.total) filter (where d between r.dari and r.sampai), 0) omzet,
             count(*) filter (where d between r.dari and r.sampai) trx,
             coalesce(sum(x.total) filter (where d between r.p_dari and r.p_sampai), 0) prev_omzet,
             count(*) filter (where d between r.p_dari and r.p_sampai) prev_trx
      from (select tr.total, (tr.created_at at time zone 'Asia/Jakarta')::date d
            from transaksi tr
            where tr.status = 'lunas' and tr.mode = 'asli'
              and tr.outlet_id in (select matur_internal.outlet_pantau())
              and (p_outlet is null or tr.outlet_id = p_outlet)
      and exists(select 1 from outlet od where od.id=tr.outlet_id and od.tampil_dashboard_pos)
              and tr.created_at >= (least(r.dari, r.p_dari)::timestamp at time zone 'Asia/Jakarta')
              and tr.created_at <  ((r.sampai + 1)::timestamp at time zone 'Asia/Jakarta')) x
    ) s;
  end loop;
  return jsonb_build_object(
    'hari_ini', t,
    'outlet', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'nama', o.nama, 'jam_operasional', o.jam_operasional) order by o.nama), '[]')
               from outlet o where o.tampil_dashboard_pos and o.id in (select matur_internal.outlet_pantau())),
    'periode', per);
end $function$;
