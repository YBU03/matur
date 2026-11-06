# Sisa Setoran Mitra

Sesuai konfirmasi pengguna, kewajiban setoran menggunakan SELURUH Grand Total RAB
aktif, tanpa membedakan barang dibeli pusat atau mitra. Penanda pembeli RAB tidak
menentukan sumber pendanaan. Sisa setoran = max(0, RAB - dana masuk mitra).
Kelebihan setoran ditampilkan terpisah pada keterangannya; sisa nol diberi status
Setoran terpenuhi. Nilai otomatis mengikuti perubahan RAB dan setoran aktif.

Kartu ditempatkan sesudah Dana Masuk Mitra pada Biaya & Dana serta Realisasi
Belanja. Ringkasan PDF proyek dan PDF realisasi memakai fungsi yang sama.
Pembayaran belanja tidak mengurangi sisa kewajiban setoran; tetap mengurangi
Sisa Dana Aktual sesuai rumus sebelumnya. Tidak ada perubahan database.

Validasi: tes PDF dan belanja mencakup kekurangan, terpenuhi, kelebihan, serta
saldo aktual; PDF contoh dirender untuk pemeriksaan. TypeScript/lint/build
produksi serta layout kartu desktop dan mobile diperiksa secara lokal.
