// @vitest-environment happy-dom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PosPromo } from "@/components/pos-promo";
import type { Promo, PromoQuote } from "../promo";

const api = vi.hoisted(() => ({
  daftarPromoKasir: vi.fn(),
  pesanPromo: vi.fn(),
  lepasPromo: vi.fn(),
}));
vi.mock("@/lib/promo-actions", () => api);
const promo = (extra: Partial<Promo> = {}): Promo => ({
  id: "trial",
  nama: "Trial opening",
  aktif: true,
  mulai: "2026-11-20",
  selesai: "2026-11-22",
  jam_mulai: "00:00",
  jam_selesai: "23:59:59",
  berakhir_at: "2026-11-20T23:59:59+07:00",
  semua_outlet: false,
  outlet_ids: ["uhb"],
  aturan: [
    { menu_id: "matcha", varian_ids: [], jenis: "harga_akhir", nilai: 11000 },
  ],
  kuota: 30,
  per_menu: false,
  bersama: false,
  boleh_manual: false,
  versi: 1,
  sisa_kuota: { semua: 30 },
  ...extra,
});
const quote: PromoQuote = {
  id: "reservation",
  nama: "Trial opening",
  diskon: 11000,
  subtotal: 22000,
  sampai_at: "2026-11-20T12:00:10+07:00",
  sisa: { semua: 0 },
};
let root: Root, host: HTMLDivElement;
const props = () => ({
  sesiId: "shift",
  izinId: "permit",
  kanal: "langsung",
  diskon: 0,
  items: [{ menu_id: "matcha", qty: 1, varian_ids: [] }],
  subtotal: 22000,
  menuNames: { matcha: "Matcha" },
  onQuote: vi.fn(),
  onBusy: vi.fn(),
  disabled: false,
  awal: [promo()],
});
async function render(p: ReturnType<typeof props>) {
  await act(async () => root.render(createElement(PosPromo, p)));
}
async function apply() {
  await act(async () => {
    const select = host.querySelector("select")!;
    select.value = "trial";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    [...host.querySelectorAll("button")]
      .find((b) => b.textContent?.includes("Terapkan"))!
      .click();
  });
}
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-20T12:00:00+07:00"));
  vi.resetAllMocks();
  api.lepasPromo.mockResolvedValue({});
  api.daftarPromoKasir.mockResolvedValue({ data: [] });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

it("promo habis tidak muncul di pilihan dan penjualan memakai mode normal", async () => {
  const p = props();
  p.awal = [promo({ sisa_kuota: { semua: 0 } })];
  await render(p);
  expect(host.querySelector("select")).toBeNull();
  expect(host.textContent).toContain("Harga normal berlaku");
  expect(api.pesanPromo).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).toBeNull();
});
it("kuota habis di kasir lain menjadi informasi normal, bukan error penghalang", async () => {
  api.pesanPromo.mockResolvedValue({
    error:
      "Kuota promo tidak cukup (sisa 0). Kurangi jumlah atau pilih promo lain",
  });
  api.daftarPromoKasir.mockResolvedValue({
    data: [
      promo({ sisa_kuota: { semua: 0 } }),
      promo({ id: "other", nama: "Promo lain" }),
    ],
  });
  const p = props();
  await render(p);
  await apply();
  expect(host.querySelector('[role="status"]')?.textContent).toContain(
    "Harga normal berlaku",
  );
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect([...host.querySelectorAll("option")].map((o) => o.value)).toEqual([
    "",
    "other",
  ]);
  expect(p.onBusy).toHaveBeenLastCalledWith(false);
  expect(p.onQuote).not.toHaveBeenCalled();
});
it("jam/tanggal lewat menghilangkan pilihan tanpa perlu muat ulang atau panggilan server", async () => {
  const p = props();
  p.awal = [promo({ berakhir_at: "2026-11-20T12:00:02+07:00" })];
  await render(p);
  expect(host.querySelector("select")).not.toBeNull();
  await act(async () => vi.advanceTimersByTime(2000));
  expect(host.querySelector("select")).toBeNull();
  expect(host.textContent).toContain("Harga normal berlaku");
  expect(api.daftarPromoKasir).not.toHaveBeenCalled();
});
it("reservasi sah tetap berlaku saat sisa nol, lalu potongan benar-benar dilepas ketika kedaluwarsa", async () => {
  api.pesanPromo.mockResolvedValue({ quote });
  const p = props();
  await render(p);
  await apply();
  expect(p.onQuote).toHaveBeenLastCalledWith({ ...quote, promo_id: "trial" });
  await render({ ...p, awal: [promo({ sisa_kuota: { semua: 0 } })] });
  expect(p.onQuote).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTime(10000));
  expect(p.onQuote).toHaveBeenLastCalledWith(null);
  expect(host.textContent).toContain("Harga normal berlaku");
  expect(host.textContent).not.toContain("Lepas promo");
});
it("nominal tidak diubah ketika pembayaran sedang diproses", async () => {
  api.pesanPromo.mockResolvedValue({ quote });
  const p = props();
  await render(p);
  await apply();
  await render({ ...p, disabled: true });
  await act(async () => vi.advanceTimersByTime(11000));
  expect(p.onQuote).toHaveBeenCalledTimes(1);
  await render({ ...p, disabled: false });
  await act(async () => vi.advanceTimersByTime(1));
  expect(p.onQuote).toHaveBeenLastCalledWith(null);
});
it("kegagalan izin tetap ditampilkan, tidak disamarkan sebagai kuota habis", async () => {
  api.pesanPromo.mockResolvedValue({ error: "Tidak diizinkan" });
  await render(props());
  await apply();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe(
    "Tidak diizinkan",
  );
  expect(api.daftarPromoKasir).not.toHaveBeenCalled();
});
