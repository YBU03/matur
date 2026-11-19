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
