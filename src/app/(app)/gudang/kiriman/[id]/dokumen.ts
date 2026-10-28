import { konteksDokumen } from "@/lib/gudang-dokumen-model";
import type { ItemKiriman, Kiriman } from "@/lib/kiriman";
import type { Kop } from "@/lib/pdf-kop";
import { gambar } from "@/lib/pdf-kop";
import type { CetakGudang } from "@/lib/gudang-cetak-config";
import type { KotakTtd } from "@/lib/gudang-ttd";
export async function cetakDokumen(
  jenis: "surat-jalan" | "invoice",
  k: Kiriman,
  items: ItemKiriman[],
  pt: Kop,
  opsi?: CetakGudang,
  ttd?: KotakTtd[],
) {
  const { buatDokumenGudang } = await import("@/lib/gudang-dokumen");
  const konteks = konteksDokumen(jenis, k, pt);
  const logo = await gambar(konteks.pt.logo_url ?? "/brand/hazna-logo.png");
  const doc = buatDokumenGudang(jenis, k, items, pt, opsi, logo, ttd);
  return {
    url: URL.createObjectURL(doc.output("blob")),
    nama: (
      (jenis === "invoice" ? "Invoice" : "Surat Jalan") +
      " " +
      k.nomor
    ).replace(/[\\/:*?"<>|]/g, "-"),
  };
}
