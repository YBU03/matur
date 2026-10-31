# Pengguna Matoer: tabel dan editor

Tabel bernuansa krem/oranye menggantikan kartu. Dropdown Kelompokkan menyediakan Peran, Outlet, Tanpa kelompok; kelompok dapat dilipat. Akun dengan beberapa penugasan tetap satu baris. Pencarian serta filter status/peran/outlet dapat digabungkan. Pagination 15 akun.

Klik nama, peran, outlet, atau status membuka editor dengan Simpan/Batal. Pada HP kolom disederhanakan dan editor muncul dari bawah. Pembuatan akun, persetujuan, reset sandi/PIN, aktivasi, serta hapus tunggal/massal dengan dua konfirmasi ketik tetap tersedia.

Kewenangan mengikuti RLS lama: Owner dapat mengatur akses, HRD/Gudang mengatur staf. Admin Pusat membaca penugasan dan mengedit profil sesuai izin yang sudah ada. RPC SECURITY INVOKER menjaga id penugasan, memeriksa snapshot, mencegah duplikat, dan melakukan penggantian atomik dengan audit INSERT/DELETE. Tidak membuka izin global baru.

Validasi: 326 tes pada 50 file lolos, TypeScript/lint/build lolos (peringatan lint lama pada simulasi). Fixture SQL authenticated menguji peran, stale edit, duplikat termasuk outlet NULL, larangan self-edit, dan rollback saat izin ditolak; seluruh fixture di-rollback. Browser diuji dengan data contoh desktop dan HP 390x844: grouping, editor, lipat kelompok, checkbox massal dan tanpa overflow horizontal. Tidak mengubah akun asli saat pengujian.

Versi kartu lama tersimpan di Git commit 05a8a7d045ffb5885885c07b2a34b0b7fd91ec9e. Pemulihan tampilan dapat mengembalikan user-admin.tsx ke versi tersebut; komponen/RPC tambahan boleh tetap ada karena tidak digunakan tampilan lama. Tidak perlu mengembalikan data pengguna.
