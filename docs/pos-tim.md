# POS outlet dan kas harian

Login utama `/pos` menggunakan username dan password **outlet**, dibuat lewat **Akses Kasir POS Outlet → Akun POS Outlet**. Akun ini terpisah dari Pengguna Matoer. Password disimpan sebagai hash; admin menggantinya, bukan membacanya. Mengganti password/mengaktifkan ulang akses mengharuskan login outlet kembali. HRD dan gudang hanya mengelola outlet dalam penugasannya; penugasan global tetap mencakup semua outlet.

Setiap browser memakai identitas Auth tablet tersembunyi tersendiri. Kredensial outlet bersama tidak menggabungkan semua perangkat menjadi satu identitas. Perangkat dicabut tetap ditolak walaupun password outlet benar.

## Alur harian

1. Staf Clock In lewat akun pribadinya; payroll/absensi tidak menggunakan akun outlet.
2. Login outlet, pilih PIC dari staf aktif dengan jadwal terbit yang sedang berlaku dan sudah Clock In/belum Clock Out.
3. Pembukaan kas pertama meminta modal fisik sekali. Semua anggota hadir pada shift PIC dicatat otomatis sebagai tim.
4. S1 → S2 → S3: menu Ganti PIC / Serah terima di beranda POS; pilih PIC penerima, isi pemeriksaan uang fisik, catatan selisih bila berbeda, konfirmasi penerimaan. Tidak ada input modal baru. Nomor sesi kas dan modal tetap; jadwal/PIC aktif berganti.
5. Pergantian PIC dalam shift yang sama tetap mencatat serah terima. Membuka kunci kembali dengan PIC sama cukup memilih nama, tanpa menghitung modal lagi.
6. Shift terakhir menutup kas harian melalui menu Kas. Kas tanggal yang sudah ditutup tidak dapat dibuka ulang secara biasa; hubungi admin jika ada pengecualian. Jangan menutup kas pada S1/S2 bila outlet masih beroperasi.

Pemilihan nama PIC adalah pernyataan melalui akun outlet bersama, **bukan autentikasi pribadi**. PIC dan anggota tim tercatat, namun sistem tidak membuktikan siapa yang menekan dropdown. Otorisasi SPV untuk diskon/void tetap terpisah. Riwayat PIC, waktu, shift, uang fisik, saldo seharusnya dan catatan dapat dilihat admin pada Riwayat Serah Terima; transaksi tetap memiliki operator dan waktu untuk penelusuran per shift.

## Perangkat dan offline

Satu perangkat menguasai sesi kas outlet. Perangkat lain tidak membuka kas kedua. Gunakan kontrol admin Pindah Perangkat atau Reset Akses, dengan aturan izin offline yang sudah berlaku. Sesi/modal/transaksi tidak dihapus. Sesi tim yang lama dapat dilanjutkan sebagai kas harian pada perangkat yang sah dengan hitungan serah terima, sedangkan sesi legacy bukan tim harus ditutup admin dahulu.

Pembukaan, ganti PIC dan serah terima harus online serta antrean tablet harus kosong. Transaksi tunai offline tetap memiliki batas izin; sinkronisasi memakai ID stabil agar tidak menggandakan stok/omzet. Rekap tetap sementara bila perangkat asal belum selesai sinkron. Admin tidak dapat memutus browser offline secara instan; izin lama dibatasi waktu.

Data uang diambil/disetor tetap dicatat sebagai pergerakan kas/setoran; pemeriksaan uang fisik serah terima tidak menambah omzet atau modal. Selisih tidak otomatis memotong gaji.

## Pengelolaan terpisah

- **Pengguna Matoer**: akun pribadi, status, peran, outlet; tersembunyi dari daftar ini adalah akun teknis tablet.
- **Akses Kasir POS Outlet**: akun outlet, perangkat, kas harian, riwayat serah terima dan aturan shift/lokasi.
- Simulasi admin `/pengaturan/pos/simulasi` menggunakan menu/harga aktual dengan keranjang lokal; tidak mengubah penjualan, stok atau kas asli.

## Verifikasi

Pengujian SQL mencakup S1/S2/S3 pada satu sesi/modal, PIC barista dapat menerima pembayaran, larangan perangkat lain, penonaktifan akses, penutupan kas, pembatasan HRD per outlet, serta regresi antrean offline/perpindahan/rekonsiliasi. PGlite menggunakan crypto double; operasi hash/Auth diverifikasi terpisah pada PostgreSQL Supabase dengan transaksi rollback.

Endpoint login outlet sengaja menerima pemanggil belum login (`anon`) dengan verifikasi bcrypt dan pembatasan percobaan. RPC admin tidak bisa dipanggil anon. Tabel rahasia di schema private sengaja memakai RLS tanpa policy dan pencabutan hak langsung; akses melalui fungsi dengan pemeriksaan kewenangan. Temuan advisor mengenai pola ini adalah batas akses yang disengaja, bukan tabel publik tanpa RLS.

## Tambah, edit dan hapus akses outlet

Tab Akun POS Outlet menampilkan kartu akses yang sudah dibuat. Gunakan **Tambah Akses POS** untuk memilih outlet yang belum memiliki akun. **Edit** mengubah username, password (kosong berarti tetap), dan status aktif. Tambah/edit menampilkan ringkasan sebelum disimpan. Satu outlet tetap satu akses.

**Hapus** meminta konfirmasi nama outlet dan username. Sistem mengarsipkan kredensial, menonaktifkannya, mengacak hash password lama, melepaskan username dan menarik izin transaksi online. Outlet, akun pribadi karyawan, perangkat, antrean historis, sesi kas, modal, transaksi, dan serah terima tidak dihapus. Izin offline tetap tunduk pada waktu pencabutan; browser offline tidak bisa menerima pencabutan secara instan.

Akses yang sudah dihapus dapat dibuat kembali melalui Tambah dengan password baru. Edit/hapus memakai versi data agar formulir lama tidak menimpa perubahan admin lain. HRD/gudang hanya dapat mengelola outlet dalam kewenangannya; tindakan dicatat di log aktivitas tanpa password/hash.
