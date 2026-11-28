# Kontak Mitra pada laporan — 28 November 2026

Owner, Admin Pusat dan Finance melihat **Konfirmasi laporan ke Mitra** di halaman `/laporan/[id]` dan `/laporan/[id]/tindak-lanjut`. Satu mitra langsung tampil; jika lebih dari satu, pilih nama penerima dahulu. Tombol **Hubungi Mitra via WhatsApp** membuka pesan awal berisi nama mitra, outlet, periode dan tautan laporan. Pengguna memeriksa lalu mengirim sendiri. Tidak ada pengiriman otomatis atau perubahan status konfirmasi, pembayaran, publikasi maupun nominal laporan.

## Sumber data dan outlet baru

RPC mengambil outlet dari ID laporan asli, bukan outlet/nomor kiriman browser. Kontak mengikuti perjanjian asli yang tidak dihapus atau penugasan akun mitra aktif pada outlet tersebut. Data master mitra diutamakan; nomor akun menjadi fallback bila nomor master kosong. Akun mitra yang belum mempunyai master tetap terbaca. Mitra master tanpa akun tetap dapat dihubungi jika mempunyai perjanjian. Duplikasi master/penugasan/perjanjian untuk akun yang sama menghasilkan satu penerima. Master yang sudah dihapus tidak dimunculkan kembali lewat fallback akun.

Untuk outlet/mitra berikutnya, Admin mengisi nama/No. HP di **Master Mitra**, lalu menghubungkan perjanjian atau penugasan mitra ke outlet. Nomor dibaca terbaru setiap halaman laporan dimuat; tidak disalin atau di-hardcode per outlet/bulan. Hubungan yang dihapus/simulasi dan akun penugasan nonaktif tidak menjadi sumber kontak; perjanjian asli yang masih berlaku sebagai data master tetap menjadi sumber.

Nomor kosong/tidak valid tidak membuat tautan WA. Perbedaan galat muat data dan belum ada mitra ditampilkan jelas. Owner/Admin mendapat tautan Master Mitra serta Perjanjian Mitra; Finance diarahkan menghubungi Admin untuk koreksi nomor. Kontak tidak diberikan ke Mitra, Marketing, atau Manajer Area. Tombol Hubungi Akunting yang sebelumnya ada tetap tersedia.

## Keamanan dan verifikasi

Migrasi `20261128015053_laporan_kontak_mitra.sql`: RPC public invoker, implementasi privat dengan search_path kosong, autentikasi aktif+peran pusat, dan laporan asli tidak terhapus. Hanya mengembalikan id kontak/nama/no_hp untuk outlet laporan; tidak membuka tabel pengguna/penugasan atau mengubah RLS. Hak akses dan jadwal publikasi laporan tetap berlaku pada tautan yang dibagikan.

Tes SQL mencakup scope outlet, beberapa mitra/mitra baru, dedup, pembaruan/fallback nomor, master tanpa akun, penghapusan/simulasi, izin dan laporan tidak tersedia. Tes server memastikan kontak tidak dimuat/diserialisasi untuk peran lain. Tes DOM memeriksa pilihan penerima, format WA, isi pesan lengkap, nomor kosong/tidak valid dan galat. Browser komponen asli 1024×768 dan390×844 diperiksa: satu/beberapa penerima, tujuan dan isi WA, tidak overflow horizontal. Tidak mengirim WhatsApp. Route QA dihapus dan middleware dipulihkan.

RPC produksi diuji sebagai Finance pada laporan UHB sementara dalam transaksi ROLLBACK: Ristania Rosita Syarief Valera /085879542888 cocok. Tidak membuat laporan terbit atau mengubah data kontak. Advisor sebelum/sesudah tetap261 existing, tidak ada temuan baru.
