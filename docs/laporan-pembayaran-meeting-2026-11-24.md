# Rekap keuangan, pembayaran dan meeting — 24 November 2026

## Tampilan dan angka

- `/laporan/rekap` untuk Owner/Admin Pusat/Finance/Mitra/Manajer Area. Laporan resmi sesuai RLS; tidak memasukkan draft ke angka resmi. Filter outlet dinamis, tahun atau rentang bulan. Kartu omzet setelah diskon, laba, margin, bagian Mitra dan pusat; grafik omzet/laba, margin dengan unit %, dan pembagian.
- Margin dua desimal, dihitung laba/omzet*100; nol omzet = tidak terdefinisi (—), rugi tetap negatif. Total adalah rasio jumlah, bukan rata-rata persentase. Persentase bagi hasil dari snapshot laporan, bukan perjanjian terbaru.
- Parsing kolom laporan numeric yang diterima sebagai string kini dinormalisasi sebelum aritmetika; nilai sumber tidak ditulis ulang. Nominal sumber, termasuk pecahan rupiah lama, dipertahankan di rekap/ekspor.
- `/portal/bep`: akumulasi dibanding garis investasi, diagram posisi BEP dan surplus/sisa. Capaian dapat melebihi 100%; lebar diagram dibatasi 0–100%, bukan angkanya. BEP = laba outlet, bukan bukti uang kembali ke Mitra.
- Nama alias penerima digabung hanya ketika semua posisi baris transfer/bagi hasil sumber per bulan identik. Kesamaan nominal saja tidak cukup. Tidak menghapus atau menulis ulang nama/baris laporan.
- Excel empat lembar: rekap, hak/pembayaran, riwayat pembayaran, pembagian per penerima. PDF tabel lengkap dengan header berulang dan baris tidak terbelah. Tidak menyertakan URL bukti privat yang kedaluwarsa.

## Hak dan pembayaran

- `/laporan/[id]/tindak-lanjut`, tabel `laporan_bayar` dan `laporan_bayar_riwayat`; hanya pusat/Akunting yang menulis melalui RPC. Identitas hak berupa posisi sumber transfer; bila tidak ada alokasi transfer, gunakan bagi hasil. Bagian pengelola yang belum ada di alokasi transfer disertakan terpisah. Sewa dibedakan dari bagian laba.
- Hak snapshot harus sama dengan sumber saat menyimpan. Koreksi memerlukan versi, alasan, dan audit sebelum/sesudah. Pembatalan mengarsipkan status, bukan menghapus fisik. Kunci laporan menserialkan pembayaran untuk menolak kelebihan bayar. UUID request+payload+aktor mencegah penggandaan retry.
- Tidak menganggap alokasi transfer pada laporan sebagai pembayaran aktual. Awalnya **Belum tercatat**, bukan tuduhan pembayaran lama belum dilakukan. Status setelah pencatatan: Sebagian/Lunas. Akunting bisa mencatat pembayaran lama dengan tanggal sebenarnya.
- Nominal nyata dan pembulatan terpisah. Penyesuaian opsional maksimal total absolut Rp1 per hak; alokasi efektif = pembayaran nyata - penyesuaian. Contoh sumber sewa 1.416.666,667, transfer 1.416.667, penyesuaian +0,333. Harus diisi secara sadar dengan alasan/konfirmasi; tidak mengubah sumber atau membulatkannya otomatis.
- Bukti transfer wajib untuk metode transfer. Bucket privat `laporan-bukti-bayar`, JPG/PNG/WebP/PDF≤5 MB; signed link 120 detik. Akses sesuai laporan. Bukti lama tetap terkait audit. Tidak menambah biaya operasional, stok, atau saldo kas otomatis.
- Jika sumber hak berubah, pembayaran lama diberi peringatan. Koreksi sumber tidak diam-diam mengubah pembayaran; pembatalan catatan dan pencatatan kembali harus ditelusuri Akunting.

## Meeting dan WhatsApp

- `/meeting-laporan`, detail menyatu dengan tindak lanjut laporan. Mitra dapat mengajukan online/tatap muka dengan agenda/waktu WIB/durasi, peserta dan lokasi/HTTPS link; pusat juga dapat mengundang.
- Usulan disetujui pihak penerima, bukan pihak pengusul. Waktu harus mendatang dan lokasi/link lengkap saat persetujuan. Perubahan jadwal memerlukan kesepakatan ulang. Versi melindungi perubahan bersamaan.
- Undangan bulanan pusat membuat 1–12 usulan bulanan (masing-masing tetap perlu persetujuan), memakai tanggal acuan asli dan clamp akhir bulan; tetap merujuk laporan awal, bukan menerbitkan/mengasumsikan laporan masa depan.
- Peserta wajib Mitra outlet tersebut serta Akunting/pengelola yang berwenang. Mitra lain meskipun sama outlet tidak dapat melihat meeting privat tanpa menjadi peserta. Pusat berwenang memantau seluruh meeting laporan.
- Notifikasi hanya di aplikasi saat pengajuan/perubahan. Tidak mengirim email/WA otomatis, membuat ruang Google Meet/Zoom, atau mengasumsikan reminder terjadwal di luar fitur ini. Pengguna memasukkan link online yang digunakan.
- Akunting mengisi notulen dan keputusan/tindak lanjut setelah jadwal berlangsung. Histori lengkap dan alasan tersimpan; selesai/batal tidak dapat diam-diam dibuka ulang.
- Tombol WhatsApp di detail membaca kontak Akunting aktif dari Support Outlet. Pesan awal berisi outlet, bulan dan link laporan; pengguna sendiri yang menekan kirim di WhatsApp.

## Validasi dan batas

SQL integration mencakup izin, privasi antar outlet/peserta, idempotensi, batas bayar, koreksi/versi/audit, bukti privat, pembulatan, persetujuan meeting dan notulen. Dry-run terhadap laporan Oktober aktual dilakukan dalam transaksi rollback, membuktikan hash seluruh laporan resmi tetap sama. Contoh PDF Kominot Juni–Oktober dirender dan diperiksa; Excel dibuka ulang untuk jumlah lembar/penerima dan presisi angka. Tidak ada pembayaran/meeting dummy ditinggalkan dan tidak ada uji fisik tablet/printer atau klik browser produksi yang diklaim.
