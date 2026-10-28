# Editor dokumen Gudang — 28 Oktober 2026

## Alur penggunaan

1. Buat kiriman dan tambahkan barang menggunakan alur Gudang yang sudah ada.
2. Pada riwayat kiriman, buka menu **⋮** lalu **Edit Invoice** / **Edit Surat Jalan**. Tautan Edit Dokumen juga ada pada detail penerimaan.
3. Lengkapi nomor telepon Gudang, catatan dan (invoice) jatuh tempo, tujuan tagihan, diskon/pajak rupiah per baris. Diskon mengurangi nilai satu baris, bukan per unit; pajak menambah nilai satu baris.
4. **Simpan Draft** menyimpan isian tanpa mengubah versi terbit sebelumnya. **Pratinjau Dokumen** menyimpan draft, meminta isian tanda tangan seperti fitur yang sudah ada, lalu membuka PDF. Download dan Cetak memakai berkas PDF yang sama persis dengan pratinjau. Cetak membuka penampil PDF browser (ikon printer di penampil), tidak memakai stylesheet cetak struk POS.
5. **Terbitkan Revisi** memakai pop-up konfirmasi. Versi tersebut dipakai pada dokumen utama dan laporan. Draft sebelum diterbitkan diberi keterangan DRAFT DOKUMEN. Setelah terbit, pratinjau dengan isian yang sama memakai versi terbit; edit berikutnya menjadi draft baru.
6. Riwayat revisi menampilkan versi, tindakan dan waktu. Database juga menyimpan pengguna pelaku dan salinan isian pada setiap versi.

## Identitas dan kontak

- Nomor awal Gudang **62 856-9786-5737**, dapat diedit pada Pengaturan Dokumen bersama logo/alamat/judul tanda tangan secara atomik, atau disesuaikan pada dokumen tertentu.
- Menu **Kontak Outlet**: tambah/edit nama, alamat dan nomor telepon. Outlet baru berstatus pembangunan; tidak membuat akun POS. Perubahan master profil memakai versi agar tidak menimpa perubahan bersamaan.
- Invoice menampilkan **Kirim ke** (outlet penerima stok) dan **Tagih ke** terpisah. Tujuan tagihan bisa sama dengan penerima, outlet lain pada dropdown, atau diisi manual nama/alamat/telepon. Tujuan tagihan tidak mengubah stok tujuan.
- Invoice dan surat jalan mencetak nomor Gudang serta nomor outlet. Identitas disalin ke dokumen; perubahan nama/alamat/logo/telepon master tidak otomatis mengubah dokumen tersimpan. Checkbox Ambil ulang identitas mengambil master terbaru secara eksplisit.
- Logo historis pada bucket privat tetap bisa dibaca oleh staf aktif melalui endpoint autentikasi, agar dokumen lama tetap bisa dicetak. Tidak menerima URL gambar eksternal.

## Hitungan dan laporan

Urutan tabel: No, SKU, Produk, Qty, Satuan, Harga, Diskon, Pajak, **Jumlah** paling kanan.

Jumlah per baris = pembulatan(qty × harga) − diskon rupiah + pajak rupiah.
Total invoice = subtotal barang − total diskon + total pajak + penyesuaian yang sudah ada.

Diskon/pajak wajib rupiah bulat nonnegatif; diskon maksimal nilai baris; total invoice tidak boleh negatif. Penyesuaian invoice lama ikut diperiksa terhadap nilai setelah diskon/pajak. Tidak menganggap penerimaan barang sebagai pelunasan; pencatatan pembayaran tidak ditambah pada revisi ini.

Laporan Gudang/Excel/PDF memasukkan diskon dan pajak dari versi invoice terbit sekali per invoice pada periode penerimaan selesai. Pajak ditunjukkan terpisah dan bukan laba. Diskon mengurangi laba; HPP/stok tidak berubah. Filter bahan tidak mengalokasikan diskon/pajak tingkat invoice. Arsip tidak menghapus angka laporan.

Jika harga/jumlah barang berubah sesudah versi dokumen tersimpan, invoice harus diperiksa/disimpan/diterbitkan ulang. PDF menolak nilai yang tidak lagi sesuai. Laporan menandai perlu ditinjau dan tidak mengasumsikan diskon/pajak yang tidak cocok masih sah. Penerimaan sebagian dapat menyebabkan kebutuhan revisi ini; transaksi stok tetap berjalan melalui alur penerimaan yang ada.

## Hapus / arsip

Menu ⋮ menyediakan hapus per jenis dokumen. Pop-up **Yakin ingin menghapus dokumen ini?** memakai **Batal / Ya, Hapus**, tanpa mengetik. Dokumen dipindahkan ke **Arsip Dokumen**, dapat dipulihkan. Edit/cetak dokumen diarsipkan ditolak sampai dipulihkan.

Tidak mengubah status/deleted_at kiriman, penerimaan, stok atau total barang; pembatalan kiriman tetap tindakan terpisah. Audit revisi dan versi terbit tetap disimpan.

## Verifikasi

- 274 tes dalam 42 file lolos; TypeScript, lint dan build produksi lolos. Build lokal memakai batas heap 1280 MB karena 768 MB tidak cukup; pengaturan sementara tidak di-commit.
- Tes SQL lokal mencakup draft/terbit, kontak tagihan manual, diskon/pajak, konflik versi, batas nilai, identitas tetap, penerimaan berubah, arsip/pulih dan akses Admin Gudang.
- Fixture Supabase dengan role authenticated dan penerimaan asli lolos. Semua data percobaan ROLLBACK. Tidak ada temuan keamanan baru; indeks FK audit yang baru belum digunakan.
- Invoice dan surat jalan dengan kontak, jatuh tempo dan diskon/pajak dirender dengan Poppler; batas teks dan gambar diperiksa. A4, continuous/NCR/tiga salinan tetap memakai pengaturan sebelumnya.
- Browser UI lokal tidak dapat diperiksa: pemilihan tab uji ditolak kebijakan akses URL browser. Tidak diakali; verifikasi menggunakan tes dan hasil render PDF. Halaman/aset pratinjau sementara dan perubahan middleware telah dibersihkan.
- Cetak fisik perlu dicocokkan dengan ukuran kertas/printer.
