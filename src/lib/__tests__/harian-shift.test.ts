import { expect, it } from "vitest";
import {
  tanggalShift,
  sesiPadaHari,
  biayaBelumTerhubung,
} from "../harian-shift";
const shift = {
  id: "old",
  tanggal_shift: "2026-11-18",
  tanggal_catatan: "2026-11-19",
  tanggal_terkait: ["2026-11-19"],
  tanggal_valid: ["2026-11-19"],
  dibuka_at: "2026-11-18T23:47:00+07:00",
  ditutup_at: "2026-11-19T23:47:00+07:00",
};
it("tanggal aktivitas memilih shift tanggal 19 walau dibuka malam 18", () => {
  expect(sesiPadaHari([shift], "2026-11-19")).toEqual([shift]);
  expect(sesiPadaHari([shift], "2026-11-18")).toEqual([]);
  expect(
    biayaBelumTerhubung(
      { sumber: "laci", tanggal: "2026-11-19", sesi_kas_id: "old" },
      [shift],
    ),
  ).toBe(false);
});
it("biaya salah tanggal tetap ditandai meskipun terlihat di rincian shift", () => {
  const s = { ...shift, tanggal_terkait: ["2026-11-18", "2026-11-19"] };
  expect(tanggalShift(s)).toHaveLength(2);
  expect(sesiPadaHari([s], "2026-11-18")).toEqual([]);
  expect(
    biayaBelumTerhubung(
      { sumber: "laci", tanggal: "2026-11-18", sesi_kas_id: "old" },
      [s],
    ),
  ).toBe(true);
});
it("pusat tidak dihitung sebagai pengeluaran laci belum terhubung; sumber laci null tetap ditandai", () => {
  expect(
    biayaBelumTerhubung({ sumber: "pusat", tanggal: "2026-11-19" }, [shift]),
  ).toBe(false);
  expect(
    biayaBelumTerhubung({ sumber: "laci", tanggal: "2026-11-19" }, [shift]),
  ).toBe(true);
});
it("beberapa shift pada hari sama tetap bisa dipilih tanpa menggandakan daftar", () => {
  const other = { ...shift, id: "new" };
  expect(sesiPadaHari([shift, other], "2026-11-19").map((s) => s.id)).toEqual([
    "old",
    "new",
  ]);
  expect(tanggalShift({ ...shift, tanggal_terkait: undefined })).toEqual([
    "2026-11-19",
  ]);
});
