import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  notFound: vi.fn(() => {
    throw Error("NOT_FOUND");
  }),
}));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ from: mocks.from }),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/charts", () => ({
  ChartCard: () => null,
  TrendChart: () => null,
}));
import Bep from "@/app/(app)/portal/bep/page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    active: { role: "owner" },
    userId: "owner",
  });
});
it("BEP queries the selected outlet only and rejects an unknown outlet", async () => {
  const eq = vi.fn();
  const agreements = [
    {
      outlet_id: "kominot",
      investasi_awal: 135000000,
      outlet: { nama: "Kominot" },
      mitra: { nama: "A" },
    },
    {
      outlet_id: "uhb",
      investasi_awal: 135000000,
      outlet: { nama: "UHB" },
      mitra: { nama: "B" },
    },
  ];
  mocks.from.mockImplementation((table: string) => {
    const q = {
      select: () => q,
      eq: (...args: unknown[]) => {
        eq(table, ...args);
        return q;
      },
      is: () => q,
      order: () => q,
      then: (resolve: (r: unknown) => unknown) =>
        Promise.resolve(
          resolve({
            data: table === "perjanjian" ? agreements : [],
            error: null,
          }),
        ),
    };
    return q;
  });
  await Bep({ searchParams: Promise.resolve({ outlet: "uhb" }) });
  expect(eq).toHaveBeenCalledWith("laporan_bulanan", "outlet_id", "uhb");
  expect(eq).not.toHaveBeenCalledWith(
    "laporan_bulanan",
    "outlet_id",
    "kominot",
  );
  mocks.from.mockClear();
  await expect(
    Bep({ searchParams: Promise.resolve({ outlet: "unknown" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.from).not.toHaveBeenCalledWith("laporan_bulanan");
});
