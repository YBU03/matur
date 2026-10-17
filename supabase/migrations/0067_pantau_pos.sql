-- Pemantau POS: data lewat RPC security definer saja (tidak ada akses baca tabel mentah).
-- Penugasan outlet_id null = semua outlet, selain itu hanya outlet yang ditugaskan.

create or replace function matur_internal.outlet_pantau()
returns setof uuid language sql stable security definer set search_path = public as $$
  select o.id from outlet o
  where o.deleted_at is null and exists (
    select 1 from penugasan t join pengguna u on u.id = t.pengguna_id and u.status = 'aktif'
    where t.pengguna_id = auth.uid()
      and (t.peran = 'owner' or (t.peran = 'pemantau_pos' and (t.outlet_id is null or t.outlet_id = o.id)))
  );
$$;

-- Ringkasan cepat: omzet & struk per periode tetap + periode pembanding dengan panjang sama.
create or replace function public.pantau_pos_periode(p_outlet uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
              and tr.created_at >= (least(r.dari, r.p_dari)::timestamp at time zone 'Asia/Jakarta')
              and tr.created_at <  ((r.sampai + 1)::timestamp at time zone 'Asia/Jakarta')) x
    ) s;
  end loop;
  return jsonb_build_object(
    'hari_ini', t,
    'outlet', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'nama', o.nama, 'jam_operasional', o.jam_operasional) order by o.nama), '[]')
               from outlet o where o.id in (select matur_internal.outlet_pantau())),
    'periode', per);
end $$;

-- Detail rentang: tren harian, kanal, menu terlaris, jam ramai (omzet saja, tanpa HPP).
create or replace function public.pantau_pos(p_outlet uuid, p_dari date, p_sampai date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
      and tr.created_at >= (p_dari::timestamp at time zone 'Asia/Jakarta')
      and tr.created_at <  ((p_sampai + 1)::timestamp at time zone 'Asia/Jakarta')
  ), t as (select * from semua where status = 'lunas')
  select jsonb_build_object(
    'kpi', (select jsonb_build_object('omzet', coalesce(sum(total), 0), 'trx', count(*), 'diskon', coalesce(sum(diskon), 0),
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
end $$;

revoke all on function public.pantau_pos_periode(uuid) from public, anon;
revoke all on function public.pantau_pos(uuid, date, date) from public, anon;
grant execute on function public.pantau_pos_periode(uuid) to authenticated;
grant execute on function public.pantau_pos(uuid, date, date) to authenticated;

-- ACC pendaftar sebagai Pemantau POS boleh tanpa outlet (= semua outlet)
create or replace function public.setujui_pengguna(p_uid uuid, p_peran peran, p_outlet uuid)
returns void language plpgsql security definer set search_path = public as $function$
declare u pengguna;
begin
  if not punya_peran('{owner,admin_pusat}') then raise exception 'Hanya Owner/Admin Pusat'; end if;
  if p_peran = 'owner' and not punya_peran('{owner}') then raise exception 'Hanya Owner yang bisa memberi peran Owner'; end if;
  select * into u from pengguna where id = p_uid;
  if u.id is null then raise exception 'Pengguna tidak ditemukan'; end if;
  if p_peran not in ('owner','finance','hrd','admin_pusat','admin_gudang','pemantau_pos') and p_outlet is null then
    raise exception 'Peran ini wajib memilih outlet';
  end if;
  update pengguna set status = 'aktif' where id = p_uid;
  if p_peran in ('owner','finance','hrd','admin_pusat','admin_gudang') then p_outlet := null; end if;
  if not exists (select 1 from penugasan where pengguna_id = p_uid and peran = p_peran and outlet_id is not distinct from p_outlet) then
    insert into penugasan (pengguna_id, peran, outlet_id) values (p_uid, p_peran, p_outlet);
  end if;
  if p_peran = 'mitra' and not exists (select 1 from mitra where pengguna_id = p_uid) then
    insert into mitra (pengguna_id, nama, email, no_hp) values (p_uid, u.nama, u.email, u.no_hp);
  end if;
end $function$;

revoke all on function matur_internal.outlet_pantau() from public, anon, authenticated;
