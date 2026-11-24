import { it, expect } from "vitest";
import { semuaHalaman } from "../paginasi-laporan";
it("reads every page and never returns partial exports after a later failure", async () => {
  const values = [1, 2, 3, 4, 5];
  expect(
    await semuaHalaman(
      async (a, b) => ({ data: values.slice(a, b + 1), error: null }),
      2,
    ),
  ).toEqual(values);
  await expect(
    semuaHalaman(
      async (a, b) =>
        a === 0
          ? { data: values.slice(a, b + 1), error: null }
          : { data: null, error: { message: "Koneksi terputus" } },
      2,
    ),
  ).rejects.toThrow("Koneksi terputus");
});
