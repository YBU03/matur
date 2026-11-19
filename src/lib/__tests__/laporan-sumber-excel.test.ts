import { describe, expect, it } from "vitest";
import {
  pdfSumberExcel,
  judulPeriodeSumber,
  type SumberExcel,
} from "../laporan-sumber-excel";
import { kategoriUntuk } from "../ruma-excel";

describe("arsip laporan Excel", () => {
  it("keeps long daily detail and formatted monthly values in the PDF", async () => {
    const source: SumberExcel = {
      versi: 1,
      nama_file: "uji.xlsx",
      sha256: "uji",
      nama_sumber: "Sumber",
      outlet_tujuan: "Outlet Uji",
      periode: "2026-10",
      xlsx_base64: "",
      koreksi: [],
      catatan: [],
      lembar: [
        {
          nama: "Laporan Keuangan",
          baris: [
            {
              nomor: 69,
              sel: [
                {
                  alamat: "F69",
                  teks: "Rp 1.245.810",
                  nilai: 1245809.525,
                  rumus: "H66*2.5%",
                  format: "#,##0",
                },
              ],
            },
          ],
        },
        {
          nama: "Transaksi",
          baris: Array.from({ length: 150 }, (_, i) => ({
            nomor: i + 7,
            sel: [
              {
                alamat: `C${i + 7}`,
                teks: `Rincian unik ${i}`,
                nilai: `Rincian unik ${i}`,
                rumus: null,
                format: "",
              },
            ],
          })),
        },
      ],
    };
    const doc = await pdfSumberExcel(source);
    const content = doc.output();
    expect(content).toContain("F69: Rp 1.245.810");
    for (let i = 0; i < 150; i++)
      expect(content).toContain(`C${i + 7}: Rincian unik ${i}`);
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    expect(source.lembar[0].baris[0].sel[0].nilai).toBe(1245809.525);
    expect(judulPeriodeSumber(source)).toBe("Oktober 2026");
  });
  it("maps other expenses to Lain-lain even when Admin Transfer precedes it", () => {
    const categories = [
      { id: "admin", nama: "Biaya Admin Transfer" },
      { id: "other", nama: "Biaya lain lain" },
    ];
    expect(kategoriUntuk("Biaya Lain-lain", categories)?.id).toBe("other");
  });
});
