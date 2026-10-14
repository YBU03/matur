import { describe, expect, it } from "vitest";
import { kategoriUntuk, parseLaporan, parseTransaksi, type Grid } from "../ruma-excel";

const d = (s: string) => new Date(s + "T00:00:00Z");
const baris = (n: number, isi: Record<number, unknown>) => Array.from({ length: n }, (_, i) => (isi[i] ?? null) as never);

describe("parseTransaksi", () => {
  // A Tanggal, B-C ket, D Tunai, E Non Tunai, F Go Food, G Discount, H Es Kristal, I Bahan Baku, J Sewa Outlet, K Penjualan
  const g: Grid = [
    baris(11, { 3: "LAPORAN OUTLET RUMA" }),
    baris(11, { 3: "Penjualan", 7: "Es Kristal", 8: "Bahan Baku", 9: "Sewa Outlet" }),
    baris(11, { 0: "Tanggal", 3: "Tunai", 4: "Non Tunai", 5: "Go Food", 6: "Discount", 10: "Penjualan" }),
    baris(11, { 0: d("2026-10-01"), 1: "Full Shift", 3: 500000, 4: 700000, 5: 20000, 6: -5000, 7: 48000, 10: 500000 }),
    baris(11, { 2: "susu 2 liter", 8: 36000 }),
    baris(11, { 1: "Pembelian Dessert dan Snack" }),
    baris(11, { 2: "cheesecake 2 pcs", 8: 24000 }),
    baris(11, { 2: 1234567 }),
    baris(11, { 0: d("2026-10-02"), 3: 400000, 9: 1416667 }),
    baris(11, { 0: "Total", 3: 900000 }),
  ];
  it("membaca penjualan per kanal & item pengeluaran per tanggal", () => {
    const r = parseTransaksi(g);
    expect(r.judul).toBe("LAPORAN OUTLET RUMA");
    expect(r.hari).toHaveLength(2);
    expect(r.hari[0].jual).toEqual({ tunai: 500000, non_tunai: 700000, gofood: 20000, diskon: 5000 });
    expect(r.hari[0].biaya).toEqual([
      { kolom: "Es Kristal", keterangan: "Es Kristal", jumlah: 48000 },
      { kolom: "Bahan Baku", keterangan: "susu 2 liter", jumlah: 36000 },
      { kolom: "Bahan Baku", keterangan: "cheesecake 2 pcs (Pembelian Dessert dan Snack)", jumlah: 24000 },
    ]);
    expect(r.hari[1]).toEqual({ tanggal: "2026-10-02", jual: { tunai: 400000 }, biaya: [{ kolom: "Sewa Outlet", keterangan: "Sewa Outlet", jumlah: 1416667 }] });
  });
  it("menolak sheet yang bukan format Ruma", () => expect(() => parseTransaksi([["a", "b"]])).toThrow());
});

describe("kategoriUntuk", () => {
  const k = [
    { id: "1", nama: "Biaya Sewa" },
    { id: "2", nama: "Es Kristal" },
    { id: "3", nama: "Biaya Gaji" },
    { id: "4", nama: "Biaya lain lain" },
    { id: "5", nama: "Biaya Internet/Wifi" },
  ];
  it("mencocokkan judul kolom Ruma ke kategori Matoer", () => {
    expect(kategoriUntuk("Sewa Outlet", k)?.id).toBe("1");
    expect(kategoriUntuk("Es Kristal", k)?.id).toBe("2");
    expect(kategoriUntuk("B. Gaji", k)?.id).toBe("3");
    expect(kategoriUntuk("Internet", k)?.id).toBe("5");
    expect(kategoriUntuk("Sesuatu Baru", k)?.id).toBe("4");
  });
});

describe("parseLaporan", () => {
  const g: Grid = [
    baris(9, { 0: "Nama Outlet", 3: ":", 4: "Ruma Kopiaksa" }),
    baris(9, { 0: "Periode Laporan", 3: ":", 4: "Per Oktober 2026" }),
    baris(9, { 0: "Mitra", 3: ":", 4: "Dwi Suyoko" }),
    baris(9, { 0: "Jumlah Karyawan", 3: ":", 4: "2 (Dua)" }),
    baris(9, { 4: "1. Andhika\n" }),
    baris(9, { 4: "2.Maya" }),
    baris(9, {}),
    baris(9, { 0: "Tanggal", 2: "Keterangan" }),
    baris(9, { 0: d("2026-10-01"), 2: "Saldo Awal", 4: 200000, 7: 200000 }),
    baris(9, { 0: "Persedian awal barang dagangan", 6: 6629112 }),
    baris(9, { 0: "Pembelian bahan baku", 6: 30000000, 8: "(+)" }),
    baris(9, { 0: "Persedian akhir barang dagangan", 6: 5000000, 8: "(-)" }),
    baris(9, { 0: "Pendapatan" }),
    baris(9, { 1: "Penjualan tunai", 5: 30000000 }),
    baris(9, { 1: "Go Food", 5: 1000000 }),
    baris(9, { 1: "Discount", 5: -50000, 6: "(+)" }),
    baris(9, { 0: "Total penjualan", 7: 30950000 }),
    baris(9, { 0: "Beban Operasional : " }),
    baris(9, { 1: "Sedekah 2,5%", 5: 500000 }),
    baris(9, { 1: "Biaya Gaji", 5: 10000000 }),
    baris(9, { 0: "Total beban operasional", 7: 10500000 }),
    baris(9, { 0: "· SHARING PROFIT" }),
    baris(9, { 0: "Untuk Pengelola 90%", 6: 9000000 }),
    baris(9, { 0: "Pembagian Hasil a.n Ibu Ida 5%", 6: 500000 }),
    baris(9, { 0: "Modal Akhir", 6: 200000 }),
    baris(9, { 0: "Tabel Penerimaan Transfer Periode Pelaporan" }),
    baris(9, { 0: "No", 1: "Keterangan", 4: "Jumlah", 5: "BSI" }),
    baris(9, { 5: "No Rekening", 7: "Atas Nama" }),
    baris(9, { 0: 1, 1: "Sewa", 4: 1416667, 5: "0970886583", 7: "Dwi Suyoko (BCA)" }),
    baris(9, { 0: "Total", 4: 1416667 }),
    baris(9, { 5: "Purbalingga, 10 November 2026" }),
    baris(9, {}),
    baris(9, { 6: "Dwi Suyoko" }),
    baris(9, { 6: "Direktur" }),
  ];
  it("membaca isi laporan keuangan format Ruma", () => {
    const l = parseLaporan(g);
    expect(l).toMatchObject({
      periode: "2026-10", nama_outlet: "Ruma Kopiaksa", mitra: "Dwi Suyoko", karyawan: ["Andhika", "Maya"], modal_awal: 200000,
      persediaan_awal: 6629112, pembelian: 30000000, persediaan_akhir: 5000000, diskon: 50000, persen_sedekah: 2.5, sedekah: 500000,
      pendapatan: [{ nama: "Penjualan tunai", jumlah: 30000000 }, { nama: "Go Food", jumlah: 1000000 }],
      beban: [{ nama: "Biaya Gaji", jumlah: 10000000 }],
      bagi_hasil: [{ nama: "Pengelola", persen: 90, jumlah: 9000000 }, { nama: "Ibu Ida", persen: 5, jumlah: 500000 }],
      transfer: [{ keterangan: "Sewa", jumlah: 1416667, bank: "BCA", no_rekening: "0970886583", atas_nama: "Dwi Suyoko" }],
      tgl_terbit: "2026-11-10", kota_terbit: "Purbalingga", penandatangan: "Dwi Suyoko", jabatan_penandatangan: "Direktur",
    });
  });
});
