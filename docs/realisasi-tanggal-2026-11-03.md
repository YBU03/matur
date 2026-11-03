# Tanggal realisasi belanja — 3 November 2026

Tanggal nota tambah/edit dan pembayaran berikutnya memakai pilihan tanggal, nama bulan Indonesia, dan tahun yang terpisah. Bulan sebelumnya dapat dipilih langsung tanpa menggeser kalender browser. Nilai tetap YYYY-MM-DD; RPC, database, saldo dana, perhitungan DP/pelunasan, dan riwayat tidak berubah.

Saat membuat nota, tanggal pembayaran mengikuti tanggal nota sampai pengguna mengubah pembayaran secara manual. Tanggal yang telah dikustom tidak ditimpa. Pergantian bulan/tahun menyesuaikan hari terakhir (31 menjadi 30/28/29). Tanggal pembayaran sebelum nota ditolak dengan penjelasan; koreksi tanggal nota dahulu bila nota sebenarnya lebih lama. Aturan database yang melindungi pembayaran lama tetap berlaku.

Validasi browser lokal memakai data fiktif tanpa menyimpan: nota Oktober dan tanggal pembayaran berbeda tampil pada preview; auto-follow dan preservasi tanggal manual; Februari dan tahun kabisat; pesan tanggal tidak sesuai; viewport HP 390px dan desktop 1366px. Tidak ada horizontal overflow atau error JavaScript. Pemeriksaan akhir: unit, TypeScript, lint, build produksi.

Hasil akhir: 377 tes / 60 berkas lolos; TypeScript, lint tanpa error, dan build produksi berhasil. Tidak ada migrasi atau perubahan data produksi.
