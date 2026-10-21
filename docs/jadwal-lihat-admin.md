# Jadwal baca saja di Rekap Absensi

Halaman `/absensi/jadwal` untuk peran aktif Owner dan Admin Pusat. Owner membukanya melalui tab Jadwal Shift di Rekap Absensi. Admin Pusat mendapat menu Rekap Absensi; karena sebelumnya belum berhak membuka rekap detail absensi, `/absensi` mengarahkannya langsung ke jadwal baca saja. Rekap detail Owner/HRD/SPV dan fungsi pengelolaan HRD yang sudah ada dipertahankan.

- Harian: nama staf per shift, jam mulai/selesai WIB, termasuk penanda shift berakhir besok.
- Mingguan: Senin–Minggu, termasuk rentang lintas bulan.
- Bulanan: semua tanggal bulan terpilih beserta orang dan shift; tanggal kosong ditandai belum ada jadwal terbit.
- Pilih outlet, tanggal/bulan, periode sebelumnya/berikutnya dan kembali ke periode berjalan. Tidak ada tombol tambah/edit/hapus/terbitkan atau pemanggilan aksi perubahan.
- Query jadwal dibatasi `status=terbit` di server dan difilter ulang sebelum serialisasi, termasuk untuk Owner yang memang punya hak baca draft di tempat lain. Nama historis diambil hanya untuk ID pada jadwal terbit.
- Tidak ada penambahan hak edit atau perubahan RLS/migrasi; memakai hak SELECT jadwal terbit yang sudah ada. Peran lain tidak mendapat akses halaman baru.

Validasi: 16 tes unit mencakup peran/sesi, penolakan akun nonaktif, penyaringan draft, nama staf, minggu lintas bulan, bulan kabisat dan batas tahun. SQL `supabase/tests/jadwal_admin_baca.sql` lulus pada proyek terhubung: Admin dapat membaca jadwal terbit, draft tidak terlihat, update/delete tidak mengubah baris; seluruh fixture di-ROLLBACK.

ESLint pada berkas terkait, TypeScript, dan production build lulus. Build masih menampilkan satu peringatan lint lama di simulasi-view.tsx. Pemeriksaan browser lokal memakai data tiruan: Owner harian/mingguan, Admin Pusat pengalihan dari Rekap Absensi dan tampilan bulanan, perpindahan mode/periode; viewport mobile 390×844 dan desktop 1280×900. Tidak memakai akun atau kredensial produksi.
