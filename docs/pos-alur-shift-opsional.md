# POS: alur shift opsional (26 Oktober 2026)

Atas persetujuan pemilik, alur baru tersedia melalui **Akses Kasir POS per Outlet → Alur Shift**. Owner, Admin Pusat, HRD dan Admin Gudang mengatur outlet sesuai penugasan. SPV/Finance tidak mengubah switch/PIN.

## Pemakaian

- Semua outlet tetap memakai akses langsung secara default. Tidak ada badge mode bebas pada POS. Transaksi pelatihan tetap merupakan data asli, sesuai permintaan pemilik.
- Aktifkan “Gunakan Alur Shift”, isi PIN outlet 4–6 angka, lalu konfirmasi. Perubahan mode berlaku pada **kas berikutnya**; kas berjalan tidak diputus. Tutup kas berjalan melalui menu Kas untuk memulai alur baru. PIN baru berlaku langsung pada pemilihan/pergantian berikutnya.
- Login tetap di `/pos` memakai username/password outlet. Jika kas sudah berjalan, perangkat yang baru login memasukkan PIN outlet untuk melanjutkan kas/PIC yang sama tanpa membuat modal kedua. Pilih petugas dari jadwal terbit hari ini; staf pengganti aktif outlet tetap tersedia dengan alasan. Foto profil memakai URL bertanda tangan; avatar Matoer menjadi cadangan.
- Isi PIN bersama outlet dan modal awal. Absensi tetap terpisah; tidak ada pengunci Clock In/Out, jam shift, atau perangkat tunggal.
- Menu Kas → **Selesai & Serah Terima Shift**: lihat ringkasan, hitung uang fisik termasuk modal, isi catatan jika selisih, pilih penerima dan masukkan PIN outlet. Selisih tidak membutuhkan persetujuan admin dan tidak memotong gaji.
- Modal harian tetap satu. Saldo awal petugas berikutnya adalah uang fisik diterima, bukan modal baru. Selisih shift asal tidak dibebankan pada penerima.
- Pilih **Tutup operasional hari ini** pada petugas terakhir. Catatan stok fisik/pinjaman, barang datang, kebutuhan order, dan pemeriksaan non tunai bisa disimpan sebagai draft. Catatan ini tidak mengubah stok buku atau membuat pesanan gudang otomatis.
- Laporan mengambil penjualan, pengeluaran laci, uang diserahkan, kanal ojol dan kiriman diterima dari ledger yang sama. Dokumen kiriman menyertakan jumlah hasil pemeriksaan. Input fisik tetap diisi petugas. Fisik laci termasuk modal dibedakan dari hasil tunai di luar modal.
- Laporan dapat disalin/dibuka di WhatsApp. Aplikasi tidak mengirim pesan otomatis. Mengirim laporan bukan syarat penutupan. Riwayat laporan dapat dibuka kembali di menu Kas atau Alur Shift admin.

## Integritas dan batasan

Transisi memakai lock outlet dan ID permintaan, sehingga retry tidak menggandakan shift atau penutupan. Checkout tetap menggunakan mesin harga, stok, pembayaran dan idempotensi lama. Identitas operator dicatat server. Transaksi offline yang menyusul memperbarui periode asal berdasarkan waktu transaksi; ringkasan bersifat sementara jika ada antrean/perangkat belum melapor. Transaksi sesudah kas ditutup tetap mengikuti mekanisme pemindahan antrean ke kas baru; dapat tercatat di luar periode petugas bila belum ada petugas baru. Tidak ada transaksi yang otomatis dihapus untuk merapikan laporan.

Memulai/serah terima/menutup memerlukan internet untuk memastikan satu keadaan kas. Penjualan tunai tetap bisa memakai antrean offline yang sudah ada. Isian uang/catatan sementara disimpan di sessionStorage per shift jika tersedia; PIN tidak disimpan di sana. Draft laporan juga bisa disimpan ke server. PIN disimpan sebagai hash; delapan kesalahan dibatasi satu menit per perangkat dan pulih otomatis.

Selisih historis dihitung kembali dari ledger, sehingga koreksi/void atau transaksi terlambat dapat mengubah ringkasan periode lama. Rekap bukan jurnal baru atau setoran baru; tidak menggandakan data akunting.

## Perapian

Komponen UI lama `pos-gate`, `pos-outlet-pic`, `pos-testing-panel`, `pos-lanjut-kas-panel` serta action pemilihan PIC/pengecualian lama yang tidak digunakan dihapus. RPC historis dan arsip tetap dipertahankan untuk kompatibilitas/audit. Tidak menghapus transaksi, stok, absensi, setoran, kas, atau data training lama tanpa daftar record yang disetujui.

## Pemeriksaan

Integrasi PGlite menguji default langsung, aktivasi pada kas berikutnya, PIN bersama, otorisasi/scoping HRD-Gudang, fallback staf, modal sekali, transaksi/operator, antrean offline, selisih terpisah, draft, tutup, retry, pembukaan berikutnya dan pembatasan PIN. `supabase/tests/pos_alur_shift_opsional.sql` menguji RPC dengan role authenticated dan crypto asli di fixture yang seluruhnya di-ROLLBACK.

Tabel implementasi privat sengaja tidak memiliki kebijakan akses langsung (default deny); semua baca/tulis melewati RPC dengan pemeriksaan uid/outlet. Advisor INFO RLS tanpa policy dan indeks baru belum terpakai sesuai rancangan ini.

Hasil verifikasi implementasi: lint dan TypeScript lolos; build produksi berhasil (satu warning lama pada halaman simulasi); seluruh 244 tes dalam 36 file lolos. Fixture Supabase dengan role `authenticated` dan crypto asli lolos serta tidak meninggalkan record. Tidak ada temuan keamanan baru selain INFO default-deny pada empat tabel privat; indeks FK baru masih berstatus belum terpakai sebelum penggunaan nyata.

Uji visual interaktif belum dapat diselesaikan: browser lokal berhenti/menjadi tidak tersedia saat pratinjau. Route pratinjau dan pengecualian middleware sudah dihapus sebelum commit. Layout mobile menggunakan grid responsif, ukuran avatar tetap, dialog yang dapat digulir, fokus keyboard dan fallback foto, tetapi belum diklaim sebagai verifikasi screenshot perangkat nyata.
