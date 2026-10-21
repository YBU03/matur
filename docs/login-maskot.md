# Maskot login Matur

Halaman `/login` tetap memakai Next.js Server Actions, Supabase email/password dan OTP, serta aturan tujuan peran yang sama. POS `/kasir` dan `/pos` tidak diubah.

## Perilaku

- Welcome: pose tangan terangkat, gerakan ringan seluruh ilustrasi, sapaan awal.
- Focus: fokus username/email, pose memperhatikan tablet.
- Password: fokus password atau OTP, pose kedua tangan menutup mata. Tidak ada pembacaan nilai password untuk animasi.
- Success: hanya setelah server mengembalikan `destination` seusai autentikasi berhasil. Pose jempol ditampilkan 1,2 detik, kemudian router membuka tujuan dari server. Overlay persiapan dashboard lama tetap digunakan saat navigasi.
- Gagal/koneksi terganggu: pesan pada formulir, tanpa sukses, bisa dicoba kembali.
- Tombol metode masuk, isian, tombol mata dan submit dikunci ketika pending/sukses. Penjaga submit juga mencegah klik ganda sebelum render pending.
- Pergantian metode mereset state formulir, termasuk status OTP dan visibilitas sandi.
- Animasi CSS menghormati `prefers-reduced-motion`; dimensi ilustrasi tetap untuk mencegah layout bergeser. Gambar dekoratif; kegagalan gambar tidak menghalangi form.

Username pada halaman ini tetap email terdaftar sesuai backend sebelumnya. Tidak menambahkan skema username baru.

## Aset

`public/mascot/login/matur-{welcome,focus,password,success}.webp`, masing-masing 480×480, alpha transparan, sekitar 34–38 KB. Tidak ada video atau dependensi baru. Ukuran tampilan adaptif 104–192 px.

Aset berasal dari referensi pengguna `369324.png`, dipisahkan/dibersihkan menggunakan built-in imagegen. PNG hasil asli tersimpan di lokasi generated_images lokal; salinan WebP teroptimasi berada dalam repo. Aset adalah empat pose statis, bukan animasi tangan berartikulasi. Efek gerak adalah float/sway seluruh gambar, fade antarpasangan pose, dan pop sukses.

Prompt set (satu panggilan per pose):

- `background-extraction`: extract only top-left waving welcome mascot and orange-yellow medallion; preserve character identity/blangkon/jacket/raised hand; remove speech bubbles, text, exterior background and other poses; centered square with actual transparent alpha.
- `background-extraction`: extract only top-right attentive tablet mascot and medallion; preserve original identity/pose; remove icon bubbles/text/exterior/other poses; centered square transparent asset.
- `background-extraction`: extract only bottom-left both-hands-covering-eyes mascot and medallion; preserve identity/proportions/materials; remove lock bubble/text/exterior/other poses; actual transparency.
- `background-extraction`: extract only bottom-right thumbs-up mascot and medallion; preserve original face/blangkon/dark jacket/pose; remove speech/text/exterior/other characters; true alpha.

## Validasi

Tes `src/lib/__tests__/login-actions.test.ts` memeriksa kegagalan password, OTP terkirim (belum sukses), kegagalan OTP, sukses OTP, dan seluruh tujuan peran. Tes memakai mock layanan, tanpa kredensial atau transaksi produksi. Pengujian visual lokal menggunakan endpoint autentikasi dummy sehingga tidak membuat/mengubah akun produksi.

Hasil verifikasi implementasi: 14 tes server action lulus, TypeScript dan lint file terkait lulus. Browser lokal diperiksa pada 320×568, 390×844 dan desktop 1280×800; pose fokus/password, tombol mata, pending disabled, gagal tanpa sukses, permintaan OTP, sukses OTP/password dan navigasi pilihan peran melalui stub lokal berhasil. Semua empat gambar berhasil dimuat dan transparansi alpha tiap aset diperiksa. Preferensi reduced-motion didukung lewat aturan CSS; belum diuji dengan pengaturan perangkat fisik. Tidak menggunakan akun/kredensial produksi.

Build produksi akhir lulus. Satu peringatan lint lama di `src/app/(app)/simulasi/simulasi-view.tsx:80` tidak terkait perubahan ini. Tidak ada perubahan skema/database atau dependensi.
