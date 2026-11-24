import { it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Laporan } from "../laporan";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getSession: async () => ({ active: { role: "owner" } }),
}));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => mocks }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("@/app/(app)/laporan/[id]/visual", () => ({
  LaporanVisual: () =>
    createElement("div", null, "Ringkasan dan grafik bulanan"),
}));
vi.mock("@/app/(app)/laporan/[id]/pdf", () => ({
  UnduhPdf: () => createElement("button", null, "Unduh PDF"),
}));
vi.mock("@/app/(app)/laporan/[id]/excel", () => ({
  UnduhExcel: () => createElement("button", null, "Excel"),
}));
import ProyeksiLaporan from "@/app/(app)/laporan/proyeksi/page";
it("source-backed internal entry uses monthly document too; PDF appendix option is absent", async () => {
  const snapshot = {
    id: "oct",
    outlet_id: "a",
    periode: "2026-10-01",
    nama_outlet: "Outlet A",
    modal_awal: 200000,
    persediaan_awal: 0,
    pembelian: 0,
    persediaan_akhir: 0,
    pendapatan: [{ nama: "Tunai", jumlah: 1000 }],
    diskon: 0,
    sedekah: 0,
    persen_sedekah: 2.5,
    beban: [],
    laba_bersih: 1000,
    bagi_hasil: [],
    transfer: [],
    karyawan: [],
    sumber_excel: {
      versi: 1,
      nama_file: "oct.xlsx",
      nama_sumber: "A",
      outlet_tujuan: "A",
      periode: "2026-10",
      sha256: "hash",
      xlsx_base64: "",
      koreksi: [],
      catatan: [],
      lembar: [{ nama: "Laporan Keuangan", baris: [] }],
    },
  } as unknown as Laporan;
  mocks.rpc.mockResolvedValue({ data: {}, error: null });
  mocks.from.mockImplementation((table: string) => {
    const data =
      table === "outlet"
        ? [{ id: "a", nama: "Outlet A" }]
        : table === "laporan_internal"
          ? { snapshot }
          : table === "perusahaan"
            ? { nama: "Perusahaan" }
            : null;
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      lt: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: () => q,
      then: (r: (v: unknown) => unknown) =>
        Promise.resolve(r({ data, error: null })),
    };
    return q;
  });
  const result = await ProyeksiLaporan({
    searchParams: Promise.resolve({ outlet: "a", bulan: "2026-10" }),
  });
  const html = renderToStaticMarkup(result);
  expect(html).toContain("Ringkasan dan grafik bulanan");
  expect(html).toContain("<article");
  expect(html).toContain("Kembali ke daftar laporan");
  expect(html).not.toContain("PDF + lampiran lengkap");
});
