# Kejelasan satuan bahan — 28 November 2026

Permintaan pemilik: perjelas angka seperti 0,7 tanpa mengubah nilai stok, resep, konversi, pemakaian, atau data keuangan.

- SO: label kemasan dan sisa terbuka, rumus total fisik berdasarkan hasil perhitungan existing, serta peringatan agar pecahan kemasan tidak dihitung ulang sebagai sisa terbuka.
- Gudang: rincian satuan pakai tidak lagi ditampilkan dengan pembulatan nol desimal. Pratinjau koreksi menunjukkan jumlah kemasan × isi per kemasan dan total fisik pengganti.
- Resep: keterangan eksplisit pemakaian per 1 menu dan satuan pakai; judul takaran pada daftar/tambah HPP diperjelas.
- Stok outlet: keterangan desimal dan konteks koreksi/waste; laporan membedakan penerimaan, pemakaian resep teoritis, dan SO fisik.
- PDF/Excel penggunaan bahan menyertakan petunjuk membaca desimal; angka dan kolom data ekspor tetap sama. Catatan Excel dibungkus dan tabel PDF mengikuti tinggi catatan.

Tidak ada migrasi, pembaruan database, perubahan server action/RPC, parser input, rumus stok/HPP, atau perubahan otomatis satuan master. Khusus data satuan ambigu seperti Lychee, sumber tetap dipertahankan dan perlu konfirmasi terpisah sebelum koreksi data.

Pemeriksaan tampilan: tablet 1024×768 dan HP 390×844, skenario 0,7 pack × 1.000 g = 700 g serta sisa 0,7 g tetap 0,7 g; resep 0,7 g per menu. Semua POST diblokir selama simulasi. PDF dirender dan diperiksa visual; Excel memastikan sel F5 tetap numerik 0.7 dan saldo M5 0.3 pada data uji. Tidak ada data produksi yang ditulis saat QA.

Validasi: seluruh 713 tes / 129 berkas lolos. Pengecekan React: tidak ada efek/jaringan atau state baru, teks mengikuti hasil perhitungan existing. Pengelompokan label menjaga satuan tetap bersama input pada layar HP. Halaman QA dan pengecualian middleware telah dihapus sebelum build produksi.
