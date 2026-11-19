import { expect, it } from "vitest";
import { alasanPromoNormal, alasanPromoDariError } from "../promo-ketersediaan";
import type { Promo } from "../promo";

const now = Date.parse("2026-11-20T12:00:00+07:00");
const promo = (extra: Partial<Promo> = {}): Promo => ({
  id: "trial",
  nama: "Trial opening",
  aktif: true,
  mulai: "2026-11-20",
  selesai: "2026-11-22",
  jam_mulai: "00:00",
  jam_selesai: "23:59:59",
  semua_outlet: false,
  outlet_ids: ["uhb"],
  aturan: ["keluarga", "butterscotch", "matcha"].map((menu_id) => ({
    menu_id,
    varian_ids: [],
    jenis: "harga_akhir",
    nilai: 11000,
  })),
  kuota: 30,
  per_menu: false,
  bersama: false,
  boleh_manual: false,
  versi: 1,
  sisa_kuota: { semua: 30 },
  ...extra,
});
const item = (menu_id: string, qty = 1, varian_ids: string[] = []) => ({
  menu_id,
  qty,
  varian_ids,
});

it("kuota 30 gabungan ketiga menu: 15+10+5, lalu penjualan berikutnya normal", () => {
  expect(
    alasanPromoNormal(
      promo(),
      [item("keluarga", 15), item("butterscotch", 10), item("matcha", 5)],
      now,
    ),
  ).toBeNull();
  expect(
    alasanPromoNormal(
      promo({ sisa_kuota: { semua: 0 } }),
      [item("keluarga")],
      now,
    ),
  ).toBe("kuota");
  expect(
    alasanPromoNormal(
      promo({ sisa_kuota: { semua: 2 } }),
      [item("keluarga"), item("butterscotch"), item("matcha")],
      now,
    ),
  ).toBe("kuota");
  expect(
    alasanPromoNormal(
      promo({ sisa_kuota: { semua: 2 } }),
      [item("keluarga"), item("matcha")],
      now,
    ),
  ).toBeNull();
});

it("berlaku untuk persen, potongan, gratis/subsidi dan harga akhir", () => {
  for (const jenis of [
    "persen",
    "potongan",
    "gratis",
    "harga_akhir",
  ] as const) {
    expect(
      alasanPromoNormal(
        promo({
          subsidi: jenis === "gratis",
          aturan: [{ menu_id: "keluarga", varian_ids: [], jenis, nilai: 20 }],
          sisa_kuota: { semua: 0 },
        }),
        [item("keluarga")],
        now,
      ),
    ).toBe("kuota");
  }
});

it("voucher kuota per transaksi tidak dikalikan jumlah cup", () => {
  expect(
    alasanPromoNormal(
      promo({ cakupan: "transaksi", sisa_kuota: { semua: 1 } }),
      [item("keluarga", 3), item("matcha", 2)],
      now,
    ),
  ).toBeNull();
  expect(
    alasanPromoNormal(
      promo({ cakupan: "transaksi", sisa_kuota: { semua: 0 } }),
      [item("keluarga")],
      now,
    ),
  ).toBe("kuota");
});

it("kuota per menu tidak mematikan menu lain dan hanya menghitung varian yang cocok", () => {
  const p = promo({
    per_menu: true,
    sisa_kuota: { keluarga: 0, butterscotch: 2, matcha: 1 },
  });
  expect(alasanPromoNormal(p, [], now)).toBeNull();
  expect(alasanPromoNormal(p, [item("butterscotch", 2)], now)).toBeNull();
  expect(alasanPromoNormal(p, [item("keluarga")], now)).toBe("kuota");
  expect(alasanPromoNormal(p, [item("matcha"), item("matcha")], now)).toBe(
    "kuota",
  );
  expect(alasanPromoNormal(p, [item("menu-lain", 99)], now)).toBeNull();
  const variant = promo({
    aturan: [
      { menu_id: "keluarga", varian_ids: ["ice"], jenis: "persen", nilai: 50 },
    ],
    sisa_kuota: { semua: 1 },
  });
  expect(
    alasanPromoNormal(variant, [item("keluarga", 3, ["hot"])], now),
  ).toBeNull();
  expect(alasanPromoNormal(variant, [item("keluarga", 2, ["ice"])], now)).toBe(
    "kuota",
  );
});

it("tanggal/jam/hari selesai otomatis normal, termasuk slot lintas tengah malam", () => {
  expect(
    alasanPromoNormal(promo(), [], Date.parse("2026-11-23T00:00:00+07:00")),
  ).toBe("waktu");
  const p = promo({
    jam_mulai: "10:00",
    jam_selesai: "13:00",
    berakhir_at: "2026-11-20T13:00:00+07:00",
  });
  expect(alasanPromoNormal(p, [], Date.parse(p.berakhir_at!) - 1)).toBeNull();
  expect(alasanPromoNormal(p, [], Date.parse(p.berakhir_at!))).toBe("waktu");
  expect(alasanPromoNormal(promo({ hari: [1] }), [], now)).toBe("waktu");
  const night = promo({ slot: [{ mulai: "22:00", selesai: "01:00" }] });
  expect(
    alasanPromoNormal(night, [], Date.parse("2026-11-23T00:30:00+07:00")),
  ).toBeNull();
  expect(
    alasanPromoNormal(night, [], Date.parse("2026-11-23T01:00:01+07:00")),
  ).toBe("waktu");
});

it("promo tanpa kuota tetap berlaku; snapshot baru hari berikutnya kembali tersedia", () => {
  expect(
    alasanPromoNormal(
      promo({ kuota: null, sisa_kuota: null }),
      [item("keluarga", 100)],
      now,
    ),
  ).toBeNull();
  expect(
    alasanPromoNormal(
      promo({ sisa_kuota: { semua: 30 } }),
      [item("matcha")],
      Date.parse("2026-11-21T12:00:00+07:00"),
    ),
  ).toBeNull();
});

it("race kuota/waktu kembali normal; error izin, jaringan, katalog dan bisnis lain tetap terlihat", () => {
  expect(
    alasanPromoDariError(
      "Kuota promo tidak cukup (sisa 0). Kurangi jumlah atau pilih promo lain",
    ),
  ).toBe("kuota");
  expect(
    alasanPromoDariError(
      "Kuota promo tidak cukup (sisa 2). Kurangi jumlah atau pilih promo lain",
    ),
  ).toBe("kuota");
  expect(alasanPromoDariError("Promo tidak aktif untuk outlet/waktu ini")).toBe(
    "waktu",
  );
  expect(alasanPromoDariError("Reservasi berakhir. Pilih promo kembali")).toBe(
    "waktu",
  );
  for (const error of [
    "Tidak diizinkan",
    "Failed to fetch",
    "Harga katalog berubah",
    "Sesi POS berubah. Muat ulang kasir",
    "Promo membutuhkan internet",
    "Promo ini tidak dapat digabung diskon manual",
  ]) {
    expect(alasanPromoDariError(error)).toBeNull();
  }
});
