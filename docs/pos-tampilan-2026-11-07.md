# POS tampilan & ketahanan (7 November 2026)

Hanya tampilan — tidak mengubah data, transaksi, kategori, foto menu, atau alur bayar.

- Kartu menu ringkas: strip warna + ikon per kategori (warna dari urutan kategori, ikon dari nama), nama & harga lebih jelas, 4–6 kolom di tablet. Foto tetap tampil bila ada. Kartu yang ada di keranjang diberi bingkai.
- Bar kategori satu baris bisa digeser, dengan ikon & jumlah menu. Kategori ganda (Non-Kopi/Non-Coffee) sengaja dibiarkan.
- Panel keranjang: kanal 4 kolom ringkas, Dine-in/Take away segmen, label "Pesanan · N item", Total besar, tombol metode berikon, tombol Bayar menempel di bawah (panel bisa digulir di tablet).
- Tab atas POS berikon (`terminal-nav.tsx`, ikon dari `menu-ikon.tsx`).
- Kartu "Hari ini · N trx · Rp" (`components/omzet-kasir.tsx`, action `lib/omzet-kasir-actions.ts`): transaksi lunas hari operasional ini, sama dengan ringkasan Riwayat; diperbarui tiap menit, saat layar kembali aktif, dan setelah transaksi. Terlihat semua staf.
- A1: `kasir/error.tsx` & `kasir/(terminal)/error.tsx` → layar "Koneksi lambat" + Coba lagi / Muat ulang (`components/layar-koneksi-lambat.tsx`).
- A2: `/dashboard` tanpa sesi → `redirect("/login")` (tanpa peran → /pilih-peran atau /menunggu), tidak lagi crash.
