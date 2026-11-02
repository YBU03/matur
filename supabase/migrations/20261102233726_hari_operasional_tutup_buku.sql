-- Hari operasional: penjualan sebelum jam tutup buku (bawaan 03.00 WIB) dihitung ke hari sebelumnya.
-- Data transaksi tidak diubah; hanya pengelompokan hari di omzet, laporan, pantau POS, rekap harian/bulanan, dan tutup kas otomatis.
alter table public.perusahaan add column if not exists jam_tutup_buku smallint not null default 3 check (jam_tutup_buku between 0 and 6);

create or replace function public.jam_tutup_buku() returns interval language sql stable security definer set search_path = '' as $$
  select make_interval(hours => coalesce((select jam_tutup_buku from public.perusahaan limit 1), 3)::int)
$$;
create or replace function public.tgl_op(p timestamptz) returns date language sql stable set search_path = '' as $$
  select ((p at time zone 'Asia/Jakarta') - public.jam_tutup_buku())::date
$$;
create or replace function public.awal_op(p date) returns timestamptz language sql stable set search_path = '' as $$
  select ((p::timestamp + public.jam_tutup_buku()) at time zone 'Asia/Jakarta')
$$;
grant execute on function public.jam_tutup_buku(), public.tgl_op(timestamptz), public.awal_op(date) to authenticated, anon;

do $$
declare
  r record; d text;
  ganti jsonb := $j$[
    ["public.laporan_operasional(text,uuid,date,date,mode_data,uuid)", "(p_dari::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(p_dari)"],
    ["public.laporan_operasional(text,uuid,date,date,mode_data,uuid)", "((p_sampai + 1)::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(p_sampai + 1)"],
    ["public.laporan_operasional(text,uuid,date,date,mode_data,uuid)", "(t.created_at at time zone 'Asia/Jakarta')::date = d::date", "public.tgl_op(t.created_at) = d::date"],
    ["public.omzet_hari_ini(uuid,mode_data)", "select (now() at time zone 'Asia/Jakarta')::date hari,", "select public.tgl_op(now()) hari,"],
    ["public.omzet_hari_ini(uuid,mode_data)", "((now() at time zone 'Asia/Jakarta')::date)::timestamp at time zone 'Asia/Jakarta' awal", "public.awal_op(public.tgl_op(now())) awal"],
    ["public.omzet_hari_ini(uuid,mode_data)", "jsonb_agg(x order by x.jam)", "jsonb_agg(x order by (x.jam + 24 - extract(hour from public.jam_tutup_buku())::int) % 24)"],
    ["public.pantau_pos(uuid,date,date)", "(p_dari::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(p_dari)"],
    ["public.pantau_pos(uuid,date,date)", "((p_sampai + 1)::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(p_sampai + 1)"],
    ["public.pantau_pos(uuid,date,date)", "select lokal::date tgl,", "select (lokal - public.jam_tutup_buku())::date tgl,"],
    ["public.pantau_pos(uuid,date,date)", "extract(isodow from lokal)::int dow", "extract(isodow from lokal - public.jam_tutup_buku())::int dow"],
    ["public.pantau_pos_periode(uuid)", "t date := (now() at time zone 'Asia/Jakarta')::date;", "t date := public.tgl_op(now());"],
    ["public.pantau_pos_periode(uuid)", "(tr.created_at at time zone 'Asia/Jakarta')::date d", "public.tgl_op(tr.created_at) d"],
    ["public.pantau_pos_periode(uuid)", "(least(r.dari, r.p_dari)::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(least(r.dari, r.p_dari))"],
    ["public.pantau_pos_periode(uuid)", "((r.sampai + 1)::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(r.sampai + 1)"],
    ["public.ringkasan_penjualan(uuid,date,date,mode_data)", "(p_dari::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(p_dari)"],
    ["public.ringkasan_penjualan(uuid,date,date,mode_data)", "((p_sampai + 1)::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(p_sampai + 1)"],
    ["public.ringkasan_penjualan(uuid,date,date,mode_data)", "select lokal::date as tgl,", "select (lokal - public.jam_tutup_buku())::date as tgl,"],
    ["public.ringkasan_penjualan(uuid,date,date,mode_data)", "extract(isodow from lokal)::int as dow", "extract(isodow from lokal - public.jam_tutup_buku())::int as dow"],
    ["public.rekap_harian(uuid,date,mode_data)", "(t.created_at at time zone 'Asia/Jakarta')::date tgl", "public.tgl_op(t.created_at) tgl"],
    ["public.rekap_harian(uuid,date,mode_data)", "(date_trunc('month', p_periode)::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(date_trunc('month', p_periode)::date)"],
    ["public.rekap_harian(uuid,date,mode_data)", "((date_trunc('month', p_periode) + interval '1 month')::timestamp at time zone 'Asia/Jakarta')", "public.awal_op((date_trunc('month', p_periode) + interval '1 month')::date)"],
    ["public.rekap_harian(uuid,date,mode_data)", "(ditutup_at at time zone 'Asia/Jakarta')::date tgl", "public.tgl_op(ditutup_at) tgl"],
    ["public.rekap_harian(uuid,date,mode_data)", "where d.tgl <= (now() at time zone 'Asia/Jakarta')::date", "where d.tgl <= public.tgl_op(now())"],
    ["public.proyeksi_laporan(uuid,date,mode_data)", "(date_trunc('month', p_periode)::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(date_trunc('month', p_periode)::date)"],
    ["public.proyeksi_laporan(uuid,date,mode_data)", "((date_trunc('month', p_periode) + interval '1 month')::timestamp at time zone 'Asia/Jakarta')", "public.awal_op((date_trunc('month', p_periode) + interval '1 month')::date)"],
    ["public.proyeksi_laporan(uuid,date,mode_data)", "(t.created_at at time zone 'Asia/Jakarta')::date tgl", "public.tgl_op(t.created_at) tgl"],
    ["public.rekap_setoran(uuid,date,date)", "(t.created_at at time zone 'Asia/Jakarta')::date tanggal", "public.tgl_op(t.created_at) tanggal"],
    ["public.rekap_setoran(uuid,date,date)", "(p_dari::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(p_dari)"],
    ["public.rekap_setoran(uuid,date,date)", "((p_sampai+1)::timestamp at time zone 'Asia/Jakarta')", "public.awal_op(p_sampai+1)"],
    ["public.persediaan_bulanan(uuid,date)", "ta timestamptz := (a::timestamp at time zone 'Asia/Jakarta'); tb timestamptz := (b::timestamp at time zone 'Asia/Jakarta');", "ta timestamptz := public.awal_op(a); tb timestamptz := public.awal_op(b);"],
    ["public.tutup_kas_otomatis()", "hari date := (now() at time zone 'Asia/Jakarta')::date;", "hari date := public.tgl_op(now());"],
    ["public.tutup_kas_otomatis()", "(dibuka_at at time zone 'Asia/Jakarta')::date) < hari", "public.tgl_op(dibuka_at)) < hari"]
  ]$j$;
  f text; fungsi text[];
begin
  select array_agg(distinct x->>0) into fungsi from jsonb_array_elements(ganti) x;
  foreach f in array fungsi loop
    d := pg_get_functiondef(f::regprocedure);
    for r in select x->>1 lama, x->>2 baru from jsonb_array_elements(ganti) x where x->>0 = f loop
      if position(r.lama in d) = 0 then raise exception 'Pola tidak ditemukan di %: %', f, r.lama; end if;
      d := replace(d, r.lama, r.baru);
    end loop;
    execute d;
  end loop;
end $$;
