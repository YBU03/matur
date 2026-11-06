# Menu samping & hamburger — 6 November 2026

- `src/components/sidebar-ctx.tsx`: `SidebarCtx` (mode `ringkas` = rel ikon desktop, `hp` = laci HP), `SidebarKepala` (logo + tombol panel lipat/buka atau ✕ di HP, tinggi tetap 64 px), `SidebarProfil`, `SidebarBawah` (disembunyikan di rel), ikon `IkonHamburger`/`IkonPanel` (kisi 24 px).
- `AppShell`: sidebar desktop lebar 256 px ↔ rel 76 px dengan transisi lebar (mati bila prefers-reduced-motion), pilihan tersimpan `matoer:sidebar-collapsed`. Anak flex dikunci `[&>*]:shrink-0` agar kepala tidak terjepit pada menu panjang. Tombol "☰ Menu" teks di atas konten dihapus.
- `SideNav`: ikon garis per menu (`src/components/menu-ikon.tsx`, peta awalan href → ikon; menu baru tanpa padanan memakai monogram). Mode rel: ikon 44 px, pemisah grup, label melayang (fixed) saat hover/fokus, tombol cari membuka menu lalu fokus ke pencarian.
- Isi menu, peran, izin, dan POS tidak berubah.
