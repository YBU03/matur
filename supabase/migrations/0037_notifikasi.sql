-- Notifikasi dalam Ruang Karyawan (lonceng di /karyawan): izin diputus, tukar shift, jadwal terbit.
-- Ditulis hanya oleh trigger/fungsi security definer; pemilik hanya membaca & menandai dibaca.

create table notifikasi (
  id uuid primary key default gen_random_uuid(),
  pengguna_id uuid not null references pengguna on delete cascade,
  judul text not null,
  isi text,
  tautan text,
  dibaca_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifikasi (pengguna_id, created_at desc);
alter table notifikasi enable row level security;
create policy baca on notifikasi for select to authenticated using (pengguna_id = auth.uid());
create policy tandai on notifikasi for update to authenticated using (pengguna_id = auth.uid()) with check (pengguna_id = auth.uid());

create or replace function kirim_notifikasi(p_uid uuid, p_judul text, p_isi text, p_tautan text) returns void
language sql security definer set search_path = public as $$
  insert into notifikasi (pengguna_id, judul, isi, tautan) select p_uid, p_judul, p_isi, p_tautan where p_uid is not null
$$;
revoke execute on function kirim_notifikasi(uuid, text, text, text) from public, anon, authenticated;

create or replace function notif_izin() returns trigger
language plpgsql security definer set search_path = public as $$
declare jenis text := case new.jenis when 'izin' then 'Izin' when 'sakit' then 'Sakit' else 'Libur' end;
begin
  if new.status in ('disetujui','ditolak')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and new.pengguna_id is distinct from new.diputus_oleh then
    perform kirim_notifikasi(new.pengguna_id,
      jenis || case when new.status = 'disetujui' then ' disetujui' else ' ditolak' end,
      jenis || ' tanggal ' || to_char(new.tanggal, 'DD-MM-YYYY')
        || case when new.status = 'ditolak' and new.alasan_tolak is not null then '. Alasan: ' || new.alasan_tolak else '' end,
      '/karyawan/izin');
  end if;
  return new;
end $$;
create trigger notif_izin after insert or update on pengajuan_izin for each row execute function notif_izin();

create or replace function notif_tukar() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; b text;
begin
  select nama into a from pengguna where id = new.pengaju_id;
  select nama into b from pengguna where id = new.rekan_id;
  if tg_op = 'INSERT' then
    perform kirim_notifikasi(new.rekan_id, 'Permintaan tukar shift', a || ' ingin bertukar shift dengan Anda.', '/karyawan/izin');
  elsif old.status is distinct from new.status then
    if new.status = 'menunggu_atasan' then
      perform kirim_notifikasi(new.pengaju_id, 'Rekan menerima tukar shift', b || ' menerima. Menunggu persetujuan HRD/SPV.', '/karyawan/izin');
    elsif new.status = 'disetujui' then
      perform kirim_notifikasi(new.pengaju_id, 'Tukar shift disetujui', 'Jadwal Anda dan ' || b || ' sudah ditukar.', '/karyawan/jadwal');
      perform kirim_notifikasi(new.rekan_id, 'Tukar shift disetujui', 'Jadwal Anda dan ' || a || ' sudah ditukar.', '/karyawan/jadwal');
    elsif new.status = 'ditolak' then
      perform kirim_notifikasi(new.pengaju_id, 'Tukar shift ditolak',
        coalesce(new.alasan_tolak, 'Permintaan tukar shift ditolak.'), '/karyawan/izin');
    end if;
  end if;
  return new;
end $$;
create trigger notif_tukar after insert or update on tukar_shift for each row execute function notif_tukar();

-- Terbitkan draft + kabari setiap staf yang mendapat jadwal
create or replace function terbitkan_jadwal(p_outlet uuid, p_dari date, p_sampai date) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  if not kelola_sdm(p_outlet) then raise exception 'Tidak diizinkan'; end if;
  for r in
    with t as (
      update jadwal_shift set status = 'terbit'
      where outlet_id = p_outlet and status = 'draft' and tanggal between p_dari and p_sampai
      returning pengguna_id, tanggal
    )
    select pengguna_id, count(*)::int jml, min(tanggal) awal, max(tanggal) akhir from t group by pengguna_id
  loop
    n := n + r.jml;
    perform kirim_notifikasi(r.pengguna_id, 'Jadwal baru terbit',
      r.jml || ' shift baru antara ' || to_char(r.awal, 'DD-MM') || ' s.d. ' || to_char(r.akhir, 'DD-MM-YYYY') || '. Cek kalender Anda.', '/karyawan/jadwal');
  end loop;
  return n;
end $$;
revoke execute on function terbitkan_jadwal(uuid, date, date) from public, anon;
grant execute on function terbitkan_jadwal(uuid, date, date) to authenticated;

alter publication supabase_realtime add table notifikasi;

-- (0037c) tautan lama /staf/... dialihkan ke Ruang Karyawan
update notifikasi set tautan = replace(replace(tautan, '/staf/pengajuan', '/karyawan/izin'), '/staf/', '/karyawan/') where tautan like '/staf/%';
