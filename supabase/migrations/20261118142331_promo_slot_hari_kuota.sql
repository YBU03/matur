-- Promo: beberapa slot jam bebas (boleh lewat tengah malam) + hari tertentu, sisa kuota untuk kotak kasir,
-- dan laporan jam kuota habis. Menambah saja: promo lama otomatis 1 slot sesuai jam lama + setiap hari.
alter table promo_internal.promo add column if not exists slot jsonb not null default '[]'::jsonb;
alter table promo_internal.promo add column if not exists hari smallint[] not null default '{1,2,3,4,5,6,7}';
update promo_internal.promo set slot = jsonb_build_array(jsonb_build_object('mulai', to_char(jam_mulai, 'HH24:MI:SS'), 'selesai', to_char(jam_selesai, 'HH24:MI:SS')))
 where slot = '[]'::jsonb;

-- Akhir slot yang sedang berlaku pada waktu t (WIB), atau null bila promo tidak berlaku pada tanggal/hari/jam itu.
-- Slot lewat tengah malam (selesai <= mulai) milik tanggal & hari saat slot dimulai.
create or replace function promo_internal.akhir_slot(x promo_internal.promo, t timestamptz)
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
declare lokal timestamp := t at time zone 'Asia/Jakarta'; d date := lokal::date; tm time := lokal::time; s jsonb; m time; e time; hasil timestamptz;
 sl jsonb := case when jsonb_typeof(x.slot) = 'array' and jsonb_array_length(x.slot) > 0 then x.slot
  else jsonb_build_array(jsonb_build_object('mulai', x.jam_mulai::text, 'selesai', x.jam_selesai::text)) end;
 hr smallint[] := coalesce(nullif(x.hari, '{}'), '{1,2,3,4,5,6,7}');
begin
 for s in select * from jsonb_array_elements(sl) loop
  m := (s->>'mulai')::time; e := (s->>'selesai')::time;
  if e > m then
   if tm between m and e and d between x.mulai and x.selesai and extract(isodow from d)::smallint = any(hr) then
    hasil := greatest(hasil, (d + e) at time zone 'Asia/Jakarta'); end if;
  else
   if tm >= m and d between x.mulai and x.selesai and extract(isodow from d)::smallint = any(hr) then
    hasil := greatest(hasil, (d + 1 + e) at time zone 'Asia/Jakarta'); end if;
   if tm <= e and (d - 1) between x.mulai and x.selesai and extract(isodow from d - 1)::smallint = any(hr) then
    hasil := greatest(hasil, (d + e) at time zone 'Asia/Jakarta'); end if;
  end if;
 end loop;
 return hasil;
end $$;

-- Sisa kuota (tanpa error) untuk ditampilkan di kasir. Kunci: 'semua' (gabungan/voucher) atau menu_id (per menu).
create or replace function promo_internal.sisa_kuota(x promo_internal.promo, o uuid, d date)
returns jsonb language sql stable security definer set search_path = '' as $$
 select case when x.kuota is null then null else coalesce((
  select jsonb_object_agg(k, greatest(x.kuota - coalesce((
   select sum(case when x.per_menu then coalesce((r.rincian->>k)::integer, 0) else (select sum(v::integer) from jsonb_each_text(r.rincian) t(kk, v)) end)
   from promo_internal.pesanan r where r.promo_id = x.id and r.tanggal = d and (x.bersama or r.outlet_id = o)
    and (r.status = 'pakai' or (r.status = 'pesan' and r.sampai_at > clock_timestamp()))), 0), 0))
  from (select case when x.per_menu then a->>'menu_id' else 'semua' end k from jsonb_array_elements(x.aturan) a group by 1) q), '{}'::jsonb) end
$$;

do $$
declare f text;
begin
 -- daftar: kasir memakai pengecekan slot/hari + sisa kuota & akhir slot untuk kotak promo.
 f := pg_get_functiondef('promo_internal.daftar(uuid,boolean)'::regprocedure);
 if position('(now() at time zone ''Asia/Jakarta'')::time between r.jam_mulai and r.jam_selesai' in f) = 0
  or position('to_jsonb(r)-''diubah_oleh''' in f) = 0 then raise exception 'Pola promo_internal.daftar berubah'; end if;
 f := replace(f, 'and (now() at time zone ''Asia/Jakarta'')::date between r.mulai and r.selesai and (now() at time zone ''Asia/Jakarta'')::time between r.jam_mulai and r.jam_selesai',
  'and promo_internal.akhir_slot(r, now()) is not null');
 f := replace(f, 'to_jsonb(r)-''diubah_oleh''',
  'case when manajemen then to_jsonb(r)-''diubah_oleh'' else to_jsonb(r)-''diubah_oleh''||jsonb_build_object(''berakhir_at'',promo_internal.akhir_slot(r, now()),''sisa_kuota'',promo_internal.sisa_kuota(r,o,public.tgl_op(now()))) end');
 if position('promo_internal.akhir_slot(r, now()) is not null' in f) = 0 then raise exception 'Gagal memperbarui daftar'; end if;
 execute f;

 -- pesan: validasi waktu & batas reservasi mengikuti slot yang sedang berlaku.
 f := pg_get_functiondef('promo_internal.pesan(jsonb)'::regprocedure);
 if position('or lokal::date not between x.mulai and x.selesai or lokal::time not between x.jam_mulai and x.jam_selesai' in f) = 0
  or position('(lokal::date+x.jam_selesai) at time zone ''Asia/Jakarta''' in f) = 0 then raise exception 'Pola promo_internal.pesan berubah'; end if;
 f := replace(f, 'or lokal::date not between x.mulai and x.selesai or lokal::time not between x.jam_mulai and x.jam_selesai',
  'or promo_internal.akhir_slot(x, clock_timestamp()) is null');
 f := replace(f, '(lokal::date+x.jam_selesai) at time zone ''Asia/Jakarta''', 'promo_internal.akhir_slot(x, clock_timestamp())');
 execute f;

 -- simpan: validasi & simpan slot/hari. Klien lama (tanpa slot) memakai jam_mulai/jam_selesai + setiap hari.
 f := pg_get_functiondef('promo_internal.simpan(jsonb)'::regprocedure);
 if position(' -- A scope change must not leave old doubled reservations redeemable.' in f) = 0 then raise exception 'Pola promo_internal.simpan berubah'; end if;
 f := replace(f, ' -- A scope change must not leave old doubled reservations redeemable.',
 $r$ if jsonb_typeof(p->'slot') = 'array' and jsonb_array_length(p->'slot') > 0 then
  if jsonb_array_length(p->'slot') > 6 then raise exception 'Maksimal 6 slot jam per promo'; end if;
  if exists(select 1 from jsonb_array_elements(p->'slot') s where coalesce(s->>'mulai','') !~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' or coalesce(s->>'selesai','') !~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' or (s->>'mulai')::time = (s->>'selesai')::time) then
   raise exception 'Jam promo tidak valid (jam mulai dan selesai harus berbeda)'; end if;
  update promo_internal.promo set slot = (select jsonb_agg(jsonb_build_object('mulai', to_char((s->>'mulai')::time,'HH24:MI:SS'), 'selesai', to_char((s->>'selesai')::time,'HH24:MI:SS')) order by (s->>'mulai')::time) from jsonb_array_elements(p->'slot') s) where id = x.id;
 else
  update promo_internal.promo set slot = jsonb_build_array(jsonb_build_object('mulai', to_char(jam_mulai,'HH24:MI:SS'), 'selesai', to_char(jam_selesai,'HH24:MI:SS'))) where id = x.id;
 end if;
 if jsonb_typeof(p->'hari') = 'array' then
  if jsonb_array_length(p->'hari') = 0 or exists(select 1 from jsonb_array_elements_text(p->'hari') h where h !~ '^[1-7]$') then raise exception 'Pilih minimal satu hari'; end if;
  update promo_internal.promo set hari = (select array_agg(distinct h::smallint order by h::smallint) from jsonb_array_elements_text(p->'hari') h) where id = x.id;
 elsif nullif(p->>'id','') is null then
  update promo_internal.promo set hari = '{1,2,3,4,5,6,7}' where id = x.id;
 end if;
 -- A scope change must not leave old doubled reservations redeemable.$r$);
 execute f;
end $$;

-- Laporan kuota per hari: terpakai, status dan jam kuota habis (dari transaksi lunas yang memakai kuota terakhir).
create or replace function promo_internal.laporan_kuota(o uuid, d date, s date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if d is null or s is null or s < d or s - d > 366 then raise exception 'Pilih periode maksimal 366 hari'; end if;
 if not (promo_internal.kelola(o) or (promo_internal.akses(o) and public.punya_peran('{finance}'))) then raise exception 'Tidak diizinkan'; end if;
 return coalesce((select jsonb_agg(z order by z->>'tanggal' desc, z->>'promo', z->>'outlet', z->>'menu') from (
  select jsonb_build_object('tanggal', tanggal, 'promo_id', promo_id, 'promo', promo, 'outlet', outlet, 'menu', menu, 'kuota', kuota,
   'terpakai', max(kumulatif), 'habis_at', min(waktu) filter (where kumulatif >= kuota)) z
  from (
   select r.tanggal, x.id promo_id, x.nama promo, x.kuota,
    case when x.bersama then 'Semua outlet' else ol.nama end outlet,
    case when x.per_menu then coalesce(m.nama, 'Menu') else null end menu,
    t.created_at waktu,
    sum(q.n) over (partition by x.id, r.tanggal, case when x.bersama then null else r.outlet_id end, q.k order by t.created_at, t.id) kumulatif
   from promo_internal.pesanan r
   join promo_internal.promo x on x.id = r.promo_id and x.kuota is not null
   join public.transaksi t on t.id = r.transaksi_id
   join public.outlet ol on ol.id = r.outlet_id
   cross join lateral (select case when x.per_menu then e.key else 'semua' end k, sum(e.value::integer) n from jsonb_each_text(r.rincian) e group by 1) q
   left join public.menu m on x.per_menu and m.id::text = q.k
   where r.status = 'pakai' and r.tanggal between d and s and (o is null or r.outlet_id = o)
    and (promo_internal.pusat() or public.punya_peran('{finance}') or promo_internal.kelola(r.outlet_id))
  ) a group by tanggal, promo_id, promo, outlet, menu, kuota
 ) b), '[]');
end $$;

create or replace function public.laporan_kuota_promo(o uuid, d date, s date) returns jsonb
language sql set search_path = '' as $$select promo_internal.laporan_kuota(o,d,s)$$;

revoke all on function promo_internal.akhir_slot(promo_internal.promo, timestamptz), promo_internal.sisa_kuota(promo_internal.promo, uuid, date), promo_internal.laporan_kuota(uuid, date, date) from public, anon, authenticated;
revoke all on function public.laporan_kuota_promo(uuid, date, date) from public, anon;
grant execute on function public.laporan_kuota_promo(uuid, date, date) to authenticated;
grant execute on function promo_internal.laporan_kuota(uuid, date, date) to authenticated;
notify pgrst, 'reload schema';
