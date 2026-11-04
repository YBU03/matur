# Status Rincian Keperluan mengikuti Realisasi Belanja

Tanggal: 4 November 2026.

- Detail nota aktif yang terhubung ke barang RAB mengubah status Rencana menjadi Dibeli. Berlaku saat nota disimpan, termasuk DP/belum lunas. Tidak menunggu pembayaran lunas.
- Dibeli menunjukkan pengadaan sudah dicatat, bukan seluruh kuantitas sudah terpenuhi. Qty, harga RAB, nilai nota, pembayaran, dan saldo tidak diubah oleh sinkronisasi.
- Item manual tanpa hubungan RAB tidak mengubah status barang mana pun.
- Status Terpasang dipertahankan. Status Dibeli yang sudah dicatat manual sebelum migrasi juga dipertahankan.
- Provenance privat mencatat hanya status yang dipromosikan otomatis. Bila barang diganti/dilepas dari nota atau nota dibatalkan, status otomatis kembali Rencana hanya jika tidak ada nota aktif lain untuk barang itu. Status manual tidak diturunkan.
- Mengubah status secara manual mengambil alih status dari otomatisasi. Memilih nilai sama tidak dianggap perubahan manual; aturan otomatis tetap berlaku pada perubahan nota berikutnya.
- Nota yang direvisi dengan menghapus/memasukkan ulang detail dievaluasi pada akhir transaksi. Tidak ada perubahan status sementara selama penyimpanan. Kegagalan pembayaran/penyimpanan me-rollback status bersama nota.
- Backfill hanya mempromosikan Rencana yang memiliki nota aktif pada proyek yang sama; tidak mengklaim status Dibeli lama sebagai status otomatis.
- Setelah menyimpan realisasi, buka/muat ulang Rincian Keperluan untuk melihat status terkini. Tidak menambahkan langganan realtime atau mengubah tampilan.

## Implementasi dan keamanan

Migrasi `20261104042346_rab_status_realisasi_otomatis.sql`: deferred constraint triggers pada header/detail nota, fungsi sinkronisasi privat dengan search_path kosong, serta provenance di `proyek_internal.status_rab_otomatis`. Kunci transaksi per proyek dan penguncian baris RAB menjaga konsistensi. Hak eksekusi fungsi dan akses tabel dicabut dari PUBLIC/anon/authenticated. RLS provenance aktif tanpa policy, sengaja menolak seluruh akses klien; hanya fungsi internal database yang mengaksesnya. Peringatan advisor RLS tanpa policy pada tabel privat ini merupakan konsekuensi deny-all yang disengaja, bukan akses publik.

Tidak mengganti RPC, aturan autentikasi, POS, ataupun perhitungan keuangan.

## Verifikasi

- 391 tes / 62 berkas lulus, termasuk tujuh skenario integrasi SQL baru: DP, revisi hubungan RAB, beberapa nota aktif, status manual/Terpasang, rollback pembayaran, penggantian detail atomik, dan penolakan akses klien/lintas proyek.
- Uji produksi memakai RPC asli dalam transaksi rollback: Rencana → Dibeli → Rencana setelah pembatalan, qty tetap. Seluruh fixture dibatalkan, tidak meninggalkan nota/barang latihan.
- Snapshot UHB sebelum/sesudah migrasi tetap: 30 Dibeli, 76 Rencana; RAB Rp60.768.603; 24 nota aktif total Rp15.017.603; pembayaran aktif Rp13.267.603.
