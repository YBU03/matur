# Kartu Karyawan Outlet: No. WA tersamar

Portal mitra memakai kartu profil client terpisah, dengan nomor WA tersamar saat
pertama dimuat. Nomor normal menampilkan empat digit terakhir, nomor pendek tidak
menampilkan digit; tombol mata memperlihatkan/menyembunyikan nomor lengkap.
Status setiap kartu terpisah dan tidak disimpan di localStorage/cookie. Muat ulang
penuh kembali tersamar. Nomor kosong diberi keterangan tanpa tombol mata.

Tombol native dapat dipakai dengan keyboard, memiliki label aksi menyebut nama
karyawan, aria-pressed, dan fokus terlihat. Ini penyamaran tampilan untuk mitra
yang sudah berhak melihat kontak, bukan perubahan otorisasi database. Query dan
pembatasan outlet yang sudah ada tetap; tidak ada migrasi atau perubahan data.

Visual: avatar/foto lebih ringkas, header gradasi Matoer, lencana peran, ikon
telepon/alamat/tanggal bergabung, label dan jarak konsisten. Alamat tetap berupa
teks tanpa tautan Maps. Foto gagal dimuat memakai ikon, termasuk kegagalan sebelum
hidrasi; sumber foto baru tetap dapat dicoba. Susunan profil di atas jadwal tetap.

Validasi browser komponen asli dengan data uji: samaran awal/reload, toggle per
kartu, keyboard Space, label/pressed, nomor kosong/pendek, nama/alamat panjang,
fallback foto, dan lebar 1440/390/320 tanpa overflow (termasuk saat nomor dibuka).
Halaman QA dan middleware uji dipulihkan sebelum commit.

Pemeriksaan akhir: seluruh 425 tes / 69 berkas lulus. TypeScript, lint dan build
produksi diperiksa sebelum deployment.
