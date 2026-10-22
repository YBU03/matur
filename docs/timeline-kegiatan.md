# Timeline kegiatan pembangunan

Timeline tetap mengikuti nomor urutan manual (`urutan`), bukan urutan tanggal. Tidak mengubah susunan atau tanggal pada proyek yang sudah ada. Query menggunakan ID sebagai pemecah seri terakhir agar hasil stabil bila nomor dan tanggal sama.

## Tampilan dan interaksi

- Kartu kegiatan bernomor 1..n; judul, tanggal rencana/realisasi, status dan keterangan tetap bersama kegiatan yang sama. Nomor tampil menunjukkan posisi; setelah disimpan nomor database dirapikan menjadi 1..n.
- Penanda Soft/Grand Opening ditampilkan terpisah sebagai target pembukaan. Penanda titik diposisikan relatif terhadap barisnya sendiri agar tidak menumpuk di pangkal timeline.
- Pegangan geser hanya di area tombol ⋮⋮. Selama pointer bergerak baris tidak dipindahkan; garis menandai posisi tujuan. Lepas untuk memperbarui pratinjau lokal. Pointercancel, kehilangan capture, atau Esc membatalkan gerakan tanpa menyimpan.
- Alternatif ↑/↓ dapat dipakai dengan keyboard/layar sentuh. Batas atas/bawah dinonaktifkan.
- `Simpan urutan` dan `Batal` berlaku untuk seluruh susunan. Tambah/edit/hapus kegiatan disembunyikan selama ada susunan yang belum disimpan agar perubahan tidak bertabrakan. Peran baca saja tidak memiliki kontrol perubahan.
- Komponen geser tahapan pekerjaan dan checklist yang sudah ada tidak diubah.

## Penyimpanan

`src/lib/timeline-actions.ts` memeriksa sesi aktif Owner/Admin Pusat lalu memanggil `simpan_urutan_timeline`. RPC SECURITY INVOKER, search_path tetap, EXECUTE hanya authenticated, dan RLS asli tetap berlaku. Mengunci proyek dan kegiatan, memeriksa seluruh ID dari proyek yang sama, menolak duplikat/baris dihapus/data usang, lalu menyimpan satu transaksi. Kegagalan membatalkan seluruh perubahan. Payload hanya ID dan nomor, tidak menyentuh tanggal/judul/status/keterangan.

Migrasi `20261022025316_timeline_urutan_atomik.sql` diterapkan pada Supabase terhubung. Tidak ada perubahan data jadwal proyek asli. Uji `supabase/tests/timeline_urutan.sql` memakai fixture sekali pakai dan ROLLBACK: Admin Pusat dapat menyimpan, tanggal tetap, data usang ditolak, peran tanpa izin ditolak. Metadata fungsi mengonfirmasi SECURITY INVOKER, anon tanpa EXECUTE dan RLS aktif.

## Validasi

Sembilan tes unit/SQL PGlite lulus: pindah atas/bawah dan batas, input tidak berubah, posisi sisip dengan tinggi baris berbeda, hak EXECUTE/peran, duplikat/ID tidak lengkap/lintas proyek/deleted/usang, rollback jika trigger gagal, Admin Pusat menyimpan hanya nomor dengan proyek lain tetap. ESLint pada berkas terkait lulus.

Pemeriksaan browser lokal pada data tiruan: geser pointer, tombol turun, Batal, status pending dan kegagalan autentikasi yang mempertahankan draft; tampilan read-only tanpa tombol edit; viewport 390×844, 320×740 (tanpa overflow horizontal) dan desktop 1280×900. Tidak menguji penyimpanan dari browser pada proyek nyata; penyimpanan diverifikasi melalui SQL/RLS dengan fixture rollback. TypeScript lulus.

Production build lulus setelah menggabungkan pembaruan dashboard terbaru (base 140219e). Ada satu peringatan lint lama di simulasi-view.tsx:80; tidak ada kegagalan build. Halaman preview data uji tidak disertakan ke produksi.

## Penyegaran tampilan ringkas

Tampilan kembali berupa timeline dengan lingkaran nomor dan garis penghubung, tanpa kartu tinggi pada tiap kegiatan. Tanggal rencana/realisasi dibuat sebaris jika ruang cukup; keterangan hanya muncul bila terisi. Edit/hapus berada di sisi kanan judul. Kontrol geser/naik/turun/Simpan/Batal ditampilkan saat admin membuka `Atur urutan`; Batal mengembalikan draft dan menutup mode tersebut. Tidak ada perubahan pada algoritme geser, aksi penyimpanan, data, izin, atau database.

Pemeriksaan: empat tes helper urutan, ESLint dan TypeScript lulus. Browser lokal pada data tiruan memverifikasi mode baca ringkas, masuk mode pengaturan, pindah dengan tombol dan drag pointer, pembatalan dan kembali ke mode baca; tampilan mitra tanpa kontrol perubahan. Lebar 320/390/1280 diperiksa, tanpa overflow horizontal pada 320. Halaman preview tidak disertakan ke produksi.

Build produksi akhir lulus tanpa halaman preview; satu peringatan lint lama simulasi-view.tsx:80 tetap ada.

## Kotak tanggal sejajar

Rencana dan Realisasi menggunakan dua kolom sama lebar/tinggi: kuning pudar untuk Rencana dan kuning lebih jelas untuk Realisasi. Label di atas tanggal; tanggal kosong menampilkan “Belum diisi”. Status mundur tetap memakai “Jadwal baru” dan tanggal rencana dicoret. Nomor serta garis timeline tetap satu sumbu. Hanya markup presentasi berubah, tanpa perubahan handler, data, hak akses, atau database.

Validasi: empat tes helper urutan dan lint lulus. Browser lokal data tiruan pada lebar 320/390/1280: kotak sejajar, tidak ada overflow horizontal pada 320/390, pindah dengan tombol dan Batal tetap bekerja. Preview lokal dihapus sebelum build produksi akhir.
