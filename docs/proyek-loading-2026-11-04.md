# Loading proyek pembangunan — 4 November 2026

Loading memakai aset maskot Matoer yang sudah tersedia (`matur-welcome.webp`), bar oranye, dan pesan menyiapkan data. Gerakan hanyalah perpindahan gambar mengikuti bar, bukan animasi anggota tubuh atau ukuran persentase penyelesaian.

- Pindah tab: navigasi tetap terlihat; isi sebelumnya disembunyikan sementara selama transisi router. Tab tujuan mendapat penanda langsung, klik biasa berulang dicegah selama pending. Link tetap mendukung keyboard dan modifier untuk tab browser baru.
- Membuka daftar/detail proyek serta Rincian Keperluan memakai fallback loading route.
- Proses lokal yang sudah memiliki pending/busy (realisasi, unggah desain/dokumen, diskusi, checklist, tanggal, timeline, penyelesaian proyek, perubahan mode/impor RAB, ekspor PDF/Excel) menampilkan indikator ringkas lewat provider khusus proyek. Indikator mengamati status proses yang ada, tidak mengganti aksi atau penanganan error. Dialog editor generik tetap memakai indikator simpan bawaannya.
- Tidak ada jeda buatan, persen palsu, library tambahan, atau perubahan database. Loading selesai mengikuti penyelesaian transisi/proses; gagal/cancel/unmount membersihkan indikator.
- Gambar berdimensi tetap, role=status, aria-live, aria-busy pada isi tab, dan preferensi reduced-motion. Indikator proses tidak menangkap klik dan tidak memblokir formulir.

## Verifikasi

Browser QA memakai komponen produksi di halaman sementara dengan router/action tertunda yang dikendalikan lokal (tanpa akun atau penulisan data produksi). Ukuran 1366, 390, dan 320 px: tab keyboard, loading/tab tetap terlihat, konten lama tersembunyi, hasil sukses, kegagalan dan coba ulang, pengunci tombol pending, reduced-motion, dan tidak ada overflow halaman. Tidak ditemukan error browser. Halaman QA dan pengecualian middleware telah dihapus sebelum build/deploy. Ini bukan uji login atau mutasi database produksi.

Referensi: [Next.js useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router), [React useTransition](https://react.dev/reference/react/useTransition).
