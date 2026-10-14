import { describe, expect, it } from "vitest";
import { nilaiHari, totalBulan, type Manual } from "../harian";

const m = (x: Partial<Manual>): Manual => ({ id: Math.random().toString(), tanggal: "2026-11-01", kanal: "gofood", jenis: "koreksi", jumlah: 0, keterangan: null, nama_pembuat: null, created_at: "2026-11-01T10:00:00Z", ...x });

describe("nilaiHari", () => {
  it("angka dashboard platform menggantikan angka POS, koreksi ditambahkan", () => {
    const v = nilaiHari({ tanggal: "2026-11-01", gofood: 150000, tunai: 500000 }, [m({ jenis: "platform", jumlah: 138000 }), m({ kanal: "tunai", jumlah: -5000 })]);
    expect(v.gofood).toEqual({ pos: 150000, platform: 138000, koreksi: 0, akhir: 138000 });
    expect(v.tunai.akhir).toBe(495000);
  });
  it("platform terbaru yang dipakai bila diinput dua kali", () => {
    const v = nilaiHari({ tanggal: "2026-11-01", gofood: 1 }, [m({ jenis: "platform", jumlah: 100, created_at: "2026-11-01T09:00:00Z" }), m({ jenis: "platform", jumlah: 120, created_at: "2026-11-01T11:00:00Z" })]);
    expect(v.gofood.akhir).toBe(120);
  });
  it("total bulan termasuk tanggal yang hanya punya input manual", () => {
    const t = totalBulan([{ tanggal: "2026-11-01", tunai: 100 }], [m({ tanggal: "2026-11-02", kanal: "grabfood", jenis: "platform", jumlah: 50 })]);
    expect(t.tunai).toBe(100);
    expect(t.grabfood).toBe(50);
  });
});
