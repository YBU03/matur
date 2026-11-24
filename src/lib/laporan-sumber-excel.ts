/** Snapshot sumber Excel: nilai tersimpan, hasil rumus dan format tampilan tetap terpisah. */
export type SelSumberExcel = {
  alamat: string;
  teks: string;
  nilai: string | number | boolean | null;
  rumus: string | null;
  format: string;
};
export type LembarSumberExcel = {
  nama: string;
  baris: { nomor: number; sel: SelSumberExcel[] }[];
};
export type SumberExcel = {
  versi: 1;
  nama_file: string;
  sha256: string;
  nama_sumber: string;
  outlet_tujuan: string;
  periode: string;
  koreksi: {
    lembar: string;
    sel: string;
    asli: string;
    hasil: string;
    alasan: string;
  }[];
  catatan: string[];
  lembar: LembarSumberExcel[];
  xlsx_base64: string;
};

export function judulPeriodeSumber(s: Pick<SumberExcel, "periode">) {
  return new Date(`${s.periode}-01T00:00:00Z`).toLocaleDateString("id-ID", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** PDF lengkap, termasuk seluruh sel berisi dari laporan dan catatan harian sumber. */
export async function pdfSumberExcel(s: SumberExcel) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc
    .setFontSize(15)
    .text(`Laporan Keuangan - ${judulPeriodeSumber(s)}`, 14, 18);
  doc
    .setFontSize(10)
    .text(`${s.outlet_tujuan} | Sumber: ${s.nama_sumber}`, 14, 25);
  doc.setFontSize(9);
  const notes = [
    "Dokumen internal. Nilai dan hasil rumus dipertahankan dari Excel sumber.",
    "Tampilan angka mengikuti format sel Excel; nilai presisi tersedia pada salinan sumber.",
    ...s.koreksi.map(
      (k) => `${k.lembar}!${k.sel}: ${k.asli} menjadi ${k.hasil}. ${k.alasan}`,
    ),
    ...s.catatan,
  ];
  const lines = doc.splitTextToSize(notes.join("\n\n"), 180);
  doc.text(lines, 14, 34);
  let y = 38 + lines.length * 4;
  for (const [index, sheet] of s.lembar.entries()) {
    if (index || y > 150) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(12).text(sheet.nama, 14, y);
    autoTable(doc, {
      startY: y + 5,
      head: [["Baris", "Keterangan / teks sumber", "Nilai sumber"]],
      body: sheet.baris.map((row) => [
        String(row.nomor),
        row.sel
          .filter((c) => typeof c.nilai !== "number")
          .map((c) => `${c.alamat}: ${c.teks}`)
          .join("\n"),
        row.sel
          .filter((c) => typeof c.nilai === "number")
          .map((c) => `${c.alamat}: ${c.teks}`)
          .join("\n"),
      ]),
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [94, 49, 21] },
      columnStyles: {
        0: { cellWidth: 13 },
        1: { cellWidth: 96 },
        2: { cellWidth: 73 },
      },
      margin: { top: 16, bottom: 16, left: 14, right: 14 },
      rowPageBreak: "avoid",
    });
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p).setFontSize(7).setTextColor(100);
    doc.text(`${s.outlet_tujuan} | ${s.periode} | ${p} / ${pages}`, 14, 290);
  }
  return doc;
}

/** Ekspor utama memakai renderer yang sama dengan seluruh laporan bulanan. */
export async function pdfLaporanSumber(
  laporan: import("./laporan").Laporan,
  options: {
    lampiran?: boolean;
    internal?: boolean;
    semua?: import("./laporan").Laporan[];
    pt?: import("./laporan").Perusahaan | null;
    assets?: import("./laporan-keuangan-pdf").OpsiLaporanPdf["assets"];
  } = {},
) {
  const s = laporan.sumber_excel;
  if (!s) throw new Error("Arsip sumber laporan belum tersedia.");
  const [{ buatLaporanKeuanganPdf }, { siapkanLaporanDokumen, visualLaporan }] =
    await Promise.all([
      import("./laporan-keuangan-pdf"),
      import("./laporan-tampilan"),
    ]);
  const { l, pt } = siapkanLaporanDokumen(laporan, options.pt ?? null);
  const visual = visualLaporan(l, options.semua);
  return buatLaporanKeuanganPdf({
    l,
    pt,
    visual,
    internal: options.internal ?? true,
    assets: options.assets,
    lampiran: options.lampiran
      ? async (doc) => {
          const autoTable = (await import("jspdf-autotable")).default;
          for (const sheet of s.lembar) {
            doc.addPage();
            autoTable(doc, {
              startY: 28,
              head: [["Baris", "Keterangan", "Nilai sumber"]],
              body: barisLampiranSumber(sheet),
              styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
              headStyles: { fillColor: [58, 31, 11] },
              columnStyles: {
                0: { cellWidth: 13 },
                1: { cellWidth: 96 },
                2: { cellWidth: 73 },
              },
              margin: { top: 28, bottom: 18, left: 14, right: 14 },
              showHead: "everyPage",
              willDrawPage: () => {
                doc
                  .setTextColor(58, 31, 11)
                  .setFontSize(10)
                  .setFont("helvetica", "bold")
                  .text(`Lampiran - ${sheet.nama}`, 14, 18);
              },
              rowPageBreak: "avoid",
            });
          }
        }
      : undefined,
  });
}

/** Preserve source row order and displayed text, with readable column names instead of cell codes. */
export function barisLampiranSumber(sheet: LembarSumberExcel): string[][] {
  const headers = new Map<string, string>();
  if (sheet.nama === "Transaksi")
    for (const row of sheet.baris.filter((r) => r.nomor === 5 || r.nomor === 6))
      for (const c of row.sel) {
        if (c.teks) headers.set(c.alamat.replace(/\d+$/, ""), c.teks);
      }
  return sheet.baris.map((row) => [
    String(row.nomor),
    row.sel
      .filter((c) => typeof c.nilai !== "number" && c.teks !== "")
      .map((c) => c.teks)
      .join("\n"),
    row.sel
      .filter((c) => typeof c.nilai === "number" && c.teks !== "")
      .map((c) => {
        const label = headers.get(c.alamat.replace(/\d+$/, ""));
        return label ? `${label}: ${c.teks}` : c.teks;
      })
      .join("\n"),
  ]);
}
