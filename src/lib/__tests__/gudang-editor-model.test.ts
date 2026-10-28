import { it, expect } from "vitest";
import { ringkasInvoice } from "../gudang-invoice";
import { konteksDokumen, type IsiDokumen } from "../gudang-dokumen-model";
import { ringkasGudang, type GudangLaporan } from "../gudang-laporan";
import type { Kiriman, ItemKiriman } from "../kiriman";
const item: ItemKiriman = {
  id: "i",
  bahan_id: "b",
  nama: "Kopi",
  satuan: "pack",
  konversi: 1,
  qty: 3,
  harga: 10000,
  qty_diterima: 2,
};
const isi: IsiDokumen = {
  jatuh_tempo: "2026-11-05",
  catatan: "Catatan dokumen",
  telepon_gudang: "62856",
  tagih_mode: "manual",
  tagih_outlet: null,
  baris: { i: { diskon: 2000, pajak: 1800 } },
  item_basis: { i: { qty: 2, harga: 10000 } },
  identitas: {
    perusahaan: {
      nama: "Hazna tersimpan",
      alamat: "Alamat lama",
      telepon: "62856",
      email: null,
      logo_path: null,
    },
    kirim: { nama: "Outlet penerima", alamat: "Alamat kirim", telepon: "6281" },
    tagih: {
      nama: "Pelanggan tagihan",
      alamat: "Alamat tagih",
      telepon: "6282",
    },
  },
};
const k: Kiriman = {
  id: "k",
  nomor: "KRM-01",
  tanggal: "2026-10-28",
  status: "diterima",
  pemeriksaan_status: "selesai",
  catatan: null,
  pengirim: null,
  total: 20000,
  dikirim_at: null,
  diterima_at: null,
  nama_penerima: null,
  outlet: { nama: "Master baru", alamat: "Alamat master baru" },
  penyesuaian: { nilai: -300, keterangan: "Pembulatan", versi: 1 },
  dokumen: [{ jenis: "invoice", isi, terbit: isi, versi: 2, arsip_at: null }],
};
it("calculates per-line currency discounts and taxes before the final adjustment", () => {
  expect(ringkasInvoice(k, [item])).toMatchObject({
    barang: 20000,
    diskon: 2000,
    pajak: 1800,
    penyesuaian: -300,
    total: 19500,
    valid: true,
  });
  expect(ringkasInvoice(k, [{ ...item, qty_diterima: 1 }]).valid).toBe(false);
  const bad = {
    ...k,
    dokumen: [
      {
        ...k.dokumen![0],
        terbit: { ...isi, baris: { i: { diskon: 20001, pajak: 0 } } },
      },
    ],
  };
  expect(ringkasInvoice(bad, [item]).valid).toBe(false);
});
it("keeps billing separate from shipping and freezes stored business identities", () => {
  const ctx = konteksDokumen("invoice", k, {
    nama: "Master perusahaan baru",
    alamat: "Alamat baru",
    telepon: "123456",
    email: null,
  });
  expect(ctx.k.outlet?.nama).toBe("Outlet penerima");
  expect(ctx.tagih?.nama).toBe("Pelanggan tagihan");
  expect(ctx.pt.nama).toBe("Hazna tersimpan");
  expect(k.outlet?.nama).toBe("Master baru");
});
it("does not count collected invoice taxes as warehouse profit", () => {
  const d = {
    rows: [{ qty: 2, harga: 10000, hpp_gudang: 6000, kepemilikan: "Mitra" }],
    biaya: [],
    mutasi: [],
    invoice: [{ nilai: -300 }],
    dokumen: [{ diskon: 2000, pajak: 1800, perlu_tinjau: false }],
  } as unknown as GudangLaporan;
  expect(ringkasGudang(d)).toMatchObject({
    diskon: 2000,
    pajak: 1800,
    tagihan: 19500,
    labaKotor: 6000,
    laba: 5700,
  });
});
