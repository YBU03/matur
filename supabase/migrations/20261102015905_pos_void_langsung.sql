-- Void langsung dari POS (tanpa PIN SPV) dengan alasan wajib & nama pembatal; switch per outlet "Void wajib PIN SPV".
alter table public.outlet add column if not exists void_wajib_pin boolean not null default false;
alter table public.transaksi add column if not exists void_nama text, add column if not exists void_kategori text;

create or replace function public.void_pos_langsung(p_outlet uuid, p_device text, p_transaksi uuid, p_kategori text, p_catatan text, p_nama text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare dev uuid; t transaksi; r record; o outlet; kat text := trim(coalesce(p_kategori, '')); cat text := trim(coalesce(p_catatan, '')); nm text := trim(coalesce(p_nama, '')); u record;
begin
  if not boleh_outlet(p_outlet) then raise exception 'Tidak diizinkan'; end if;
  dev := matur_internal.perangkat(p_outlet, p_device);
  if dev is null then raise exception 'Gunakan tablet outlet yang disetujui'; end if;
  select * into o from outlet where id = p_outlet;
  if o.void_wajib_pin then raise exception 'Outlet ini mewajibkan PIN SPV untuk void'; end if;
  if kat = '' or length(kat) > 40 then raise exception 'Pilih alasan pembatalan'; end if;
  if length(cat) < 3 or length(cat) > 300 then raise exception 'Catatan pembatalan wajib diisi (min. 3 huruf)'; end if;
  if length(nm) < 2 or length(nm) > 60 then raise exception 'Isi nama yang membatalkan'; end if;
  select * into t from transaksi where id = p_transaksi and outlet_id = p_outlet and status = 'lunas' for update;
  if t.id is null then raise exception 'Transaksi tidak ditemukan atau sudah dibatalkan'; end if;
  if not exists (select 1 from sesi_kas where id = t.sesi_kas_id and ditutup_at is null) then raise exception 'Kas shift transaksi ini sudah ditutup, void tidak bisa dari POS'; end if;
  update transaksi set status = 'void', void_oleh = auth.uid(), void_nama = nm, void_kategori = kat, void_alasan = kat || ': ' || cat, void_at = now() where id = t.id;
  for r in select bahan_id, sum(jumlah) jml from mutasi_stok where ref_id = t.id and jenis = 'pemakaian' group by bahan_id loop
    perform geser_stok(t.mode, t.outlet_id, r.bahan_id, -r.jml, 'void', t.id, 'Void POS oleh ' || nm);
  end loop;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru)
  values (auth.uid(), 'void_pos', 'transaksi', t.id::text, jsonb_build_object('kategori', kat, 'catatan', cat, 'nama', nm, 'total', t.total, 'nomor', t.nomor));
  -- info (bukan persetujuan) ke SPV outlet, HRD, Owner, Admin Pusat
  for u in select distinct pe.pengguna_id from penugasan pe join pengguna g on g.id = pe.pengguna_id and g.status = 'aktif'
           where (pe.outlet_id = p_outlet and pe.peran = 'spv') or (pe.outlet_id is null and pe.peran in ('owner', 'admin_pusat', 'hrd')) loop
    insert into notifikasi(pengguna_id, judul, isi, tautan)
    values (u.pengguna_id, 'Void POS #' || t.nomor || ' · ' || o.nama,
            'Rp ' || to_char(t.total, 'FM999G999G999') || ' dibatalkan oleh ' || nm || ' · ' || kat || ': ' || cat,
            '/laporan-pos/void?outlet=' || p_outlet);
  end loop;
  return jsonb_build_object('ok', 'Transaksi #' || t.nomor || ' dibatalkan, stok dikembalikan.');
end $$;
revoke all on function public.void_pos_langsung(uuid, text, uuid, text, text, text) from public, anon;
grant execute on function public.void_pos_langsung(uuid, text, uuid, text, text, text) to authenticated;

create or replace function public.atur_void_pin(p_outlet uuid, p_aktif boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not punya_peran('{owner,admin_pusat,hrd,admin_gudang}') then raise exception 'Hanya Owner/Admin Pusat/HRD/Admin Gudang'; end if;
  update outlet set void_wajib_pin = coalesce(p_aktif, false) where id = p_outlet and deleted_at is null;
  if not found then raise exception 'Outlet tidak ditemukan'; end if;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru) values (auth.uid(), 'atur_void_pin', 'outlet', p_outlet::text, jsonb_build_object('void_wajib_pin', p_aktif));
end $$;
revoke all on function public.atur_void_pin(uuid, boolean) from public, anon;
grant execute on function public.atur_void_pin(uuid, boolean) to authenticated;

-- laporan void: nama pembatal & kategori; rekap void per orang
do $$
declare d text;
begin
  d := pg_get_functiondef('public.laporan_operasional'::regproc);
  if position($q$'void_oleh', (select nama from pengguna where id = t.void_oleh)$q$ in d) = 0 then raise exception 'pola void_oleh tidak ditemukan'; end if;
  d := replace(d, $q$'void_oleh', (select nama from pengguna where id = t.void_oleh)$q$,
                  $q$'void_oleh', coalesce(t.void_nama, (select nama from pengguna where id = t.void_oleh)), 'kategori', t.void_kategori$q$);
  if position($q$'modifier','kasir','stok_keluar','ikhtisar')$q$ in d) = 0 then raise exception 'pola daftar jenis tidak ditemukan'; end if;
  d := replace(d, $q$'modifier','kasir','stok_keluar','ikhtisar')$q$, $q$'modifier','kasir','stok_keluar','ikhtisar','void_orang')$q$);
  if position($q$  elsif p_jenis = 'produk' then$q$ in d) = 0 then raise exception 'pola produk tidak ditemukan'; end if;
  d := replace(d, $q$  elsif p_jenis = 'produk' then$q$, $q$  elsif p_jenis = 'void_orang' then
    select coalesce(jsonb_agg(x order by (x->>'nilai')::bigint desc), '[]') into r from (
      select jsonb_build_object('nama', coalesce(t.void_nama, (select nama from pengguna where id = t.void_oleh), '-'),
        'jumlah', count(*), 'nilai', coalesce(sum(t.total), 0),
        'alasan_utama', (select t2.void_kategori from transaksi t2 where t2.outlet_id = p_outlet and t2.mode = p_mode and t2.status = 'void'
                           and t2.created_at >= ta and t2.created_at < tb and coalesce(t2.void_nama, '') = coalesce(t.void_nama, '') and t2.void_kategori is not null
                         group by t2.void_kategori order by count(*) desc limit 1),
        'terakhir', max(t.void_at)) x
      from transaksi t
      where t.outlet_id = p_outlet and t.mode = p_mode and t.status = 'void' and t.created_at >= ta and t.created_at < tb
      group by coalesce(t.void_nama, (select nama from pengguna where id = t.void_oleh), '-'), t.void_nama) s;

  elsif p_jenis = 'produk' then$q$);
  execute d;
end $$;
