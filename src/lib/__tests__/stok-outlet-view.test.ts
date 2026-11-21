// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { StokOutletView } from "@/app/(app)/stok/outlet/view";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/stok-outlet-actions", () => ({
  bacaLaporanStok: vi.fn(),
  perintahStokOutlet: vi.fn(),
  fotoStokOutlet: vi.fn(),
  bukaFotoStok: vi.fn(),
}));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
function props(): ComponentProps<typeof StokOutletView> {
  return {
    outlets: [
      { id: "a", nama: "Kominot" },
      { id: "b", nama: "UHB" },
    ],
    tujuanOutlets: [
      { id: "a", nama: "Kominot" },
      { id: "b", nama: "UHB" },
    ],
    stok: [{ outlet_id: "a", bahan_id: "kopi", jumlah: 125 }],
    outlet: "a",
    awal: "2026-11-01",
    akhir: "2026-11-21",
    hari: "2026-11-21",
    bahan: [
      { id: "kopi", nama: "Kopi", satuan_pakai: "g", stok_min: 100 },
      { id: "susu", nama: "Susu", satuan_pakai: "ml", stok_min: 50 },
    ],
    pengaturan: [],
    data: {
      ringkasan: [],
      riwayat: [],
      lanjut: false,
      mulai: "",
      selesai: "",
      dibaca_at: "",
      awal_riwayat: null,
    },
    permintaan: [],
    transfer: [],
    kelola: true,
    pusat: true,
    bahanPilih: null,
  };
}
const button = (s: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(s))!;
it("stock management uses current stock even when report period/material is filtered", async () => {
  await act(async () =>
    root.render(
      createElement(StokOutletView, { ...props(), bahanPilih: "susu" }),
    ),
  );
  expect(host.textContent).toContain("125 g");
  await act(async () => button("Koreksi stok").click());
  expect(host.querySelector("dialog")?.open).toBe(true);
  expect(host.textContent).toContain("Stok saat ini: 125 g");
});
it("read-only role cannot modify stock; reports keep export and range controls", async () => {
  await act(async () =>
    root.render(
      createElement(StokOutletView, {
        ...props(),
        kelola: false,
        pusat: false,
      }),
    ),
  );
  expect(host.textContent).not.toContain("Koreksi stok");
  await act(async () => button("Penggunaan & Kartu Bahan").click());
  expect(host.textContent).toContain("Ekspor PDF");
  expect(host.textContent).toContain("Ekspor Excel");
  expect(host.textContent).toContain("7 hari terakhir");
  expect(host.querySelectorAll("input[type=date]")).toHaveLength(2);
});
it("restock requests and transfer confirmation are separate from immediate stock correction", async () => {
  await act(async () => root.render(createElement(StokOutletView, props())));
  await act(async () => button("Permintaan Restock").click());
  expect(host.textContent).toContain("Permintaan tidak menambah stok");
  await act(async () => button("Transfer Outlet").click());
  expect(host.textContent).toContain("setelah penerimaan dikonfirmasi");
});
