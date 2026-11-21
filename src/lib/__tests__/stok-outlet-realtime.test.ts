import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ambilStok } from "../stok-realtime";
it("outlet minimum overrides shared default without changing quantities or affecting warehouse/simulation", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValue({
      data: {
        hari: "2026-11-21",
        bahan: [
          {
            id: "kopi",
            stok_min: 10,
            stok: 100,
            konversi: 1,
            harga: 20,
            stok_tutup: null,
          },
        ],
        shift: [],
      },
      error: null,
    });
  const eq = vi
    .fn()
    .mockResolvedValue({
      data: [{ bahan_id: "kopi", minimum: 25 }],
      error: null,
    });
  const from = vi.fn().mockReturnValue({ select: () => ({ eq }) });
  const db = { rpc, from } as unknown as SupabaseClient;
  const original = await ambilStok(db, "outlet");
  expect(original.data?.bahan[0].stok_min).toBe(25);
  expect(original.data?.bahan[0].stok).toBe(100);
  from.mockClear();
  expect((await ambilStok(db, null)).data?.bahan[0].stok_min).toBe(10);
  expect(from).not.toHaveBeenCalled();
  expect(
    (await ambilStok(db, "outlet", "simulasi")).data?.bahan[0].stok_min,
  ).toBe(10);
  expect(from).not.toHaveBeenCalled();
});
