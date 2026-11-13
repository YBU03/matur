# Profil admin, jadwal SPV, HPP akunting dan laporan akhir shift

Disetujui pemilik 13 November 2026. Produksi matoer.id; branch produksi ccr-2427af56-yvuskv.

## Pengguna Matoer

Owner/Admin Pusat membuka nama pengguna → Profil, unggah/ganti foto JPG/PNG/WebP maksimal 3 MB, alamat KTP dan domisili. Simpan memakai RPC atomik `edit_profil_admin`; nama/HP memakai pemeriksaan nilai sebelumnya. Foto baru memakai nama unik di folder pengguna pada bucket privat `profil`; tidak melakukan upsert/menimpa foto lama. Foto menggunakan URL bertanda tangan satu jam; jika tidak ada foto tetap inisial.

Helper privat `pengguna_internal` memeriksa akun aktif dan peran dari penugasan. Admin Pusat tidak boleh mengedit target Owner. Tidak memberi HRD/Admin Gudang hak edit profil melalui formulir ini. Field profil lain (TTL/kontak darurat/sharelok) tetap tersimpan. Jalur isi profil sendiri tetap tersedia. Alamat tidak dikirim ke klien pengelola akun staf HRD/Admin Gudang.

## Jadwal SPV

Akses kelola jadwal SPV ternyata sudah ada di `/jadwal`: UI, `kelola_sdm`, dan RPC editor harian. Ditambahkan kartu langsung **Kelola Jadwal Outlet** di dashboard SPV agar mudah ditemukan. Tetap hanya outlet penugasan aktifnya. Edit tanggal/orang/shift, versi usang, batas lintas outlet, dan perlindungan jadwal yang sudah memiliki absensi memakai mekanisme lama, bukan dibuka ulang. Tes positif SPV membuat/memindahkan jadwal ditambahkan.

## HPP akunting

Dashboard Finance/Akuntan memiliki kartu **Edit HPP Menu**, juga menu sidebar. Halaman `/hpp-menu` menampilkan tombol Edit HPP pada kartu setiap menu. Produk titipan memakai editor rupiah sederhana; menu racikan memakai editor resep dasar. Finance hanya mendapat RPC edit biaya/resep, bukan hak umum mengubah menu/varian/harga jual.

`edit_hpp_titipan` memeriksa nilai HPP sebelumnya, rupiah bulat 0–100 juta, role aktif, mode asli, dan produk belum dihapus. Untuk menu dengan satu barang khusus qty=1, harga barang titipan disinkronkan agar sumber biaya tetap sama. Menu gabungan atau barang yang dipakai beberapa menu diarahkan ke Titipan Produk untuk mengubah harga komponennya secara eksplisit; tidak mengubah semua menu secara tersembunyi. Setiap edit tercatat dalam log.

Data produksi diperbarui melalui RPC dengan akun teknis pencatat sesuai instruksi pemilik: Burnt, Strawberry Crumble, Blueberry Crumble Cheesecake, Matcha, New York, Ubi Ungu masing-masing Rp14.000; Ice Berg Rp17.000. Harga jual tidak berubah; snapshot HPP transaksi lama tidak ditulis ulang. Rekap/tagihan titipan yang memang memakai harga master saat ini tetap mengikuti mekanisme yang sudah ada.

## Laporan akhir kas/shift

Setelah penutupan kas biasa atau tutup operasional Alur Shift berhasil, laporan dimuat terpisah. Unduh PDF thermal dan cetak otomatis dicoba satu kali per sesi/per browser session. Di Android memakai printer tersimpan; browser membuka dialog cetak dokumen khusus. Cetak/unduh gagal tidak mengulang penutupan dan tidak membatalkan kas tersimpan. Tombol manual **Cetak manual / ulang**, **Unduh PDF**, **Muat ulang laporan** selalu tersedia. Riwayat kini mencakup kas biasa juga, agar tetap bisa dicetak setelah kas berikutnya dimulai.

Isi: outlet/petugas, waktu mulai-akhir WIB, modal, pembayaran tunai, pengeluaran laci, uang diserahkan, tunai seharusnya, fisik, selisih, detail non tunai, catatan, pengeluaran per item. Pembayaran lain menggunakan tabel pembayaran (metode untuk kanal langsung/tumbler, kanal untuk marketplace) sehingga tidak menjumlah ulang omzet kanal di atas non tunai. Kas yang masih menunggu sinkronisasi ditandai sementara. Angka yang belum dihitung tidak dianggap nol.

Laporan ini rekap sesi kas/operasional. Serah terima antarpetugas yang masih memakai sesi kas yang sama tetap mengikuti alur serah terima yang ada; fitur ini otomatis pada penutupan kas/tutup operasional.

## Verifikasi

- Suite lengkap: 85 file, 501 tes lolos; kemudian tambahan tes positif SPV dan perbaikan format nol diuji terarah (11 tes lolos).
- PGlite: edit profil mempertahankan field pribadi lain; stale edit, target Owner, role ditolak, foto lintas pengguna/tidak ada; Finance HPP + sumber barang tersinkron; angka negatif; akun nonaktif; anon ditolak.
- Database nyata: migrasi dikompilasi dalam transaksi rollback; RPC Finance berhasil mengubah biaya menu dan barang bersama; laporan mengembalikan rincian pembayaran. Data uji rollback.
- Ketujuh HPP produksi sudah diverifikasi sama antara menu dan barang.
- Browser data uji: editor profil terbuka dan alamat dapat diketik; Edit HPP langsung membuka editor; laporan tampil, PDF benar-benar diunduh (1 halaman thermal 58 mm). Tidak mengklaim kertas printer fisik teruji.
- Fixture `/zz` dan pengecualian middleware dihapus sebelum build.
- Advisor: tidak ada temuan yang menyebut fungsi/schema baru; temuan lama di luar scope tetap tidak diubah.
