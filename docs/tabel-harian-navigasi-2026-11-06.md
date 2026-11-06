# Navigasi sel Catatan Harian

Viewport tabel mengikuti sel aktif saat navigasi panah dan Tab/Shift+Tab.
Perhitungan area terlihat memperhitungkan tanggal yang terkunci, header, total,
border, serta scrollbar. Hanya posisi scroll tabel yang diubah, tanpa animasi
berulang yang dapat tertinggal saat tombol ditahan. Sel lebih lebar dari layar
HP ditampilkan dari tepi kirinya; pengguna tetap dapat menggeser secara manual.

Input angka tetap memakai panah untuk menggerakkan kursor teks. Enter menyimpan
lalu turun satu baris, Tab menyimpan lalu ke kanan, Shift+Tab menyimpan lalu ke
kiri. Data kosong tidak mencoba membuka atau menyimpan sel yang tidak tersedia.
Tidak ada perubahan autentikasi, database, perhitungan, atau proses simpan.

Validasi: TypeScript, lint, dan build produksi berhasil. Uji browser lokal
memakai komponen asli dengan fixture 30 hari (tanpa menulis database), pada
viewport 1280, 390, dan 320 piksel: navigasi horizontal/vertikal, batas baris,
Tab/Shift+Tab, kursor input, dan perpindahan setelah simpan. Kolom yang lebih
lebar dari area layar diperiksa dari tepi kiri, bukan diwajibkan muat seluruhnya.
