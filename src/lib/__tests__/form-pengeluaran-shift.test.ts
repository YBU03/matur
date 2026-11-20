// @vitest-environment happy-dom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FormPengeluaran } from "@/components/form-pengeluaran";
vi.mock("@/lib/accounting-operasional-actions", () => ({
  muatBahanBelanja: vi.fn(),
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
const setup = (
  pilihanSesi: {
    id: string;
    nama: string;
    dibuka_at: string;
    ditutup_at: string | null;
  }[],
) => ({
  kategori: [{ id: "es", nama: "Es Kristal", grup: "beban" }],
  pending: false,
  awal: {
    kategori_id: "es",
    jumlah: 48000,
    keterangan: "Es batu",
    sumber: "laci" as const,
  },
  baru: true,
  pilihanSesi,
  onSimpan: vi.fn(),
});
const shift = {
  id: "shift",
  nama: "Kas Kominot",
  dibuka_at: "2026-11-18T23:47:00+07:00",
  ditutup_at: null as string | null,
};
it("satu shift cocok otomatis dipilih dan ikut payload tanpa input ulang", async () => {
  const p = setup([shift]);
  await act(async () => root.render(createElement(FormPengeluaran, p)));
  expect(host.querySelector("select")?.value).toBe("shift");
  const button = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Catat pengeluaran"),
  )!;
  await act(async () => button.click());
  expect(p.onSimpan.mock.calls[0][0]).toMatchObject({
    sesi_id: "shift",
    sumber: "laci",
    jumlah: 48000,
  });
});
it("beberapa shift memerlukan pilihan; kas tertutup memerlukan alasan sebelum simpan", async () => {
  const p = setup([
    { ...shift, ditutup_at: "2026-11-19T23:47:00+07:00" },
    { ...shift, id: "other" },
  ]);
  await act(async () => root.render(createElement(FormPengeluaran, p)));
  const save = () =>
    [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Catat pengeluaran"),
    )!;
  expect(save().disabled).toBe(true);
  await act(async () => {
    const s = host.querySelector("select")!;
    s.value = "shift";
    s.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.textContent).toContain("Setoran aktual tetap");
  expect(save().disabled).toBe(true);
});
it("tidak membuat pengeluaran laci tanpa shift yang cocok", async () => {
  const p = setup([]);
  await act(async () => root.render(createElement(FormPengeluaran, p)));
  const save = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Catat pengeluaran"),
  )!;
  expect(save.disabled).toBe(true);
  expect(host.querySelector('[role="status"]')?.textContent).toContain(
    "Belum ada shift",
  );
});
