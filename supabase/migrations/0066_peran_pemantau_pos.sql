-- Peran baru: Pemantau POS — hanya melihat dashboard omzet/penjualan POS (tanpa HPP, laba, stok, gaji).
alter type peran add value if not exists 'pemantau_pos';
