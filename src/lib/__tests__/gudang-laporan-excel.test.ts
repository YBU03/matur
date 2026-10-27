import { it, expect } from "vitest";
import { buatLabaExcel, buatOpnameExcel } from "../gudang-laporan-excel";
import type { GudangLaporan } from "../gudang-laporan";

const lap: GudangLaporan = {
  rows: [
    { id: "1", nomor: "KRM-1", outlet_id: "o1", outlet: "Kominot", kepemilikan: "Pusat", waktu: "2026-10-27T02:00:00Z", bahan_id: "b", nama: "Kopi", harga: 150000, hpp_gudang: 100000, qty: 2 },
    { id: "2", nomor: "KRM-2", outlet_id: "o1", outlet: "Kominot", kepemilikan: "Mitra", waktu: "2026-10-27T02:00:00Z", bahan_id: "c", nama: "Gula", harga: 20000, hpp_gudang: null, qty: 1 },
  ],
  biaya: [{ id: "x", tanggal: "2026-10-27", jumlah: 10000, keterangan: "Ongkos kirim", outlet_id: "o1" }],
  mutasi: [{ id: "m", nama: "Kopi", jenis: "opname", jumlah: -2, hpp: 100 }].map((m) => ({ ...m, tanggal: "2026-10-27" })),
  invoice: [{ id: "i", nomor: "KRM-1", outlet: "Kominot", kepemilikan: "Pusat", tanggal: "2026-10-27", nilai: -750, keterangan: "Pembulatan" }],
};

it("exports a formatted four-sheet Laba Rugi workbook", async () => {
  const wb = await buatLabaExcel(lap, "2026-10-01", "2026-10-27", "Semua outlet", { o1: "Kominot" });
  expect(wb.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Penjualan", "Biaya", "Penyesuaian"]);
  const ring = wb.getWorksheet("Ringkasan")!;
  const nilai = new Map<string, unknown>();
  ring.eachRow((r) => nilai.set(String(r.getCell(1).value).trim(), r.getCell(2).value));
  expect(nilai.get("Penjualan diterima")).toBe(320000);
  expect(nilai.get("Laba kotor diketahui")).toBe(100000);
  expect(nilai.get("LABA / RUGI DIKETAHUI")).toBe(100000 - 10000 - 750 - 200);
  expect(ring.getCell("B6").numFmt).toContain("Rp");
  const biaya = wb.getWorksheet("Biaya")!;
  expect(biaya.getRow(6).getCell(3).value).toBe("Kominot");
  const jual = wb.getWorksheet("Penjualan")!;
  expect(jual.getRow(7).getCell(11).value).toBe("Belum lengkap");
  expect((await wb.xlsx.writeBuffer()).byteLength).toBeGreaterThan(1000);
});

it("exports opname with uncounted items marked and a valued total", async () => {
  const wb = await buatOpnameExcel(
    { id: "d", tanggal: "2026-10-27", status: "final", versi: 2, catatan: "", nama_petugas: "Sinta", created_at: "2026-10-27", final_at: "2026-10-27" },
    [
      { bahan_id: "1", nama: "Kopi", satuan: "g", sistem: 1000, fisik: 980, hpp: 100, alasan: "Tumpah" },
      { bahan_id: "2", nama: "Cup", satuan: "pcs", sistem: 200, fisik: null, hpp: 500, alasan: "" },
    ],
  );
  const ws = wb.getWorksheet("Opname")!;
  const isi = ws.getSheetValues().filter(Array.isArray).map((r) => r.slice(1));
  const kopi = isi.find((r) => r[0] === "Kopi")!;
  expect(kopi.slice(2, 7)).toEqual([1000, 980, -20, 100, -2000]);
  expect(isi.find((r) => r[0] === "Cup")![3]).toBe("Belum dihitung");
  const total = isi.find((r) => r[0] === "TOTAL")!;
  expect(total[6]).toBe(-2000);
  expect(total[7]).toBe("1 dari 2 bahan dihitung");
});
