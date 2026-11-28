import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RincianStokBahan, statusStokTertulis } from "@/components/rincian-stok-bahan";
import { findMenu } from "../roles";
const tables = vi.hoisted(() => ({ data: {} as Record<string, unknown[]> }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ from: (name: string) => {
  const q = { select: () => q, eq: () => q, is: () => q, in: () => q, then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: tables.data[name] ?? [], error: null }).then(resolve) }; return q;
} }) }));
import { stokMenipis } from "../stok-menipis";
describe("stock explanation keeps distinct meanings", () => {
  it("does not disguise small, zero, missing or negative balances", () => {
    expect(statusStokTertulis(-0.7, 10)).toContain("Negatif");
    expect(statusStokTertulis(0, 10)).toBe("Habis di sistem");
    expect(statusStokTertulis(null, 10)).toBe("Belum tercatat");
    const html = renderToStaticMarkup(createElement(RincianStokBahan, { info: { jumlah: 0.02, satuan: "g", satuanBeli: "pack", konversi: 1000, minimum: 20 }, riwayat: "/stok/outlet?outlet=a&bahan=b&tab=laporan" }));
    expect(html).toContain("0,02 gram");
    expect(html).toContain("0,00002");
    expect(html).toContain("outlet=a&amp;bahan=b");
    expect(html).not.toContain("Habis di sistem");
  });
  it("warns about contradictory package units without inventing a new unit", () => {
    const html = renderToStaticMarkup(createElement(RincianStokBahan, { info: { jumlah: 0.7, satuan: "kaleng", satuanBeli: "kaleng", konversi: 18, minimum: 18 }, riwayat: "/stok/outlet" }));
    expect(html).toContain("perlu diperiksa");
    expect(html).not.toContain("Setara:");
  });
  it("uses outlet minimum including zero and excludes inactive ingredients without changing stock", async () => {
    tables.data = { stok: [{outlet_id:"a",bahan_id:"b",jumlah:-0.7},{outlet_id:"a",bahan_id:"c",jumlah:0.02},{outlet_id:"a",bahan_id:"d",jumlah:0}], resep:[{bahan_id:"b"},{bahan_id:"c"},{bahan_id:"d"}], bahan:["b","c","d"].map(id=>({id,nama:id,satuan_beli:"pack",satuan_pakai:"g",konversi:1000,stok_min:100})), setelan_stok_outlet:[{outlet_id:"a",bahan_id:"b",minimum:0,aktif:true},{outlet_id:"a",bahan_id:"c",minimum:0,aktif:true},{outlet_id:"a",bahan_id:"d",minimum:100,aktif:false}] };
    const before=JSON.stringify(tables.data);const result=await stokMenipis([{id:"a",nama:"Outlet A"}]);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].info).toMatchObject({jumlah:-0.7,minimum:0,sumberMinimum:"pengaturan khusus outlet"});
    expect(JSON.stringify(tables.data)).toBe(before);
  });
  it("accounting has navigation to warehouse detail and outlet cards", () => {
    expect(findMenu("finance","/gudang/stok")).toBeTruthy();
    expect(findMenu("finance","/stok/outlet")).toBeTruthy();
  });
});
