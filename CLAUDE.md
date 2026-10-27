# Aturan kerja

- Setiap permintaan baru dari pemilik proyek: **diskusikan dulu** (usulan, pertanyaan, dampak) dan jangan mengubah kode aplikasi, database, atau migrasi.
- Baru eksekusi kode setelah pemilik proyek bilang **"gas"** (atau persetujuan yang sama jelasnya) untuk usulan tersebut.
- Komunikasi dalam Bahasa Indonesia dan beri laporan singkat di akhir setiap pekerjaan.
- Setelah "gas": kerjakan sampai tuntas (tes, commit, push) **dan langsung deploy ke produksi** (Vercel project `matoer`), pastikan deploy terakhir yang aktif adalah commit terbaru dan statusnya READY sebelum melapor.

# Peta project (ringkas — baca ini dulu, hindari menelusuri ulang)

**Matoer**: sistem coffeeshop terpadu CV. Hazna Berkah Indonesia (Ruma Kopi). Next.js 15 App Router + React 19 + Tailwind v4 + Supabase (project `qocejvxjfrmlpnejtcwh`). Produksi: matoer.id (Vercel project `matoer`, branch `ccr-2427af56-yvuskv`).

## Folder penting
- `src/app/(app)/` — dashboard admin/manajemen. `dashboard/` (Beranda per peran: `page.tsx`, `sales.tsx` = SalesDashboard/SalesView, `filters.tsx`, `omzet-hari-ini.tsx`), `dashboard-pos/` (POS lengkap Owner/Admin Pusat), `pantau-pos/` (Pemantau POS), `portal/` (Mitra), `gudang/`, `proyek/`, `laporan*/`, `pengaturan/`, `master/[tabel]` (master data generik).
- `src/app/karyawan/` — Ruang Karyawan (HP kasir/barista): absen, jadwal, izin, slip, profil (wajib lengkap → redirect ke `/karyawan/profil`).
- `src/app/kasir/` & `src/app/pos/` — aplikasi POS (tablet outlet, antrean, struk, kas shift).
- `src/lib/` — `roles.ts` (peran & menu), `session.ts` (getSession, peran aktif via cookie), `*-actions.ts` (server actions), `dashboard-navigation.ts`.
- `src/components/` — `ui-halaman.tsx` (HeaderHalaman, Kartu, KartuAngka, Badge, tabel), `charts.tsx`, `kartu-omzet.tsx`, `lipat-hp.tsx`, `lonceng*.tsx`, `app-shell.tsx`.
- `supabase/migrations/` — SQL (`00xx_nama.sql` dan bertimestamp). Akses data via RLS (`boleh_outlet`, `punya_peran`) & RPC security definer.

## Peran
owner, admin_pusat, finance, hrd, admin_gudang, manajer_area, spv, kasir, barista, mitra, pic, pemantau_pos, tablet (tersembunyi). Owner & Admin Pusat = `isAdminDashboardRole`.

## RPC penting
`ringkasan_penjualan`, `omzet_hari_ini`, `pantau_pos`/`pantau_pos_periode`, `buat_transaksi`, `kas_tertinggal`/`tutup_kas_otomatis`, `stok_realtime`, `profil_kurang`, `buat_pengguna`/`setujui_pengguna`.

## Cek & deploy
- Cek: `rm -rf .next; npx tsc --noEmit -p .; npx eslint src --quiet; npx vitest run --maxWorkers=1; npm run build`.
- Uji tampilan: halaman sementara `src/app/zz` + tambah `zz|` di matcher `src/middleware.ts`, dev port 3005, Playwright `executablePath: /opt/pw-browsers/chromium`. Hapus sebelum commit.
- Sandbox tidak bisa akses matoer.id/supabase.co langsung: DB lewat Supabase MCP, deploy lewat Vercel MCP (`create_deployment` gitSource ke SHA terbaru, target production), lalu pastikan deploy produksi terakhir = SHA terbaru & READY.
- Git: merge (bukan rebase/force). Hemat token: satu topik per sesi; baca potongan file, jangan ulang baca.

## POS aktif (26 Oktober 2026)

Login akun outlet langsung masuk POS lengkap. Atas permintaan pemilik, pengunci shift/absensi/PIC/perangkat tunggal/testing/presentasi sudah dilepas. Baca `docs/pos-login-langsung.md` sebelum menyentuh POS. Jangan mengaktifkan skema pengunci lama tanpa diskusi dan persetujuan baru. Histori dan login/kewenangan outlet tetap dijaga.

## Alur shift opsional yang disetujui (26 Oktober 2026)

Pemilik telah menyetujui alur baru, terpisah dari pengunci lama. Default semua outlet tetap langsung; switch **Alur Shift** per outlet tersedia untuk Owner/Admin Pusat/HRD/Admin Gudang sesuai kewenangan. Berlaku kas berikutnya; PIN bersama outlet, pemilihan staf terjadwal/pengganti, modal sekali, hitung fisik dan serah terima, laporan harian. Baca `docs/pos-alur-shift-opsional.md`. Jangan aktifkan otomatis atau menghapus riwayat pelatihan.

## Gudang (27 Oktober 2026)

Harga jual langsung di Stok Gudang; menu `/gudang/opname` dan `/gudang/laba-rugi`; template kiriman dengan empat kotak tanda tangan dan pengaturan kertas/NCR/tiga salinan. Baca `docs/gudang-revisi-2026-10-27.md`. HPP kiriman/pergerakan baru dibekukan; data lama tanpa HPP ditandai belum lengkap, jangan diganti harga sekarang. Opname hanya gudang dan finalisasi memeriksa snapshot stok. Draft POS/PIN sebelumnya tetap terpisah.
