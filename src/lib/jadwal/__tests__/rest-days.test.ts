import { describe, expect, it } from "vitest";

import { planRestDays } from "../libur";
import { generateSchedule } from "../engine";
import { eachDate, weekStart } from "../waktu";

const hosts = [
  { id: "host-a", weeklyDayOffQuota: 1 },
  { id: "host-b", weeklyDayOffQuota: 1 },
  { id: "host-c", weeklyDayOffQuota: 1 },
  { id: "host-d", weeklyDayOffQuota: 1 },
  { id: "host-e", weeklyDayOffQuota: 1 },
  { id: "host-f", weeklyDayOffQuota: 1 },
];

// 2026-03-02 adalah hari Senin.
const SENIN = "2026-03-02";
const MINGGU = "2026-03-08";

function rencana(startDate = SENIN, endDate = MINGGU, daftar = hosts, approved?: Set<string>) {
  return planRestDays({ startDate, endDate, hosts: daftar, approvedLeaveKeys: approved });
}

describe("planRestDays", () => {
  it("memberi tiap host jatah libur sesuai kuota mingguannya", () => {
    const { keys } = rencana();

    for (const host of hosts) {
      const libur = [...keys].filter((key) => key.startsWith(`${host.id}|`));
      expect(libur).toHaveLength(1);
    }
  });

  it("menyebar libur ke seluruh hari, tidak menumpuk berurutan", () => {
    const { perDate } = rencana();
    const jumlah = Object.values(perDate);

    // Enam host dan tujuh hari: paling banyak satu hari punya selisih satu peliburan.
    expect(Math.max(...jumlah) - Math.min(...jumlah)).toBeLessThanOrEqual(1);
    expect(Math.max(...jumlah)).toBeLessThanOrEqual(1);
  });

  it("tidak pernah membuat satu hari kosong sementara hari lain menumpuk", () => {
    const banyakHost = Array.from({ length: 12 }, (_, index) => ({
      id: `host-${String(index).padStart(2, "0")}`,
      weeklyDayOffQuota: 1,
    }));

    const { perDate } = rencana(SENIN, MINGGU, banyakHost);
    const jumlah = Object.values(perDate);

    // Dua belas host dibagi tujuh hari: tiap hari kebagian satu atau dua peliburan.
    expect(Math.min(...jumlah)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...jumlah) - Math.min(...jumlah)).toBeLessThanOrEqual(1);
  });

  it("menghitung izin yang sudah disetujui sebagai jatah liburnya", () => {
    const approved = new Set(["host-a|2026-03-05"]);
    const { keys } = rencana(SENIN, MINGGU, hosts, approved);

    const libur = [...keys].filter((key) => key.startsWith("host-a|"));
    expect(libur).toEqual(["host-a|2026-03-05"]);
  });

  it("menggeser hari libur tiap minggu supaya tidak selalu jatuh di hari yang sama", () => {
    const { keys } = rencana("2026-03-02", "2026-03-29");

    const hariLibur = [...keys]
      .filter((key) => key.startsWith("host-a|"))
      .map((key) => key.split("|")[1])
      .sort();

    expect(hariLibur.length).toBeGreaterThanOrEqual(4);

    const namaHari = new Set(hariLibur.map((tanggal) => new Date(`${tanggal}T00:00:00Z`).getUTCDay()));
    expect(namaHari.size).toBeGreaterThan(1);
  });

  it("menghasilkan rencana yang sama untuk masukan yang sama", () => {
    expect(rencana().keys).toEqual(rencana().keys);
  });
});

describe("penyebaran libur pada jadwal yang dihasilkan", () => {
  const shifts = [
    { id: "pagi", name: "Pagi", startTime: "06:00", endTime: "11:00", minHosts: 1, sortOrder: 1 },
    { id: "siang", name: "Siang", startTime: "11:00", endTime: "16:00", minHosts: 1, sortOrder: 2 },
    { id: "sore", name: "Sore", startTime: "16:00", endTime: "21:00", minHosts: 1, sortOrder: 3 },
  ];

  it("tidak menumpuk hari libur pada tanggal yang berdekatan", () => {
    const { assignments } = generateSchedule({
      startDate: "2026-03-02",
      endDate: "2026-03-29",
      hosts,
      shifts,
    });

    const dates = eachDate("2026-03-02", "2026-03-29");
    const bekerja = new Map<string, Set<string>>();
    assignments.forEach((item) => {
      const set = bekerja.get(item.workDate) ?? new Set<string>();
      set.add(item.hostId);
      bekerja.set(item.workDate, set);
    });

    const liburPerHari = dates.map((date) => hosts.length - (bekerja.get(date)?.size ?? 0));

    // Dalam tiap minggu penuh, jumlah yang libur antar hari tidak boleh timpang.
    const perMinggu = new Map<string, number[]>();
    dates.forEach((date, index) => {
      const week = weekStart(date);
      perMinggu.set(week, [...(perMinggu.get(week) ?? []), liburPerHari[index]]);
    });

    for (const [, jumlah] of perMinggu) {
      if (jumlah.length < 7) continue;
      expect(Math.max(...jumlah) - Math.min(...jumlah)).toBeLessThanOrEqual(1);
    }
  });
});
