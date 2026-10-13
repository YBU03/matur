import { describe, expect, it } from "vitest";
import { cocokNama, penerimaanMitra } from "../penerimaan-mitra";

const lap = [
  {
    periode: "2026-06-01",
    transfer: [
      { keterangan: "Bagi hasil Ibu Prasetya Ida S.", jumlah: 1591877, bank: "BSI", no_rekening: "7350338987", atas_nama: "Prasetya Ida Suntari" },
      { keterangan: "Bagi hasil Ibu Oktantina Ratnasari", jumlah: 1591877, bank: null, no_rekening: null, atas_nama: null },
      { keterangan: "Sewa", jumlah: 1416667, bank: "BCA", no_rekening: "0970886583", atas_nama: "Dwi Suyoko" },
    ],
    bagi_hasil: [
      { nama: "Pengelola", persen: 90, jumlah: 28653779 },
      { nama: "Ibu Prasetya Ida Suntari", persen: 5, jumlah: 1591877 },
    ],
  },
  { periode: "2026-07-01", transfer: [], bagi_hasil: [{ nama: "Ibu Prasetya Ida Suntari", persen: 5, jumlah: 1600000 }] },
];

describe("penerimaanMitra", () => {
  it("mencocokkan atas nama, keterangan, dan mengabaikan sapaan", () => {
    expect(cocokNama("Bagi hasil Ibu Oktantina Ratnasari", "Oktantina Ratnasari")).toBe(true);
    expect(cocokNama("Pengelola", "Dwi Suyoko")).toBe(false);
  });
  it("sewa untuk pemilik tempat dan bagi hasil untuk investor", () => {
    expect(penerimaanMitra(lap, "Dwi Suyoko").map((p) => p.total)).toEqual([1416667]);
    const ida = penerimaanMitra(lap, "Prasetya Ida Suntari");
    expect(ida.map((p) => p.total)).toEqual([1591877, 1600000]); // Juli: dari baris bagi hasil
    expect(ida[0].rincian[0].rekening).toBe("BSI 7350338987");
  });
});
