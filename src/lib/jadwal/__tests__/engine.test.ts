import { describe, expect, it } from "vitest";

import { generateSchedule, type SchedulingInput } from "../engine";

const shifts = [
  { id: "shift-pagi", name: "Shift Pagi", startTime: "06:00", endTime: "11:00", minHosts: 1, sortOrder: 1 },
  { id: "shift-siang", name: "Shift Siang", startTime: "11:00", endTime: "16:00", minHosts: 1, sortOrder: 2 },
];

function baseInput(overrides: Partial<SchedulingInput> = {}): SchedulingInput {
  return {
    startDate: "2026-03-02", // Senin
    endDate: "2026-03-08", // Minggu
    hosts: [
      { id: "host-a", weeklyDayOffQuota: 1 },
      { id: "host-b", weeklyDayOffQuota: 1 },
      { id: "host-c", weeklyDayOffQuota: 1 },
    ],
    shifts,
    ...overrides,
  };
}

describe("generateSchedule", () => {
  it("mengisi setiap shift sesuai jumlah host minimum", () => {
    const { assignments, warnings } = generateSchedule(baseInput());

    expect(warnings).toHaveLength(0);
    expect(assignments).toHaveLength(7 * 2);

    const perSlot = new Map<string, number>();
    assignments.forEach((item) => {
      const key = `${item.workDate}|${item.shiftId}`;
      perSlot.set(key, (perSlot.get(key) ?? 0) + 1);
    });
    expect([...perSlot.values()].every((count) => count === 1)).toBe(true);
  });

  it("tidak pernah menjadwalkan satu host di dua shift bertumpuk", () => {
    const overlapping = [
      { id: "shift-a", name: "A", startTime: "06:00", endTime: "12:00", minHosts: 1, sortOrder: 1 },
      { id: "shift-b", name: "B", startTime: "10:00", endTime: "16:00", minHosts: 1, sortOrder: 2 },
    ];
    const { assignments } = generateSchedule(
      baseInput({ shifts: overlapping, hosts: [{ id: "host-a", weeklyDayOffQuota: 0 }] }),
    );

    const perDate = new Map<string, string[]>();
    assignments.forEach((item) => {
      perDate.set(item.workDate, [...(perDate.get(item.workDate) ?? []), item.shiftId]);
    });
    expect([...perDate.values()].every((list) => list.length === 1)).toBe(true);
  });

  it("menghormati izin yang sudah disetujui", () => {
    const { assignments } = generateSchedule(
      baseInput({ approvedLeaves: [{ hostId: "host-a", date: "2026-03-03" }] }),
    );

    const onLeave = assignments.filter(
      (item) => item.hostId === "host-a" && item.workDate === "2026-03-03",
    );
    expect(onLeave).toHaveLength(0);
  });

  it("menghormati jatah libur mingguan", () => {
    const { assignments } = generateSchedule(baseInput());

    const daysWorked = new Map<string, Set<string>>();
    assignments.forEach((item) => {
      const set = daysWorked.get(item.hostId) ?? new Set<string>();
      set.add(item.workDate);
      daysWorked.set(item.hostId, set);
    });

    // Jatah libur 1x/minggu berarti maksimal 6 hari kerja dalam satu minggu.
    expect([...daysWorked.values()].every((set) => set.size <= 6)).toBe(true);
  });

  it("membagi beban secara merata antar host", () => {
    const { assignments } = generateSchedule(baseInput());

    const counts = new Map<string, number>();
    assignments.forEach((item) => counts.set(item.hostId, (counts.get(item.hostId) ?? 0) + 1));

    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("memberi peringatan bila host tidak cukup, bukan menggagalkan generate", () => {
    const { assignments, warnings } = generateSchedule(
      baseInput({
        hosts: [{ id: "host-a", weeklyDayOffQuota: 1 }],
        shifts: [{ ...shifts[0], minHosts: 3 }],
      }),
    );

    expect(assignments.length).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatchObject({ shift_name: "Shift Pagi", required: 3 });
    expect(warnings[0].assigned).toBeLessThan(3);
  });

  it("memperhitungkan penugasan manual yang sudah ada", () => {
    const { assignments } = generateSchedule(
      baseInput({
        startDate: "2026-03-02",
        endDate: "2026-03-02",
        existingAssignments: [{ hostId: "host-b", shiftId: "shift-pagi", workDate: "2026-03-02" }],
      }),
    );

    const pagi = assignments.filter((item) => item.shiftId === "shift-pagi");
    expect(pagi).toHaveLength(0);
  });

  it("menghasilkan keluaran yang sama untuk masukan yang sama", () => {
    const first = generateSchedule(baseInput());
    const second = generateSchedule(baseInput());
    expect(first).toEqual(second);
  });
});
