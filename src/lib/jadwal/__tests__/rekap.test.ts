import { describe, expect, it } from "vitest";
import { hitungRekap } from "../rekap";

const shifts = [{ id: "pagi", nama: "Pagi", jam_mulai: "09:00", jam_selesai: "17:00" }];

describe("hitungRekap", () => {
  it("membedakan tepat, telat, tidak absen, belum mulai, dan izin", () => {
    const { baris, ringkas } = hitungRekap({
      shifts,
      jadwal: [
        { id: "j1", shift_id: "pagi", pengguna_id: "a", tanggal: "2026-10-01" },
        { id: "j2", shift_id: "pagi", pengguna_id: "a", tanggal: "2026-10-02" },
        { id: "j3", shift_id: "pagi", pengguna_id: "a", tanggal: "2026-10-03" },
        { id: "j4", shift_id: "pagi", pengguna_id: "a", tanggal: "2026-10-05" },
      ],
      absensi: [
        { id: "x1", pengguna_id: "a", jadwal_id: "j1", tanggal: "2026-10-01", masuk_at: "2026-10-01T02:00:00Z", pulang_at: "2026-10-01T10:00:00Z", status: "tepat", telat_menit: 0 },
        { id: "x2", pengguna_id: "a", jadwal_id: "j2", tanggal: "2026-10-02", masuk_at: "2026-10-02T02:12:00Z", pulang_at: null, status: "telat", telat_menit: 12 },
      ],
      izin: [{ pengguna_id: "a", tanggal: "2026-10-04", jenis: "sakit" }],
      // 5 Okt 10.00 WIB: shift 5 Okt belum selesai
      sekarang: new Date("2026-10-05T03:00:00Z"),
    });
    expect(baris.map((b) => b.status)).toEqual(["tepat", "telat", "tidak_absen", "sakit", "belum"]);
    expect(ringkas[0]).toMatchObject({ jadwal: 3, hadir: 2, tepat: 1, telat: 1, menitTelat: 12, tidakAbsen: 1, izin: 1, menitKerja: 480 });
  });

  it("absen tanpa jadwal tetap terhitung hadir", () => {
    const { ringkas } = hitungRekap({
      shifts,
      jadwal: [],
      absensi: [{ id: "x", pengguna_id: "b", jadwal_id: null, tanggal: "2026-10-01", masuk_at: "2026-10-01T02:00:00Z", pulang_at: "2026-10-01T05:00:00Z", status: "tanpa_jadwal", telat_menit: 0 }],
      izin: [],
    });
    expect(ringkas[0]).toMatchObject({ hadir: 1, tanpaJadwal: 1, menitKerja: 180, jadwal: 0 });
  });
});
