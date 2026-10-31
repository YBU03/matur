# Gudang: Pergerakan Stok & Smart Forecast — 1 November 2026

Disetujui pemilik ("gas"). Hanya membaca data; satu setelan buffer baru.

- Halaman `/gudang/pergerakan` (menu "Pergerakan & Forecast", juga tombol di Stok Gudang). Akses Owner/Admin Pusat/Admin Gudang; Finance lihat.
- Tab Pergerakan: RPC `pergerakan_stok_gudang(awal, akhir, grain)` — Gudang (`outlet_id` null), WIB, harian (maks 92 hari) / mingguan Senin–Minggu / bulanan (maks 1 tahun). Masuk = pembelian, keluar = kiriman_keluar, waste, penyesuaian = opname/koreksi/lainnya; stok awal & akhir dari stok sekarang dikurangi mutasi sesudahnya. Angka ditampilkan per satuan beli. Excel & PDF.
- Tab Smart Forecast: RPC `forecast_stok(outlet, bulan)` → per bulan kiriman Gudang→outlet (filter outlet lewat `kiriman.outlet_id`) dan pemakaian POS di outlet (pemakaian/void/marketing), stok Gudang & outlet, awal data, buffer. Rumus di `src/lib/gudang-forecast.ts`: laju harian per bulan (maks 3 bulan + berjalan), bobot kebaruan × porsi hari, tren diredam 50% diproyeksikan ke bulan depan; kebutuhan = max(kiriman, POS); saran = kebutuhan × (1+buffer) + stok_min − stok (dibulatkan ke kemasan). Lingkup perusahaan = stok Gudang + outlet; per outlet = stok outlet ("saran kirim").
- Buffer default 10% di `pengaturan_gudang`, diubah lewat `atur_buffer_forecast` (Owner/Admin Pusat/Admin Gudang, tercatat di log).
