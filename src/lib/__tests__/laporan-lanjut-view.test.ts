// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { TindakLanjutView } from "@/app/(app)/laporan/[id]/tindak-lanjut/view";
import { RekapLaporan } from "@/app/(app)/laporan/rekap/view";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/laporan-lanjut-actions", () => ({
  kelolaLaporanLanjut: vi.fn(),
  uploadBuktiLaporan: vi.fn(),
  bukaBuktiLaporan: vi.fn(),
}));
vi.mock("@/components/dialog-tanya", () => ({ tanya: vi.fn() }));
vi.mock("@/components/charts", () => ({
  ChartCard: ({ children }: { children: unknown }) =>
    createElement("section", null, children as never),
  TrendChart: ({ unit }: { unit?: string }) =>
    createElement("span", { "data-unit": unit ?? "money" }),
  StatTile: ({ label, value }: { label: string; value: string }) =>
    createElement("div", null, label + " " + value),
}));
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const props = (): ComponentProps<typeof TindakLanjutView> => ({
  laporan: {
    id: "r",
    nama_outlet: "Outlet A",
    outlet_id: "a",
    periode: "2026-10-01",
  } as never,
  hak: [
    {
      key: "transfer:1",
      nama: "Mitra A",
      jenis: "Bagi hasil",
      jumlah: 100,
      bank: null,
      rekening: null,
    },
  ],
  bayar: [],
  meetings: [],
  peserta: [
    { id: "u", nama: "Mitra A" },
    { id: "f", nama: "Finance" },
  ],
  user: "u",
  pusat: false,
  bisaMeeting: true,
  riwayat: [],
});
const button = (label: string) =>
  [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label),
  );
it("partner sees rights and meeting request but no payment mutations", async () => {
  await act(async () => root.render(createElement(TindakLanjutView, props())));
  expect(host.textContent).toContain("Belum tercatat");
  expect(button("Catat pembayaran")).toBeUndefined();
  expect(button("Ajukan pembahasan")).toBeTruthy();
  await act(async () => button("Ajukan pembahasan")!.click());
  expect(host.querySelector('input[type="datetime-local"]')).toBeTruthy();
  expect(host.textContent).toContain(
    "Peserta (pilih Mitra dan Akunting/Pengelola)",
  );
});
it("finance has explicit payment form, upload evidence and separate rounding field", async () => {
  await act(async () =>
    root.render(
      createElement(TindakLanjutView, { ...props(), pusat: true, user: "f" }),
    ),
  );
  await act(async () => button("Catat pembayaran")!.click());
  expect(host.querySelector('input[type="file"]')).toBeTruthy();
  expect(host.textContent).toContain("Penyesuaian pembulatan");
  expect(button("Simpan pembayaran")).toBeTruthy();
});
it("report recap shows undefined zero-sales margin and percent chart with correct unit", async () => {
  const l = {
    id: "r",
    outlet_id: "a",
    nama_outlet: "Outlet A",
    periode: "2026-10-01",
    pendapatan: [],
    diskon: 0,
    persediaan_awal: 0,
    pembelian: 0,
    persediaan_akhir: 0,
    modal_awal: 0,
    sedekah: 0,
    beban: [],
    bagi_hasil: [],
    transfer: [],
    laba_bersih: 0,
  } as never;
  await act(async () =>
    root.render(
      createElement(RekapLaporan, {
        list: [l],
        bayar: [],
        outlets: [{ id: "a", nama: "Outlet A" }],
        outlet: "a",
        dari: "",
        sampai: "",
        tahun: "",
      }),
    ),
  );
  expect(host.textContent).toContain("Margin laba bersih —");
  expect(host.querySelector('[data-unit="%"]')).toBeTruthy();
  expect(host.textContent).toContain("Rekap per bulan");
});
