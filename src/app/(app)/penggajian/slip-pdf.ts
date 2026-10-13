// Slip gaji PDF (A5 tegak) dengan kop perusahaan. Dipakai HRD (semua/satu slip) dan staf (slip sendiri).
import type { Baris } from "@/lib/gaji";
import { kopSurat, unduh, type Kop } from "@/lib/pdf-kop";

export type SlipPdf = {
  nama: string;
  jabatan: string | null;
  outlet: string;
  bulan: string; // YYYY-MM
  hadir: number;
  telat: number;
  tidak_absen: number;
  izin: number;
  pendapatan: Baris[];
  potongan: Baris[];
  total: number;
  rekening: string | null;
};

const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
export const namaBulan = (b: string) => new Date(b + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

export async function unduhSlip(pt: Kop, slips: SlipPdf[], namaFile: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  for (const [i, s] of slips.entries()) {
    if (i) doc.addPage();
    let y = (await kopSurat(doc, pt)) + 8;
    doc.setFont("helvetica", "bold").setFontSize(12).text("SLIP GAJI", W / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(9).text(`Periode ${namaBulan(s.bulan)}`, W / 2, (y += 5), { align: "center" });
    y += 8;
    const info: [string, string][] = [
      ["Nama", s.nama],
      ["Jabatan", s.jabatan ?? "-"],
      ["Outlet", s.outlet],
      ["Kehadiran", `${s.hadir} hari hadir · ${s.telat}× telat · ${s.izin} izin/libur · ${s.tidak_absen} tidak absen`],
    ];
    doc.setFontSize(8.5);
    for (const [k, v] of info) {
      doc.setTextColor(110).text(k, 14, y).setTextColor(0).text(`: ${v}`, 38, y);
      y += 5;
    }
    const tabel = (judul: string, xs: Baris[]) => {
      y += 3;
      doc.setFont("helvetica", "bold").text(judul, 14, y);
      doc.setLineWidth(0.2).line(14, (y += 1.5), W - 14, y);
      doc.setFont("helvetica", "normal");
      if (!xs.length) doc.setTextColor(140).text("-", 14, (y += 5)).setTextColor(0);
      for (const b of xs) {
        y += 5;
        doc.text(b.nama, 16, y);
        doc.text(rp(b.jumlah), W - 14, y, { align: "right" });
      }
      const t = xs.reduce((a, b) => a + b.jumlah, 0);
      doc.setFont("helvetica", "bold").text(`Total ${judul.toLowerCase()}`, 16, (y += 5.5)).text(rp(t), W - 14, y, { align: "right" });
      doc.setFont("helvetica", "normal");
    };
    tabel("Pendapatan", s.pendapatan);
    tabel("Potongan", s.potongan);
    y += 8;
    doc.setFillColor(255, 243, 224).roundedRect(14, y - 5, W - 28, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold").setFontSize(10.5).text("GAJI DITERIMA", 18, y + 1.5).text(rp(s.total), W - 18, y + 1.5, { align: "right" });
    y += 12;
    doc.setFont("helvetica", "normal").setFontSize(8);
    if (s.rekening) doc.text(`Ditransfer ke: ${s.rekening}`, 14, y);
    doc.setTextColor(130).text("Slip ini dibuat otomatis oleh Matoer dari data absensi.", 14, doc.internal.pageSize.getHeight() - 10).setTextColor(0);
  }
  unduh(doc, namaFile);
}
