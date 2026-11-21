import { expect, it } from "vitest";
import { periodeStok, saldoHitung, type StokRingkas } from "../stok-outlet";
import { barisStok, barisGerak } from "../stok-outlet-ekspor";
it("date range handles invalid dates, reversed and future dates and bounds full exports", () => {
  expect(periodeStok("2026-99-99", "2026-11-30", "2026-11-21")).toEqual({
    awal: "2026-11-01",
    akhir: "2026-11-21",
  });
  expect(periodeStok("2026-11-25", "2026-11-05", "2026-11-21")).toEqual({
    awal: "2026-11-05",
    akhir: "2026-11-05",
  });
  expect(periodeStok("2020-01-01", "2026-11-21", "2026-11-21").awal).toBe(
    "2025-11-21",
  );
});
it("export preserves each ingredient and unit; void offsets usage and SO is separate", () => {
  const r = {
    outlet_id: "o",
    outlet: "Outlet",
    bahan_id: "b",
    nama: "Kopi",
    satuan: "g",
    awal: 100,
    masuk: 20,
    pakai: 12,
    kembali: 2,
    waste: 3,
    marketing: 1,
    so: -4,
    koreksi: 5,
    keluar_lain: 7,
    akhir: 100,
  } as StokRingkas;
  expect(saldoHitung(r)).toBe(100);
  const data = {
    ringkasan: [r],
    riwayat: [],
    lanjut: false,
    mulai: "",
    selesai: "",
    awal_riwayat: null,
    dibaca_at: "",
  };
  expect(barisStok(data)[0]).toEqual([
    "Outlet",
    "Kopi",
    "g",
    100,
    20,
    12,
    2,
    3,
    1,
    -4,
    5,
    7,
    100,
  ]);
  expect(
    barisGerak([
      {
        id: "m",
        created_at: "2026-11-20T17:30:00Z",
        outlet_id: "o",
        outlet: "Outlet",
        bahan_id: "b",
        nama: "Kopi",
        satuan: "g",
        jenis: "opname",
        jumlah: -4,
        keterangan: "Hitung ulang",
        ref_id: "so",
        petugas: "SPV",
      },
    ])[0],
  ).toContain("Penyesuaian SO");
});
