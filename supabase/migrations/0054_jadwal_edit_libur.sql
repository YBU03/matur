-- Jadwal: jatah libur mingguan ditegakkan saat staf mengajukan libur; HRD/SPV bisa membatalkan izin/libur;
-- ubah jadwal (pindah shift / ganti orang) divalidasi di fungsi agar pesan kesalahannya jelas.

create or replace function cek_jatah_libur(p_pengguna uuid, p_tanggal date) returns void
language plpgsql stable security definer set search_path = public as $$
declare jatah int; terpakai int; awal date := date_trunc('week', p_tanggal)::date;
begin
  select coalesce(u.jatah_libur, (select jatah_libur_default from perusahaan limit 1), 1) into jatah from pengguna u where u.id = p_pengguna;
  select count(*) into terpakai from pengajuan_izin
   where pengguna_id = p_pengguna and jenis = 'libur' and status in ('menunggu','disetujui') and tanggal between awal and awal + 6;
  if terpakai >= jatah then
    raise exception 'Jatah libur minggu % – % sudah penuh (% hari/minggu)', to_char(awal, 'DD/MM'), to_char(awal + 6, 'DD/MM'), jatah;
  end if;
end $$;

create or replace function batal_izin_atasan(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r pengajuan_izin;
begin
  select * into r from pengajuan_izin where id = p_id;
  if r.id is null or not kelola_sdm(r.outlet_id) then raise exception 'Tidak diizinkan'; end if;
  if r.status not in ('menunggu','disetujui') then raise exception 'Pengajuan sudah tidak aktif'; end if;
  update pengajuan_izin set status = 'dibatalkan', diputus_oleh = auth.uid(), diputus_at = now() where id = p_id;
end $$;

create or replace function ubah_jadwal(p_id uuid, p_shift uuid, p_pengguna uuid) returns void
language plpgsql security definer set search_path = public as $$
declare j jadwal_shift; nama text;
begin
  select * into j from jadwal_shift where id = p_id for update;
  if j.id is null or not kelola_sdm(j.outlet_id) then raise exception 'Tidak diizinkan'; end if;
  if not exists (select 1 from shift_outlet where id = p_shift and outlet_id = j.outlet_id) then raise exception 'Shift tidak ditemukan di outlet ini'; end if;
  if not exists (select 1 from penugasan where pengguna_id = p_pengguna and outlet_id = j.outlet_id and peran in ('kasir','barista','spv')) then
    raise exception 'Staf ini tidak bertugas di outlet ini';
  end if;
  if exists (select 1 from pengajuan_izin where pengguna_id = p_pengguna and tanggal = j.tanggal and status = 'disetujui') then
    select u.nama into nama from pengguna u where u.id = p_pengguna;
    raise exception '% sedang izin/libur di tanggal itu', nama;
  end if;
  if exists (select 1 from jadwal_shift where id <> p_id and shift_id = p_shift and pengguna_id = p_pengguna and tanggal = j.tanggal) then
    raise exception 'Orang ini sudah ada di shift tersebut pada tanggal itu';
  end if;
  update jadwal_shift set shift_id = p_shift, pengguna_id = p_pengguna where id = p_id;
end $$;

-- ajukan_izin (staf): setelah cek "Libur hanya untuk tanggal ke depan" ditambah
--   if p_jenis = 'libur' then perform cek_jatah_libur(siapa, p_tanggal); end if;
-- (diterapkan via replace teks fungsi)
