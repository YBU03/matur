import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  db: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("../session", () => ({ getSession: mocks.session }));
vi.mock("../supabase/server", () => ({ supabaseServer: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { aturTampilDashboardPos } from "../outlet-dashboard-actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.mockResolvedValue({ rpc: mocks.rpc });
});
describe("izin dan penyimpanan switch dashboard outlet", () => {
  it.each([null, "hrd", "finance", "admin_gudang", "tablet"])(
    "menolak peran %s sebelum mengakses database",
    async (role) => {
      mocks.session.mockResolvedValue(role ? { active: { role } } : null);
      expect(
        await aturTampilDashboardPos("outlet", true, false),
      ).toHaveProperty("error");
      expect(mocks.db).not.toHaveBeenCalled();
    },
  );
  it.each(["owner", "admin_pusat"])(
    "menyimpan OFF oleh %s dan menyegarkan dashboard",
    async (role) => {
      mocks.session.mockResolvedValue({ active: { role } });
      mocks.rpc.mockResolvedValue({ data: false, error: null });
      expect(await aturTampilDashboardPos("outlet", true, false)).toEqual({
        value: false,
      });
      expect(mocks.rpc).toHaveBeenCalledWith("atur_tampil_dashboard_pos", {
        p_outlet: "outlet",
        p_sebelum: true,
        p_tampil: false,
      });
      expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard-pos");
    },
  );
  it("menampilkan kegagalan stale dan tidak mengklaim perubahan tersimpan", async () => {
    mocks.session.mockResolvedValue({ active: { role: "owner" } });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Pengaturan sudah berubah" },
    });
    expect(await aturTampilDashboardPos("outlet", true, false)).toEqual({
      error: "Pengaturan sudah berubah",
    });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
