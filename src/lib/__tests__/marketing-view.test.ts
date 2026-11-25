// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: m.session }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: m.db }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
import Page from "@/app/(app)/marketing/shift/page";
import { ROLES } from "../roles";
import { mobileQuickLinks } from "../dashboard-navigation";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  m.session.mockResolvedValue({ active: { role: "marketing" } });
  m.db.mockResolvedValue({ rpc: m.rpc });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
it("uses a narrow menu while keeping the existing guest read-only", () => {
  expect(ROLES.marketing.label).toBe("Marketing Matoer");
  expect(ROLES.marketing.allOutlets).toBe(true);
  expect(ROLES.marketing.menu.map((x) => x.href)).toEqual([
    "/pantau-pos",
    "/promo",
    "/marketing/shift",
  ]);
  expect(ROLES.pemantau_pos.menu.map((x) => x.href)).toEqual(["/pantau-pos"]);
  expect(mobileQuickLinks("marketing").map((x) => x.href)).toEqual([
    "/pantau-pos",
    "/promo",
    "/marketing/shift",
  ]);
});
it.each(["pemantau_pos", "finance", "kasir", "barista", "mitra", "spv"])(
  "rejects %s before querying the schedule",
  async (role) => {
    m.session.mockResolvedValue({ active: { role } });
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(m.db).not.toHaveBeenCalled();
  },
);
it("shows outlet-specific empty states, published names and overnight hours with no edit controls", async () => {
  m.rpc.mockResolvedValue({
    data: {
      tanggal: "2026-11-25",
      outlets: [
        { id: "a", nama: "Outlet A" },
        { id: "b", nama: "Outlet B" },
      ],
      jadwal: [
        {
          id: "j",
          outlet_id: "a",
          nama: "Petugas A",
          jabatan: "Barista",
          shift: "Malam",
          jam_mulai: "18:00:00",
          jam_selesai: "01:00:00",
        },
      ],
    },
  });
  const el = await Page({ searchParams: Promise.resolve({}) });
  await act(async () => root.render(el));
  expect(host.textContent).toContain("Petugas A");
  expect(host.textContent).toContain("(+1 hari)");
  expect(host.textContent).toContain("Belum ada jadwal terbit");
  expect(host.textContent).not.toMatch(/Hapus|Simpan|Edit/);
  expect(m.rpc).toHaveBeenCalledWith("jadwal_marketing_hari_ini");
});
it("reports a failed fetch as an error instead of showing no shifts", async () => {
  m.rpc.mockResolvedValue({ error: { message: "Koneksi gagal" } });
  await act(async () =>
    root.render(await Page({ searchParams: Promise.resolve({}) })),
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Koneksi gagal",
  );
  expect(host.textContent).not.toContain("Belum ada jadwal terbit");
});
