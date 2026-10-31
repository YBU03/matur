# Kelompok menu kiri Admin Pusat dan Owner

Sidebar kedua peran memakai delapan subjudul: Ringkasan; Outlet & Kemitraan; Karyawan & Kehadiran; Menu & Produk; Gudang & Persediaan; Titipan Produk; Keuangan & Laporan; Pengguna & Pengaturan.

Semua kelompok langsung terbuka. Subjudul cokelat, garis pemisah tipis dan jarak memisahkan bagian. Label menu panjang dapat membungkus sesuai lebar sidebar desktop/laci HP. Satu komponen SideNav digunakan keduanya.

Pengelompokan menerima menu dari peran aktif, tanpa menambahkan hak akses atau mengubah ROLES. Termasuk menu operasional yang di-push pada bagian akhir roles.ts: invoice/penerimaan, setoran, kasbon, opname, profil karyawan, akses POS, laba rugi gudang, kontak outlet dan pengaturan/arsip dokumen. Jika ada rute baru yang belum dipetakan, tetap tampil dalam Menu Lainnya. Kelompok kosong tidak tampil.

Pencarian tetap memfilter nama menu. Hanya kelompok yang berisi hasil ditampilkan; Enter membuka hasil pertama sesuai urutan yang terlihat. Escape mengosongkan pencarian dan tombol / memfokuskan kolom yang terlihat. Halaman aktif memakai aria-current dan tombol menu tetap memiliki fokus keyboard.

Pengujian mencocokkan seluruh objek menu Owner/Admin Pusat sebelum dan sesudah pengelompokan, jumlah dan keunikan href, tidak ada rute aktif yang tertinggal dalam fallback, tidak ada pemetaan rangkap, hasil pencarian dan fallback menu baru. Tidak mengubah database, alur POS, data transaksi, atau menu peran lainnya. Pemeriksaan visual pada perangkat fisik belum dilakukan.
