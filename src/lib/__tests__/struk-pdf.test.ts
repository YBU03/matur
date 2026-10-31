import { it, expect } from "vitest";
import { barisTeks, buatStrukPdf } from "../struk-pdf";
import type { BarisStruk } from "../printer-bt";

const baris: BarisStruk[] = [
  { teks: "*** SALINAN ***", tengah: true, tebal: true },
  { teks: "RUMA", tengah: true, tebal: true, besar: true },
  { teks: "", kiriKanan: ["1x Kopi Susu Aren (Cup) (Less Sugar, Extra Shot)", "Rp 23.000"] },
  { teks: "", tebal: true, kiriKanan: ["TOTAL", "Rp 38.000"] },
  { teks: "", kiriKanan: ["Bayar", "QRIS"] },
];

it("keeps every line within the paper columns and right-aligns amounts", () => {
  for (const kolom of [32, 48]) {
    const rows = barisTeks(baris, kolom);
    for (const r of rows) expect(r.teks.length).toBeLessThanOrEqual(r.besar ? kolom / 2 : kolom);
    const total = rows.find((r) => r.teks.startsWith("TOTAL"))!;
    expect(total.teks.endsWith("Rp 38.000")).toBe(true);
    expect(total.teks).toHaveLength(kolom);
    expect(rows.filter((r) => r.teks.includes("Kopi Susu")).length + rows.filter((r) => r.teks.startsWith("  ")).length).toBeGreaterThan(1);
  }
});

it("builds a receipt-width PDF for 58 and 80 mm paper", async () => {
  for (const [k, w] of [["58", 58], ["80", 80]] as const) {
    const doc = await buatStrukPdf(baris, k);
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(w);
    expect(doc.output()).toContain("SALINAN");
  }
});
