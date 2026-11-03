/** Draft otomatis menyimpan selisih, bukan menggandakan transaksi POS. */
export type IsianLaporan = {
  pend: Record<string, string>;
  beban: Record<string, string>;
  stok: { awal: string; pembelian: string; akhir: string; titipan: string };
  info: {
    nama_outlet: string;
    mitra: string;
    pj: string;
    karyawan: string;
    terbit: string;
    catatan: string;
    modal?: string;
    persen?: string;
    sedekah?: string;
    diskon?: string;
  };
  ojol: Record<string, string>;
  koreksi: string;
  manual?: {
    pendapatan: import("./laporan").Baris[];
    bagi_hasil: import("./laporan").BagiHasil[];
    transfer: import("./laporan").Transfer[];
  };
};
export type DraftInternal = {
  sumber: "otomatis" | "manual" | "impor";
  isian: IsianLaporan;
  baseline: IsianLaporan;
  snapshot: import("./laporan").Laporan | null;
  alasan: string;
  buka_at: string | null;
  updated_at: string;
};
export type PeriodeLaporan = {
  periode: string;
  laporan_id: string | null;
  buka_at: string | null;
  disetujui: boolean;
  terbuka: boolean;
  ada_draft: boolean;
  sumber: string;
};
const angka = (s: string) => Math.round(Number(s.replace(/[^\d-]/g, "")) || 0);
export function pulihkanIsian(
  aktual: IsianLaporan,
  draft: Pick<DraftInternal, "sumber" | "isian" | "baseline"> | null,
): IsianLaporan {
  if (!draft?.isian?.stok || !draft.baseline?.stok) return aktual;
  if (draft.sumber !== "otomatis") return draft.isian;
  const hasil = structuredClone(aktual);
  for (const grup of ["pend", "beban", "stok", "info", "ojol"] as const) {
    for (const [k, v] of Object.entries(draft.isian[grup])) {
      const lama = (draft.baseline[grup] as Record<string, string>)[k];
      if (v === lama) continue;
      const target = hasil[grup] as Record<string, string>;
      const delta =
        grup === "pend" ||
        grup === "beban" ||
        (grup === "stok" && ["pembelian", "titipan"].includes(k));
      target[k] = delta
        ? String(angka(target[k] ?? "0") + angka(v) - angka(lama ?? "0"))
        : v;
    }
  }
  hasil.koreksi = String(
    angka(aktual.koreksi) +
      angka(draft.isian.koreksi) -
      angka(draft.baseline.koreksi),
  );
  return hasil;
}
export function keWibInput(iso: string | null) {
  return iso
    ? new Date(new Date(iso).getTime() + 7 * 3600_000)
        .toISOString()
        .slice(0, 16)
    : "";
}
export function dariWibInput(v: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v + "+07:00"))
    ? new Date(v + "+07:00").toISOString()
    : null;
}
export function statusKunci(
  buka: string | null,
  disetujui: boolean,
  kini: number,
) {
  if (!buka) return "belum_dijadwalkan";
  if (Date.parse(buka) > kini) return "menunggu";
  return disetujui ? "terbuka" : "pemeriksaan";
}
