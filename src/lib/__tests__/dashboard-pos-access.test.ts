import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  session: vi.fn(),
  db: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("../session", () => ({ getSession: mock.session }));
vi.mock("../supabase/server", () => ({ supabaseServer: mock.db }));
vi.mock("next/navigation", () => ({ notFound: mock.notFound }));
vi.mock("server-only", () => ({}));
import { loadDashboardPos } from "../dashboard-pos";
beforeEach(() => vi.clearAllMocks());
describe("Dashboard POS server access", () => {
  it.each(["owner", "admin_pusat"])(
    "loads outlets for %s and validates outlet filters",
    async (role) => {
      mock.session.mockResolvedValue({ active: { role } });
      const rows = [
        { id: "allowed", nama: "Outlet Test", jam_operasional: null },
      ];
      const order = vi.fn().mockResolvedValue({ data: rows, error: null });
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order,
      };
      mock.db.mockResolvedValue({ from: () => chain });
      expect(
        await loadDashboardPos({ outlet: "allowed", mode: "simulasi" }),
      ).toMatchObject({
        outlets: rows,
        outletId: "allowed",
        mode: "simulasi",
        error: null,
      });
      expect(await loadDashboardPos({ outlet: "unknown" })).toMatchObject({
        outletId: null,
        mode: "asli",
      });
    },
  );
  it.each([
    null,
    "pemantau_pos",
    "hrd",
    "admin_gudang",
    "finance",
    "mitra",
    "spv",
    "kasir",
    "barista",
    "tablet",
  ])("rejects %s before querying data", async (role) => {
    mock.session.mockResolvedValue(role ? { active: { role } } : null);
    await expect(loadDashboardPos({})).rejects.toThrow("NOT_FOUND");
    expect(mock.db).not.toHaveBeenCalled();
  });
});
