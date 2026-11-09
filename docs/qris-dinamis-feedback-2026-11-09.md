# Feedback pembayaran QRIS Dinamis — 9 November 2026

Receipt yang benar-benar berhasil dari server pada mode QRIS Dinamis melewati layar centang hijau + nominal selama dua detik, baru kemudian membuka struk. Semua outlet menggunakan aturan ini pada mode Dinamis; tidak mengganti pilihan QRIS outlet atau mengaktifkan integrasi bank. Saat ini alur Dinamis yang bisa diuji adalah simulasi Outlet Demo. Integrasi provider nyata masih menunggu kesiapan sebelumnya.

SFX memakai aset existing `/audio/pembayaran-diterima.wav` tanpa perubahan. AudioContext diaktifkan dari gesture klik Bayar mode Dinamis, kemudian aset dimuat/di-decode sebelum menunggu konfirmasi. Suara baru dimainkan setelah receipt berhasil; prepare/cancel/pending/error tidak memainkan suara. Satu ID receipt hanya dimainkan sekali melalui dedup memori, promise in-flight dan sessionStorage. Jika autoplay/audio ditolak, layar sukses menyediakan tombol aktivasi; kegagalan suara tidak menggagalkan pembayaran atau menahan struk. Suara tidak dihentikan saat layar sukses beralih ke struk.

Animasi CSS/SVG kecil, tanpa dependensi tambahan, menghormati prefers-reduced-motion. Komponen success generik dipasang pada receipt gate POS, bukan hardcoded Outlet Demo; nama simulasi hanya ketika receipt merupakan testing. Cetak/salinan riwayat tidak melewati gate, sehingga tidak mengulang bunyi.

QRIS Statis, kode QR, nominal, tombol konfirmasi manual, autentikasi, checkout server, database dan semua pengaturan outlet tidak berubah. Guard provider dinamis operasional tetap berlaku; fitur ini tidak menganggap klik Bayar sebagai pembayaran berhasil.

Validasi: 458 tes / 76 file lulus. Tes baru meliputi pembatasan mode/metode/offline, dedup konfirmasi bersamaan/berulang/session, dan retry audio yang diblokir. Browser QA memakai komponen POS/halaman simulasi asli dengan backend lokal mock pada 390 px: konfirmasi → audio source start tepat sekali → success sekitar dua detik → struk testing; jalur statis tetap aktif dan tidak menyalakan audio. Fixture QA dan pengecualian middleware dikembalikan sebelum build. Tidak mengubah database untuk fitur ini.

ESLint, TypeScript dan build produksi lulus. Perbandingan byte mengonfirmasi modal QRIS statis, generator QR, tampilan QR dan fungsi checkout server sama dengan produksi sebelumnya.
