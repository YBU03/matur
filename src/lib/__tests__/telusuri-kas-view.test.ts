// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { RekonsiliasiKas } from "@/components/rekonsiliasi-kas";
import { periksaKas } from "@/lib/rekonsiliasi-kas-actions";
import { revisiAktual } from "@/lib/accounting-operasional-actions";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/rekonsiliasi-kas-actions", () => ({
  periksaKas: vi.fn(),
  koreksiKas: vi.fn(),
}));
vi.mock("@/lib/accounting-operasional-actions", () => ({
  revisiAktual: vi.fn(),
}));
vi.mock("@/components/confirm-edit", () => ({
  Modal: ({ children }: { children: unknown }) =>
    createElement("section", null, children as never),
}));
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const click = async (label: string) => {
  const b = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label),
  );
  expect(b).toBeTruthy();
  await act(async () => b!.click());
};
const data = () => ({
  sesi: {
    id: "shift22",
    outlet_id: "uhb",
    tanggal_shift: "2026-11-22",
    dibuka_at: "2026-11-21T18:57:56Z",
    ditutup_at: "2026-11-23T09:12:58Z",
    modal_laci: 0,
    pos_tim: true,
    fisik_akhir: 46000,
    setoran: 46000,
    seharusnya: 154000,
    selisih: -108000,
  },
  tanggal: "2026-11-23",
  hitung: { tunai: 154000, laci: 0, keluar: 0, seharusnya: 154000 },
  biaya: [],
  pilihan: [
    {
      id: "shift22",
      tanggal: "2026-11-23",
      nama: "UHB",
      dibuka_at: "2026-11-21T18:57:56Z",
      ditutup_at: "2026-11-23T09:12:58Z",
      tanggal_terkait: ["2026-11-22", "2026-11-23"],
    },
  ],
  riwayat: [],
  penyerahan: [],
});
it("opens the exact cross-date shift and routes sales correction to its full activity period", async () => {
  vi.mocked(periksaKas).mockResolvedValue({ data: data() });
  await act(async () =>
    root.render(
      createElement(RekonsiliasiKas, { sesiId: "shift22", label: "Selisih" }),
    ),
  );
  await click("Selisih");
  expect(periksaKas).toHaveBeenCalledWith("shift22");
  expect(host.textContent).toContain("Tanggal awal shift 2026-11-22");
  expect(host.textContent).toContain("Penjualan tunai harian");
  expect(host.querySelector("a")?.getAttribute("href")).toBe(
    "/koreksi-penjualan?outlet=uhb&dari=2026-11-22&sampai=2026-11-23",
  );
});
it("accepts physical zero with a reason, preserves the previous-value guard, and reloads diagnosis", async () => {
  vi.mocked(periksaKas).mockResolvedValue({ data: data() });
  vi.mocked(revisiAktual).mockResolvedValue({ ok: "ok" });
  await act(async () =>
    root.render(createElement(RekonsiliasiKas, { sesiId: "shift22" })),
  );
  await click("Periksa &");
  await click("Revisi aktual");
  const input = host.querySelector('input[type="number"]') as HTMLInputElement;
  const reason = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "0");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(reason, "Uang fisik benar kosong");
    reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Simpan revisi");
  expect(revisiAktual).toHaveBeenCalledWith({
    sesi_id: "shift22",
    aktual: 0,
    sebelum: 46000,
    alasan: "Uang fisik benar kosong",
  });
  expect(periksaKas).toHaveBeenCalledTimes(2);
});
