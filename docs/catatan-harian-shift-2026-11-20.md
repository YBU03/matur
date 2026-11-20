# Catatan harian dan hubungan shift — 20 November 2026

Gejala: penjualan 19 November tercatat di tabel harian tetapi kartu kas kosong/salah, pada UHB dan Kominot. Status POS membuka kas segera setelah tutup malam. Penjualan esok masuk kas itu, namun label `tanggal_shift` masih tanggal pembukaan. Trigger pengeluaran 17 November hanya menerima kecocokan label itu; pengeluaran laci jadi null tanpa pemberitahuan. Kartu bawah 18 November memakai seluruh shift berdasarkan label buka, berbeda dari tabel penjualan berdasarkan `tgl_op`.

## Perilaku yang diperbaiki

- Penjualan tunai/pengeluaran laci dalam ringkasan harian selalu memakai tanggal yang sama dengan daftar atas. Pengeluaran pusat tetap terlihat dan dijelaskan tidak mengurangi laci.
- RPC baca `sesi_catatan_harian` memuat kas berdasarkan tanggal aktivitas penjualan/pengeluaran, termasuk sesi yang dibuka sebelum awal bulan dan sesi lintas tanggal. Rincian seluruh shift terpisah dari ringkasan harian, dengan tanggal/jam buka–tutup lengkap dan tanggal aktivitas.
- Tanggal pencatatan setoran dipetakan ke aktivitas transaksi terakhir (fallback biaya, lalu label lama; kas kosong aktif mengikuti hari operasional saat ini). Rekap setoran dihitung sekali, tidak digandakan ketika satu shift tampil pada beberapa hari. Angka setoran/fisik dan timestamp asli tidak diubah.
- Kas otomatis tetap boleh terbuka setelah tutup; tidak menambah syarat shift/PIN atau menutup kas paksa. Kas aktif valid untuk input hari operasional saat ini meskipun pertama dibuka malam sebelumnya.
- Pengeluaran baru tidak boleh diam-diam kehilangan hubungan shift. Jika satu kandidat cocok, otomatis dipilih; jika beberapa, akunting memilih. Pengeluaran pusat tidak perlu shift. Untuk kas tertutup, hanya Owner/Admin Pusat/Finance, alasan wajib dan antrean offline harus selesai; kas seharusnya dihitung ulang tanpa mengubah setoran aktual. Request ID tetap idempoten.
- Rekonsiliasi tersedia untuk kas aktif/tertutup. Pengaitan ulang memperlihatkan preview, membutuhkan alasan dan fingerprint, menulis audit, dan menjaga nilai aktual. Tanggal aktivitas lintas hari diperbolehkan; hubungan tanggal yang benar-benar keliru tetap diperingatkan. Rincian bahan/stok yang dilindungi tetap melalui guard lama.

## Keamanan dan kinerja

Fungsi SECURITY DEFINER hanya di schema privat `rekonsiliasi_internal`/fungsi lama operasional; wrapper publik SECURITY INVOKER. Otorisasi peran/outlet dan rentang maksimal 366 hari. Anon ditolak. Dua indeks lookup `(sesi_kas_id,created_at)` dan `(sesi_kas_id,tanggal)` untuk menghindari pemindaian ulang seluruh transaksi/biaya. Tidak menambah polling. Tidak memindahkan transaksi, membuat setoran, mengubah stok atau membuat kas baru.

Migrasi `harian_shift_terhubung` diuji menggunakan PGlite dan dry-run produksi dalam transaksi ROLLBACK. Data koreksi riil dilakukan terpisah melalui RPC rekonsiliasi beraudit, bukan update massal di migrasi.

## Verifikasi

Uji: kas buka 18 dengan transaksi 19; pengeluaran null tanggal 19; preview dan pengaitan tanpa mengubah aktual; input susulan tertutup idempoten; pusat tidak mengurangi kas; beberapa shift harus dipilih; kas kosong terbuka kembali valid hari berikutnya; shift lintas bulan tetap terlihat dan setoran sekali; tanggal lama yang keliru tetap diperingatkan; role/anon/lintas outlet; form DOM pemilihan shift/alasan. Uji regresi rekonsiliasi lama tetap lulus.

Belum diuji pada tablet/printer fisik. UI diuji melalui DOM React; pembatasan browser sebelumnya dihormati.
