import { describe, expect, it } from "vitest";
import { hariLibur, rekapLibur } from "../hari-libur";

const jadwal = [
  { pengguna_id: "a", tanggal: "2026-11-02" },
  { pengguna_id: "b", tanggal: "2026-11-02" },
  { pengguna_id: "a", tanggal: "2026-11-03" },
];

describe("hariLibur", () => {
  it("staf tanpa shift pada hari yang sudah dijadwalkan = libur", () => {
    const m = hariLibur(["a", "b", "c"], jadwal);
    expect(m.get("2026-11-02")).toEqual(["c"]);
    expect(m.get("2026-11-03")).toEqual(["b", "c"]);
    expect(m.has("2026-11-04")).toBe(false); // belum disusun
  });
  it("izin/sakit yang disetujui tidak dihitung libur", () => {
    const m = hariLibur(["a", "b", "c"], jadwal, [{ pengguna_id: "c", tanggal: "2026-11-03", jenis: "sakit", status: "disetujui" }]);
    expect(m.get("2026-11-03")).toEqual(["b"]);
  });
  it("rekap per staf", () => {
    expect(rekapLibur(["a", "b"], jadwal).get("b")).toEqual(["2026-11-03"]);
  });
});
