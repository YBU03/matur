# POS: printer Bluetooth lebih andal — 1 November 2026

Disetujui pemilik ("gas"), dipicu RPP02N kedua yang tersambung tetapi tidak mencetak. Tanpa RawBT sebagai jalur utama; tanpa perubahan database.

- `src/lib/printer-bt.ts`: daftar layanan BLE diperluas (18F0, FFF0, FF00, FFE0, FEE7, AE30, AF30, FF80, FFB0, E7810A71, ISSC). Semua karakteristik tulis dikumpulkan lalu diurutkan: jalur cetak yang dikenal (2AF1, FFF2, FF02, FFE1, ISSC 8841, BEF8D6C9, AE01, AF01, FF82, FFB2, FEC7) didahulukan — sebelumnya diambil jalur tulis pertama (bisa jalur pengaturan → data terkirim tanpa tercetak).
- Cetak tes → kasir menjawab Keluar/Tidak keluar; "Tidak keluar" mencoba jalur berikutnya; jalur yang berhasil disimpan per printer (`localStorage` `matoer_printer_jalur`, kunci `device.id`/nama).
- Ganti printer memutus GATT lama; sambung GATT dicoba 3× (Android sering gagal sekali); putus di tengah cetak → sambung ulang & lanjut. Tulis-dengan-balasan bila didukung, tanpa balasan diberi jeda 20 ms per 20 byte, jeda tambahan tiap ±400 byte.
- Browser tetap tidak bisa Bluetooth klasik (SPP); untuk unit klasik saja, RawBT tetap tersedia sebagai cadangan.
