// Isi & susunan struk POS (format Ruma). Murni: dipakai cetak Bluetooth/aplikasi, PDF, dan tampilan layar.
import type { BarisStruk } from "./printer-bt";

export type StrukOutlet = {
  judul: string;
  alamat: string;
  telepon: string;
  instagram: string;
  wifi: string;
  tagline: string;
  hashtag: string;
  catatan: string;
  tampil_logo: boolean;
};

export const STRUK_BAWAAN: StrukOutlet = {
  judul: "RUMA",
  alamat: "",
  telepon: "",
  instagram: "di.rumakopi",
  wifi: "keluargaruma",
  tagline: "tempat ngopi, tempat pulang",
  hashtag: "#RUMAKOPI",
  catatan: "",
  tampil_logo: true,
};

export const KOLOM_STRUK = { "58": 32, "80": 48 } as const;

const LABEL_KANAL: Record<string, string> = {
  langsung: "Normal",
  gofood: "GoFood",
  grabfood: "GrabFood",
  shopeefood: "ShopeeFood",
  tiktok: "TikTok Go",
  ruma_app: "Ruma App",
  tumbler: "Tumbler",
};
const LABEL_METODE: Record<string, string> = { tunai: "Tunai", qris: "Qris", debit: "Debit/Kredit", transfer: "Transfer" };

/** 24000 → "24.000" (tanpa "Rp", seperti struk kasir). */
export const angkaStruk = (n: number) => Math.round(n).toLocaleString("id-ID").replace(/,/g, ".");

const bagianWib = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { dd: g("day"), mm: g("month"), yyyy: g("year"), jam: `${g("hour")}:${g("minute")}` };
};

/** "01/11/2026 08:33" (WIB) */
export const tanggalStruk = (d: Date) => {
  const b = bagianWib(d);
  return `${b.dd}/${b.mm}/${b.yyyy} ${b.jam}`;
};

/** Nomor order gaya kasir: POS-ddmmyy-nomor antrean (tanggal WIB). */
export const nomorOrder = (d: Date, nomor: number | string) => {
  const b = bagianWib(d);
  return `POS-${b.dd}${b.mm}${b.yyyy.slice(2)}-${nomor}`;
};

export type ItemStruk = { nama: string; qty: number; total: number };
export type BayarStruk = { metode: string; nominal: number; diterima?: number | null };

export type DataStruk = {
  struk: StrukOutlet;
  waktu: Date;
  /** nomor antrean, atau teks khusus (OFFLINE / TEST-…) */
  nomor: number | string;
  kanal: string;
  kasir: string;
  items: ItemStruk[];
  subtotal: number;
  diskon: number;
  total: number;
  bayar: BayarStruk[];
  kembalian: number;
  cetakUlang?: boolean;
  /** null/undefined = bukan void; string (boleh kosong) = transaksi dibatalkan */
  voidAlasan?: string | null;
  testing?: boolean;
};

const label = (k: string, v: string) => `${k.padEnd(13)}: ${v}`;

/** Susun baris struk sesuai format kasir Ruma (lihat docs/pos-struk-2026-11-02.md). */
export function susunBarisStruk(d: DataStruk, lebar: number): BarisStruk[] {
  const s = d.struk;
  const sama = "=".repeat(lebar);
  const garis = "-".repeat(lebar);
  const order = typeof d.nomor === "number" ? nomorOrder(d.waktu, d.nomor) : d.nomor;
  const out: BarisStruk[] = [];
  if (s.judul) out.push({ teks: s.judul, tengah: true });
  if (s.alamat) out.push({ teks: s.alamat, tengah: true });
  if (s.telepon) out.push({ teks: `Phone: ${s.telepon}`, tengah: true });
  out.push(sama);
  out.push(label("Date", tanggalStruk(d.waktu)));
  out.push(label("Order Number", order));
  out.push(label("Sales Type", LABEL_KANAL[d.kanal] ?? d.kanal));
  out.push(label("User", d.kasir));
  out.push(label("Cashier", d.kasir));
  out.push(sama);
  const tanda: string[] = [];
  if (d.testing) tanda.push("** TESTING - BUKAN TRANSAKSI **");
  if (d.voidAlasan != null) tanda.push("** VOID BILL **");
  else if (d.cetakUlang) tanda.push("** REPRINT BILL **");
  if (tanda.length) {
    for (const t of tanda) out.push({ teks: t, tengah: true, tebal: true });
    if (d.voidAlasan) out.push({ teks: `Alasan: ${d.voidAlasan}`, tengah: true });
    out.push(sama);
  }
  for (const it of d.items) {
    const harga = it.qty ? it.total / it.qty : it.total;
    out.push(it.nama);
    out.push({ teks: "", kiriKanan: [`${it.qty}x ${angkaStruk(harga)}`, angkaStruk(it.total)] });
  }
  out.push(garis);
  out.push(`Total Item ${d.items.reduce((n, i) => n + i.qty, 0)}`);
  out.push(garis);
  if (d.diskon > 0) {
    out.push({ teks: "", kiriKanan: ["Subtotal", angkaStruk(d.subtotal)] });
    out.push({ teks: "", kiriKanan: ["Diskon", `-${angkaStruk(d.diskon)}`] });
  }
  out.push({ teks: "", tebal: true, kiriKanan: ["Total", angkaStruk(d.total)] });
  out.push("Tender");
  for (const b of d.bayar) {
    const nilai = b.metode === "tunai" && b.diterima != null ? Number(b.diterima) : b.nominal;
    out.push({ teks: "", kiriKanan: [`  ${LABEL_METODE[b.metode] ?? b.metode}`, angkaStruk(nilai)] });
  }
  out.push({ teks: "", kiriKanan: ["Change", angkaStruk(Math.max(d.kembalian, 0))] });
  out.push(garis);
  if (s.instagram) out.push(`instagram: ${s.instagram}`);
  const kaki = [
    s.wifi ? `password wifi : ${s.wifi}` : "",
    s.tagline,
    s.hashtag,
    ...s.catatan.split(/\r?\n/),
  ].map((x) => x.trim()).filter(Boolean);
  if (kaki.length) {
    out.push("");
    for (const k of kaki) out.push({ teks: k, tengah: true });
  }
  return out;
}

/** Pembayaran dari data ringkas (struk baru tanpa rincian split). */
export function bayarDariMetode(metode: string, total: number, kembalian: number): BayarStruk[] {
  return [{ metode, nominal: total, diterima: metode === "tunai" ? total + kembalian : null }];
}
