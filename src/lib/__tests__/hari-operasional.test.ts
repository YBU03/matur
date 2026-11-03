import { describe, expect, it } from "vitest";
import { awalOperasional, tglOperasional } from "../hari-operasional";

describe("hari operasional (tutup buku 03.00 WIB mulai 2 Nov 2026)", () => {
  it("transaksi lewat tengah malam masih hari sebelumnya", () => {
    expect(tglOperasional("2026-11-02T17:42:19Z")).toBe("2026-11-02"); // 3 Nov 00.42 WIB
    expect(tglOperasional("2026-11-02T19:59:00Z")).toBe("2026-11-02"); // 3 Nov 02.59 WIB
    expect(tglOperasional("2026-11-02T20:00:00Z")).toBe("2026-11-03"); // 3 Nov 03.00 WIB
    expect(tglOperasional("2026-11-02T01:15:00Z")).toBe("2026-11-02"); // 2 Nov 08.15 WIB
  });
  it("sebelum 2 Nov tetap tanggal kalender (data PDF 1 Nov utuh)", () => {
    expect(tglOperasional("2026-10-31T17:09:00Z")).toBe("2026-11-01"); // 1 Nov 00.09 WIB
    expect(tglOperasional("2026-11-01T16:30:00Z")).toBe("2026-11-01"); // 1 Nov 23.30 WIB
    expect(tglOperasional("2026-11-01T18:30:00Z")).toBe("2026-11-01"); // 2 Nov 01.30 WIB → malam 1 Nov
  });
  it("awal hari operasional", () => {
    expect(awalOperasional("2026-11-01")).toBe("2026-11-01T00:00:00+07:00");
    expect(awalOperasional("2026-11-02")).toBe("2026-11-02T03:00:00+07:00");
    expect(new Date(awalOperasional("2026-11-03")).toISOString()).toBe("2026-11-02T20:00:00.000Z");
  });
});
