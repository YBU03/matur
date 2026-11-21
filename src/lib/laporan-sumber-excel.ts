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
    assets?: import("./laporan-keuangan-pdf").OpsiLaporanPdf["assets"];
  } = {},
) {
  const s = laporan.sumber_excel;
  if (!s) throw new Error("Arsip sumber laporan belum tersedia.");
  const [{ buatLaporanKeuanganPdf }, { hitung }] = await Promise.all([
    import("./laporan-keuangan-pdf"),
    import("./laporan"),
  ]);
  const cells =
    s.lembar
      .find((sh) => sh.nama === "Laporan Keuangan")
      ?.baris.flatMap((r) => r.sel) ?? [];
  const cell = (address: string) => cells.find((c) => c.alamat === address);
  const start = cell("E13")?.nilai;
  const l = {
    ...laporan,
    outlet: {
      nama: laporan.nama_outlet,
      tgl_mulai:
        typeof start === "number"
          ? new Date((start - 25569) * 86400000).toISOString().slice(0, 10)
          : null,
      jam_operasional: cell("E14")?.teks ?? null,
    },
  };
  const contact = cell("C5")?.teks ?? "";
  const pt = {
    nama: cell("C3")?.teks ?? "CV. Hazna Berkah Indonesia",
    alamat: cell("C4")?.teks ?? null,
    email: contact.match(/Email:\s*(.*?)\s*Telp:/i)?.[1] ?? null,
    telepon: contact.match(/Telp:\s*(.*)/i)?.[1] ?? null,
  };
  const h = hitung(l);
  const visual = {
    bulan: judulPeriodeSumber(s),
    penjualan: h.totalPenjualan,
    hpp: h.hpp,
    labaKotor: h.labaKotor,
    labaBersih: h.labaBersih,
    beban: h.totalBeban - l.sedekah,
    sedekah: l.sedekah,
    persenSedekah: l.persen_sedekah,
    pendapatan: l.pendapatan
      .filter((x) => x.jumlah > 0)
      .map((x) => ({ name: x.nama, value: x.jumlah })),
    bebanRinci: [
      { name: "Sedekah", value: l.sedekah },
      ...l.beban.map((x) => ({ name: x.nama, value: x.jumlah })),
    ]
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value),
    bagiHasil: l.bagi_hasil.map((x) => ({
      name: `${x.nama} ${x.persen}%`,
      value: x.jumlah,
    })),
    prev: null,
    riwayat: [],
  };
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
            doc
              .setTextColor(0)
              .setFontSize(12)
              .setFont("helvetica", "bold")
              .text(`Lampiran sumber - ${sheet.nama}`, 14, 18);
            autoTable(doc, {
              startY: 24,
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
              headStyles: { fillColor: [58, 31, 11] },
              columnStyles: {
                0: { cellWidth: 13 },
                1: { cellWidth: 96 },
                2: { cellWidth: 73 },
              },
              margin: { top: 16, bottom: 18, left: 14, right: 14 },
              rowPageBreak: "avoid",
            });
          }
        }
      : undefined,
  });
}
