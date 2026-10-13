// Ekspor rekap absensi ke Excel: lembar Ringkasan (per staf) dan Detail (per hari).
import { formatDurasi, LABEL_STATUS, type BarisRekap, type RingkasStaf } from "@/lib/jadwal/rekap";
import type { Absen } from "@/lib/sdm";

const jam = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "";

export async function eksporRekap(d: {
  outlet: string;
  dari: string;
  sampai: string;
  nama: Record<string, string>;
  rekap: { baris: BarisRekap[]; ringkas: RingkasStaf[] };
  absensi: Record<string, Absen>;
}) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  const n = (id: string) => d.nama[id] ?? "Staf";
  const judul = `REKAP ABSENSI ${d.outlet.toUpperCase()} · ${d.dari} s.d. ${d.sampai}`;

  const r = wb.addWorksheet("Ringkasan");
  r.addRow([judul]).font = { bold: true, size: 13 };
  r.addRow([]);
  const h = r.addRow(["Nama", "Jadwal", "Hadir", "Tepat waktu", "Telat", "Total menit telat", "Tidak absen", "Masuk tanpa jadwal", "Izin/sakit/libur", "Jam kerja", "Menit kerja"]);
  h.font = { bold: true };
  h.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFDE85" } }));
  for (const x of [...d.rekap.ringkas].sort((a, b) => n(a.pengguna_id).localeCompare(n(b.pengguna_id)))) {
    r.addRow([n(x.pengguna_id), x.jadwal, x.hadir, x.tepat, x.telat, x.menitTelat, x.tidakAbsen, x.tanpaJadwal, x.izin, formatDurasi(x.menitKerja), x.menitKerja]);
  }
  [26, 9, 9, 12, 8, 16, 12, 18, 15, 14, 12].forEach((w, i) => (r.getColumn(i + 1).width = w));

  const t = wb.addWorksheet("Detail");
  t.addRow([judul]).font = { bold: true, size: 13 };
  t.addRow([]);
  const h2 = t.addRow(["Tanggal", "Nama", "Shift", "Jam shift", "Status", "Telat (menit)", "Masuk", "Pulang", "Jam kerja", "Perangkat", "Lokasi masuk", "Catatan"]);
  h2.font = { bold: true };
  h2.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFDE85" } }));
  for (const b of d.rekap.baris.filter((x) => x.status !== "belum")) {
    const a = b.absen ? d.absensi[b.absen.id] : undefined;
    t.addRow([
      b.tanggal,
      n(b.pengguna_id),
      b.shift?.nama ?? "",
      b.shift ? `${b.shift.jam_mulai}–${b.shift.jam_selesai}` : "",
      LABEL_STATUS[b.status],
      a?.telat_menit || "",
      jam(a?.masuk_at),
      jam(a?.pulang_at),
      a ? formatDurasi(b.menitKerja) : "",
      a ? (a.perangkat === "outlet" ? "Perangkat outlet" : "HP sendiri") : "",
      a && a.masuk_lat !== null ? `${a.masuk_lat}, ${a.masuk_lng}` : "",
      a?.catatan ?? "",
    ]);
  }
  [12, 24, 10, 13, 18, 12, 8, 8, 12, 16, 24, 30].forEach((w, i) => (t.getColumn(i + 1).width = w));
  t.views = [{ state: "frozen", ySplit: 3 }];

  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const el = document.createElement("a");
  el.href = URL.createObjectURL(blob);
  el.download = `Rekap Absensi ${d.outlet} ${d.dari} sd ${d.sampai}.xlsx`;
  el.click();
  setTimeout(() => URL.revokeObjectURL(el.href), 5000);
}
