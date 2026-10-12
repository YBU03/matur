-- Pembaruan langsung (tanpa refresh): pendaftar baru & persetujuan akun; status "dihapus" untuk akun yang diarsipkan
alter publication supabase_realtime add table pengguna, penugasan;
alter table pengguna drop constraint pengguna_status_check;
alter table pengguna add constraint pengguna_status_check check (status in ('menunggu','aktif','ditolak','nonaktif','dihapus'));
