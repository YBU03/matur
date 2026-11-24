import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { eksporRekap } from "../laporan-rekap-ekspor";
import type { Laporan } from "../laporan";
it("retains numeric source precision, source recipient rows and weighted margin in Excel", async () => {
  const list = [
    {
      id: "laporan-1",
      outlet_id: "a",
      nama_outlet: "Nama sumber",
      outlet: { nama: "Outlet A" },
      periode: "2026-10-01",
      pendapatan: [{ nama: "Penjualan", jumlah: 88535871 }],
      diskon: 0,
      laba_bersih: "28073805.81",
      persediaan_awal: "1000",
      pembelian: "2000",
      persediaan_akhir: "300",
      modal_awal: "1000",
      sedekah: 0,
      beban: [],
      bagi_hasil: [
        { nama: "Mitra", persen: 10, jumlah: 2807380.58 },
        { nama: "Pengelola", persen: 90, jumlah: 25266425.23 },
      ],
      transfer: [
        {
          atas_nama: "Mitra",
          keterangan: "Bagi hasil",
          jumlah: 2807380.58,
          bank: null,
          no_rekening: null,
        },
      ],
    },
  ] as unknown as Laporan[];
  const x = await eksporRekap(
    list,
    [],
    "Outlet A · Oktober 2026",
    "excel",
    false,
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await x.blob.arrayBuffer()) as never);
  expect(wb.worksheets).toHaveLength(5);
  expect(wb.getWorksheet("Rekap bulanan")!.getCell("A3").value).toBe(
    "Outlet A",
  );
  expect(wb.getWorksheet("Rekap bulanan")!.getCell("D3").value).toBe(
    28073805.81,
  );
  expect(wb.getWorksheet("Hak dan pembayaran")!.rowCount).toBe(3);
  expect(wb.getWorksheet("Pembagian laporan")!.rowCount).toBe(3);
  const m = wb.getWorksheet("Pembulatan margin")!;
  expect(m.getCell("D3").value).toBe(28073805.81);
  expect(m.getCell("F3").value).toBe(0.3171);
  expect(Number(m.getCell("G3").value)).toBeCloseTo(88535871 * 0.3171, 5);
  expect(Number(m.getCell("H3").value)).toBeCloseTo(
    88535871 * 0.3171 - 28073805.81,
    5,
  );
  const pdf = await eksporRekap(
    list,
    [],
    "Outlet A · Oktober 2026",
    "pdf",
    false,
  );
  expect(pdf.blob.type).toBe("application/pdf");
  expect(pdf.blob.size).toBeGreaterThan(1000);
});
