import ExcelJS from "exceljs";
import { expect, it } from "vitest";
import type { Laporan } from "../laporan";
import { isiSheetLaporan } from "../laporan-excel";
import { gridDariSheet, parseLaporan } from "../ruma-excel";

const l = {
  id: "x", outlet_id: "o", periode: "2026-10-01", nama_outlet: "Ruma Kopiaksa", mitra: "Dwi Suyoko", pj_laporan: "Nurfaika Putri",
  karyawan: ["Andhika", "Maya"], modal_awal: 200000, persediaan_awal: 6629112, pembelian: 30000000, tagihan_titipan: 820000,
  rincian_titipan: [{ produsen: "Bu Ratna", jumlah: 820000 }], persediaan_akhir: 5000000,
  pendapatan: [{ nama: "Penjualan tunai", jumlah: 30000000 }, { nama: "Go Food", jumlah: 1000000 }], diskon: 50000, persen_sedekah: 2.5, sedekah: 50000,
  beban: [{ nama: "Biaya Gaji", jumlah: 10000000 }, { nama: "Biaya Sewa", jumlah: 1416667 }],
  bagi_hasil: [{ nama: "Pengelola", persen: 90, jumlah: 9000000 }, { nama: "Ibu Ida", persen: 5, jumlah: 500000 }],
  transfer: [{ keterangan: "Bagi hasil Ibu Ida", jumlah: 500000, bank: "BSI", no_rekening: "7350338987", atas_nama: "Prasetya Ida" }, { keterangan: "Sewa", jumlah: 1416667, bank: "BCA", no_rekening: "0970886583", atas_nama: "Dwi Suyoko" }],
  tgl_terbit: "2026-11-10", kota_terbit: "Purbalingga", penandatangan: "Dwi Suyoko", jabatan_penandatangan: "Direktur", catatan: null, laba_bersih: null,
  outlet: { nama: "Ruma", tgl_mulai: "2026-06-12", jam_operasional: "09.00 - 22.00 WIB" },
} as unknown as Laporan;

it("ekspor lalu impor kembali menghasilkan laporan yang sama", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Laporan Keuangan");
  isiSheetLaporan(ws, l, { nama: "CV. Hazna Berkah Indonesia", alamat: "Purbalingga", email: null, telepon: null });
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(await wb.xlsx.writeBuffer());
  const p = parseLaporan(gridDariSheet(wb2.getWorksheet("Laporan Keuangan") as never));
  expect(p).toMatchObject({
    periode: "2026-10", nama_outlet: l.nama_outlet, mitra: l.mitra, pj_laporan: l.pj_laporan, karyawan: l.karyawan, modal_awal: l.modal_awal,
    persediaan_awal: l.persediaan_awal, pembelian: l.pembelian, tagihan_titipan: 820000, persediaan_akhir: l.persediaan_akhir, pendapatan: l.pendapatan,
    diskon: l.diskon, persen_sedekah: 2.5, sedekah: l.sedekah, beban: l.beban, bagi_hasil: l.bagi_hasil, transfer: l.transfer,
    tgl_terbit: l.tgl_terbit, kota_terbit: "Purbalingga", penandatangan: "Dwi Suyoko", jabatan_penandatangan: "Direktur",
  });
});
