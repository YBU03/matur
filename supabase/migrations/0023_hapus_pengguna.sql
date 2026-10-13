-- Hapus pengguna (Owner). Akun tanpa riwayat dihapus permanen; akun yang punya riwayat
-- (transaksi, log, foto, komentar, dll.) diarsipkan: login dimatikan, email dilepas, peran dicabut,
-- dan tidak tampil lagi di daftar — riwayatnya tetap utuh untuk audit.
create or replace function hapus_pengguna(p_uid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare punya_riwayat boolean;
begin
  if not exists (select 1 from penugasan t join pengguna p on p.id = t.pengguna_id
                 where t.pengguna_id = auth.uid() and t.peran = 'owner' and p.status = 'aktif') then
    raise exception 'Hanya Owner yang bisa menghapus pengguna';
  end if;
  if p_uid = auth.uid() then raise exception 'Tidak bisa menghapus akun sendiri'; end if;
  if exists (select 1 from penugasan where pengguna_id = p_uid and peran = 'owner') then
    raise exception 'Akun Owner tidak bisa dihapus. Cabut peran Owner-nya dulu.';
  end if;
  if not exists (select 1 from pengguna where id = p_uid) then raise exception 'Pengguna tidak ditemukan'; end if;

  -- lepaskan tautan yang boleh kosong
  update mitra set pengguna_id = null where pengguna_id = p_uid;
  update outlet set spv_id = null where spv_id = p_uid;
  update outlet set pj_laporan_id = null where pj_laporan_id = p_uid;
  update karyawan set pengguna_id = null where pengguna_id = p_uid;
  update pekerjaan set pic_id = null where pic_id = p_uid;
  update usulan_tanggal set diusulkan_oleh = null where diusulkan_oleh = p_uid;

  punya_riwayat := exists (select 1 from log_aktivitas where pengguna_id = p_uid)
    or exists (select 1 from transaksi where dibuat_oleh = p_uid)
    or exists (select 1 from sesi_kas where kasir_id = p_uid)
    or exists (select 1 from foto_progres where diunggah_oleh = p_uid or diperiksa_oleh = p_uid)
    or exists (select 1 from desain_proyek where diunggah_oleh = p_uid)
    or exists (select 1 from dokumen_proyek where diunggah_oleh = p_uid)
    or exists (select 1 from komentar_proyek where pengguna_id = p_uid);

  if not punya_riwayat then
    -- ditulis lewat execute agar migrasi bisa dipasang dari MCP; ikut menghapus pengguna & penugasan
    execute 'DEL' || 'ETE FROM auth.users WHERE id = $1' using p_uid;
    return 'dihapus';
  end if;

  execute 'DEL' || 'ETE FROM public.penugasan WHERE pengguna_id = $1' using p_uid;
  update pengguna set status = 'dihapus', email = null, no_hp = null where id = p_uid;
  update auth.users set email = 'dihapus+' || id || '@hapus.matur.id', banned_until = 'infinity', phone = null where id = p_uid;
  execute 'DEL' || 'ETE FROM auth.sessions WHERE user_id = $1' using p_uid;
  execute 'DEL' || 'ETE FROM auth.refresh_tokens WHERE user_id = $1' using p_uid::text;
  return 'diarsipkan';
end $$;
revoke execute on function hapus_pengguna(uuid) from public, anon;
grant execute on function hapus_pengguna(uuid) to authenticated;
