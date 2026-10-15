# Panduan Pemantauan Pembangunan Outlet

Alamat aplikasi: https://matur-ybu.vercel.app

## 1. Admin Pusat / Owner — menyiapkan proyek
1. Login → pilih peran **Admin Pusat**.
2. **Pengguna & Akses** (peran Owner): buat akun **Mitra** (email) dan **PIC / Kontraktor** (email), pilih outlet yang sesuai.
3. **Outlet**: pastikan outlet baru sudah ada (status *pembangunan*).
4. **Proyek Pembangunan → + Kelola Proyek → + Tambah**: isi nama, outlet, estimasi budget, tanggal mulai, target buka.
5. Buka proyek → **Kelola Pekerjaan & PIC**: tambah pekerjaan (mis. Renovasi, Instalasi listrik, Branding), pilih PIC, isi **bobot** (pekerjaan besar diberi bobot lebih besar).
6. **Kelola RAB**: isi kebutuhan (mesin espresso, grinder, furnitur, …) dengan total estimasi; isi realisasi dan ubah status *rencana → dibeli → terpasang* saat berjalan.

## 2. PIC / Kontraktor — melapor progres
1. Login dengan email → menu **Progres Pekerjaan** → buka proyek.
2. Pada pekerjaan miliknya tekan **Lapor progres**: geser persentase, ambil foto, tulis keterangan → **Kirim**.
3. Laporan menunggu persetujuan Admin Pusat.

## 3. Admin Pusat — menyetujui
Di halaman proyek muncul kotak **Menunggu persetujuan**. **Setujui** → progres pekerjaan diperbarui dan foto tampil ke mitra. **Tolak** → tidak tampil.
Foto yang diunggah Admin Pusat langsung disetujui.

## 4. Mitra — memantau
Login → **Progres Pembangunan** (juga tampil di Dashboard): progres total, budget vs realisasi, sisa budget, hitung mundur grand opening, daftar pekerjaan + PIC, galeri foto, RAB, dan timeline.
Menu lain (Laporan Bulanan, Progres BEP) masih terkunci 🔒 dan dibuka bertahap.

## Rumus
- Progres total = Σ(bobot × progres) ÷ Σ bobot.
- Realisasi = jumlah kolom *Total Realisasi* RAB. Sisa budget = estimasi budget − realisasi.

## 5. Rincian Keperluan (import/export)
Buka proyek → **Lihat rincian →** (atau tombol *Rincian Keperluan* untuk admin).
- **Import Excel**: pilih file `.xlsx`. Bisa langsung memakai format *Daftar Material dan Harga* (sheet material per bagian, interior, tukang) maupun file hasil Export Matoer. Muncul pratinjau total per kelompok + peringatan bila total tertulis di file berbeda dengan penjumlahan item. Pilih *tambahkan* atau *ganti semua* (data lama masuk tempat sampah).
- **Export Excel / PDF**: unduh rincian lengkap dengan subtotal per kelompok dan grand total. File Excel hasil export bisa diedit lalu di-import kembali.
- **+ Tambah / Ubah Item**: isi kelompok, bagian, nama barang, spesifikasi, jumlah, satuan, harga satuan (total dihitung otomatis bila dikosongkan), realisasi, status.

## 6. Daftar akun & persetujuan
- **Pendaftar pertama** (saat belum ada Owner aktif) otomatis menjadi **Owner / Super Admin** dan langsung masuk ke dashboard.
- Pendaftar berikutnya membuka **https://matoer.vercel.app/daftar** (nama, email, HP, password, keterangan opsional) — tanpa memilih peran. Akun berstatus *menunggu* dan belum bisa melihat data apa pun.
- Owner / Admin Pusat membuka **Pengguna & Akses** → kotak *Pendaftar menunggu persetujuan* → tentukan **peran** dan **outlet** → **Setujui** (atau **Tolak**). Untuk mitra, outlet yang dipilih adalah outlet yang boleh ia lihat; outlet tambahan lewat **+ peran**.
- Setelah login, setiap orang langsung masuk ke dashboard sesuai perannya. Akun bisa **dinonaktifkan** kapan saja (akses langsung terkunci). Hanya Owner yang bisa memberi peran Owner.

## 7. Aplikasi POS kasir & barista (terpisah)
- Alamat khusus: **https://matoer.vercel.app/pos** — dipakai di tablet kasir outlet dengan akun kasir. Bisa dipasang sebagai aplikasi (*Add to Home Screen*) dan langsung terbuka ke POS. Alamat lama /kasir otomatis diarahkan ke /pos.
- Login dengan **kode staf + PIN** (akun dibuat Owner di *Pengguna & Akses*), atau email untuk kasir yang mendaftar sendiri.
- POS: layar **Kasir**, **Antrean**, **Kas & Pengeluaran**, dan **Absen** (rekan yang absen di tablet memakai kode staf + PIN).
- **Aplikasi Staf** pribadi di **https://matoer.vercel.app/staf** (HP masing-masing kasir & barista, bisa dipasang): Beranda, Jadwal, Absen, Pengajuan, Profil — lihat bagian SDM outlet.
- Halaman login utama (**/login**) hanya untuk email: owner, admin, pusat, gudang, mitra. Kasir/barista yang login di sana otomatis diarahkan ke /kasir. SPV membuka POS lewat menu **Buka Aplikasi POS**.

## 8. Menu POS, tombol Pasang Aplikasi, menu ☰
- 24 menu Ruma Kopi (Coffee, Non Coffee, Cheesecake) sudah masuk lengkap dengan foto dan harga. Harga ojol sementara disamakan dengan harga dine-in — ubah di **Data Master → Menu** bila harga ojol berbeda.
- Menu baru: **Data Master → Menu → + Tambah**, isi foto (tombol *Pilih foto*, otomatis dikecilkan), nama, kategori, harga, dan *Urutan di POS*.
- **📲 Pasang Aplikasi**: tombol di halaman login, menu samping, dan aplikasi POS. Android/Chrome langsung memasang; iPhone diberi petunjuk *Bagikan → Tambahkan ke Layar Utama*.
- Di HP, menu samping dibuka lewat tombol **☰** di kiri atas.

## 9. Bahan baku & stok gudang
- Menu **Stok Gudang** (Owner, Admin Pusat, Admin Gudang): 32 bahan dari *List Bahan Baku Ruma* per kategori (Kopi & Susu, Sirup & Saus, Bubuk, Buah & Jus, Kemasan & Cup, Lainnya) dengan stok awal, harga beli per kemasan, HPP per gram/ml/pcs, dan nilai persediaan (total Rp19.991.568 = Grand Total daftar).
- Kartu ringkasan bisa diketuk untuk menyaring **stok menipis/habis** dan **perlu dicek**. Ada pencarian, filter kategori, dan **Export Excel**.
- **Koreksi stok**: isi stok fisik dalam satuan beli → konfirmasi sebelum → sesudah → tercatat di log.
- **+ Tambah / Ubah Bahan** membuka Data Master Bahan; HPP per satuan pakai dihitung otomatis dari harga beli ÷ isi kemasan bila dikosongkan. HPP ini dipakai resep untuk menghitung HPP teoritis tiap transaksi.

## 10. Proyek "Pembangunan Ruma Kopi UHB" (siap dibagikan ke mitra)
- Estimasi biaya **Rp35.259.000** (50 item dari *Daftar Material dan Harga*: Material Rp17.999.000, Keperluan Interior Rp11.100.000, Pertukangan Rp6.160.000).
- 8 tahapan mulai 0%: Perencanaan & Desain → RAB & Pengadaan → Sipil & Renovasi → Kusen/Plafon/Listrik-Air → Interior & Furnitur → Peralatan & AC → Branding & Finishing → Persiapan Grand Opening. Bobot bisa diubah di *Kelola Tahapan & PIC*.
- Halaman proyek: tahap saat ini, estimasi biaya, ringkasan per kelompok + **Lihat detail** + **⬇ Excel / ⬇ PDF**, galeri **Desain Cafe** (admin: *+ Unggah desain*, bisa beberapa gambar sekaligus), tahapan & progres, galeri progres, timeline.
- Agar mitra bisa melihat: setujui akun mitra dengan peran **Mitra** dan outlet **Ruma Kopi UHB** (atau tambahkan lewat **+ peran**).

## 11. Halaman proyek bertab
Halaman proyek dibagi menjadi tab agar mudah dibaca di HP:
- **Catatan Tambahan** (tab Ringkasan): admin mencatat info atau permintaan mitra dari chat, misalnya kode warna cat. Kode warna berformat #RRGGBB otomatis tampil sebagai contoh warna.
- **Ringkasan**: tanggal Soft Opening & Grand Opening. Admin dan mitra bisa **+ Usulkan tanggal**; admin menekan **Pakai tanggal ini** untuk menetapkan tanggal resmi yang disepakati bersama. Tab ini juga berisi tahapan & progres, checklist persiapan buka (admin cukup mencentang), dan info lokasi (alamat, luas, sewa, kontak, link Google Maps).
- **Jadwal**: timeline kegiatan yang bisa diubah (✏️), ditambah (+ Kegiatan), atau dihapus (🗑). Kegiatan boleh belum bertanggal. Status *mundur* dicoret lalu diberi tanggal baru di kolom Tanggal Realisasi.
- **Biaya & Dana**: estimasi, realisasi, dana masuk dari mitra, sisa dana, rincian per kelompok (unduh Excel/PDF), dan catatan setoran dana mitra.
- **Desain & Foto**: rencana desain cafe, persetujuan laporan progres, dan galeri progres.
- **Dokumen**: unggah PDF atau gambar (MoU, RAB, izin, kuitansi), maksimal 10 MB per file.
- **Diskusi**: obrolan admin ↔ mitra per proyek.
- Tombol **⬇ Laporan PDF** di bagian atas membuat laporan ringkas untuk dikirim ke mitra.

## 12. Alur akunting terintegrasi (kasir → gudang → laporan)
Mengikuti Excel Ruma (sheet *Transaksi* → *Laporan Keuangan*):
1. **Kasir/barista (aplikasi POS → Kas & Pengeluaran):** catat pengeluaran harian (es kristal, galon, bahan baku/dessert, perlengkapan, parkir, listrik, marketing, dll.), pilih *uang laci* atau *dibayar pusat*. Bisa diubah/dihapus sendiri dalam 2 hari. **Tutup shift:** isi uang tunai aktual → sistem menghitung *penjualan tunai − pengeluaran laci* dan selisihnya.
2. **Gudang:** kiriman bahan yang diterima outlet otomatis masuk *Pembelian bahan baku*. Setiap penjualan kasir **memotong stok bahan outlet** sesuai resep (dibentuk dari file HPP, seri Ice) dan mengisi HPP transaksi; halaman *Kiriman ke Outlet* menampilkan **stok outlet yang menipis** sebagai dasar kiriman berikutnya.
3. **Catatan Harian (Owner/Admin/Finance/SPV):** tampilan per hari seperti sheet Transaksi; tambah/ubah/hapus pengeluaran; ekspor **Excel format Ruma**.
4. **Stok & Opname (SPV/Gudang):** pilih *Stok awal* (pertama kali) atau *Opname rutin* (akhir bulan). Isi per bahan: kemasan utuh + sisa terbuka (gram/ml), atau unduh template Excel, isi di outlet, lalu unggah. Nilainya jadi *Persediaan akhir*.
5. **Proyeksi laporan (Finance):** penjualan per kanal, diskon, pembelian (kiriman + es kristal + bahan baku + galon), beban, sewa (dari perjanjian, rata per bulan), sedekah 2,5% laba kotor, bagi hasil dari skema. Isi angka **aplikasi GoFood/Grab/Shopee** → selisihnya + pengembalian discount menjadi *Pendapatan Lain-lain*. Simpan draft, lalu **Terbitkan**.
6. **Laporan terbit:** ringkasan visual (KPI vs bulan lalu, struktur penjualan, tren, komposisi, beban, bagi hasil) di web dan PDF (halaman 1 grafik, halaman berikutnya format resmi).

## SDM outlet: shift, jadwal, absensi, izin (konsep Makaryo)
- **HRD** (semua outlet) dan **Owner** mengelola lewat menu **Jadwal Shift**, **Rekap Absensi**, **Persetujuan Izin & Tukar**. **SPV** mendapat menu yang sama untuk outletnya sendiri.
- **Jadwal Shift → tab Shift**: atur shift per outlet (nama, jam, minimal orang). Tombol *Isi 3 shift standar* membagi jam operasional outlet. Shift dinonaktifkan, tidak dihapus.
- **Tab Kalender**: pilih cakupan → **Susun draft otomatis** (jatah libur mingguan, izin yang disetujui, minimal orang, beban merata, anti-bentrok, rotasi shift) → periksa/ubah (ketuk nama untuk hapus, + untuk tambah) → **Terbitkan**. Hanya jadwal terbit yang terlihat staf. Slot kurang orang ditandai merah.
- **Tab Staf**: jatah libur per minggu per orang (bawaan 1). **Tab Aturan** (HRD/Owner): toleransi telat (**5 menit**), izin minimal H-3, buka/tutup pengajuan libur mingguan.
- **Aplikasi Staf (/staf)** — tampilan mengikuti aplikasi host Makaryo dengan warna Matoer: sapaan + kartu *Shift kamu hari ini* dengan tombol absen, 4 kartu angka (jam kerja, tepat, telat, penjualan/pesanan hari ini), 4 kartu modul (Absen, Jadwal, Pengajuan, POS/Antrean), menu pil melayang di bawah (HP) atau sidebar (laptop), lonceng **notifikasi** (izin diputus, tukar shift, jadwal terbit), dan **Profil** (ubah nama/HP, ganti PIN).
- **Absen**: selfie + lokasi GPS, jam server. Dari **HP sendiri** lewat /staf, atau di **tablet outlet** lewat /pos → *Absen* (rekan lain memakai **kode staf + PIN** tanpa mengganti kasir yang sedang login). Lokasi ditolak tetap tersimpan, ditandai tanpa lokasi. Status: tepat waktu / telat / tanpa jadwal / tidak absen.
- **Pengajuan** (Aplikasi Staf → *Pengajuan*): izin min. H-3, sakit untuk hari ini, libur mingguan saat dibuka HRD. HRD/SPV menyetujui/menolak (dengan alasan), atau mencatat izin/sakit untuk staf yang mengabari lewat WA. Izin disetujui otomatis melepas jadwal orang itu di tanggal tersebut.
- **Tukar shift** (Aplikasi Staf → *Pengajuan → Tukar shift*, atau ketuk tanggal di kalender *Jadwal*): ajukan ke rekan (paling lambat H-1) → rekan menerima → HRD/SPV menyetujui → jadwal tertukar otomatis.
- **Pengingat**: banner di aplikasi POS (tablet) mulai 60 menit sebelum shift bila belum absen masuk (merah ≤15 menit / sudah lewat), dan saat ada permintaan tukar menunggu.
- **Rekap Absensi**: status hari ini, ringkasan per staf (jadwal, hadir, tepat, telat + menit, tidak absen, izin, jam kerja), detail dengan foto selfie & tautan peta, koreksi (catatan / isi jam pulang), **Unduh Excel**. Data ini menjadi dasar penggajian (Tahap 8).
- Shift kerja (kehadiran) **terpisah** dari shift kas (buka/tutup laci di *Kas & Pengeluaran*).
