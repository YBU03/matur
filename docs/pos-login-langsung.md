# POS langsung — 26 Oktober 2026

Atas instruksi pemilik, pengunci operasional POS dilepas. Alur aktif adalah **login username/password outlet → langsung kasir lengkap** untuk seluruh outlet. Tidak ada syarat jadwal/jam shift, Clock In/Out, PIN/PIC, modal awal, perangkat tunggal, pindah perangkat, kunci otomatis, atau batas presentasi. Tautan testing/simulasi lama mengarah ke POS biasa. Menu pengaturan shift, testing, pengecualian dan kontrol pindah perangkat tidak ditampilkan lagi; arsip tetap tersimpan.

Login outlet dan batas kewenangan data tetap berlaku. Akun/perangkat harus sesuai outlet, kredensial masih aktif, dan pengguna harus aktif. Tidak membuka database atau POS kepada pengunjung tanpa login. Validasi nilai transaksi, menu/harga server, stok, pembayaran, diskon dan audit tetap memakai mesin transaksi yang ada. Offline tetap khusus tunai, agar pembayaran elektronik tidak dianggap berhasil tanpa konfirmasi.

`status_pos_tim` kini merupakan RPC kompatibel untuk menyiapkan pencatatan kas dan identitas transaksi, bukan gerbang shift. Kas terbuka yang sama digunakan seluruh perangkat outlet. Jika belum ada kas terbuka, dibuat otomatis dengan modal 0; modal dapat dicatat melalui menu Kas tanpa menjadi syarat masuk. Kas yang sudah ditutup tidak diubah/dihapus: masuk berikutnya membuat pencatatan kas baru, termasuk pada tanggal yang sama. Tidak ada modal yang otomatis dijumlahkan ulang ke kas lama.

Lease/identitas perangkat masih menjadi metadata internal untuk menjaga ID transaksi dan antrean offline, tanpa batas jam shift atau afinitas satu perangkat. Checkout memeriksa akun, rahasia perangkat, outlet, kas, token dan ID transaksi. Pengiriman ulang bersifat idempoten. Katalog harga izin lama tidak ditimpa ketika harga baru diterbitkan, agar antrean offline tetap merujuk snapshotnya. Histori penutupan, pembayaran, setoran, stok dan transaksi sebelumnya dipertahankan. Metadata pembuka transaksi dicatat sebagai akun POS outlet, tanpa mengatasnamakan pegawai yang tidak dipilih.

Mesin lama dipindahkan ke fungsi privat untuk kompatibilitas antrean personal lama. Jalur aplikasi aktif tidak lagi memanggil gerbang lama. Pengaturan testing/presentasi/lanjut kas lama dinonaktifkan. Ini perubahan alur utama, bukan flag pengecualian sementara. Skema shift baru hanya dibuat setelah diskusi/persetujuan berikutnya.

## Verifikasi

- Uji mesin POS penuh tanpa absensi/jadwal terbit: 12 perangkat berhasil login; dua perangkat berbagi kas yang sama, mencatat draft dan transaksi tanpa PIC; retry tidak menggandakan transaksi.
- Modal opsional tercatat, tutup kas dari perangkat kedua berhasil, dan kas baru langsung tersedia pada tanggal sama. Antrean tunai perangkat pertama tetap dapat menyinkron ke kas lama dan rekap diperbarui.
- Tidak membuat absensi palsu. Akun personal/anonim, token perangkat lain dan akses lintas outlet ditolak. Snapshot harga lama tetap sama setelah harga baru berubah.
- `supabase/tests/pos_login_langsung.sql` lulus menggunakan role authenticated dan fixture outlet terisolasi, kemudian ROLLBACK. Tidak mengubah data outlet asli untuk pengujian.
- Tidak ada temuan security advisor baru. Cache shell PWA diperbarui ke v7; antrean IndexedDB tidak dihapus.

Migrasi: `20261026042921_pos_login_langsung.sql`, `20261026043618_pos_katalog_izin_tetap.sql`, `20261026044320_pos_antrean_login_baru.sql`, `20261026044502_pos_antrean_lintas_kas.sql`. Pembaruan UI mencakup pintu masuk, layout kasir, runtime, halaman pengaturan POS dan pencatatan modal/tutup kas.

Jika perangkat lain sudah menutup kas ketika sebuah perangkat offline, penjualan bertanggal sebelum penutupan tetap masuk kas lama; penjualan sesudah penutupan masuk kas terbuka berikutnya dengan audit pemetaan. Pengiriman ulang tetap memakai hash payload asli agar tidak menggandakan penjualan.
