# Oktober: semua jalur dan navigasi laporan

Screenshot pemilik menunjukkan tampilan tabel sel Excel sebagai halaman utama, berbeda dari September. Versi resmi memakai LaporanDokumen sejak PR106, tetapi jalur Periksa Internal/proyeksi masih mengembalikan LaporanSumberExcel secara langsung untuk draft sumber. Jalur itu sekarang memakai LaporanDokumen dan riwayat outlet yang sama. Arsip Excel hanya berada di panel sumber di bawah laporan.

Navigasi kembali menjadi tombol jelas pada toolbar sticky di atas grafik maupun panel pembayaran/WA, menuju daftar laporan outlet yang sama. Tautan Versi resmi dari daftar memakai navigasi dokumen penuh untuk mengambil halaman terbaru, tidak mengandalkan halaman yang tersimpan di router klien.

Atas koreksi pemilik, tombol PDF + lampiran lengkap dihapus dari antarmuka. PDF utama berisi laporan bulanan saja; Excel asli tetap dapat diunduh. Tidak mengubah angka, status laporan terbit, atau data transaksi. Renderer PDF tidak diubah oleh patch ini.

Validasi regresi: entry point internal berarsip sumber tetap menampilkan artikel/grafik bulanan; template biasa dan Oktober mempunyai navigasi kembali serta tidak menampilkan pilihan PDF lampiran. Tes PDF memastikan format umum dan cached totals tetap utuh. Browser produksi hanya mencapai login, sehingga tidak mengklaim pemeriksaan visual sesi akun pemilik.
