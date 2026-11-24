import { hitung, namaBulan, type Laporan, type Perusahaan } from "./laporan";
import type { Ringkas, Visual } from "@/app/(app)/laporan/[id]/visual";

/** Presentation metadata only; financial source snapshots remain untouched. */
export function siapkanLaporanDokumen(l: Laporan, pt: Perusahaan | null) {
  l = {
    ...l,
    ...Object.fromEntries(
      [
        "modal_awal",
        "persediaan_awal",
        "pembelian",
        "persediaan_akhir",
        "diskon",
        "sedekah",
        "persen_sedekah",
      ].map((k) => [k, Number(l[k as keyof Laporan])]),
    ),
    pendapatan: l.pendapatan.map((x) => ({ ...x, jumlah: Number(x.jumlah) })),
    beban: l.beban.map((x) => ({ ...x, jumlah: Number(x.jumlah) })),
    bagi_hasil: l.bagi_hasil.map((x) => ({ ...x, jumlah: Number(x.jumlah) })),
    transfer: l.transfer.map((x) => ({ ...x, jumlah: Number(x.jumlah) })),
  };
  const cells =
    l.sumber_excel?.lembar
      .find((s) => s.nama === "Laporan Keuangan")
      ?.baris.flatMap((r) => r.sel) ?? [];
  const cell = (a: string) => cells.find((c) => c.alamat === a);
  const start = cell("E13")?.nilai;
  const contact = cell("C5")?.teks ?? "";
  return {
    l: cells.length
      ? {
          ...l,
          outlet: {
            nama: l.outlet?.nama ?? l.nama_outlet,
            tgl_mulai:
              typeof start === "number"
                ? new Date((start - 25569) * 86400000)
                    .toISOString()
                    .slice(0, 10)
                : (l.outlet?.tgl_mulai ?? null),
            jam_operasional:
              cell("E14")?.teks || l.outlet?.jam_operasional || null,
          },
        }
      : l,
    pt: cells.length
      ? {
          nama: cell("C3")?.teks || pt?.nama || "CV. Hazna Berkah Indonesia",
          alamat: cell("C4")?.teks || pt?.alamat || null,
          email:
            contact.match(/Email:\s*(.*?)\s*Telp:/i)?.[1] || pt?.email || null,
          telepon: contact.match(/Telp:\s*(.*)/i)?.[1] || pt?.telepon || null,
        }
      : (pt ?? {
          nama: "CV. Hazna Berkah Indonesia",
          alamat: null,
          email: null,
          telepon: null,
        }),
  };
}

/** One outlet and one chronological series for both screen and PDF. */
export function visualLaporan(l: Laporan, semua: Laporan[] = []): Visual {
  const h = hitung(l);
  const riwayat: Ringkas[] = [
    ...semua.filter(
      (r) =>
        r.outlet_id === l.outlet_id && r.periode <= l.periode && r.id !== l.id,
    ),
    l,
  ]
    .sort((a, b) => a.periode.localeCompare(b.periode))
    .slice(-12)
    .map((r) => {
      const x = hitung(r);
      return {
        periode: r.periode,
        label: new Date(r.periode + "T00:00:00").toLocaleDateString("id-ID", {
          month: "short",
          year: "2-digit",
        }),
        penjualan: x.totalPenjualan,
        hpp: x.hpp,
        laba_kotor: x.labaKotor,
        beban: x.totalBeban,
        laba_bersih: x.labaBersih,
      };
    });
  const urut = (xs: { name: string; value: number }[]) =>
    xs.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  return {
    bulan: namaBulan(l.periode),
    penjualan: h.totalPenjualan,
    hpp: h.hpp,
    labaKotor: h.labaKotor,
    beban: h.totalBeban - Number(l.sedekah),
    sedekah: Number(l.sedekah),
    persenSedekah: Number(l.persen_sedekah),
    labaBersih: h.labaBersih,
    pendapatan: urut(
      l.pendapatan.map((p) => ({
        name: p.nama.replace(/ \(.*\)$/, ""),
        value: Number(p.jumlah),
      })),
    ),
    bebanRinci: urut([
      { name: "Sedekah", value: Number(l.sedekah) },
      ...l.beban.map((b) => ({
        name: b.nama.replace(/^Biaya /, ""),
        value: Number(b.jumlah),
      })),
    ]).slice(0, 8),
    bagiHasil: l.bagi_hasil.map((b) => ({
      name: `${b.nama} ${b.persen}%`,
      value: Number(b.jumlah),
    })),
    prev: riwayat.length > 1 ? riwayat[riwayat.length - 2] : null,
    riwayat,
  };
}
