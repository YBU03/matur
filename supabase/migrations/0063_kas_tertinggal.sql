-- Kas POS tertinggal: kas tim yang lewat batas shift / izin tabletnya sudah habis tidak bisa ditutup dari tablet
-- dan menghalangi kas hari berikutnya. Owner, SPV outlet itu, dan Admin Gudang (outlet kewenangannya) bisa menutupnya
-- dengan hitungan uang fisik + alasan. Riwayat transaksi tidak diubah.
create or replace function matur_internal.boleh_tutup_tertinggal(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    punya_peran('{owner}')
    or exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id and u.status='aktif' where t.pengguna_id=auth.uid() and t.outlet_id=o and t.peran='spv')
    or (punya_peran('{admin_gudang}') and matur_internal.admin_pos_outlet(o))
  )
$$;
revoke all on function matur_internal.boleh_tutup_tertinggal(uuid) from public, anon, authenticated;

create or replace function matur_internal.kas_tersangkut(s sesi_kas) returns boolean
language sql stable security definer set search_path = public as $$
  select s.ditutup_at is null and s.pos_tim and (
    now() > s.batas_at
    or not exists(select 1 from matur_internal.pos_izin i where i.sesi_id = s.id and i.ditarik_at is null and i.sampai_at > now())
  )
$$;
revoke all on function matur_internal.kas_tersangkut(sesi_kas) from public, anon, authenticated;

-- daftar kas tertinggal yang boleh ditutup pemanggil
create or replace function public.kas_tertinggal() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'outlet_id', s.outlet_id, 'outlet', o.nama, 'nama', s.nama_kasir,
      'tanggal', s.tanggal_shift, 'dibuka_at', s.dibuka_at, 'batas_at', s.batas_at,
      'lewat_batas', now() > s.batas_at,
      'pic', (select u.nama from pos_serah_terima st join pengguna u on u.id = st.pic_id where st.sesi_id = s.id order by st.mulai_at desc limit 1),
      'kas', matur_internal.kas_ringkas(s.id),
      'pesanan_aktif', (select count(*) from transaksi t where t.sesi_kas_id = s.id and t.status = 'lunas' and t.status_pesanan <> 'diambil')
    ) order by s.dibuka_at), '[]')
  from sesi_kas s join outlet o on o.id = s.outlet_id
  where s.mode = 'asli' and matur_internal.kas_tersangkut(s) and matur_internal.boleh_tutup_tertinggal(s.outlet_id)
$$;
revoke all on function public.kas_tertinggal() from public, anon;
grant execute on function public.kas_tertinggal() to authenticated;

create or replace function public.tutup_kas_tertinggal(p_sesi uuid, p_aktual bigint, p_alasan text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s sesi_kas; h jsonb;
begin
  select * into s from sesi_kas where id = p_sesi for update;
  if s.id is null or s.ditutup_at is not null or not s.pos_tim then raise exception 'Kas tidak ditemukan atau sudah ditutup'; end if;
  if not matur_internal.boleh_tutup_tertinggal(s.outlet_id) then raise exception 'Hanya Owner, SPV outlet ini, atau Admin Gudang'; end if;
  if not matur_internal.kas_tersangkut(s) then raise exception 'Kas masih aktif di tablet. Tutup lewat tablet (Tutup Shift) atau kunci tablet dahulu'; end if;
  if p_aktual is null or p_aktual < 0 then raise exception 'Isi uang fisik di laci (termasuk modal)'; end if;
  if length(trim(coalesce(p_alasan, ''))) < 5 then raise exception 'Alasan minimal 5 karakter'; end if;
  h := matur_internal.kas_ringkas(s.id);
  update sesi_kas set ditutup_at = now(), ditutup_oleh = auth.uid(), fisik_akhir = p_aktual,
    kas_seharusnya = (h->>'seharusnya')::bigint, setoran = p_aktual - s.modal_laci,
    seharusnya = (h->>'seharusnya')::bigint - s.modal_laci, selisih = p_aktual - (h->>'seharusnya')::bigint,
    rekap_status = 'final', catatan_tutup = left('Ditutup admin (kas tertinggal): ' || trim(p_alasan), 1000)
  where id = s.id;
  update matur_internal.pos_izin set ditarik_at = coalesce(ditarik_at, now()) where sesi_id = s.id;
  update pos_serah_terima set selesai_at = now() where sesi_id = s.id and selesai_at is null;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru)
    values (auth.uid(), 'tutup_kas_tertinggal', 'sesi_kas', s.id::text, h || jsonb_build_object('aktual', p_aktual, 'alasan', p_alasan));
  return h || jsonb_build_object('aktual', p_aktual, 'selisih', p_aktual - (h->>'seharusnya')::bigint);
end $$;
revoke all on function public.tutup_kas_tertinggal(uuid, bigint, text) from public, anon;
grant execute on function public.tutup_kas_tertinggal(uuid, bigint, text) to authenticated;
