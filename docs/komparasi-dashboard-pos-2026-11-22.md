# Komparasi — Dashboard POS (22 November 2026)

Tab **⚔️ Komparasi** di `/dashboard-pos` (Owner & Admin Pusat), di samping tab **📊 Ringkasan** yang tidak berubah. URL: `/dashboard-pos?tab=komparasi`.

## Mode
- **Antar outlet** (`km=outlet`): Outlet A (oranye) vs Outlet B (biru) pada periode yang sama (`p`, kustom `pd`/`ps`). Tombol ⇄ menukar. Hanya outlet yang tampil di Dashboard POS (`tampil_dashboard_pos`, mode asli, tidak dihapus) — outlet tersembunyi/nonaktif tidak bisa dipilih.
- **Antar periode** (`km=periode`): satu outlet (`a`), Periode A (`p`) vs Periode B (`pb`: "periode sebelumnya (panjang sama)" bawaan, atau periode/tanggal kustom `pbd`/`pbs`). Tren disejajarkan per "Hari ke-n".

## Isi
Hero A vs B (omzet, struk, rata-rata, 🏆 unggul omzet), kesimpulan otomatis, papan skor (omzet, jumlah struk, rata-rata per struk, item terjual, laba kotor = omzet − HPP, diskon & promo) dengan bar porsi A:B, selisih % dan pertumbuhan vs periode sebelumnya masing-masing; tren penjualan dua garis; kanal & kategori (batang berpasangan); jam ramai & sepi (struk per jam 06.00–02.00, label jam tersibuk/tersepi); menu terlaris qty & Rp (⭐ = sama-sama masuk 10 teratas) dan 5 menu kurang laku.

## Teknis
Hanya baca: RPC `ringkasan_penjualan` dipanggil per sisi (dan periode sebelumnya untuk pertumbuhan), sama dengan dashboard. Tanpa perubahan database. File: `src/app/(app)/dashboard-pos/komparasi.tsx` (server), `komparasi-filter.tsx`, `komparasi-view.tsx`, perhitungan murni `src/lib/komparasi.ts` (+ tes).
