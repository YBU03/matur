# Koreksi Penjualan Akunting — 18 November 2026

Menu `/koreksi-penjualan` tersedia untuk Owner, Admin Pusat, dan Finance. Tautan juga ada pada Laporan POS dan tanggal di Catatan Harian. Pilih outlet/periode, cari nomor/kanal/nominal, lalu tambah penjualan susulan, edit menu/jumlah/harga/diskon/kanal/metode, hapus ke tempat sampah, atau pulihkan. Alasan wajib. Riwayat menyimpan pelaku, waktu, data sebelum/sesudah, perubahan kas dan bahan yang sudah tercakup SO.

Pratinjau menjalankan perhitungan dalam subtransaksi yang dibatalkan: tidak menyimpan transaksi, pembayaran, stok, kas, audit atau ID permintaan. Konfirmasi memakai sidik transaksi, kas, stok, SO dan resep/HPP. Jika dasar berubah, harus melihat pratinjau baru. ID permintaan dan hash payload mencegah kirim ulang menggandakan transaksi; transaksi database mengikat seluruh perubahan.

Tanggal mengikuti shift tertutup asli, bukan tanggal input. Antrean offline harus bersih agar tidak tumpang tindih dengan transaksi yang belum sinkron. Jam perkiraan ditandai pada metadata tersendiri `koreksi_penjualan`, bukan `sumber_penjualan` (khusus PDF lama tanpa rincian). Transaksi promo/subsidi, split payment dan impor PDF lama dilindungi dari penggantian item biasa; tersedia alur asal untuk koreksi yang sesuai. Pemindahan tanggal dilakukan dengan pembatalan dan pencatatan pengganti pada shift tujuan.

Penjualan masuk tabel transaksi/item/pembayaran yang sama sehingga laporan dan ekspor yang ada ikut berubah. Kas seharusnya dihitung ulang dari transaksi lunas, pengeluaran laci dan penyerahan; setoran aktual tetap. HPP item lama dengan menu/varian sama dipertahankan. Item baru memakai resep/HPP saat pencatatan dan dibekukan, tidak diklaim sebagai resep historis. Koreksi stok memakai delta, bukan pemakaian ganda; bahan yang sudah dihitung fisik melalui SO setelah transaksi tidak mengubah saldo kini lagi. Hapus–pulihkan memakai net mutasi sebelum hapus, termasuk hasil edit sebelumnya. Laporan bulanan yang sudah diterbitkan tidak ditimpa otomatis.

## Penjualan susulan Kominot 17 November

Instruksi pemilik: penjualan saat web terganggu sekitar pukul 21.00. Harga Lemonade diverifikasi Rp15.000; Durian Goreng Rp36.000 total dua porsi.

| Rekap | Rincian | Nilai |
|---|---|---:|
| Tunai #43 | Butterscotch Latte 1 × 28.000; Chocolate 1 × 22.000 | 50.000 |
| QRIS #44 | Cappucino 1 × 20.000; Kopi Susu Keluarga 1 × 23.000; Lemonade 2 × 15.000; Durian Goreng 2 × 18.000; Mineral Water 1 × 5.000; Caramel Latte 1 × 28.000 | 142.000 |
| GoFood #45 | Black Coffee 1 × 15.000; Croissant 1 × 20.000 | 35.000 |

Total Rp227.000, 12 unit. Tiga catatan merupakan rekap per metode, **bukan klaim tiga nota pelanggan asli**; pembagian pesanan tidak diberikan. Alasan menjelaskan batas tersebut. Omzet lunas bertambah dari Rp1.837.000 menjadi Rp2.064.000. Tidak ditemukan entri susulan sebelumnya; antrean perangkat kosong. Tidak ada SO sesudah waktu transaksi yang mengharuskan pemakaian bahan dilewati.

Setoran lama Rp467.000 tetap. Tambahan tunai Rp50.000 membuat seharusnya Rp517.000 dan selisih −Rp50.000, memerlukan pencocokan bukti setoran; tidak dibuat setoran fiktif.

Bukti waktu: transaksi online terakhir seluruh outlet diterima server 17 November pukul 21.03.52 WIB. Cup 3 unit pukul 21.08.27 tersimpan offline dan baru diterima 18 November pukul 06.33.58. Transaksi online berikutnya tercatat 18 November pukul 07.13.38. Ini bukti aktivitas, **bukan pengukuran persis awal/akhir downtime**. Akses runtime log Vercel terhalang izin tim (403). Waktu rekap memakai 21.10 dengan penanda perkiraan.

## Selisih tanggal 5

Ditemukan dua biaya es kristal masing-masing Rp24.000 dalam shift 5. Salah satunya bertanggal 4 tetapi terhubung shift 5. Pemilik mengonfirmasi masuk tanggal 5; tanggalnya diperbaiki melalui rekonsiliasi dengan audit. Nominal dan setoran dipertahankan.

Pengeluaran shift sebenarnya Rp127.500, sedangkan kartu sebelumnya hanya menampilkan biaya bertanggal 5 Rp103.500. Kartu kini menggunakan hitungan shift yang sama dengan kas, termasuk penyerahan dan biaya berbeda tanggal; inspector memperingatkan biaya dengan nama/tanggal/nominal sama untuk dicocokkan. Dua biaya tidak otomatis dianggap duplikat. Rp792.000 − Rp127.500 = Rp664.500; setoran Rp688.500 masih lebih Rp24.000 sampai bukti kedua biaya diperiksa. Tambah/edit/hapus pengeluaran sudah tersedia di Catatan Harian; hubungan tanggal/shift di inspector.

## Validasi

Uji PGlite mencakup pratinjau tanpa penyimpanan, simpan/idempotensi, perubahan payload ditolak, edit/harga/HPP, stale preview, saldo kas aktual tetap, dua siklus hapus–pulihkan, SO historis, tanggal/qty salah, antrean offline, promo, dan akses anon/barista/lintas outlet. Fixture `supabase/tests/koreksi_penjualan.sql` juga lulus dengan RPC produksi dan role authenticated, kemudian ROLLBACK. Readback memastikan tiga rekap serta seluruh item dan metode benar. Security advisor tidak menambah WARN/ERROR; INFO bertambah satu karena tabel idempotensi privat memakai RLS tanpa kebijakan/akses tabel (disengaja). Browser visual tidak diuji karena batas kebijakan sesi.
