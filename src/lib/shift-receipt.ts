import type { LaporanShift } from "./pos-alur";
import type { BarisStruk } from "./printer-bt";
const rp = (n: number) => new Intl.NumberFormat("id-ID").format(n === 0 ? 0 : n);
const waktu = (s?: string | null) => s ? new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "Belum ditutup";
/** Kas tersimpan menjadi satu laporan; pembayaran lain dipilah sekali per metode/kanal. */
export function barisAkhirShift(r: LaporanShift): BarisStruk[] {
  const pasangan = (k: string, v: number | null): BarisStruk => ({ teks: "", kiriKanan: [k, v == null ? "Belum dihitung" : rp(v)] });
  return [
    { teks: "AKHIR SHIFT", tengah: true, tebal: true },
    { teks: r.outlet, tengah: true, tebal: true },
    r.sementara || !r.sesi.ditutup_at ? "REKAP SEMENTARA" : "REKAP KAS TERSIMPAN",
    `Mulai: ${waktu(r.sesi.dibuka_at ?? r.shifts[0]?.mulai_at)}`,
    `Akhir: ${waktu(r.sesi.ditutup_at)}`,
    `Petugas: ${r.shifts.map((s) => s.tim?.length ? s.tim.map((x) => x.nama).join(", ") : s.nama).join(" / ") || r.sesi.nama_kasir || "-"}`,
    "--------------------------------",
    pasangan("Uang tunai awal", r.kas.modal),
    pasangan("Pembayaran tunai", r.kas.tunai),
    pasangan("Pengeluaran laci", -r.kas.laci),
    pasangan("Sudah diserahkan", -r.kas.keluar),
    pasangan("Tunai seharusnya", r.kas.seharusnya),
    pasangan("Uang fisik di laci", r.sesi.fisik_akhir),
    pasangan("Selisih", r.sesi.selisih),
    pasangan("Pembayaran lainnya", r.kas.non_tunai),
    "", { teks: "DETAIL PEMBAYARAN LAINNYA", tebal: true },
    ...Object.entries(r.pembayaran ?? {}).map(([k, v]) => pasangan(k.toUpperCase(), v)),
    ...(Object.keys(r.pembayaran ?? {}).length ? [] : ["Tidak ada rincian non tunai"]),
    "", { teks: "PENGELUARAN LACI", tebal: true },
    ...r.pengeluaran.map((p, i) => pasangan(`${i + 1}. ${p.keterangan}`, p.jumlah)),
    pasangan("Total pengeluaran laci", r.kas.laci),
    "", `Catatan: ${r.sesi.catatan_tutup || r.shifts.at(-1)?.catatan || "-"}`,
    ...(r.sementara ? ["Menunggu sinkronisasi perangkat.", "Cetak ulang setelah rekap final."] : []),
    "", { teks: "Matoer - Ruma Kopi", tengah: true },
  ];
}
