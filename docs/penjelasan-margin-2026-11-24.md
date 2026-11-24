# Penjelasan pembulatan margin

Angka margin dua desimal menjadi pembulatan tampilan, bukan dasar menghitung laba. Di /laporan/rekap, margin bulanan dan total dapat dibuka untuk melihat omzet/laba asli, margin rinci (hingga 12 desimal, diberi tanda perkiraan), persentase tampilan dua desimal, hitung balik omzet × margin tampilan, dan selisih hitung balik − laba asli. Nilai diagnosis rupiah ditampilkan dua desimal; nominal sumber tetap presisi seperti laporan.

Contoh September: omzet84.802.594, laba28.441.821, margin33,5388573137…%, tampilan33,54%, hitung balik28.442.790,0276, selisih+969,0276. Tidak membuat jurnal, penyesuaian pembayaran, atau mengubah sumber. Selisih negatif tetap negatif. Omzet nol menghasilkan margin/hitung balik/selisih tidak terdefinisi, bukan angka nol palsu. Margin pembulatan memakai Intl yang sama dengan persenLaba, termasuk midpoint negatif.

Ekspor rekap: Excel menambah lembar Pembulatan margin (nilai numerik asli, persen rinci dan tampilan terpisah); PDF menambah bagian penjelasan yang sama dengan disclaimer. Total berasal dari total laba/total omzet dan pembulatan margin totalnya sendiri, bukan rata-rata persentase atau jumlah selisih bulanan. PDF bulanan Oktober dan sumber Excel lama tidak diubah.

Verifikasi: uji contoh September, rugi/selisih negatif, omzet nol, pengamanan nilai asli Excel, rendering komponen, serta PDF rekap aktual Juni–Oktober. Tidak ada perubahan database.
