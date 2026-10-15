import { describe, it, expect } from "vitest";
import { hitungJamGaji, aturanGaji, KOMPONEN_KOSONG } from "../gaji";
import type { BarisRekap } from "../jadwal/rekap";
const salary = { ...KOMPONEN_KOSONG, gaji_pokok: 2080000 };
const shift = {
  id: "s",
  nama: "Pagi",
  jam_mulai: "08:00",
  jam_selesai: "16:00",
};
const row = (out: string | null): BarisRekap => ({
  pengguna_id: "u",
  tanggal: "2026-01-05",
  shift,
  status: "tepat",
  menitKerja: 0,
  absen: {
    id: "a",
    pengguna_id: "u",
    jadwal_id: "j",
    tanggal: "2026-01-05",
    masuk_at: "2026-01-05T01:00:00Z",
    pulang_at: out,
    status: "tepat",
    telat_menit: 0,
  },
});
describe("monthly payroll hourly references and overtime", () => {
  it("keeps monthly components and derives references without paying early overtime", () => {
    const a = hitungJamGaji(salary, [row("2026-01-05T10:59:00Z")]);
    expect(a.referensi_harian).toBe(80000);
    expect(a.referensi_perjam).toBe(10000);
    expect(a.menit_lembur).toBe(0);
    expect(a.nominal_lembur).toBe(0);
  });
  it("default pays all overtime once two hours after planned end is reached", () => {
    const a = hitungJamGaji(salary, [row("2026-01-05T11:00:00Z")]);
    expect(a.menit_lembur).toBe(120);
    expect(a.nominal_lembur).toBe(20000);
  });
  it("supports threshold excess only, custom rate, factor, breaks and rounding down", () => {
    const a = hitungJamGaji(
      {
        ...salary,
        aturan: {
          lembur_mode: "selisih",
          lembur_tarif: 15000,
          lembur_pengali: 1.5,
          pembulatan_menit: 30,
          istirahat_menit: 60,
        },
      },
      [row("2026-01-05T11:59:00Z")],
    );
    expect(a.menit_lembur).toBe(30);
    expect(a.nominal_lembur).toBe(11250);
    expect(a.menit_kerja).toBe(659 - 60);
  });
  it("handles overnight shifts and never counts a duplicated absence twice", () => {
    const b = row("2026-01-06T01:00:00Z");
    b.shift = { ...shift, jam_mulai: "22:00", jam_selesai: "06:00" };
    b.absen!.masuk_at = "2026-01-05T15:00:00Z";
    const a = hitungJamGaji(salary, [b, b]);
    expect(a.menit_lembur).toBe(120);
    expect(a.menit_kerja).toBe(600);
  });
  it("blocks incomplete attendance and reports unscheduled work for HRD review", () => {
    expect(hitungJamGaji(salary, [row(null)]).belum_lengkap).toBe(1);
    const b = row("2026-01-05T11:00:00Z");
    delete b.shift;
    const a = hitungJamGaji(salary, [b]);
    expect(a.tanpa_jadwal).toBe(1);
    expect(a.menit_lembur).toBe(0);
  });
  it("rejects invalid divisors and rules instead of generating infinite pay", () => {
    expect(() => aturanGaji({ hari_pembagi: 0 })).toThrow();
    expect(() => aturanGaji({ lembur_pengali: NaN })).toThrow();
    expect(() => aturanGaji({ pembulatan_menit: 0 })).toThrow();
  });
});
