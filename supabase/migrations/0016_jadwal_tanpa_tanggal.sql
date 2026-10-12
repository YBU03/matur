-- Kegiatan timeline boleh belum bertanggal (diisi menyusul) + urutan tampil
alter table jadwal_proyek alter column tgl_rencana drop not null;
alter table jadwal_proyek add column urutan int not null default 0;
