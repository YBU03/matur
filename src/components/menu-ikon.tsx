// Ikon garis untuk menu samping (24×24, stroke 1.75, ujung membulat) — satu gaya untuk semua menu.
// Ikon dipilih dari awalan alamat menu; menu baru tanpa padanan memakai monogram 2 huruf.

const P: Record<string, string> = {
  dashboard: "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z",
  pos: "M4 5h16v10H4zM8 19h8M12 15v4M7.5 9.5h3M13.5 9.5h3",
  antrean: "M5 6h14M5 12h14M5 18h9M18 16.5v3M16.5 18h3",
  stok: "M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10",
  gudang: "M3 10 12 4l9 6v10H3zM8 20v-6h8v6M8 17h8",
  kiriman: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0 .01M17.5 18.5a1.5 1.5 0 1 0 0 .01",
  pembelian: "M5 7h14l-1.5 9h-11zM9 7V5a3 3 0 0 1 6 0v2",
  mutasi: "M4 8h13l-3-3M20 16H7l3 3",
  outlet: "M4 9 6 4h12l2 5M4 9v11h16V9M4 9h16M9 20v-5h6v5",
  mitra: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M16 11a3 3 0 1 0 0-6M2.5 20a5.5 5.5 0 0 1 11 0M14 14.5a5.5 5.5 0 0 1 7.5 5.5",
  dokumen: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  proyek: "M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6",
  laporan: "M5 20V10M10 20V4M15 20v-7M20 20v-11",
  uang: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M6.5 10v4M17.5 10v4",
  catatan: "M4 4h16v16H4zM4 9h16M4 14h16M9 4v16",
  jadwal: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h2M14 14h2M8 17h2",
  absensi: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2",
  karyawan: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0",
  menu: "M6 3v8a2 2 0 0 0 4 0V3M8 11v10M16 3c-2 2-2 6 0 8v10",
  bahan: "M9 3h6M10 3v5l-5 10a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3M7.5 15h9",
  hpp: "M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h8",
  titipan: "M4 10h16v10H4zM3 6h18v4H3zM12 6v14M12 6c-2-3-5-3-5 0M12 6c2-3 5-3 5 0",
  setoran: "M12 3v12M7 10l5 5 5-5M4 19h16",
  persetujuan: "M9 12l2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18",
  pengaturan: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12",
  pengguna: "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M3 21a7 7 0 0 1 12.5-4.3M18 15v6M15 18h6",
  log: "M12 8v4l2.5 2.5M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8",
  simulasi: "M5 3h14v18H5zM8 7h8v3H8zM8 14h2M12 14h2M16 14v4M8 17h2M12 17h2",
  transfer: "M4 9h16M4 9l4-4M4 9l4 4M20 15H4M20 15l-4-4M20 15l-4 4",
  bep: "M4 20 10 13l4 3 6-9M15 7h5v5",
  profil: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 20a7 7 0 0 1 14 0",
  shift: "M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  supplier: "M3 17V7h11v10M14 11h4l3 3v3M3 17h18",
  maintenance: "M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z",
  qris: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18h2",
  struk: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  tutup: "M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5zM12 14v3",
  varian: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  kategori: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  permintaan: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h3M15.5 16.5l1.5 1.5 3-3",
  cari: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4",
  kasbon: "M3 8h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 8l12-4 1 4M16 14h.01",
};

// urutan penting: awalan lebih spesifik lebih dulu
const PETA: [string, keyof typeof P][] = [
  ["/dashboard-pos", "pos"], ["/dashboard", "dashboard"], ["/pantau-pos", "pos"], ["/portal/pos", "pos"], ["/pos", "pos"], ["/kasir", "pos"],
  ["/antrean", "antrean"], ["/operasional/kiriman", "kiriman"], ["/kasbon", "kasbon"], ["/stok-realtime", "stok"], ["/stok", "stok"],
  ["/gudang/kiriman", "kiriman"], ["/gudang/pembelian", "pembelian"], ["/gudang/mutasi", "mutasi"], ["/gudang", "gudang"],
  ["/master/outlet", "outlet"], ["/master/mitra", "mitra"], ["/master/perjanjian", "dokumen"], ["/master/karyawan", "karyawan"],
  ["/master/menu", "menu"], ["/master/kategori_menu", "kategori"], ["/master/varian", "varian"], ["/master/resep", "bahan"],
  ["/master/bahan", "bahan"], ["/master/supplier", "supplier"], ["/master/produsen_titipan", "titipan"], ["/master/biaya_outlet", "uang"],
  ["/portal/bep", "bep"], ["/portal/karyawan", "karyawan"], ["/portal/pembangunan", "proyek"], ["/proyek", "proyek"],
  ["/laporan-pos", "laporan"], ["/laporan", "laporan"], ["/catatan-harian", "catatan"], ["/tutup-buku", "tutup"],
  ["/hpp-menu", "hpp"], ["/rumus-hpp", "hpp"], ["/persediaan", "stok"], ["/titipan", "titipan"], ["/setoran", "setoran"],
  ["/jadwal", "jadwal"], ["/absensi", "absensi"], ["/slip", "uang"], ["/penggajian", "uang"], ["/profil-karyawan", "karyawan"],
  ["/persetujuan", "persetujuan"], ["/permintaan", "permintaan"], ["/pengaturan/maintenance", "maintenance"], ["/pengaturan/qris", "qris"],
  ["/pengaturan/struk", "struk"], ["/pengaturan", "pengaturan"], ["/pengguna", "pengguna"], ["/log", "log"], ["/simulasi", "simulasi"],
  ["/skema-bagi-hasil", "bep"], ["/transfer", "transfer"], ["/profil", "profil"], ["/shift", "shift"],
];

export function ikonUntuk(href: string): keyof typeof P | null {
  return PETA.find(([awal]) => href === awal || href.startsWith(awal + "/") || href.startsWith(awal + "?"))?.[1] ?? null;
}

const monogram = (label: string) =>
  label
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "•";

/** Ikon menu 20×20; fallback monogram bila belum ada padanan. */
export function IkonMenu({ href, label, nama, className = "" }: { href?: string; label: string; nama?: keyof typeof P; className?: string }) {
  const k = nama ?? (href ? ikonUntuk(href) : null);
  if (!k) {
    return (
      <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-md border border-current text-[9px] font-bold leading-none ${className}`}>
        {monogram(label)}
      </span>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d={P[k]} />
    </svg>
  );
}
