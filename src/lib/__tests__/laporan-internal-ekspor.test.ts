import { it, expect, vi, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import type { Laporan } from "../laporan";
vi.mock("react", async () => ({
  ...(await vi.importActual<typeof import("react")>("react")),
  useState: () => [false, () => {}],
}));
vi.mock("../pdf-kop", async () => ({
  ...(await vi.importActual<typeof import("../pdf-kop")>("../pdf-kop")),
  gambar: async (path: string) => {
    const b = readFileSync(process.cwd() + "/public" + path);
    return {
      url: "data:image/png;base64," + b.toString("base64"),
      w: b.readUInt32BE(16),
      h: b.readUInt32BE(20),
    };
  },
}));
import { UnduhPdf } from "../../app/(app)/laporan/[id]/pdf";
import { UnduhExcel } from "../../app/(app)/laporan/[id]/excel";
const l: Laporan = {
  id: "contoh",
  outlet_id: "contoh",
  periode: "2026-11-01",
  nama_outlet: "Outlet Contoh",
  mitra: "Mitra Contoh",
  pj_laporan: "Accounting",
  karyawan: ["Andi", "Budi"],
  modal_awal: 200000,
  persediaan_awal: 100000,
  pembelian: 50000,
  persediaan_akhir: 25000,
  pendapatan: [
    { nama: "Penjualan tunai", jumlah: 200000 },
    { nama: "Penjualan non tunai", jumlah: 100000 },
  ],
  diskon: 0,
  persen_sedekah: 2.5,
  sedekah: 4375,
  beban: [{ nama: "Biaya internet", jumlah: 10000 }],
  bagi_hasil: [],
  transfer: [],
  tgl_terbit: "2026-11-03",
  kota_terbit: "Purbalingga",
  penandatangan: "Accounting",
  jabatan_penandatangan: "Finance",
  catatan: "Data contoh pengujian",
  laba_bersih: null,
};
const pt = {
  nama: "CV. Hazna Berkah Indonesia",
  alamat: "Alamat contoh untuk uji",
  email: null,
  telepon: null,
};
let blob: Blob;
let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };
function setup() {
  anchor = { href: "", download: "", click: vi.fn() };
  vi.stubGlobal("document", { createElement: () => anchor });
  vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
    blob = b as Blob;
    return "blob:contoh";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("ekspor PDF internal menghasilkan dokumen nyata dengan penanda draft", async () => {
  setup();
  const el = UnduhPdf({
    l,
    pt,
    internal: true,
    visual: {
      bulan: "November 2026",
      penjualan: 300000,
      hpp: 125000,
      labaKotor: 175000,
      beban: 10000,
      sedekah: 4375,
      persenSedekah: 2.5,
      labaBersih: 160625,
      pendapatan: [
        { name: "Tunai", value: 200000 },
        { name: "Non tunai", value: 100000 },
      ],
      bebanRinci: [{ name: "Internet", value: 10000 }],
      bagiHasil: [],
      prev: null,
      riwayat: [],
    },
  });
  await el.props.onClick();
  const b = Buffer.from(await blob.arrayBuffer());
  expect(b.subarray(0, 5).toString()).toBe("%PDF-");
  expect(b.toString()).toContain("DRAFT INTERNAL - BELUM DITERBITKAN KE MITRA");
  expect(anchor.download).toContain("Draft Internal");
  expect(anchor.click).toHaveBeenCalledOnce();
  writeFileSync("/tmp/matoer-laporan-internal-test.pdf", b);
}, 30000);
it("ekspor Excel internal menjaga angka dan penanda status", async () => {
  setup();
  await UnduhExcel({ l, pt, internal: true }).props.onClick();
  const b = Buffer.from(await blob.arrayBuffer());
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  await wb.xlsx.load(b as never);
  const ws = wb.getWorksheet("Laporan Keuangan")!;
  expect(String(ws.getCell("A10").value)).toContain("DRAFT INTERNAL");
  expect(anchor.download).toContain("Draft Internal");
  expect(ws.getCell("E12").value).toBe("Outlet Contoh");
  expect(anchor.click).toHaveBeenCalledOnce();
}, 30000);
