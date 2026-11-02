import { describe, expect, it } from "vitest";
import { awalOperasional, tglOperasional } from "../hari-operasional";

describe("hari operasional (tutup buku 03.00 WIB)", () => {
  it("transaksi lewat tengah malam masih hari sebelumnya", () => {
    expect(tglOperasional("2026-11-02T17:42:19Z")).toBe("2026-11-02"); // 3 Nov 00.42 WIB
    expect(tglOperasional("2026-11-02T19:59:00Z")).toBe("2026-11-02"); // 3 Nov 02.59 WIB
    expect(tglOperasional("2026-11-02T20:00:00Z")).toBe("2026-11-03"); // 3 Nov 03.00 WIB
    expect(tglOperasional("2026-11-02T01:15:00Z")).toBe("2026-11-02"); // 2 Nov 08.15 WIB
  });
  it("awal hari operasional jam 03.00 WIB", () => {
    expect(awalOperasional("2026-11-02")).toBe("2026-11-02T03:00:00+07:00");
    expect(new Date(awalOperasional("2026-11-03")).toISOString()).toBe("2026-11-02T20:00:00.000Z");
  });
});
