import { it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LaporanDokumen } from "@/app/(app)/laporan/laporan-dokumen";
import { siapkanLaporanDokumen, visualLaporan } from "../laporan-tampilan";
import type { Laporan } from "../laporan";
vi.mock("@/app/(app)/laporan/[id]/visual", () => ({
  LaporanVisual: () => createElement("div", { "data-visual": "monthly" }),
}));
vi.mock("@/app/(app)/laporan/[id]/pdf", () => ({
  UnduhPdf: () => createElement("button", null, "Unduh PDF"),
}));
vi.mock("@/app/(app)/laporan/[id]/excel", () => ({
  UnduhExcel: () => createElement("button", null, "Excel"),
}));
const report = (id: string, outlet = "a", periode = "2026-10-01") =>
  ({
    id,
    outlet_id: outlet,
    periode,
    nama_outlet: outlet,
    modal_awal: 200000,
    persediaan_awal: 0,
    pembelian: 0,
    persediaan_akhir: 0,
    pendapatan: [{ nama: "Tunai", jumlah: 1000 }],
    diskon: 0,
    sedekah: 0,
    persen_sedekah: 2.5,
    beban: [],
    laba_bersih: 1000,
    bagi_hasil: [],
    transfer: [],
    karyawan: [],
  }) as unknown as Laporan;
it("October source and ordinary months use the same primary financial template, source remains an appendix", () => {
  const l = report("oct");
  l.sumber_excel = {
    versi: 1,
    nama_file: "oct.xlsx",
    nama_sumber: "A",
    outlet_tujuan: "A",
    periode: "2026-10",
    sha256: "hash",
    xlsx_base64: "",
    koreksi: [],
    catatan: [],
    lembar: [{ nama: "Laporan Keuangan", baris: [] }],
  };
  const before = JSON.stringify(l);
  for (const value of [l, report("sep", "a", "2026-09-01")]) {
    const html = renderToStaticMarkup(
      createElement(LaporanDokumen, { l: value, pt: null }),
    );
    expect(html).toContain("<article");
    expect(html).toContain('aria-label="Navigasi laporan"');
    expect(html).toContain("Kembali ke daftar laporan");
    expect(html).not.toContain("PDF + lampiran lengkap");
    for (const label of [
      "Harga Pokok Penjualan",
      "Laba Rugi",
      "Sharing Profit",
      "Saldo Sedekah",
      "Penerimaan Transfer Periode Pelaporan",
      'data-visual="monthly"',
    ])
      expect(html).toContain(label);
    if (value.sumber_excel) {
      expect(html.indexOf("</article>")).toBeLessThan(
        html.indexOf("Lampiran lengkap &amp; Excel sumber"),
      );
    }
  }
  expect(JSON.stringify(l)).toBe(before);
});
it("screen/PDF trend excludes other outlets and later periods; current source precision is retained", () => {
  const l = report("oct");
  l.laba_bersih = 28073805.81;
  const before = JSON.stringify(l);
  const v = visualLaporan(l, [
    report("foreign", "b", "2026-09-01"),
    report("future", "a", "2026-11-01"),
    report("sep", "a", "2026-09-01"),
    l,
  ]);
  expect(v.riwayat).toHaveLength(2);
  expect(v.prev?.periode).toBe("2026-09-01");
  expect(v.labaBersih).toBe(28073805.81);
  const p = siapkanLaporanDokumen(l, null);
  expect(p.l.laba_bersih).toBe(l.laba_bersih);
  expect(JSON.stringify(l)).toBe(before);
});
