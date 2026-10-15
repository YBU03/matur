# Operasional karyawan dan POS tim

Karyawan masuk dengan email/password ke Matoer, memilih outlet bertugas, lalu membuka Dashboard & Absen. Akun baru menunggu persetujuan HRD/Admin Gudang/Owner. Identitas absensi dan penggajian tetap per orang.

## Persiapan admin

1. Buka **POS Tim, PIN & Tablet**. Tetapkan kode staf dan PIN tersendiri. Tombol mata hanya tersedia untuk Owner, HRD, dan Admin Gudang; setiap pembukaan PIN tercatat, dan tampilan disembunyikan setelah 20 detik.
2. Akun lama beralamat `@pin.matur.id` perlu dihubungkan ke email pribadi melalui panel yang sama. UID dan riwayat tetap sama. PIN lama yang hanya tersimpan sebagai hash perlu ditetapkan ulang sebelum bisa ditampilkan.
3. Periksa outlet dan akses kasir staf, terbitkan jadwal, lalu atur koordinat/radius absensi. Tanpa koordinat outlet, GPS tetap wajib tetapi dashboard menandai jarak belum diverifikasi.
4. Di tablet fisik outlet, masuk dengan akun karyawan, pilih Buka POS, dan ajukan tablet. Admin mencocokkan nama/ID permintaan dengan perangkat fisik sebelum menyetujui. Pendaftaran melekat pada cookie browser; menghapus data browser menghilangkan identitas perangkat dan antrean lokal.
5. Sesi kas skema lama yang masih terbuka harus diperiksa dan ditutup oleh SPV/Owner melalui panel. Riwayat tidak dihapus otomatis.

## Setiap shift

- Setiap anggota Clock In dari HP sendiri, mengambil foto kamera, lokasi GPS, dan catatan opsional. Waktu serta menit keterlambatan dihitung server. Clock Out juga memerlukan foto dan GPS baru.
- Di tablet, petugas berakses kasir memasukkan kode/PIN, modal fisik awal, dan mengonfirmasi anggota yang sudah hadir pada jadwal yang sama. Satu outlet hanya memiliki satu sesi tim terbuka.
- Anggota dapat bergantian memakai layar yang sama. Transaksi menjadi tanggung jawab tim; sistem tidak mengklaim mengetahui orang yang menekan tombol. Anggota terlambat dapat bergabung melalui dashboard setelah absen.
- Pembuka yang Clock Out lebih awal tidak menutup kas selama ada anggota tim bertugas. Membuka ulang layar yang terkunci memerlukan PIN anggota yang masih hadir dan berakses kasir. Semua anggota pulang atau jam berakhir menghentikan penjualan baru. SPV/Owner dapat mencatat perpanjangan dengan alasan.
- Penerimaan gudang, setoran, izin, jadwal, dan slip gaji dibuka dari akun pribadi. Setoran mencatat penyerah, pengambil/PIC, waktu, rincian tanggal omzet, serta foto pengambil/bukti transfer.
- Setoran dari laci tim langsung mengurangi uang fisik laci meskipun bukti menunggu/ditolak Akunting. Perbaikan bukti memakai referensi penyerahan sebelumnya dan nominal yang sama; tidak memotong laci dua kali.
- Tutup kas di tablet dengan kode/PIN anggota/SPV, hitung **seluruh uang fisik tersisa termasuk modal**, dan beri alasan jika selisih/antrean belum kosong. Setoran dan hitung kas adalah dua catatan berbeda. Selisih tidak otomatis menjadi potongan gaji.

## Offline dan pemulihan

Offline tersedia setelah pembukaan sesi online pada tablet yang disetujui. Izin default 30 menit, dapat diatur 1–120 menit, tetap dibatasi akhir shift. Hanya tunai tanpa split, draft, atau persetujuan diskon khusus. Absensi dan penutupan kas membutuhkan internet.

Transaksi tunai biasa disimpan ke IndexedDB sebelum dikirim; struk offline hanya muncul setelah penyimpanan selesai. Antrean mengirim otomatis saat online dan menggunakan ID tetap agar stok/omzet tidak ganda. Jangan keluar akun atau menghapus data browser saat antrean masih ada. Salinan JSON antrean bisa diunduh untuk pemeriksaan admin.

Antrean mempertahankan waktu kejadian dan harga yang disahkan saat izin diterbitkan. Perubahan resep/HPP, pencabutan perangkat/akses, atau keterlambatan sinkronisasi lebih dari 24 jam memerlukan pemeriksaan SPV; data lokal tetap disimpan dan pesan kesalahan ditampilkan. Tidak ada penggantian harga/HPP atau penghapusan antrean secara diam-diam. Penutupan dengan antrean terdaftar menghasilkan rekap sementara, lalu diperbarui setelah semuanya diterima.

Perubahan keadaan server ketika tablet benar-benar offline baru diketahui saat terhubung kembali; batas izin membatasi jendela ini. Jam/perangkat browser tidak setara perangkat keras tepercaya. Admin perlu menyetujui dan menjaga tablet fisik serta memeriksa setiap transaksi yang gagal sinkron.

## Validasi perubahan

Jalankan `npx vitest run --maxWorkers=1`, `npm run lint`, dan `npm run build`. Pengujian SQL memakai PostgreSQL/PGlite dengan schema produksi tanpa data pengguna; kriptografi/Vault diuji terpisah pada Supabase dengan transaksi rollback. Uji alur kamera, GPS, izin browser, printer, dan putus-sambung internet pada HP/tablet fisik sebelum operasional penuh.

Pemeriksaan Supabase pada perubahan ini memastikan RPC baru tidak dapat dijalankan anonim, tabel bukti/izin/PIN berada di schema privat dengan akses ditolak, dan indeks relasi baru tersedia. Advisor masih mencatat temuan warisan di luar alur baru, termasuk search_path dua fungsi lama, ekstensi pg_net di public, dan izin eksekusi anonim beberapa RPC lama. Ini memerlukan audit terpisah sebelum menyebut seluruh aplikasi bebas temuan keamanan: [panduan advisor RPC](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). Tabel privat baru memang memakai RLS tanpa policy agar tidak memiliki akses baris langsung; hanya fungsi terotorisasi yang membacanya.

## Tablet outlet di `/pos` (kode staf + PIN, akun tablet tersembunyi)

- Satu alamat untuk semua cabang: buka `/pos` di tablet dan masuk dengan **kode staf + PIN POS** (tanpa email/password, tanpa admin). Outlet mengikuti penugasan staf (bila lebih dari satu, staf memilih). RPC `masuk_pos_tablet` (boleh dipanggil anon) memeriksa PIN dengan batas 5 kali salah/15 menit per staf dan 50 kali salah/15 menit untuk kode tak dikenal, lalu membuat atau memakai ulang akun `tablet` (peran `tablet`, `pengguna.akun_tablet = true`) untuk perangkat itu. Password akun tablet acak dan diganti setiap kali masuk; tidak disimpan di mana pun. Maksimal 10 tablet aktif per outlet.
- Bila shift tim di tablet itu masih berjalan, login yang sama langsung membuka kunci. Bila belum ada shift, anggota berakses kasir membuka shift (modal laci + centang anggota yang sudah Clock In).
- Akun tablet memenuhi `peran_di_outlet` untuk kasir/barista di outletnya saja (bukan SPV), tidak muncul di daftar pengguna, dan ikut nonaktif saat tablet dicabut di **POS Tim, PIN & Tablet**.
- Layar terkunci otomatis setelah 5 menit tanpa sentuhan. Anggota tim mana pun yang masih bertugas (termasuk barista) bisa membuka kunci dengan PIN; ia menjadi **operator** yang tercatat di `transaksi.operator_id/operator_nama`, struk, dan riwayat.
- Operator tanpa akses kasir hanya bisa menyimpan draft dan mengelola antrean; pembayaran ditolak server (`buat_transaksi`) dan tombol Bayar disembunyikan.
- Beranda tablet: Kasir · Antrean · Draft · Riwayat & Void · Kas & Pengeluaran · Produk Endorse · Stok · Printer · Kunci layar · Tutup Shift.
