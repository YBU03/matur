// Ekspor Catatan Harian ke Excel dengan susunan persis sheet "Transaksi" file inputan harian Ruma:
// A Tanggal · B–C Keterangan · D–K Penjualan · L–AA Pengeluaran · AB Penjualan · AC Pengeluaran.
// Angka penjualan memakai nilai akhir (POS / dashboard platform + koreksi).
import { nilaiHari, type KanalHarian, type Manual } from "@/lib/harian";
import type { Biaya, Hari, ProdukKeluar } from "./catatan-view";

type Kat = { id: string; nama: string; grup: string; urutan: number };

const JUAL: [KanalHarian, string][] = [
  ["tunai", "Tunai"],
  ["non_tunai", "Non Tunai"],
  ["gofood", "Go Food"],
  ["grabfood", "Grab Food"],
  ["tiktok", "Tiktok Go"],
  ["ruma_app", "Ruma App"],
  ["shopeefood", "Shopee Food"],
  ["diskon", "Discount"],
];
// kolom pengeluaran Ruma + kata kunci untuk mencocokkan nama kategori biaya di Matoer
const KELUAR: [string, RegExp][] = [
  ["Es Kristal", /es kristal|es batu/],
  ["Bahan Baku", /bahan baku|dessert|snack|titip/],
  ["Biaya Galon", /galon/],
  ["Sewa Outlet", /sewa/],
  ["Listrik", /listrik|pln|token/],
  ["Internet", /internet|wifi|indihome/],
  ["Air", /^(biaya )?air|pdam/],
  ["Maintenance", /maintenance|servis|service/],
  ["B. Gaji", /gaji|upah|lembur/],
  ["Biaya Perlengkapan", /perlengkapan/],
  ["Biaya Pemeliharaan Lingkungan", /lingkungan|kebersihan|sampah|keamanan/],
  ["Biaya Lain-lain", /lain/],
  ["Reimburse", /reimburse/],
  ["Sedekah", /sedekah|donasi|infaq|zakat/],
  ["Distribusi", /distribusi|ongkir|kirim/],
  ["Marketing", /marketing|promosi|iklan|endorse|influencer/],
];
const KOL_JUAL = 4; // D
const KOL_KELUAR = KOL_JUAL + JUAL.length; // L
const KOL_AB = KOL_KELUAR + KELUAR.length; // AB
const LEBAR = KOL_AB + 1; // AC
const HIJAU = "FFC5E0B3";
const RP = '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)';
const LAIN = KELUAR.findIndex(([n]) => n === "Biaya Lain-lain");

/** Indeks kolom pengeluaran (0-based dalam KELUAR) untuk sebuah nama kategori. */
export function kolomKategori(nama: string) {
  const n = nama.toLowerCase().trim();
  const i = KELUAR.findIndex(([, re]) => re.test(n));
  return i < 0 ? LAIN : i;
}

const huruf = (c: number) => {
  let s = "";
  for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export async function eksporExcel(outlet: string, bulan: string, hari: Hari[], manual: Manual[], biaya: Biaya[], kategori: Kat[], produk: ProdukKeluar[]) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  const ws = wb.addWorksheet("Transaksi");
  const namaKat = new Map(kategori.map((k) => [k.id, k.nama]));
  const judul = new Date(`${bulan}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  ws.getCell("D1").value = `LAPORAN OUTLET ${outlet.toUpperCase()}`;
  ws.getCell("D1").font = { bold: true, size: 14 };
  ws.getCell("D2").value = `Per ${judul}`;
  ws.getCell("D2").font = { bold: true };

  // header 3 baris (4–6)
  const kotak = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;
  const sel = (r: number, c: number, v: string) => {
    const x = ws.getCell(r, c);
    x.value = v;
    x.font = { bold: true };
    x.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIJAU } };
    x.border = kotak;
  };
  for (let r = 4; r <= 6; r++) for (let c = 1; c <= LEBAR; c++) sel(r, c, "");
  sel(4, 1, "Tanggal");
  ws.mergeCells(4, 1, 6, 1);
  sel(4, 2, "Keterangan");
  ws.mergeCells(4, 2, 6, 3);
  sel(4, KOL_JUAL, "Penjualan");
  ws.mergeCells(4, KOL_JUAL, 5, KOL_KELUAR - 1);
  JUAL.forEach(([, l], i) => sel(6, KOL_JUAL + i, l));
  sel(4, KOL_KELUAR, "Pengeluaran");
  ws.mergeCells(4, KOL_KELUAR, 5, KOL_AB - 1);
  KELUAR.forEach(([l], i) => sel(6, KOL_KELUAR + i, l));
  sel(4, KOL_AB, "Total");
  ws.mergeCells(4, KOL_AB, 5, LEBAR);
  sel(6, KOL_AB, "Penjualan");
  sel(6, LEBAR, "Pengeluaran");

  const tanggal = [...new Set([...hari.map((h) => h.tanggal), ...manual.map((m) => m.tanggal), ...biaya.map((b) => b.tanggal), ...produk.map((p) => p.tanggal)])].sort();
  const awal = 7;
  let r = awal;
  for (const t of tanggal) {
    const h = hari.find((x) => x.tanggal === t);
    const v = nilaiHari(h ?? { tanggal: t }, manual);
    const items = biaya.filter((b) => b.tanggal === t);
    const prod = produk.filter((p) => p.tanggal === t);
    const jual = JUAL.map(([k]) => v[k].akhir);
    // tumbler tidak punya kolom di format Ruma → digabung ke Non Tunai
    jual[1] += v.tumbler.akhir;
    if (!jual.some(Boolean) && !items.length && !prod.length) continue;

    // baris tanggal
    const barisTgl = r;
    ws.getCell(r, 1).value = new Date(`${t}T00:00:00Z`);
    ws.getCell(r, 2).value = h && h.shift > 1 ? `${h.shift} Shift` : "Full Shift";
    jual.forEach((n, i) => (ws.getCell(r, KOL_JUAL + i).value = n || null));
    ws.getRow(r).font = { bold: true };
    r++;

    // item pengeluaran, dikelompokkan per kategori (judul grup di kolom B)
    const perKat = new Map<string, Biaya[]>();
    for (const b of items) perKat.set(b.kategori_id, [...(perKat.get(b.kategori_id) ?? []), b]);
    for (const [kid, list] of perKat) {
      const nama = namaKat.get(kid) ?? "Lain-lain";
      const kol = KOL_KELUAR + kolomKategori(nama);
      if (list.length > 1) {
        ws.getCell(r, 2).value = nama;
        ws.getCell(r, 2).font = { italic: true, bold: true };
        r++;
      }
      for (const b of list) {
        ws.getCell(r, 3).value = `${b.keterangan || nama}${b.sumber === "pusat" ? " (pusat)" : ""}`;
        ws.getCell(r, kol).value = Number(b.jumlah);
        r++;
      }
    }
    // produk marketing (barter endorse/sampel): bukan uang keluar — biayanya sudah masuk HPP lewat stok yang terpotong,
    // jadi hanya dicatat sebagai keterangan (nilai HPP disebut) agar tidak terhitung dua kali.
    for (const p of prod) {
      const isi = p.items.map((i) => `${i.qty}x ${i.nama}`).join(", ");
      ws.getCell(r, 3).value = `Produk ${p.jenis.replace("_", " ")}${p.penerima ? ` – ${p.penerima}` : ""}: ${isi} (HPP Rp ${Number(p.total_hpp).toLocaleString("id-ID")})`;
      ws.getCell(r, 3).font = { italic: true, color: { argb: "FF7C3AED" } };
      r++;
    }
    // ringkasan hari di baris tanggal
    const akhir = r - 1;
    ws.getCell(barisTgl, KOL_AB).value = { formula: `SUM(${huruf(KOL_JUAL)}${barisTgl}:${huruf(KOL_KELUAR - 2)}${barisTgl})-${huruf(KOL_KELUAR - 1)}${barisTgl}` };
    ws.getCell(barisTgl, LEBAR).value = { formula: `SUM(${huruf(KOL_KELUAR)}${barisTgl}:${huruf(KOL_AB - 1)}${akhir})` };
  }

  // baris total
  const tot = r + 1;
  ws.getCell(tot, 1).value = "Total";
  for (let c = KOL_JUAL; c <= LEBAR; c++) ws.getCell(tot, c).value = { formula: `SUM(${huruf(c)}${awal}:${huruf(c)}${r})` };
  for (let c = 1; c <= LEBAR; c++) {
    const x = ws.getCell(tot, c);
    x.font = { bold: true };
    x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIJAU } };
    x.border = kotak;
  }
  ws.getCell(tot + 2, 2).value = "Laba kotor (Penjualan − Pengeluaran)";
  ws.getCell(tot + 2, KOL_AB).value = { formula: `${huruf(KOL_AB)}${tot}-${huruf(LEBAR)}${tot}` };
  ws.getRow(tot + 2).font = { bold: true };

  ws.getColumn(1).numFmt = "dd mmmm yyyy";
  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 38;
  for (let c = KOL_JUAL; c <= LEBAR; c++) {
    ws.getColumn(c).width = 15;
    for (let i = awal; i <= tot + 2; i++) ws.getCell(i, c).numFmt = RP;
  }
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 6 }];

  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Laporan Harian ${outlet} ${bulan}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
