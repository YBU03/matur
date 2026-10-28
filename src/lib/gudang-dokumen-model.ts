import type { Kiriman, ItemKiriman } from "./kiriman";
import type { Kop } from "./pdf-kop";
export type JenisDokumen = "invoice" | "surat-jalan";
export type KontakDokumen = {
  nama: string;
  alamat: string | null;
  telepon: string | null;
};
export type IsiDokumen = {
  jatuh_tempo: string | null;
  catatan: string;
  telepon_gudang: string;
  tagih_mode: "sama" | "outlet" | "manual";
  tagih_outlet: string | null;
  baris: Record<string, { diskon: number; pajak: number }>;
  item_basis?: Record<string, { qty: number; harga: number }>;
  identitas?: {
    perusahaan: Kop & { logo_path?: string | null };
    kirim: KontakDokumen;
    tagih: KontakDokumen;
  };
};
export type DokumenKiriman = {
  jenis: JenisDokumen;
  isi: IsiDokumen;
  terbit: IsiDokumen | null;
  versi: number;
  arsip_at: string | null;
  terbit_at?: string | null;
};
export function qtyInvoice(k: Kiriman, i: ItemKiriman) {
  return Number(
    (k.status === "diterima" ||
      ["selesai", "selisih"].includes(k.pemeriksaan_status ?? "")) &&
      i.qty_diterima !== null
      ? i.qty_diterima
      : i.qty,
  );
}
export function isiDokumen(k: Kiriman, jenis: JenisDokumen) {
  const d = k.dokumen?.find((d) => d.jenis === jenis);
  return d?.terbit ?? d?.isi;
}
export function basisCocok(k: Kiriman, items: ItemKiriman[], isi?: IsiDokumen) {
  if (!isi?.item_basis) return true;
  return (
    Object.keys(isi.item_basis).length === items.length &&
    items.every((i) => {
      const b = isi.item_basis?.[i.id];
      return (
        b &&
        Number(b.qty) === qtyInvoice(k, i) &&
        Number(b.harga) === Number(i.harga)
      );
    })
  );
}
export function konteksDokumen(jenis: JenisDokumen, k: Kiriman, pt: Kop) {
  const d = k.dokumen?.find((d) => d.jenis === jenis),
    isi = isiDokumen(k, jenis),
    identitas = isi?.identitas;
  const perusahaan = identitas?.perusahaan;
  return {
    k: {
      ...k,
      catatan: isi?.catatan ?? k.catatan,
      outlet: identitas?.kirim ?? k.outlet,
    },
    pt: perusahaan
      ? {
          ...perusahaan,
          telepon: isi?.telepon_gudang ?? perusahaan.telepon,
          logo_url: perusahaan.logo_path
            ? "/api/gudang/logo?path=" +
              encodeURIComponent(perusahaan.logo_path)
            : perusahaan.logo_path === null
              ? "/brand/hazna-logo.png"
              : (perusahaan.logo_url ?? "/brand/hazna-logo.png"),
        }
      : { ...pt, telepon: isi?.telepon_gudang ?? pt.telepon },
    isi,
    tagih: identitas?.tagih ?? k.outlet,
    draft: !!d && !d.terbit,
  };
}
