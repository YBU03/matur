import type { ItemKiriman, Kiriman } from "@/lib/kiriman";
import type { Kop } from "@/lib/pdf-kop";
import { unduh } from "@/lib/pdf-kop";
import type { CetakGudang } from "@/lib/gudang-cetak-config";
export async function cetakDokumen(
  jenis: "surat-jalan" | "invoice",
  k: Kiriman,
  items: ItemKiriman[],
  pt: Kop,
  opsi?: CetakGudang,
) {
  const { buatDokumenGudang } = await import("@/lib/gudang-dokumen");
  const doc = buatDokumenGudang(jenis, k, items, pt, opsi);
  unduh(
    doc,
    `${jenis === "invoice" ? "Invoice" : "Surat Jalan"} ${k.nomor} ${k.outlet?.nama ?? ""}`,
  );
}
