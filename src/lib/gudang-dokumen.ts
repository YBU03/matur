import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Kiriman, ItemKiriman } from "./kiriman";
import type { Kop } from "./pdf-kop";
import {
  cetakGudangDefault,
  validCetakGudang,
  type CetakGudang,
} from "./gudang-cetak-config";
const uang = (v: number) => "Rp " + Math.round(v).toLocaleString("id-ID");
const nf = (v: number) =>
  Number(v).toLocaleString("id-ID", { maximumFractionDigits: 3 });
export function buatDokumenGudang(
  jenis: "surat-jalan" | "invoice",
  k: Kiriman,
  items: ItemKiriman[],
  pt: Kop,
  opsi: CetakGudang = cetakGudangDefault,
) {
  if (!validCetakGudang(opsi))
    throw new Error(
      "Ukuran kertas tidak valid: lebar 180–330 mm dan tinggi 130–420 mm.",
    );
  const doc = new jsPDF({
    unit: "mm",
    format: [opsi.lebar, opsi.tinggi],
    orientation: opsi.lebar > opsi.tinggi ? "landscape" : "portrait",
  });
  const W = doc.internal.pageSize.getWidth(),
    H = doc.internal.pageSize.getHeight(),
    M = 10;
  const invoice = jenis === "invoice";
  const diperiksa =
    k.status === "diterima" ||
    k.pemeriksaan_status === "selisih" ||
    k.pemeriksaan_status === "selesai";
  const qty = (i: ItemKiriman) =>
    diperiksa && i.qty_diterima !== null
      ? Number(i.qty_diterima)
      : Number(i.qty);
  const copies = opsi.rangkap === "salinan" ? 3 : 1,
    ranges: { start: number; end: number; copy: number }[] = [];
  function header() {
    doc
      .setTextColor(0)
      .setDrawColor(0)
      .setFont("helvetica", "bold")
      .setFontSize(11);
    doc.text(
      doc.splitTextToSize(pt.nama.toUpperCase(), W - 2 * M).slice(0, 2),
      M,
      11,
    );
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(
      doc.splitTextToSize(pt.alamat ?? "", W - 2 * M).slice(0, 2),
      M,
      18,
    );
    doc
      .setFont("helvetica", "bold")
      .setFontSize(11)
      .text(invoice ? "INVOICE" : "SURAT JALAN", W - M, 28, { align: "right" });
    doc.setFontSize(8).text(k.nomor, M, 28);
    doc.setFont("helvetica", "normal").text("Tanggal: " + k.tanggal, M, 33);
    doc.text(
      doc
        .splitTextToSize("Kepada: " + (k.outlet?.nama ?? "-"), W - 2 * M)
        .slice(0, 1),
      M,
      37,
    );
    doc.text(
      doc
        .splitTextToSize("Alamat: " + (k.outlet?.alamat ?? "-"), W - 2 * M)
        .slice(0, 2),
      M,
      41,
    );
    doc
      .setFont("helvetica", "bold")
      .text(
        k.status === "draft"
          ? "DRAFT - BELUM DIKIRIM"
          : k.status === "batal"
            ? "DIBATALKAN"
            : diperiksa
              ? "SUDAH DIPERIKSA OUTLET"
              : "MENUNGGU PEMERIKSAAN OUTLET",
        M,
        49,
      );
    doc.setLineWidth(0.3).line(M, 51, W - M, 51);
  }
  function page() {
    doc.addPage(
      [opsi.lebar, opsi.tinggi],
      opsi.lebar > opsi.tinggi ? "landscape" : "portrait",
    );
    header();
    return 56;
  }
  for (let c = 0; c < copies; c++) {
    if (c > 0)
      doc.addPage(
        [opsi.lebar, opsi.tinggi],
        opsi.lebar > opsi.tinggi ? "landscape" : "portrait",
      );
    const first = doc.getNumberOfPages();
    autoTable(doc, {
      startY: 55,
      margin: { left: M, right: M, top: 55, bottom: 14 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 1.5,
        lineColor: 80,
        lineWidth: 0.15,
        textColor: 0,
      },
      headStyles: { fillColor: 235, textColor: 0, fontStyle: "bold" },
      footStyles: { fillColor: 245, textColor: 0, fontStyle: "bold" },
      rowPageBreak: "avoid",
      didDrawPage: () => header(),
      head: [
        invoice
          ? ["No", "Nama Barang", "Jumlah", "Satuan", "Harga", "Subtotal"]
          : [
              "No",
              "Nama Barang",
              "Jumlah Kirim",
              "Satuan",
              "Baik Diterima",
              "Keterangan",
            ],
      ],
      body: items.map((i, n) =>
        invoice
          ? [
              String(n + 1),
              i.nama,
              nf(qty(i)),
              i.satuan ?? "",
              uang(Number(i.harga)),
              uang(qty(i) * Number(i.harga)),
            ]
          : [
              String(n + 1),
              i.nama,
              nf(Number(i.qty)),
              i.satuan ?? "",
              i.qty_diterima === null ? "" : nf(Number(i.qty_diterima)),
              "",
            ],
      ),
      foot: invoice
        ? [
            [
              "",
              "TOTAL",
              "",
              "",
              "",
              uang(
                items.reduce(
                  (s, i) => s + Math.round(qty(i) * Number(i.harga)),
                  0,
                ),
              ),
            ],
          ]
        : undefined,
      columnStyles: {
        0: { cellWidth: 9 },
        2: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
    let y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 5;
    const notes = [
      ...(k.catatan ? ["Catatan: " + k.catatan] : []),
      ...(invoice
        ? [
            diperiksa
              ? "Nilai mengikuti barang baik diterima. Selisih/kiriman susulan tercatat terpisah."
              : "Nilai rencana kirim; menunggu pemeriksaan outlet.",
          ]
        : []),
    ];
    doc.setFont("helvetica", "normal").setFontSize(8);
    for (const note of notes) {
      for (const line of doc.splitTextToSize(note, W - 2 * M)) {
        if (y > H - 18) y = page();
        doc.setFont("helvetica", "normal").setFontSize(8).text(line, M, y);
        y += 4;
      }
      y += 2;
    }
    const height = 35;
    if (y + height > H - 12) y = page();
    const labels = [
      "Dibuat oleh",
      "Diperiksa oleh",
      "Dikirim oleh",
      "Diterima oleh",
    ];
    const names = [
      k.pembuat_nama ?? "",
      k.pemeriksa_nama ?? "",
      k.pengirim ?? "",
      k.nama_penerima ?? "",
    ];
    const cw = (W - 2 * M) / 4;
    labels.forEach((l, i) => {
      const x = M + i * cw;
      doc.setDrawColor(0).setLineWidth(0.2).rect(x, y, cw, height);
      doc
        .setFont("helvetica", "bold")
        .setFontSize(8)
        .text(l, x + cw / 2, y + 5, { align: "center" });
      doc
        .setFont("helvetica", "normal")
        .setFontSize(7)
        .text(
          doc.splitTextToSize(names[i], cw - 4).slice(0, 4),
          x + cw / 2,
          y + 20,
          { align: "center" },
        );
      doc.text("Tanggal: ................", x + 2, y + 32);
    });
    ranges.push({ start: first, end: doc.getNumberOfPages(), copy: c });
  }
  for (const r of ranges)
    for (let p = r.start; p <= r.end; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(0);
      doc.text(
        opsi.rangkap === "ncr"
          ? "NCR 3 lapis: cetak 1 set (bukan 3 salinan)"
          : `Salinan ${r.copy + 1}/3 - ${["Arsip Gudang", "Outlet", "Accounting"][r.copy]}`,
        M,
        H - 6,
      );
      doc.text(
        `Halaman ${p - r.start + 1}/${r.end - r.start + 1}`,
        W - M,
        H - 6,
        { align: "right" },
      );
    }
  return doc;
}
