# POS di HP: keranjang mengambang — 1 November 2026

Hanya tampilan (`src/app/kasir/(terminal)/pos/pos-screen.tsx`, `layout.tsx`, `terminal-nav.tsx`, `globals.css`). Mesin transaksi, QRIS, SPV, draft, struk tidak berubah.

- Layar < `lg` (HP/tablet tegak): saat keranjang berisi, muncul bar bawah "🛒 n item · total · Lihat & Bayar". Ketuk → keranjang (elemen `aside` yang sama) tampil sebagai lembar bawah; bagian Simpan draft + Bayar menempel di bawah (sticky). Keranjang kosong → lembar tertutup otomatis.
- Layar `lg`+ (tablet mendatar/laptop): tetap dua kolom seperti sebelumnya.
- Kategori & kanal satu baris geser di HP; kotak cari dengan ikon; kartu menu 4:3 di HP; tombol jumlah lebih besar.
- Header POS ringkas: nama outlet di bawah "Matoer POS", menu Kasir/Antrean/Riwayat/Kas/Stok baris kedua di HP.
