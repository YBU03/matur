import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { hitung, type Laporan } from "../laporan";
import { pdfLaporanSumber, type SumberExcel } from "../laporan-sumber-excel";

const cell = (alamat: string, nilai: number) => ({
  alamat,
  nilai,
  teks: `Rp ${nilai}`,
  rumus: null,
  format: "#,##0",
});
function example(): Laporan {
  const source: SumberExcel = {
    versi: 1,
    nama_file: "uji.xlsx",
    sha256: "uji",
    nama_sumber: "Outlet Uji",
    outlet_tujuan: "Outlet Uji",
    periode: "2026-10",
    koreksi: [],
    catatan: [],
    xlsx_base64: "",
    lembar: [
      {
        nama: "Laporan Keuangan",
        baris: [
          {
            nomor: 84,
            sel: [
              cell("H61", 10000),
              cell("H66", 1000),
              cell("H83", 100.125),
              cell("H84", 899.875),
              cell("E118", 100.003),
            ],
          },
        ],
      },
    ],
  };
  return {
    id: "uji",
    outlet_id: "uji",
    periode: "2026-10-01",
    nama_outlet: "Outlet Uji",
    mitra: "Mitra Uji",
    pj_laporan: "Akunting",
    karyawan: ["Petugas"],
    modal_awal: 200000,
    persediaan_awal: 9000,
    pembelian: 0,
    persediaan_akhir: 0,
    pendapatan: [{ nama: "Tunai", jumlah: 10000 }],
    diskon: 0,
    persen_sedekah: 2.5,
    sedekah: 25.003,
    beban: [{ nama: "Biaya", jumlah: 75.122 }],
    bagi_hasil: [],
    transfer: [
      {
        keterangan: "Transfer A",
        jumlah: 33.334,
        bank: null,
        no_rekening: null,
        atas_nama: null,
      },
      {
        keterangan: "Transfer B",
        jumlah: 66.668,
        bank: null,
        no_rekening: null,
        atas_nama: null,
      },
    ],
    tgl_terbit: "2026-11-10",
    kota_terbit: "Kota Uji",
    penandatangan: "Pengelola",
    jabatan_penandatangan: "Direktur",
    catatan: null,
    laba_bersih: 899.875,
    sumber_excel: source,
  };
}
it("uses authoritative cached Excel totals including a transfer total different from the item sum", () => {
  const l = example();
  expect(hitung(l).totalTransfer).toBe(100.003);
  expect(hitung(l).totalBeban).toBe(100.125);
  expect(hitung(l).labaBersih).toBe(899.875);
  delete l.sumber_excel;
  expect(hitung(l).totalTransfer).toBeCloseTo(100.002, 6);
});
it("default source PDF uses the common financial layout and preserves stored precision", async () => {
  const l = example();
  const before = JSON.stringify(l);
  const asset = (name: string) => {
    const b = readFileSync(process.cwd() + "/public/brand/" + name);
    return {
      url: "data:image/png;base64," + b.toString("base64"),
      w: b.readUInt32BE(16),
      h: b.readUInt32BE(20),
    };
  };
  const doc = await pdfLaporanSumber(l, {
    assets: [asset("hazna-logo.png"), asset("ttd-hazna.png")],
  });
  const content = doc.output();
  for (const section of [
    "Ke mana uang penjualan pergi",
    "MODAL OUTLET",
    "HARGA POKOK PENJUALAN",
    "LABA RUGI",
    "SHARING PROFIT",
    "SALDO SEDEKAH",
    "Bank / No Rekening",
    "DRAFT INTERNAL",
  ])
    expect(content).toContain(section);
  expect(content).not.toContain("Keterangan / teks sumber");
  expect(doc.getNumberOfPages()).toBeLessThan(8);
  expect(JSON.stringify(l)).toBe(before);
}, 30000);
