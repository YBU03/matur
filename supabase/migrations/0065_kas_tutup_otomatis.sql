-- Tutup otomatis kas POS yang tertinggal sampai berganti hari (cron tiap jam). Uang fisik belum diketahui,
-- jadi kas ditandai "belum dihitung" (setoran & selisih kosong) sampai Owner/SPV/Admin Gudang mengisi hitungan.
-- Owner, SPV outlet, dan Admin Gudang mendapat notifikasi; semua penutupan otomatis tercatat di riwayat & log.
alter table sesi_kas add column if not exists tutup_otomatis boolean not null default false;
alter table sesi_kas add column if not exists dihitung_at timestamptz;
alter table sesi_kas add column if not exists dihitung_oleh uuid references pengguna;
create index if not exists sesi_kas_dihitung_oleh_idx on sesi_kas(dihitung_oleh);

create or replace function public.tutup_kas_otomatis() returns int
language plpgsql security definer set search_path = public as $$
declare s sesi_kas; h jsonb; n int := 0; hari date := (now() at time zone 'Asia/Jakarta')::date;
begin
  for s in select * from sesi_kas where mode = 'asli' and pos_tim and ditutup_at is null
             and now() > batas_at and coalesce(tanggal_shift, (dibuka_at at time zone 'Asia/Jakarta')::date) < hari
             and not exists(select 1 from matur_internal.pos_izin i where i.sesi_id = sesi_kas.id and i.ditarik_at is null and i.sampai_at > now())
           for update skip locked loop
    h := (select jsonb_build_object('modal', s.modal_laci, 'tunai', coalesce(sum(p.nominal) filter (where p.metode = 'tunai'), 0),
            'non_tunai', coalesce(sum(p.nominal) filter (where p.metode <> 'tunai'), 0), 'transaksi', count(distinct t.id))
          from transaksi t join pembayaran p on p.transaksi_id = t.id where t.sesi_kas_id = s.id and t.status = 'lunas');
    h := h || jsonb_build_object(
      'laci', coalesce((select sum(jumlah) from biaya_outlet where sesi_kas_id = s.id and sumber = 'laci' and deleted_at is null), 0),
      'keluar', coalesce((select sum(jumlah) from pos_kas_keluar where sesi_id = s.id), 0));
    h := h || jsonb_build_object('seharusnya', s.modal_laci + (h->>'tunai')::bigint - (h->>'laci')::bigint - (h->>'keluar')::bigint);
    update sesi_kas set ditutup_at = now(), ditutup_oleh = null, tutup_otomatis = true, fisik_akhir = null,
      kas_seharusnya = (h->>'seharusnya')::bigint, seharusnya = (h->>'seharusnya')::bigint - s.modal_laci,
      setoran = null, selisih = null, rekap_status = 'final',
      catatan_tutup = 'Ditutup otomatis oleh sistem: shift tidak ditutup sampai berganti hari. Uang fisik belum dihitung.'
    where id = s.id;
    update matur_internal.pos_izin set ditarik_at = coalesce(ditarik_at, now()) where sesi_id = s.id;
    update pos_serah_terima set selesai_at = now() where sesi_id = s.id and selesai_at is null;
    insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru)
      values (null, 'tutup_kas_otomatis', 'sesi_kas', s.id::text, h);
    insert into notifikasi(pengguna_id, judul, isi, tautan)
      select distinct u.id, '⚠️ Kas POS ditutup otomatis',
        (select nama from outlet where id = s.outlet_id) || ' · shift ' || coalesce(s.tanggal_shift::text, '') || ' tidak ditutup kasir. Hitung uang di laci (seharusnya Rp ' || to_char((h->>'seharusnya')::bigint, 'FM999G999G999') || ') lalu isi di menu Akses Kasir POS Outlet.',
        '/pengaturan/pos#riwayat-kas'
      from penugasan t join pengguna u on u.id = t.pengguna_id and u.status = 'aktif' and not u.akun_tablet
      where t.peran = 'owner' or (t.peran = 'spv' and t.outlet_id = s.outlet_id) or (t.peran = 'admin_gudang' and (t.outlet_id is null or t.outlet_id = s.outlet_id));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tutup_kas_otomatis() from public, anon, authenticated;

-- riwayat kas ditutup otomatis (60 hari) yang boleh dilihat pemanggil
create or replace function public.riwayat_kas_otomatis() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'outlet', o.nama, 'tanggal', s.tanggal_shift, 'dibuka_at', s.dibuka_at, 'ditutup_at', s.ditutup_at,
      'pic', (select u.nama from pos_serah_terima st join pengguna u on u.id = st.pic_id where st.sesi_id = s.id order by st.mulai_at desc limit 1),
      'modal', s.modal_laci, 'seharusnya', s.kas_seharusnya, 'fisik', s.fisik_akhir, 'selisih', s.selisih,
      'transaksi', (select count(*) from transaksi t where t.sesi_kas_id = s.id and t.status = 'lunas'),
      'dihitung_at', s.dihitung_at, 'dihitung_oleh', (select nama from pengguna where id = s.dihitung_oleh), 'catatan', s.catatan_tutup
    ) order by s.ditutup_at desc), '[]')
  from sesi_kas s join outlet o on o.id = s.outlet_id
  where s.tutup_otomatis and s.ditutup_at > now() - interval '60 days' and matur_internal.boleh_tutup_tertinggal(s.outlet_id)
$$;
revoke all on function public.riwayat_kas_otomatis() from public, anon;
grant execute on function public.riwayat_kas_otomatis() to authenticated;

-- isi hitungan uang fisik untuk kas yang ditutup otomatis
create or replace function public.hitung_kas_otomatis(p_sesi uuid, p_aktual bigint, p_catatan text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s sesi_kas;
begin
  select * into s from sesi_kas where id = p_sesi for update;
  if s.id is null or not s.tutup_otomatis then raise exception 'Kas tidak ditemukan'; end if;
  if s.dihitung_at is not null then raise exception 'Kas ini sudah dihitung'; end if;
  if not matur_internal.boleh_tutup_tertinggal(s.outlet_id) then raise exception 'Hanya Owner, SPV outlet ini, atau Admin Gudang'; end if;
  if p_aktual is null or p_aktual < 0 then raise exception 'Isi uang fisik di laci (termasuk modal)'; end if;
  if p_aktual <> s.kas_seharusnya and length(trim(coalesce(p_catatan, ''))) < 3 then raise exception 'Catatan wajib bila ada selisih'; end if;
  update sesi_kas set fisik_akhir = p_aktual, setoran = p_aktual - s.modal_laci, selisih = p_aktual - s.kas_seharusnya,
    dihitung_at = now(), dihitung_oleh = auth.uid(),
    catatan_tutup = left(s.catatan_tutup || ' Dihitung: ' || coalesce(nullif(trim(p_catatan), ''), 'sesuai'), 1000)
  where id = s.id;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru)
    values (auth.uid(), 'hitung_kas_otomatis', 'sesi_kas', s.id::text, jsonb_build_object('aktual', p_aktual, 'seharusnya', s.kas_seharusnya, 'catatan', p_catatan));
  return jsonb_build_object('selisih', p_aktual - s.kas_seharusnya);
end $$;
revoke all on function public.hitung_kas_otomatis(uuid, bigint, text) from public, anon;
grant execute on function public.hitung_kas_otomatis(uuid, bigint, text) to authenticated;

select cron.schedule('tutup-kas-otomatis', '23 * * * *', 'select public.tutup_kas_otomatis()');
