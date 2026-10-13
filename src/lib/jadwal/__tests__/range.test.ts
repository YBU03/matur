import { describe, expect, it } from "vitest";

import { defaultScope, resolveGenerateRange } from "../range";
import { monthWeeks } from "../waktu";

// September 2026: tanggal 1 jatuh hari Selasa, 30 hari.
const BULAN = "2026-09";

describe("resolveGenerateRange", () => {
  it("satu bulan penuh mengambil seluruh tanggal", () => {
    expect(resolveGenerateRange({ month: BULAN, scope: "bulan", today: "2026-09-14" })).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
      days: 30,
    });
  });

  it("sisa bulan mulai dari hari ini, bukan tanggal 1", () => {
    expect(resolveGenerateRange({ month: BULAN, scope: "sisa-bulan", today: "2026-09-14" })).toEqual({
      start: "2026-09-14",
      end: "2026-09-30",
      days: 17,
    });
  });

  it("sisa bulan pada bulan mendatang tetap mulai dari tanggal 1", () => {
    expect(resolveGenerateRange({ month: "2026-10", scope: "sisa-bulan", today: "2026-09-14" })).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
      days: 31,
    });
  });

  it("sisa bulan tidak berlaku untuk bulan yang sudah lewat", () => {
    expect(resolveGenerateRange({ month: "2026-08", scope: "sisa-bulan", today: "2026-09-14" })).toBeNull();
  });

  it("minggu berjalan mulai hari ini sampai Minggu", () => {
    // 14 September 2026 hari Senin, jadi minggunya berakhir 20 September.
    expect(resolveGenerateRange({ month: BULAN, scope: "minggu-ini", today: "2026-09-17" })).toEqual({
      start: "2026-09-17",
      end: "2026-09-20",
      days: 4,
    });
  });

  it("minggu berjalan dipotong di ujung bulan", () => {
    expect(resolveGenerateRange({ month: BULAN, scope: "minggu-ini", today: "2026-09-29" })).toEqual({
      start: "2026-09-29",
      end: "2026-09-30",
      days: 2,
    });
  });

  it("minggu berjalan tidak berlaku bila hari ini di luar bulan itu", () => {
    expect(resolveGenerateRange({ month: "2026-11", scope: "minggu-ini", today: "2026-09-14" })).toBeNull();
  });

  it("minggu tertentu diambil utuh walau sebagian sudah lewat", () => {
    // Minggu ke-1 September 2026: Selasa 1 sampai Minggu 6.
    expect(
      resolveGenerateRange({ month: BULAN, scope: "minggu", weekIndex: 1, today: "2026-09-14" }),
    ).toEqual({ start: "2026-09-01", end: "2026-09-06", days: 6 });
  });

  it("nomor minggu yang tidak ada ditolak", () => {
    expect(resolveGenerateRange({ month: BULAN, scope: "minggu", weekIndex: 9, today: "2026-09-14" })).toBeNull();
    expect(resolveGenerateRange({ month: BULAN, scope: "minggu", today: "2026-09-14" })).toBeNull();
  });
});

describe("monthWeeks", () => {
  it("menutupi seluruh bulan tanpa celah maupun tumpang tindih", () => {
    const weeks = monthWeeks(BULAN);

    expect(weeks[0].start).toBe("2026-09-01");
    expect(weeks.at(-1)?.end).toBe("2026-09-30");

    weeks.forEach((week, index) => {
      expect(week.index).toBe(index + 1);
      if (index > 0) {
        const sebelumnya = weeks[index - 1];
        expect(new Date(week.start).getTime() - new Date(sebelumnya.end).getTime()).toBe(86_400_000);
      }
    });
  });

  it("minggu di tengah bulan selalu Senin sampai Minggu", () => {
    const tengah = monthWeeks(BULAN).slice(1, -1);
    tengah.forEach((week) => {
      expect(new Date(`${week.start}T00:00:00Z`).getUTCDay()).toBe(1);
      expect(new Date(`${week.end}T00:00:00Z`).getUTCDay()).toBe(0);
    });
  });
});

describe("defaultScope", () => {
  it("melanjutkan dari hari ini bila bulannya sedang berjalan", () => {
    expect(defaultScope("2026-09", "2026-09-14")).toBe("sisa-bulan");
  });

  it("mengambil bulan penuh untuk bulan lain", () => {
    expect(defaultScope("2026-10", "2026-09-14")).toBe("bulan");
    expect(defaultScope("2026-08", "2026-09-14")).toBe("bulan");
  });
});
