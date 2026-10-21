import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  db: vi.fn(),
  filters: [] as unknown[][],
}));
vi.mock("server-only", () => ({}));
vi.mock("../session", () => ({ getSession: m.session }));
vi.mock("../supabase/server", () => ({ supabaseServer: m.db }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
import { loadJadwalLihat } from "../jadwal-lihat";
import { rentangLihat } from "../jadwal/rentang-lihat";
beforeEach(() => {
  vi.clearAllMocks();
  m.filters = [];
});
describe("read-only shift schedule", () => {
  it.each([
    null,
    "hrd",
    "spv",
    "finance",
    "admin_gudang",
    "pemantau_pos",
    "kasir",
    "barista",
    "tablet",
    "mitra",
  ])("blocks %s before DB access", async (role) => {
    m.session.mockResolvedValue(
      role ? { status: "aktif", active: { role } } : null,
    );
    await expect(loadJadwalLihat({})).rejects.toThrow("NOT_FOUND");
    expect(m.db).not.toHaveBeenCalled();
  });
  it.each(["owner", "admin_pusat"])(
    "only returns published assignments for %s",
    async (role) => {
      m.session.mockResolvedValue({ status: "aktif", active: { role } });
      const from = vi.fn((table: string) => {
        const data =
          table === "outlet"
            ? [{ id: "o1", nama: "Outlet" }]
            : table === "jadwal_shift"
              ? [
                  {
                    id: "published",
                    pengguna_id: "u1",
                    shift_id: "s1",
                    tanggal: "2026-10-21",
                    status: "terbit",
                  },
                  { id: "draft", pengguna_id: "u2", status: "draft" },
                ]
              : table === "pengguna"
                ? [{ id: "u1", nama: "Nama historis" }]
                : [];
        const q = {
          select: () => q,
          eq: (...args: unknown[]) => {
            m.filters.push([table, ...args]);
            return q;
          },
          is: () => q,
          gte: () => q,
          lte: () => q,
          order: async () => ({ data, error: null }),
          in: async (_k: string, ids: string[]) => {
            expect(ids).toEqual(["u1"]);
            return { data, error: null };
          },
        };
        return q;
      });
      m.db.mockResolvedValue({ from });
      const d = await loadJadwalLihat({ tanggal: "2026-10-21" });
      expect(d.jadwal.map((j) => j.id)).toEqual(["published"]);
      expect(d.nama.u1).toBe("Nama historis");
      expect(m.filters).toContainEqual(["jadwal_shift", "status", "terbit"]);
      expect(d.outlet?.id).toBe("o1");
    },
  );
  it("rejects a disabled admin", async () => {
    m.session.mockResolvedValue({
      status: "nonaktif",
      active: { role: "admin_pusat" },
    });
    await expect(loadJadwalLihat({})).rejects.toThrow("NOT_FOUND");
    expect(m.db).not.toHaveBeenCalled();
  });
});
describe("day/week/month ranges", () => {
  it("uses Jakarta today by default and rejects impossible dates", () => {
    expect(rentangLihat({ tanggal: "2026-02-30" }, "2026-10-21")).toMatchObject(
      { start: "2026-10-21", end: "2026-10-21" },
    );
    expect(
      rentangLihat({ mode: "x", tanggal: "2026-10-21" }).days,
    ).toHaveLength(1);
  });
  it("includes the full Monday-Sunday week across month boundaries", () => {
    expect(
      rentangLihat({ mode: "minggu", tanggal: "2026-11-01" }),
    ).toMatchObject({
      start: "2026-10-26",
      end: "2026-11-01",
      next: { tanggal: "2026-11-08" },
    });
  });
  it("handles leap years and year boundaries", () => {
    expect(rentangLihat({ mode: "bulan", bulan: "2028-02" }).days).toHaveLength(
      29,
    );
    expect(rentangLihat({ mode: "bulan", bulan: "2026-12" }).next).toEqual({
      bulan: "2027-01",
    });
    expect(
      rentangLihat({ mode: "bulan", bulan: "2026-13" }, "2026-10-21").bulan,
    ).toBe("2026-10");
  });
});
