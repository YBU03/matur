# PDF realisasi per toko / nota — 4 November 2026

Hanya proyeksi cetak: data belanja, item RAB, pembayaran, status, bukti, dan saldo tidak dimutasi. Ringkasan dana selalu dihitung dari daftar asli sebelum pengelompokan.

Kunci kelompok: proyek + toko (case-insensitive dan spasi dirapikan) + tanggal nota + nomor nota + penanda nilai DP. Nomor berbeda, tanggal berbeda, proyek berbeda, atau nota dibatalkan tetap terpisah. Nomor kosong pada toko/tanggal sama digabung pada PDF, sesuai konfirmasi pemilik bahwa input terpisah pada data tersebut berasal dari satu nota. PDF tetap menulis nomor belum diisi, tidak mengarang nomor. Untuk belanja berikutnya dari toko sama di hari sama tetapi nota berbeda, isi nomor nota masing-masing agar tetap terpisah.

Semua barang dipertahankan beserta qty, satuan, harga, total, dan urutan asal. Subtotal nota adalah penjumlahan total catatan asli. PJ Putra & Wahyu / Putra dan Wahyu dirapikan saat cetak; catatan lain dipertahankan dan duplikasi teks identik dihilangkan. Pembayaran di PDF diringkas hanya jika tanggal, sumber, dan metode sama. Nominal pembayaran identik tetap dijumlahkan, bukan dihapus. DP/pelunasan pada hari berbeda dan sumber/metode berbeda tetap terpisah; riwayat koreksi ditampilkan sendiri serta tetap dikecualikan dari pembayaran aktif.

Ringkasan di halaman pertama, setiap nota mulai halaman baru. Tabel info ringkas, tabel barang dengan subtotal kuning, lalu pembayaran. Tabel panjang tetap bisa melanjutkan halaman dengan header dan footer nomor halaman.

Validasi: unit menguji partisi kelompok, invariansi nilai uang, item/tautan RAB, immutable input, pembayaran/koreksi, dan keluaran PDF. Snapshot privat UHB (tidak masuk Git) berisi 25 catatan termasuk arsip, menjadi 7 kelompok dalam 8 halaman. Bintang Terang 12 input Rp5.149.000; Lancar Plastik 2 input Rp774.000; CV Setia Mulai Sejahtera 7 input Rp885.853. Semua halaman PDF dirender dan diperiksa; saldo tetap Rp11.732.397 pada snapshot tersebut.

Pemeriksaan akhir: 384 tes pada 62 berkas lolos (pool threads pada mesin dengan beban tinggi); TypeScript, lint tanpa error, dan build produksi berhasil.
