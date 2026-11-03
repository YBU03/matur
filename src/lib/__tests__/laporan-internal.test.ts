import { describe, it, expect } from "vitest";
import {
  pulihkanIsian,
  statusKunci,
  keWibInput,
  dariWibInput,
  type IsianLaporan,
} from "../laporan-internal";
const awal = (): IsianLaporan => ({
  pend: { tunai: "100", non_tunai: "50" },
  beban: { Internet: "20" },
  stok: { awal: "10", pembelian: "30", akhir: "15", titipan: "5" },
  info: {
    nama_outlet: "Kominot",
    mitra: "A",
    pj: "",
    karyawan: "Andi",
    terbit: "2026-11-01",
    catatan: "",
  },
  ojol: { gofood: "" },
  koreksi: "0",
});
describe("draft internal laporan", () => {
  it("koreksi tetap mengikuti transaksi baru tanpa dobel", () => {
    const baseline = awal(),
      isian = awal(),
      aktual = awal();
    isian.pend.tunai = "120";
    isian.beban.Internet = "25";
    isian.stok.pembelian = "40";
    aktual.pend.tunai = "200";
    aktual.beban.Internet = "30";
    aktual.stok.pembelian = "50";
    const hasil = pulihkanIsian(aktual, {
      sumber: "otomatis",
      isian,
      baseline,
    });
    expect(hasil.pend.tunai).toBe("220");
    expect(hasil.beban.Internet).toBe("35");
    expect(hasil.stok.pembelian).toBe("60");
    expect(aktual.pend.tunai).toBe("200");
  });
  it("input akhir opname dan nama edit tetap, nama otomatis mengikuti jadwal terbaru", () => {
    const baseline = awal(),
      isian = awal(),
      aktual = awal();
    isian.stok.akhir = "17";
    aktual.info.karyawan = "Budi";
    expect(
      pulihkanIsian(aktual, { sumber: "otomatis", isian, baseline }).info
        .karyawan,
    ).toBe("Budi");
    isian.info.karyawan = "Nama koreksi";
    const h = pulihkanIsian(aktual, { sumber: "otomatis", isian, baseline });
    expect(h.info.karyawan).toBe("Nama koreksi");
    expect(h.stok.akhir).toBe("17");
  });
  it("manual dan impor mengganti nilai, tidak ditambahkan ke POS", () => {
    const isian = awal();
    isian.pend.tunai = "45";
    for (const sumber of ["manual", "impor"] as const)
      expect(
        pulihkanIsian(awal(), { sumber, isian, baseline: awal() }).pend.tunai,
      ).toBe("45");
  });
  it("koreksi yang dibuka dan disimpan ulang tidak berlipat", () => {
    const baseline = awal(),
      isian = awal(),
      aktual = awal();
    isian.pend.tunai = "120";
    aktual.pend.tunai = "300";
    const r = pulihkanIsian(aktual, { sumber: "otomatis", isian, baseline });
    const berikut = awal();
    berikut.pend.tunai = "400";
    expect(
      pulihkanIsian(berikut, { sumber: "otomatis", isian: r, baseline: aktual })
        .pend.tunai,
    ).toBe("420");
  });
});
describe("jadwal buka laporan WIB", () => {
  it("konversi lintas tahun tetap WIB", () => {
    expect(dariWibInput("2027-01-01T00:30")).toBe("2026-12-31T17:30:00.000Z");
    expect(keWibInput("2026-12-31T17:30:00.000Z")).toBe("2027-01-01T00:30");
    expect(dariWibInput("salah")).toBeNull();
  });
  it("waktu saja tidak membuka draft", () => {
    const t = Date.parse("2026-12-10T02:00:00Z");
    expect(statusKunci(null, false, t)).toBe("belum_dijadwalkan");
    expect(statusKunci("2026-12-10T02:01:00Z", true, t)).toBe("menunggu");
    expect(statusKunci("2026-12-10T02:00:00Z", false, t)).toBe("pemeriksaan");
    expect(statusKunci("2026-12-10T02:00:00Z", true, t)).toBe("terbuka");
  });
});
