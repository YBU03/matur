import { expect, it } from "vitest";
import {
  marginLaba,
  persenLaba,
  ringkasBayar,
  hakLaporan,
  type Bayar,
  type HakBayar,
} from "../laporan-rekap";
import { penerimaUnik } from "../penerimaan-mitra";
it("margin is weighted, negative stays negative, and zero sales is undefined", () => {
  expect(marginLaba(28073805.81, 88535871)).toBeCloseTo(31.71, 2);
  expect(persenLaba(marginLaba(-10, 100))).toBe("-10,00%");
  expect(persenLaba(marginLaba(0, 0))).toBe("—");
  expect(marginLaba(10 + 80, 100 + 1000)).not.toBe((10 + 8) / 2);
});
it("deduplicates aliases only when they resolve to the same source descriptions/account", () => {
  const list = [
    {
      periode: "2026-10-01",
      transfer: [
        {
          keterangan: "Bagi hasil Ibu Prasetya Ida S.",
          atas_nama: "Prasetya Ida Suntari",
          bank: "BSI",
          no_rekening: "123",
          jumlah: 100,
        },
        {
          keterangan: "Bagi hasil Ibu Oktantina Ratnasari",
          atas_nama: null,
          bank: null,
          no_rekening: null,
          jumlah: 100,
        },
      ],
      bagi_hasil: [],
    },
  ];
  const p = penerimaUnik(list, [
    "Ida",
    "Prasetya Ida Suntari",
    "Ratna",
    "Oktantina Ratnasari",
  ]);
  expect(p.map((x) => x.nama).sort()).toEqual([
    "Oktantina Ratnasari",
    "Prasetya Ida Suntari",
  ]);
  expect(p.reduce((s, p) => s + p.data[0].total, 0)).toBe(200);
});
it("preserves equally sized rights for distinct recipients", () => {
  const l = [
    {
      periode: "2026-10-01",
      transfer: [],
      bagi_hasil: [
        { nama: "Andi", jumlah: 100, persen: 5 },
        { nama: "Budi", jumlah: 100, persen: 5 },
      ],
    },
  ];
  expect(penerimaUnik(l, ["Andi", "Budi"])).toHaveLength(2);
});
it("payments never infer payment from report transfer allocation; cancelled rows do not count", () => {
  const h: HakBayar = {
    key: "transfer:1",
    nama: "A",
    jenis: "Bagi hasil",
    jumlah: 100,
    bank: "BSI",
    rekening: "1",
  };
  const b = {
    penerima_key: h.key,
    hak_snapshot: {
      rekening: "1",
      bank: "BSI",
      jumlah: 100,
      jenis: "Bagi hasil",
      nama: "A",
      key: "transfer:1",
    },
    jumlah: 60,
    status: "tercatat",
  } as Bayar;
  expect(ringkasBayar(h, []).status).toBe("Belum tercatat");
  expect(ringkasBayar(h, [b]).status).toBe("Sebagian");
  expect(ringkasBayar(h, [b]).perluCek).toBe(false);
  expect(ringkasBayar(h, [b, { ...b, jumlah: 40 }]).status).toBe("Lunas");
  expect(ringkasBayar(h, [{ ...b, status: "batal" }]).dibayar).toBe(0);
  expect(ringkasBayar({ ...h, jumlah: 50 }, [b]).perluCek).toBe(true);
});
it("rights include rent, investor and centre separately without duplicating investors", () => {
  const h = hakLaporan({
    transfer: [
      {
        atas_nama: "A",
        keterangan: "Bagi hasil",
        jumlah: 10,
        bank: null,
        no_rekening: null,
      },
      {
        atas_nama: "Pemilik",
        keterangan: "Sewa",
        jumlah: 5,
        bank: null,
        no_rekening: null,
      },
    ],
    bagi_hasil: [
      { nama: "A", jumlah: 10, persen: 10 },
      { nama: "Pengelola", jumlah: 90, persen: 90 },
    ],
  });
  expect(h).toHaveLength(3);
  expect(h.map((x) => x.jumlah)).toEqual([10, 5, 90]);
});
it("explicit rounding is separate from actual transfer and never silently rewrites the source", () => {
  const h = {
    key: "transfer:1",
    nama: "Sewa",
    jenis: "Sewa",
    jumlah: 1416666.667,
    bank: null,
    rekening: null,
  };
  const b = {
    penerima_key: h.key,
    hak_snapshot: h,
    jumlah: 1416667,
    pembulatan: 0.333,
    status: "tercatat",
  } as Bayar;
  expect(ringkasBayar(h, [b])).toMatchObject({
    dibayar: 1416667,
    pembulatan: 0.333,
    sisa: 0,
    status: "Lunas",
    perluCek: false,
  });
  expect(h.jumlah).toBe(1416666.667);
});
