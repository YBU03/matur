import { describe, expect, it } from "vitest";
import { hitungSlip, totalSlip } from "../gaji";

const k = { gaji_pokok: 1_500_000, tunjangan: 200_000, uang_makan: 15_000, potongan_telat: 10_000, potongan_alpa: 50_000 };
const h = { hadir: 24, telat: 2, menitTelat: 17, tidakAbsen: 1, izin: 1, menitKerja: 24 * 480 };

describe("hitungSlip", () => {
  it("menjumlahkan pendapatan dan potongan dari kehadiran", () => {
    const s = hitungSlip(k, h);
    expect(s.pendapatan.map((b) => b.jumlah)).toEqual([1_500_000, 200_000, 360_000]);
    expect(s.potongan.map((b) => b.jumlah)).toEqual([20_000, 50_000]);
    expect(s.total).toBe(1_990_000);
  });
  it("melewati komponen bernilai nol", () => {
    const s = hitungSlip({ ...k, tunjangan: 0, potongan_telat: 0 }, h);
    expect(s.pendapatan).toHaveLength(2);
    expect(s.potongan).toHaveLength(1);
  });
  it("total tidak pernah negatif", () => {
    expect(totalSlip([{ nama: "a", jumlah: 100 }], [{ nama: "kasbon", jumlah: 500 }])).toBe(0);
  });
});
