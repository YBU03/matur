import { describe, expect, it } from "vitest";
import { parseLaporanPdf, selPdf, type ItemPdf } from "../laporan-pdf";

// Potongan teks tiruan dengan tata letak PDF laporan Ruma (tanpa data asli)
const baris: [number, number, string[]][] = [
  [1, 640, ["Nama Outlet", ":", "Outlet Uji"]],
  [1, 620, ["Periode Laporan", ":", "Per Oktober 2026"]],
  [1, 600, ["Mitra", ":", "Mitra Uji"]],
  [1, 580, ["Penanggung Jawab Laporan", ":", "PJ Uji"]],
  [1, 560, ["Jumlah Karyawan", ":", "2 (Dua)"]],
  [1, 545, ["1. Ani"]],
  [1, 530, ["2.Budi"]],
  [1, 300, ["· MODAL OUTLET"]],
  [1, 280, ["01/10/2026", "Saldo Awal", "-Rp", "200.000-", "-Rp", "200.000-"]],
  [2, 760, ["· HARGA POKOK PENJUALAN"]],
  [2, 740, ["Persedian awal barang dagangan", "-Rp", "1.000.000-"]],
  [2, 725, ["Pembelian bahan baku", "-Rp", "5.000.000- (+)"]],
  [2, 710, ["Persedian akhir barang dagangan", "-Rp", "500.000- (-)"]],
  [2, 695, ["Harga pokok penjualan", "-Rp", "5.500.000-"]],
  [2, 600, ["Pendapatan"]],
  [2, 585, ["Penjualan tunai", "-Rp", "8.000.000-"]],
  [2, 570, ["Penjualan non tunai", "-Rp", "4.000.000-"]],
  [2, 555, ["Tumbler", "-Rp", "-", "-"]],
  [2, 540, ["Discount", "(Rp", "(100.000) (+)"]],
  [2, 525, ["Total penjualan", "-", "Rp", "11.900.000-"]],
  [2, 500, ["Laba Kotor", "-", "Rp", "6.400.000-"]],
  [2, 480, ["Beban Operasional :"]],
  [2, 465, ["Sedekah 2,5%", "-Rp", "160.000-"]],
  [2, 450, ["Biaya Gaji", "-Rp", "2.000.000-"]],
  [2, 435, ["Biaya Air/PDAM", "-Rp", "-", "-"]],
  [2, 420, ["Total beban operasional", "-", "Rp", "2.160.000- (-)"]],
  [2, 405, ["Laba Bersih", "-", "Rp", "4.240.000-"]],
  [3, 760, ["· SHARING PROFIT"]],
  [3, 740, ["Untuk Pengelola"]],
  [3, 740, ["-Rp", "3.816.000-"]],
  [3, 725, ["Bagi Hasil a.n Ibu A 10%", "-Rp", "424.000-"]],
  [3, 710, ["Modal Akhir", "-Rp", "200.000-"]],
  [3, 450, ["Tabel Penerimaan Transfer Periode Pelaporan"]],
  [3, 437, ["BSI"]],
  [3, 430, ["No", "Keterangan", "Jumlah"]],
  [3, 423, ["No Rekening", "Atas Nama"]],
  [3, 408, ["1 Bagi hasil Ibu A", "-Rp", "424.000-", "1234567890", "Ibu A"]],
  [3, 393, ["2 Sewa", "-Rp", "1.000.000-", "0987654321", "Pak B (BCA)"]],
  [3, 378, ["Total", "-Rp", "1.424.000-"]],
  [3, 330, ["Purbalingga, 10 November 2026"]],
  [3, 250, ["Nama TTD"]],
  [3, 238, ["Direktur"]],
];
const items: ItemPdf[] = baris.flatMap(([halaman, y, xs]) => xs.map((teks, i) => ({ halaman, y, x: 50 + i * 80, teks })));

describe("selPdf", () => {
  it("angka format akuntansi", () => {
    expect(selPdf("33.907.500-")).toBe(33907500);
    expect(selPdf("(62.200) (+)")).toBe(-62200);
    expect(selPdf("-Rp")).toBeUndefined();
    expect(selPdf("-")).toBe(0);
    expect(selPdf("7350338987")).toBe("7350338987");
    expect(selPdf("Biaya Gaji")).toBe("Biaya Gaji");
  });
});

describe("parseLaporanPdf", () => {
  const { laporan: l, cek } = parseLaporanPdf(items);
  it("identitas & HPP", () => {
    expect(l.periode).toBe("2026-10");
    expect(l.nama_outlet).toBe("Outlet Uji");
    expect(l.karyawan).toEqual(["Ani", "Budi"]);
    expect([l.modal_awal, l.persediaan_awal, l.pembelian, l.persediaan_akhir]).toEqual([200000, 1000000, 5000000, 500000]);
  });
  it("pendapatan, diskon, beban, sedekah", () => {
    expect(l.pendapatan.map((p) => p.jumlah)).toEqual([8000000, 4000000, 0]);
    expect(l.diskon).toBe(100000);
    expect(l.sedekah).toBe(160000);
    expect(l.beban).toEqual([{ nama: "Biaya Gaji", jumlah: 2000000 }, { nama: "Biaya Air/PDAM", jumlah: 0 }]);
  });
  it("bagi hasil dengan persen tersirat", () => {
    expect(l.bagi_hasil).toEqual([
      { nama: "Pengelola", persen: 90, jumlah: 3816000 },
      { nama: "Ibu A", persen: 10, jumlah: 424000 },
    ]);
  });
  it("transfer & penandatangan", () => {
    expect(l.transfer).toEqual([
      { keterangan: "Bagi hasil Ibu A", jumlah: 424000, bank: "BSI", no_rekening: "1234567890", atas_nama: "Ibu A" },
      { keterangan: "Sewa", jumlah: 1000000, bank: "BCA", no_rekening: "0987654321", atas_nama: "Pak B" },
    ]);
    expect([l.tgl_terbit, l.penandatangan, l.jabatan_penandatangan]).toEqual(["2026-11-10", "Nama TTD", "Direktur"]);
  });
  it("angka total PDF untuk pengecekan", () => {
    expect(cek).toEqual({ totalPenjualan: 11900000, hpp: 5500000, labaKotor: 6400000, labaBersih: 4240000 });
  });
});
