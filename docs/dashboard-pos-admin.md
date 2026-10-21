# Navigasi Dashboard POS admin dan Tamu Matur

- Owner dan Admin Pusat: menu `/dashboard-pos` memakai SalesDashboard dan Filters yang sama dengan grafik POS sebelumnya. Filter outlet/periode/kustom, simulasi, dan grafik tetap tersedia.
- Beranda kedua role tersebut menampilkan ringkasan POS hari ini dan tombol menuju detail. Grafik POS panjang serta tab POS/keuangan tidak lagi ditampilkan di Beranda admin. Menu laporan keuangan yang sudah ada tetap `/laporan`.
- Tombol melayang mobile: Beranda, POS, Laporan, Menu. Menu tetap membuka seluruh navigasi. Item aktif diberi `aria-current`. Desktop mendapat menu Dashboard POS di sidebar.
- Role lain mempertahankan dashboard dan pilihan pintasan sebelumnya. Admin Gudang tidak mendapat hak melihat omzet tambahan.
- Role internal `pemantau_pos` tetap sama; nama tampilannya menjadi Tamu Matur. Menu penjualan tetap `/pantau-pos`, dengan pintasan POS, Profil, dan Menu. Pengaman halaman dan RPC/outlet tetap dipertahankan. Tidak membuat akun tamu, mengubah penugasan, atau membuka akses baru.
- Tidak ada migrasi database, perubahan autentikasi, maupun dependensi baru.

## Validasi

31 tes terarah lulus: navigasi per role, loader server (Owner/Admin Pusat diizinkan, 10 kondisi sesi/peran lain ditolak sebelum query), validasi pilihan outlet dan simulasi, serta regresi login/OTP. ESLint file terkait lulus. Loader akses/data dipisahkan ke `src/lib/dashboard-pos.ts` agar dapat diuji langsung tanpa memuat JSX di test runner; konfigurasi test tidak diubah.

Browser lokal dengan layanan auth/data tiruan memverifikasi Beranda Owner (ringkasan stok, absensi, POS), navigasi ke Dashboard POS, tampilan grafik dan filter serta empat pintasan mobile. Indikator POS aktif diperiksa. Browser kemudian tidak tersedia, sehingga perpindahan dari bagian bawah grafik ke Laporan dan UI Tamu tidak selesai diuji lewat browser. Tautan Laporan dan batas akses Tamu tercakup tes otomatis. Tidak menggunakan akun atau transaksi produksi.

Build produksi akhir lulus beserta pemeriksaan TypeScript. Satu warning lint lama di simulasi-view.tsx:80 tidak terkait perubahan ini.
