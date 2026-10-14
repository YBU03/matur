// QRIS (standar EMVCo MPM). QRIS statis dari bank/penyedia bisa diubah menjadi QRIS dinamis berisi nominal:
// tag 01 "11" (statis) → "12" (dinamis), sisipkan tag 54 (nominal) sebelum tag 58, lalu hitung ulang CRC (tag 63).
// Pelanggan cukup scan tanpa mengetik nominal. Murni & diuji.

export type Tlv = { tag: string; nilai: string };

/** CRC-16/CCITT-FALSE (poly 0x1021, awal 0xFFFF), 4 digit hex kapital. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseTlv(s: string): Tlv[] {
  const out: Tlv[] = [];
  let i = 0;
  while (i < s.length) {
    const tag = s.slice(i, i + 2);
    const pj = Number(s.slice(i + 2, i + 4));
    if (tag.length < 2 || !Number.isInteger(pj) || i + 4 + pj > s.length) throw new Error("Format QRIS tidak valid");
    out.push({ tag, nilai: s.slice(i + 4, i + 4 + pj) });
    i += 4 + pj;
  }
  return out;
}
const susun = (t: Tlv[]) => t.map((x) => x.tag + String(x.nilai.length).padStart(2, "0") + x.nilai).join("");

export type InfoQris = { valid: boolean; dinamis: boolean; merchant: string | null; kota: string | null; nmid: string | null; alasan?: string };

/** Periksa payload QRIS: diawali 000201, CRC cocok, berisi nama merchant. */
export function cekQris(payload: string): InfoQris {
  const p = payload.trim();
  try {
    if (!p.startsWith("000201")) return { valid: false, dinamis: false, merchant: null, kota: null, nmid: null, alasan: "Bukan kode QRIS" };
    const t = parseTlv(p);
    const crc = t.find((x) => x.tag === "63");
    if (!crc || t[t.length - 1].tag !== "63") return { valid: false, dinamis: false, merchant: null, kota: null, nmid: null, alasan: "CRC tidak ada" };
    if (crc16(p.slice(0, -4)) !== crc.nilai.toUpperCase()) return { valid: false, dinamis: false, merchant: null, kota: null, nmid: null, alasan: "CRC tidak cocok" };
    const nmid = t.find((x) => x.tag === "51")?.nilai;
    let id: string | null = null;
    if (nmid) {
      try {
        id = parseTlv(nmid).find((x) => x.tag === "02")?.nilai ?? null;
      } catch {
        id = null;
      }
    }
    return { valid: true, dinamis: t.find((x) => x.tag === "01")?.nilai === "12", merchant: t.find((x) => x.tag === "59")?.nilai ?? null, kota: t.find((x) => x.tag === "60")?.nilai ?? null, nmid: id };
  } catch (e) {
    return { valid: false, dinamis: false, merchant: null, kota: null, nmid: null, alasan: (e as Error).message };
  }
}

/** QRIS statis → QRIS dinamis dengan nominal (rupiah bulat). */
export function qrisDinamis(payload: string, nominal: number): string {
  const n = Math.round(nominal);
  if (!(n > 0)) throw new Error("Nominal harus lebih dari 0");
  const info = cekQris(payload);
  if (!info.valid) throw new Error(info.alasan ?? "QRIS tidak valid");
  const t = parseTlv(payload.trim()).filter((x) => x.tag !== "63" && x.tag !== "54");
  const satu = t.find((x) => x.tag === "01");
  if (satu) satu.nilai = "12";
  const i58 = t.findIndex((x) => x.tag === "58");
  t.splice(i58 >= 0 ? i58 : t.length, 0, { tag: "54", nilai: String(n) });
  const isi = susun(t) + "6304";
  return isi + crc16(isi);
}
