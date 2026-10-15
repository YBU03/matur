import { describe, it, expect } from "vitest";
import { ringkasHrd } from "../hrd-dashboard";
import type { BarisRekap, StatusHari } from "../jadwal/rekap";
const row = (uid: string, status: StatusHari, tanggal = "2026-10-15", shift = true): BarisRekap => ({ pengguna_id: uid, tanggal, status, menitKerja: 0, ...(shift ? { shift: { id: "shift", nama: "Pagi", jam_mulai: "08:00", jam_selesai: "16:00" } } : {}), ...(["tepat", "telat", "tanpa_jadwal"].includes(status) ? { absen: { id: uid, pengguna_id: uid, jadwal_id: shift ? "shift" : null, tanggal, status: status as "tepat" | "telat" | "tanpa_jadwal", masuk_at: "2026-10-15T01:00:00Z", pulang_at: null, telat_menit: status === "telat" ? 10 : 0 } } : {}) });
describe("ringkasan HRD", () => {
  it("returns an empty state without a fabricated attendance percentage", () => {
    expect(ringkasHrd([])).toMatchObject({ tercatat: 0, hadir: 0, persen: null });
  });
  it("counts multiple shifts or outlets once per person and date, prioritizing lateness", () => {
    expect(ringkasHrd([row("a","tepat"), row("a","telat"), row("a","belum")])).toMatchObject({ tercatat: 1, terjadwal: 1, hadir: 1, telat: 1, tepat: 0, belum: 0, persen: 100 });
  });
  it("keeps leave separate and prevents unscheduled attendance from inflating the rate", () => {
    expect(ringkasHrd([row("a","tepat"),row("b","belum"),row("c","izin","2026-10-15",false),row("d","tanpa_jadwal","2026-10-15",false)])).toMatchObject({ tercatat: 4, terjadwal: 2, hadir: 2, izin: 1, tanpaJadwal: 1, persen: 50 });
  });
  it("retains separate person-days in the trend", () => {
    expect(ringkasHrd([row("a","tepat"),row("a","tepat","2026-10-14")])).toMatchObject({ tercatat: 2, hadir: 2 });
  });
});
