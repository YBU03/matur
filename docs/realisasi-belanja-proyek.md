# Realisasi Belanja Proyek

Tab `Realisasi Belanja` di `/proyek/[id]?tab=belanja`. Owner/Admin Pusat mencatat dan mengoreksi nota; peran lain yang sudah berhak membaca proyek mendapat tampilan baca saja sesuai RLS proyek.

## Alur

1. Tambah Belanja: tanggal, toko/penerima, nomor nota opsional, penanggung jawab, catatan.
2. Pilih beberapa barang RAB lewat pencarian dan centang, atau tambah barang manual. Satu nota boleh campuran. Input kuantitas aktual (maksimal 3 desimal), satuan/kategori untuk manual, dan harga aktual per satuan. Nama/kategori/satuan barang RAB diverifikasi di server dan disalin sebagai snapshot, bukan dipercaya dari browser.
3. Opsional unggah JPG/PNG/WebP/PDF maksimal 5 MB. Server memeriksa jenis dan signature file. Bukti disimpan di bucket proyek privat dan dibuka lewat signed URL.
4. Opsional catat pembayaran awal. Nota juga bisa disimpan belum dibayar, lalu diberi pembayaran bertahap. Setiap pembayaran memiliki tanggal, nominal, sumber dana, metode tunai/transfer, referensi/catatan dan pencatat.
5. Konfirmasi ringkasan sebelum simpan. Pencarian dan filter status/rentang tanggal berlaku pada daftar nota; kartu ringkasan selalu seluruh proyek.

## Perhitungan

- Realisasi = baseline `item_rab.harga_realisasi` lama + total nota aktif. Baseline tidak ditimpa atau ditambah oleh transaksi baru.
- Realisasi per item RAB = baseline item + rincian nota aktif yang menunjuk ID item tersebut. Pembelian berulang dijumlahkan sekali. Grand Total RAB/qty/harga anggaran tidak berubah.
- Barang manual dan barang yang RAB-nya kemudian diarsipkan tetap masuk total realisasi; dilaporkan terpisah dari rincian anggaran RAB.
- Saldo dana tercatat = total setoran mitra − pembayaran bersumber `dana_proyek`. Talangan pusat dan pembayaran langsung mitra tidak dikurangkan lagi dari saldo pusat.
- Sisa tagihan = total nota aktif − seluruh pembayaran nota. Nilai belanja berbeda dari kas yang sudah dibayar. Pelunasan talangan bukan bagian fitur ini.
- Contoh: masuk 25 juta, nota 7 juta, pembayaran dana proyek 5 juta → realisasi 7 juta, saldo tercatat 20 juta, tagihan 2 juta.
- Jika ada baseline realisasi lama, UI dan PDF menandai pembayaran lamanya belum dirinci dan belum termasuk hitungan saldo. Jangan memasukkan nota lama ulang sebelum dicocokkan. Saat pemeriksaan proyek terhubung, baseline masih nol; tidak ada konversi/duplikasi data lama.

Daftar proyek, ringkasan Biaya & Dana, rincian RAB dan laporan PDF memakai realisasi terintegrasi. Excel RAB menampilkan realisasi terkini serta kolom `Realisasi Lama (untuk impor)`; parser menggunakan baseline tersebut untuk mencegah nominal nota masuk dua kali saat impor ulang. Nota manual tidak dimasukkan menjadi anggaran RAB baru.

## Koreksi dan batasan

- Edit nota mempertahankan pembayaran. Total tidak boleh lebih kecil dari nominal yang telah dibayar, dan tanggal nota tidak boleh melewati pembayaran yang sudah tercatat.
- Batalkan nota memerlukan alasan dan ketikan `BATALKAN`; hanya nota tanpa pembayaran yang boleh dibatalkan. Riwayat tetap ada. Pembayaran tercatat tidak dihapus atau dibalik secara otomatis; pengembalian dana/koreksi pembayaran memerlukan alur tersendiri.
- Ini pencatatan biaya dan pembayaran proyek, tidak mengeksekusi transfer bank, tidak membuat jurnal akuntansi umum, dan tidak mengubah stok gudang.

## Keamanan dan transaksi

Migrasi `20261022031736_belanja_proyek.sql` menambah tiga tabel publik dengan RLS SELECT sesuai proyek dan tanpa izin DML langsung bagi klien. Wrapper RPC publik SECURITY INVOKER memanggil fungsi terbatas di schema non-API `proyek_internal`; pemeriksaan auth.uid, akun aktif serta admin proyek dilakukan sebelum penulisan. Search path tetap, anon tidak memiliki EXECUTE. Logger internal tidak dapat dipanggil klien.

Nota, rincian dan pembayaran awal disimpan satu transaksi. UUID permintaan melindungi retry; penguncian nota dan versi updated_at menolak konflik serta pembayaran melebihi sisa tagihan. Audit log menyimpan perubahan. Kebijakan storage nota dibatasi folder belanja dan proyek, tanpa mengubah bucket menjadi publik. File baru yang gagal disimpan dibersihkan jika belum terikat nota.

## Validasi

- 21 tes relevan lulus: hitungan saldo/tagihan/sumber dana, pembelian berulang, baseline, manual/arsip, pembulatan kuantitas, impor Excel, total RAB; SQL PGlite meliputi rollback, ID lintas proyek, retry, edit, overpayment, versi, bukti nota, kuantitas, peran dan hak tabel.
- `supabase/tests/belanja_proyek.sql` lulus pada proyek terhubung dengan fixture ROLLBACK: nota campuran, pembayaran idempoten, baseline tetap, direct write ditolak, mitra hanya baca proyek sendiri, item/pembayaran/bukti tidak bocor lintas outlet.
- Advisor keamanan tidak menampilkan temuan baru terkait tabel/fungsi fitur ini; metadata mengonfirmasi hak fungsi/logger dan pembatasan anon.
- ESLint berkas terkait dan TypeScript lulus. Uji browser lokal menggunakan data tiruan pada lebar 320, 390 dan 1280: pilih RAB, tambah manual di nota sama, total dan konfirmasi, gagal simpan menjaga isian, pembayaran lanjutan/sumber talangan, filter status, serta tampilan baca saja. Tidak membuat transaksi produksi untuk tes UI.
- Halaman preview dan gambar QA hanya di folder kerja, tidak disertakan ke produksi. Bukti nota fisik dan transfer bank tidak diuji sebagai transaksi nyata.

Production build akhir lulus tanpa halaman preview. Peringatan lint lama di simulasi-view.tsx:80 tetap ada, tidak menggagalkan build.

## Ringkasan kas dan PDF realisasi

Kartu Biaya & Dana serta Realisasi Belanja menggunakan komponen yang sama, berurutan: Grand Total RAB, Dana Masuk Mitra, Realisasi Pembayaran (hanya sumber dana_proyek), Sisa Dana Aktual. Nilai pesanan, pembayaran seluruh sumber, dan sisa tagihan ditampilkan terpisah. Tidak menyamakan anggaran RAB dengan harga pesanan aktual.

Form nota baru membuka bagian pembayaran secara default, namun nominal wajib diisi secara eksplisit. Input harga barang adalah harga pesanan penuh; input DP/pembayaran adalah nominal yang sudah keluar. Pilihan belum dibayar tetap tersedia. Catatan pembayaran awal membedakan DP/sebagian dan lunas. RPC transaksi, validasi server, RLS, serta batas tidak boleh lebih bayar tetap digunakan tanpa perubahan.

Download PDF Realisasi tersedia di kedua tab untuk pembaca proyek sesuai akses yang sudah berlaku. PDF mencakup seluruh proyek, terlepas dari filter daftar: ringkasan dana, setoran mitra, rincian barang per nota, penanggung jawab/pencatat, DP/pelunasan per tanggal/sumber/metode, serta sisa tagihan. Nota batal ditandai dan tidak masuk total aktif; realisasi lama tanpa rincian pembayaran diberi peringatan. Tidak mengekspor signed URL atau berkas bukti privat. Pembuatan PDF memakai impor dinamis jsPDF yang sudah tersedia; ada status loading, tombol nonaktif saat proses, pesan gagal, tabel berlanjut dan nomor halaman.

Validasi pembaruan: seluruh 213 tes dari 34 berkas lulus, termasuk tiga tes baru DP/pelunasan serta PDF kosong/multihalaman. ESLint seluruh src tanpa error dan TypeScript lulus. PDF lima halaman data tiruan dirender dan diperiksa, termasuk teks panjang, tabel lanjutan dan footer. Browser lokal memverifikasi unduh PDF sungguhan, konfirmasi pesanan Rp3.250.000 dengan DP Rp1.491.750, opsi belum dibayar, tampilan 320/390/1280 tanpa overflow di mobile dan akses baca mitra tanpa tombol tambah. Tidak ada penulisan data proyek nyata dari browser. Preview dihapus sebelum build akhir.

## Status pembayaran langsung pada nota

Admin memakai tombol `Sudah Dibayar` untuk mengonfirmasi tanggal, nominal, sumber dan metode sekali, lalu status/saldo diperbarui setelah server berhasil menyimpan. Jika masih ada sisa, tersedia pembayaran berikutnya. Status diturunkan dari pembayaran aktif: Belum dibayar, Dibayar Sebagian (DP), atau Lunas. Tidak ada toggle boolean yang melewati buku pembayaran.

`Ubah ke Belum Dibayar` mengoreksi seluruh pembayaran aktif dengan alasan wajib; koreksi satu pembayaran tersedia dalam riwayat. Ini koreksi pencatatan, bukan pengembalian dana. Riwayat tetap disimpan, termasuk waktu, alasan dan nama pengoreksi. RPC mengunci nota, memeriksa versi, admin aktif, proyek/nota serta pembayaran yang sama; pengiriman ulang idempoten. Mengoreksi catatan tidak dapat menghidupkan ulang ID pembayaran lama; pembayaran pengganti memakai ID baru. Saldo, validasi lebih bayar dan batas minimum total nota hanya memakai pembayaran aktif. Tidak menambah hak tulis langsung ke tabel.

Kolom `nota_dp` menandai nota yang hanya mencantumkan nilai DP ketika harga penuh pesanan belum tersedia. Nota tersebut tidak dianggap lunas meskipun nilai DP sudah terbayar seluruhnya. Ringkasan dan PDF menjelaskan bahwa sisa pelunasan pesanan belum diketahui, tanpa mengganti harga aktual dengan estimasi RAB. Gunakan `Lengkapi total pesanan`, ubah harga barang menjadi harga penuh dan nonaktifkan tanda nota DP sebelum mencatat pelunasan berikutnya. Saldo kas tetap memakai DP aktual yang dibayar.

Migrasi `20261024022630_belanja_status_pembayaran.sql` menambah metadata nota DP dan koreksi, mengganti penjumlahan pembayaran pada RPC agar mengabaikan catatan yang dikoreksi, serta menambah wrapper SECURITY INVOKER untuk koreksi dengan implementasi terjaga di schema internal. RLS dan ACL tetap. SQL fixture `supabase/tests/belanja_status_pembayaran.sql` memeriksa akses lintas outlet, mitra ditolak, koreksi satu/seluruh pembayaran, idempotensi dan perhitungan aktif; seluruh fixture ROLLBACK. Advisor keamanan tidak memiliki temuan baru dibanding baseline.

Validasi status pembayaran: 221 tes/34 berkas lulus (hook timeout 60 detik untuk inisialisasi PGlite pada komputer terbatas). Lint seluruh src dan TypeScript lulus. Browser data uji memeriksa tombol Sudah Dibayar, input nominal/metode dan dampak saldo, koreksi dengan alasan wajib, penolakan tanpa sesi yang menjaga isian, PDF unduhan dan akses mitra tanpa kontrol mutasi. Lebar 320/390/1280 diperiksa; PDF dua halaman dirender dan dibaca. Preview dihapus sebelum build produksi akhir. Tidak mengirim pembayaran bank dari aplikasi; tombol hanya mencatat pembayaran yang sudah dilakukan.
