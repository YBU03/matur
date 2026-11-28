# Rincian stok bahan — 28 November 2026

Atas persetujuan Gas pemilik, kartu stok sekarang menjelaskan saldo asli (gram/ml/pcs), padanan kemasan perkiraan, isi per kemasan, batas dan sumber minimum, serta status stok positif/rendah, nol, negatif, atau belum tercatat. Tidak menafsirkan satuan kemasan ambigu (contoh kaleng=18 kaleng) sebagai satuan baru.

Lokasi:
- Dashboard penjualan dan peringatan Kiriman Gudang: setiap bahan dapat dibuka, tidak dipotong hanya 12 bahan. Ambang baca menghormati setelan outlet (termasuk nol) dan bahan nonaktif, lalu master atau batas bawaan satu kemasan. Saldo negatif tidak lagi disamarkan menjadi nol.
- Stok Gudang: rincian dan tautan pergerakan bahan terpilih. Finance mendapat menu lihat; canEdit gudang tetap hanya owner/admin_pusat/admin_gudang.
- Kelola Stok Outlet: informasi konversi bahan, rincian minimum konsisten dengan dashboard, status belum tercatat berbeda dari nol, tautan Kartu Bahan terfilter outlet+bahan dengan periode dapat dipilih. Nilai form dan payload perintah tidak berubah.
- Stok Real-time manajemen: rincian pada peringatan dan daftar, saldo negatif terlihat dalam satuan asli. Tidak menambah akses panel manajemen bagi akun tablet/karyawan.
- Pergerakan Gudang: query bahan membuka rincian bahan yang dipilih, dipertahankan saat mengganti periode; rincian periode juga menampilkan angka asli satuan pakai selain grafik kemasan.

Riwayat menggunakan panel existing: outlet memiliki mutasi dan pagination/ekspor, gudang memiliki rincian pergerakan per periode. Saldo saat ini dibedakan dari data periode. Tidak ada polling baru, migrasi, RLS/grant baru, atau perubahan jumlah stok, resep, SO, HPP dan keuangan. Tidak membuat kiriman atau koreksi stok produksi.

Verifikasi akses baca Finance melalui authenticated role pada DB produksi: 32 bahan dan 32 saldo stok gudang dapat dibaca; tabel setelan dapat dibaca (saat pengecekan belum ada baris). Semua query audit dibungkus transaksi read-only secara penggunaan dan ROLLBACK, tidak ada pembaruan data.

QA: empat tes khusus memastikan negatif/nol/belum tercatat, pecahan kecil tetap nonnol, satuan ambigu tidak ditafsirkan baru, minimum outlet nol dan bahan nonaktif, serta navigasi Finance. Browser tablet 1024×768 dan HP 390×844 memeriksa toggle rincian, link outlet+bahan, negatif, unit rancu, Finance read-only dan rincian gudang terpilih. Seluruh POST diblokir saat QA. Tidak ada overflow mendatar pada kartu HP. Halaman QA dan pengecualian middleware telah dibersihkan sebelum build.

Seluruh 717 tes / 130 berkas lolos. Rincian gudang juga membedakan saldo negatif dan bahan yang belum punya catatan stok; bukan menyebut keduanya habis. Tidak menambahkan efek, fetch saat membuka rincian, polling, atau akses tulis Finance.
