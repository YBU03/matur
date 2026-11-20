# Promo & Diskon POS — 18 November 2026

Pengaturan tersedia di `/promo`, menu **Promo & Diskon**. Owner, Admin Pusat, Admin Gudang dan HRD mengelola promo. SPV hanya mengelola promo untuk satu outlet penugasannya; tidak dapat mengubah promo global atau lintas outlet. Finance melihat pemakaian promo melalui menu **Pemakaian Promo**. Kasir hanya memakai promo aktif.

## Pengaturan

- Nama, aktif/nonaktif, tanggal kalender WIB dan rentang jam dalam hari yang sama.
- Pilih satu/beberapa outlet, atau semua outlet (otomatis mencakup outlet baru). Tidak ada promo/outlet yang diaktifkan otomatis saat pemasangan fitur.
- Satu aturan per menu/kemasan: diskon persen, potongan rupiah per item, atau harga akhir per item **termasuk tambahan varian**. Varian opsional yang dipilih menjadi syarat wajib; kosong berarti semua varian menu tersebut.
- Satu promo per transaksi. Pengelola dapat mengizinkan tambahan diskon manual; persetujuan SPV untuk diskon manual tetap berlaku terhadap nilai setelah potongan promo.
- Kuota opsional per hari operasional (berganti pukul 03.00 WIB), gabungan semua menu atau terpisah per menu; dihitung per outlet atau bersama lintas outlet. Kuota menghitung jumlah item yang benar-benar mendapat potongan.
- Perubahan memakai versi agar edit pengguna lain tidak tertimpa dan tercatat dalam Log Aktivitas. Reservasi yang sudah terbit tetap dihormati sampai batas waktunya, termasuk setelah promo dinonaktifkan/diedit.

## Kasir dan pembayaran

1. Isi keranjang, lalu **Muat / segarkan promo** di panel keranjang.
2. Pilih promo dan **Terapkan promo**. Server memeriksa akun/perangkat, outlet, sesi, katalog, varian, waktu, harga dan kuota. Jika katalog layar berbeda dengan harga server, kasir diminta memuat ulang.
3. Server menahan kuota maksimal 15 menit, dibatasi jam akhir promo dan pergantian hari operasional. Panel menampilkan nama, potongan, sisa kuota saat reservasi, serta waktu berakhir. Kuota diamankan sebelum QR pembayaran ditampilkan.
4. Bayar menggunakan total setelah promo. Promo yang sudah disetujui pengelola tidak meminta PIN diskon besar lagi. Transaksi manual besar tetap mengikuti izin SPV.
5. Mengubah keranjang/kanal/diskon/sesi melepas reservasi dan memerlukan penerapan ulang. Draft tidak menyimpan reservasi; terapkan lagi saat membayar draft.

Promo memerlukan internet dan tidak masuk antrean tunai offline. Tunai biasa tanpa promo tetap memakai antrean offline yang sudah ada. Setelah respons jaringan hilang, pengiriman ulang menggunakan ID transaksi/reservasi yang sama. Jika pembayaran sudah dilakukan, periksa riwayat sebelum membuat transaksi baru. Saat reservasi berakhir, QR ditutup dan kasir diminta memeriksa pembayaran/riwayat sebelum melanjutkan.

## Pencatatan

Harga katalog dan aturan/nama promo disalin ke reservasi dan transaksi sehingga perubahan berikutnya tidak mengubah riwayat. `transaksi.diskon` berisi **diskon promo + manual**, sehingga laporan Accounting yang sudah ada tetap menghitungnya sekali. Nama promo tampil pada struk pertama, unduhan, berbagi teks dan cetak ulang dari riwayat.

Laporan pemakaian `/promo` memiliki filter outlet dan rentang tanggal maksimal 366 hari. Menampilkan transaksi, promo, jumlah item, potongan, total bayar dan status. Ringkasan hanya memasukkan transaksi lunas. Void/hapus mengembalikan kuota satu kali. Pemulihan transaksi memeriksa ulang kuota pada hari operasional asal; jika sudah penuh, pemulihan ditolak sampai kuota tersedia/disesuaikan pengelola.

## Implementasi dan verifikasi

Tabel privat `promo_internal.promo` dan `promo_internal.pesanan`, RLS tanpa izin akses tabel langsung. RPC publik invoker memanggil fungsi privat dengan pemeriksaan akun aktif/peran/outlet. Pengambilan kuota dikunci pada baris promo dan pencatatan pembayaran/kuota terjadi dalam transaksi database yang sama. Kegagalan pembayaran membatalkan pemakaian kuota; reservasi tetap bisa dicoba ulang hingga berakhir.

Migrasi menambahkan `transaksi.promo_snapshot` dan menyisipkan validasi promo pada mesin harga yang sudah ada dengan pemeriksaan pola fungsi. Tidak mengganti mesin stok atau mengaktifkan pengunci login/shift lama. Tidak menambah polling jaringan POS.

Pengujian khusus `promo-sql.test.ts`: hak akses/anonim, versi edit, tiga jenis harga, syarat varian, kuota gabungan/per menu/per outlet/lintas outlet, retry, katalog beku, pembayaran gagal, diskon manual/SPV, offline, kedaluwarsa, void/pemulihan, laporan Finance dan transaksi biasa. `supabase/tests/promo_diskon_pos.sql` menguji jalur tablet authenticated pada database sebenarnya dan selalu ROLLBACK.

Uji browser visual belum dijalankan karena akses browser pada sesi ini dibatasi kebijakan browser. Bukti verifikasi tersedia dari tes otomatis, build aplikasi, uji database terisolasi dan status deployment GitHub/Vercel.

Hasil verifikasi: 94 berkas tes / 540 tes lulus; TypeScript dan ESLint bersih. Uji database tablet authenticated lulus dan ROLLBACK. Security advisor tidak menambah WARN/ERROR; dua INFO RLS tanpa policy adalah tabel privat yang sengaja tidak dibuka untuk akses langsung. Migrasi tersimpan sebagai `20261118033002_promo_diskon_pos.sql`, sesuai versi riwayat database.

## Tampilan baru halaman /promo (18 November 2026)

Hanya tampilan; RPC `simpan_promo`/`daftar_promo`/`laporan_promo`, aturan, kuota dan kasir tidak berubah.
- Header berwarna + 4 kartu angka (promo berjalan, terjadwal, transaksi promo lunas, total potongan/subsidi periode).
- Tab Semua/Berjalan/Terjadwal/Nonaktif/Selesai + cari nama. Status dihitung di `src/lib/promo-tampilan.ts` (tanggal/jam WIB, lencana "Di luar jam" bila berjalan tapi di luar rentang jam).
- Kartu promo: label nilai besar (Diskon %, Potong Rp, Harga Rp, Voucher, Gratis), periode mudah dibaca, label outlet/menu, kuota, garis warna status.
- Tombol cepat Aktifkan/Nonaktifkan (konfirmasi `tanya`, memakai `simpanPromo` dengan versi yang sama → tercatat di Log Aktivitas) dan Duplikat (membuka form promo baru nonaktif berisi salinan).
- Form dibagi 5 bagian bernomor + pratinjau ringkas; isian sama seperti sebelumnya.
- Laporan pemakaian: ringkasan + tabel seragam (`ui-halaman`), kartu per transaksi di HP; total bayar Rp0 tampil "Rp0".

## Hari, slot jam fleksibel, kotak promo kasir & laporan kuota (18 November 2026, malam)

Migrasi `20261118142331_promo_slot_hari_kuota.sql` (hanya menambah):
- Kolom `promo_internal.promo.slot` (jsonb, maks 6 slot `{mulai, selesai}` HH:MM:SS) dan `hari` (smallint[] ISO 1=Senin…7=Minggu). Promo lama di-backfill 1 slot = jam lama, setiap hari; Sambas & Grand Opening diverifikasi tidak berubah.
- `promo_internal.akhir_slot(promo, t)` = akhir slot yang berlaku atau null. Slot dengan jam selesai ≤ jam mulai = lewat tengah malam, milik tanggal/hari saat dimulai. Dipakai `daftar` (kasir) dan `pesan` (validasi + batas reservasi). `simpan` memvalidasi & menyimpan slot/hari; klien lama tanpa slot tetap memakai jam_mulai/jam_selesai. Kolom jam lama hanya kompatibilitas (dikirim dari `jamLegacy`).
- Daftar kasir menambah `berakhir_at` dan `sisa_kuota` (`promo_internal.sisa_kuota`, termasuk reservasi aktif).
- `laporan_kuota_promo(o,d,s)`: per hari/promo/outlet(/menu): kuota, terpakai, `habis_at` = jam transaksi yang memakai kuota terakhir (hanya pesanan `pakai`; void/hapus tidak dihitung).

Tampilan:
- Kasir: `src/components/kotak-promo-kasir.tsx` di bawah bar operator. Hanya muncul bila promo aktif & dalam slot/hari. Timer lokal per detik, merah berdenyut 10 menit terakhir, bar kuota hijau/kuning/merah ("Kuota habis"), ketuk untuk detail di HP, "Mulai lagi pukul …" bila ada slot berikutnya hari itu. Data dimuat saat dibuka, setelah transaksi, saat kembali ke layar, tiap 3 menit (5 menit bila tidak ada promo). Daftar juga diisikan ke `PosPromo` (prop `awal`) sehingga kasir tidak perlu klik Muat dulu.
- Form /promo: kartu jenis promo (Diskon per menu / Voucher belanja), hari (Sen–Min + Setiap hari/Hari kerja/Akhir pekan), slot jam 24 jam pilihan jam:menit + tombol cepat (Sepanjang hari, Ngopi Pagi, Siang, Sore, Malam), contoh harga coret per menu dari `harga_langsung` (peringatan bila harga akhir > harga asli), tambah semua menu satu kategori, label varian "Hanya berlaku kalau pembeli memilih", kalimat kuota otomatis, konfirmasi "Simpan & aktifkan", pesan error ramah (`pesanRamah`).
- Laporan: kartu "Kuota per hari" dengan jam habis.

## Harga normal → Potongan → Harga akhir (19 November 2026)

Hanya tampilan; jenis aturan server tetap (`persen`/`potongan`/`harga_akhir`/`gratis`).
- Form /promo, tiap menu (`BarisHarga` di `panel.tsx`): Harga normal (harga langsung, tidak bisa diketik) − Potongan (ketik angka, pilih **%** / **Rp** / **Gratis**) = Harga akhir (otomatis). Harga akhir juga bisa diketik → disimpan sebagai `harga_akhir` (harga tetap per cup termasuk varian) dan potongan ditampilkan sebagai selisih. Ganti %↔Rp mengonversi nilai setara. Baris kecil harga ojol (coret → hasil), peringatan potongan melebihi harga / harga akhir lebih mahal, tombol "Samakan potongan ini ke semua menu". Halaman memuat `harga_ojol`.
- Kasir: setelah promo per menu diterapkan, baris keranjang menampilkan harga coret + harga promo + label 🏷️ promo (hitung klien dengan `hargaPromo` dari aturan promo terpilih; total resmi tetap dari server). `PosPromo` mengirim `promo_id` pada quote. Voucher per transaksi tidak memakai harga coret per baris.

## Campaign & Promo untuk Mitra (19 November 2026)

Menu Mitra **Campaign & Promo** (`/portal/promo`, hanya baca). Migrasi `20261118234109_promo_mitra.sql` hanya menambah fungsi `promo_internal.mitra(o,d,s)` + wrapper `public.promo_mitra` (periode maks 92 hari). Akses: `peran_di_outlet(o,'{mitra}')` (atau pusat); Mitra hanya melihat outlet penugasannya.
- Data: promo **aktif** yang berlaku di outlet (termasuk semua outlet), selesai ≤ 60 hari lalu; aturan diperkaya nama menu + harga langsung/ojol; `berakhir_at` & `sisa_kuota` hari ini; riwayat kuota per hari (jam habis, kuota bersama ditandai) dan pemakaian per hari/promo (transaksi lunas, item, total potongan, subsidi). Tidak memuat `diubah_oleh`, daftar outlet lain, draft nonaktif, atau data pelanggan.
- Tampilan: ringkasan (berlangsung, akan datang, transaksi & potongan hari ini), tab Berlangsung/Akan datang/Selesai, kartu berlangsung bergaya kotak kasir (timer lokal, bar kuota, "Kuota terpenuhi ✅"), detail (periode, hari & jam, kuota, ketentuan, tabel Harga normal → Potongan → Harga akhir termasuk ojol), riwayat per tanggal dengan filter. Data disegarkan tiap 3 menit.
- Notifikasi lonceng untuk Mitra belum dibuat (opsional, menunggu persetujuan).

## Satu nota banyak menu promo — promo menempel di keranjang (20 November 2026)

Temuan UHB 20 Nov (promo "Trial Opening"): 25 dari 27 transaksi promo hanya 1 item; beberapa keranjang 2–3 item dilepas lalu dipecah jadi nota terpisah; log server 5× "Reservasi promo berakhir" (08.01–08.20). Penyebab: `PosPromo` di-remount (`key={promoKey}`) setiap keranjang/kanal/diskon berubah sehingga reservasi dilepas; pembayaran memakai reservasi lepas → error, kasir memilih 1 item per nota. Aturan server sudah mengizinkan banyak item.

Perbaikan (klien saja, server/kuota tidak berubah):
- `PosPromo` tidak lagi di-remount. Promo terpilih menempel; perubahan keranjang memicu pesan ulang otomatis (debounce 450 ms, respons usang diabaikan, reservasi lama dilepas). Selama menyesuaikan, diskon lama disembunyikan dan Bayar menunggu (`onBusy`). Quote dikirim bersama kunci keranjang (`kunciPromo`, dipakai juga oleh `promoKey`) sehingga tidak terpakai untuk keranjang lain.
- Pilih otomatis bila hanya satu promo berjalan dan keranjang berisi menunya; "Lepas promo"/"Tanpa promo" menghentikan pilih otomatis sampai keranjang kosong.
- Perpanjang otomatis 20 detik sebelum reservasi 15 menit berakhir.
- Bila pembayaran tetap menolak reservasi ("Reservasi promo …"), pos-screen menaikkan `segar` → reservasi ulang → checkout otomatis sekali lagi (maks 30 detik).
- Kuota kurang: pesan jelas "Kuota promo tidak cukup (sisa N)… kurangi jumlah atau bayar tanpa promo" + tombol Coba lagi.
- Void/hapus tetap mengembalikan kuota (ditambah tes: satu nota 3 cup, void → kuota kembali 3; reservasi lama yang dilepas ditolak saat bayar).
