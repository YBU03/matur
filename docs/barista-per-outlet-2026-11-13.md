# Pengguna Barista per outlet

Pada mode pengelompokan Peran di menu Pengguna, bagian Barista memiliki subkelompok outlet yang dapat dibuka/tutup, dengan jumlah pengguna setiap kelompok. Daftar mengikuti ID/nama penugasan outlet secara otomatis; tidak ada nama outlet yang ditulis tetap di kode. Outlet baru muncul ketika ada barista yang ditugaskan ke sana. Status aktif/nonaktif tetap terlihat sesuai filter.

Barista tanpa outlet konkret diletakkan pada Belum ditetapkan outlet; beberapa penugasan outlet konkret masuk Beberapa outlet. Satu pengguna tetap satu baris sehingga checkbox dan pengelolaan akun tidak berganda. Akun multi peran tetap berada di Multi Peran sesuai perilaku sebelumnya.

Pengurutan kelompok dilakukan sebelum pagination, sehingga barista dari outlet sama berurutan ketika daftar melampaui satu halaman. Kelompok dapat berlanjut ke halaman berikutnya; jumlah yang ditampilkan pada kelompok adalah jumlah baris pada halaman itu, sesuai perilaku tabel sebelumnya. Pilihan checkbox tetap tersimpan saat kelompok ditutup/dibuka. Pencarian, filter dan callback detail/akses/status/aksi tetap memakai alur semula.

Tidak ada perubahan akun, penugasan, hak akses, database atau transaksi outlet. Pengelompokan mengambil data yang sudah tersedia pada halaman Pengguna.

Verifikasi: unit test mencakup outlet baru, tanpa outlet, multi-outlet, status nonaktif, pengguna multi-peran, keutuhan jumlah pengguna dan urutan sebelum pagination. Preview browser dengan data tiruan mengonfirmasi Kominot4/UHB3, kelompok baru/tanpa outlet/multi-outlet, buka-tutup, checkbox bertahan, serta callback aksi. Halaman preview dan pengecualian middleware sementara dihapus sebelum build produksi.
