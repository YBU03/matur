# Marketing Matoer — 25 November 2026

Role baru `marketing`, label **Marketing Matoer**, login password akun pribadi. Owner dapat membuat akun melalui Pengguna; Owner/Admin Pusat dapat menyetujui pendaftar atau memberi akses Marketing pada akun yang sesuai. Tidak membuat akun, mengubah akun Tamu, atau menambahkan penugasan otomatis dalam migrasi. Penugasan Marketing bersifat pusat, outlet_id harus NULL; outlet baru otomatis mengikuti daftar master.

## Menu

- **Omzet Outlet** (`/pantau-pos`): ringkasan, periode/kustom, tren harian, kanal, menu terlaris, jam ramai dan perbandingan outlet. Memakai RPC pantau_pos yang sama dengan Tamu, bukan akses tabel transaksi atau ringkasan berisi HPP.
- **Promo & Pemakaian** (`/promo`): membuat/mengedit promo untuk satu, beberapa, atau semua outlet, harga akhir/persen/voucher/gratis bersubsidi, periode/jam/hari, menu, kuota, pemakaian dan total potongan. Alur konfirmasi aktif/nonaktif, pemeriksaan versi dan audit yang sama tetap berlaku. Tidak membuka edit tagihan atau pencatatan pelunasan subsidi Akunting.
- **Shift Hari Ini** (`/marketing/shift`): tanggal kalender WIB dari server, semua/satu outlet, nama/jabatan/jam shift yang sudah terbit. Jadwal draft, hari lain dan profil pribadi tidak dikirim. Shift malam diberi tanda +1 hari. Menampilkan kosong eksplisit per outlet; kegagalan memuat dibedakan dari tidak ada jadwal. Ini jadwal, bukan bukti kehadiran atau operator POS aktif. Hanya lihat, tidak mengedit jadwal.

Login dan pindah peran diarahkan ke pantau-pos. Navigasi Marketing dibatasi ke tiga menu tersebut serta Profil. Pintasan HP Omzet/Promo/Shift hari ini. Tamu Matur tetap hanya pemantau dengan cakupan penugasannya.

## Izin database

Tidak menambahkan Marketing ke boleh_outlet, kelola_sdm, peran keuangan, POS atau pengelola akun. Promo pusat dan outlet_pantau mengenali penugasan Marketing global dari pengguna aktif. Pembuatan/pemberian peran tetap melalui kewenangan lama; kebijakan baru Admin Pusat hanya untuk tambah/cabut Marketing pada akun lain yang bukan Owner.

Katalog promo menyajikan nama, kategori, kemasan, harga jual dan varian saja lewat `katalog_promo_marketing`; tidak mengirim HPP/harga titip. Jadwal memakai `jadwal_marketing_hari_ini` dengan proyeksi terbatas. Endpoint publik SECURITY INVOKER menuju implementasi privat yang memeriksa hak akses. Anonim ditolak.

Marketing-only dibatasi membaca master mentah menu, bahan, resep, supplier dan data titipan yang sebelumnya dibuka bagi authenticated. Kebijakan RESTRICTIVE tidak memperluas akses peran lama; akun dengan peran operasional lain tetap mengikuti hak peran tersebut. Tabel keuangan/stok/karyawan/transaksi tidak dibuka untuk Marketing. Tamu lama tidak diberi hak promo atau jadwal.

Migrasi: 20261125044137_marketing_role, 20261125044143_marketing_akses, 20261125044325_marketing_rpc_invoker. Enum terpisah agar tidak memakai nilai enum yang belum committed. Tidak mengubah saldo, transaksi, stok, jadwal atau promo produksi. Tidak menambah polling ataupun integrasi AI.

## Validasi

PGlite menguji semua outlet vs Tamu satu outlet, akun nonaktif/anonim, penugasan pusat/eskalasi, jadwal terbit hari ini saja, HPP/keuangan mentah ditutup, pembuatan promo global dan konflik versi. DOM menguji penolakan role sebelum query, menu, data jadwal/shift malam/kosong/error; login Marketing diuji menuju pantau-pos.

Fixture akun Marketing authenticated di database sebenarnya berhasil membaca pemantauan, katalog (48 menu), jadwal terbit (10 baris), membuat/mengedit promo nonaktif. Pembacaan tabel mentah menu/jadwal/transaksi/keuangan menghasilkan nol. Seluruh fixture ROLLBACK, tidak ada data uji tertinggal. Security advisor dibandingkan sebelum/sesudah: tidak ada temuan baru.
