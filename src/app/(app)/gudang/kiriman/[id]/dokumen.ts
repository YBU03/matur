import type { ItemKiriman, Kiriman } from "@/lib/kiriman";
import type { Kop } from "@/lib/pdf-kop";
import { gambar, unduh } from "@/lib/pdf-kop";
import type { CetakGudang } from "@/lib/gudang-cetak-config";
export async function cetakDokumen(
  jenis: "surat-jalan" | "invoice",
  k: Kiriman,
  items: ItemKiriman[],
  pt: Kop,
  opsi?: CetakGudang,
) {
  const { buatDokumenGudang } = await import("@/lib/gudang-dokumen");
  const logo = await gambar(pt.logo_url ?? "/brand/hazna-logo.png");
  const doc = buatDokumenGudang(jenis, k, items, pt, opsi, logo);
  unduh(
    doc,
    `${jenis === "invoice" ? "Invoice" : "Surat Jalan"} ${k.nomor} ${k.outlet?.nama ?? ""}`,
  );
}
