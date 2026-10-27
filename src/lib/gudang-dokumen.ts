import { ringkasInvoice } from "./gudang-invoice";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Kiriman, ItemKiriman } from "./kiriman";
import type { Kop } from "./pdf-kop";
import {
  cetakGudangDefault,
  validCetakGudang,
  type CetakGudang,
} from "./gudang-cetak-config";
export type LogoGudang = { url: string; w: number; h: number };
const uang = (v: number) => "Rp " + Math.round(v).toLocaleString("id-ID");
const nf = (v: number) =>
  Number(v).toLocaleString("id-ID", { maximumFractionDigits: 3 });
export function buatDokumenGudang(
  jenis: "surat-jalan" | "invoice",
  k: Kiriman,
  items: ItemKiriman[],
  pt: Kop,
  opsi: CetakGudang = cetakGudangDefault,
  logo?: LogoGudang,
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
  const ringkasan = ringkasInvoice(k, items);
  const total = ringkasan.barang;
  let tableTop = 55;
  const tanggal = (v: string) => {
    const [y, m, d] = v.slice(0, 10).split("-");
    return d && m && y ? d + "/" + m + "/" + y : v;
  };
  function invoiceHeader() {
    doc.setTextColor(0).setDrawColor(0);
    const leftW = (W - 2 * M) * 0.55;
    const rightX = M + leftW + 5;
    const rightW = W - M - rightX;
    const logoW = logo ? Math.min(17, (18 * logo.w) / logo.h) : 0;
    if (logo) {
      const lh = (logoW * logo.h) / logo.w;
      doc.addImage(logo.url, "PNG", M, 8, logoW, lh, "hazna-logo");
    }
    const tx = M + (logo ? logoW + 3 : 0);
    doc.setFont("helvetica", "bold").setFontSize(9);
    const namaLines = doc.splitTextToSize(
      pt.nama.toUpperCase(),
      leftW - (tx - M),
    );
    doc.text(namaLines, tx, 12);
    let leftY = 12 + namaLines.length * 3.5 + 2;
    doc.setFont("helvetica", "normal").setFontSize(7);
    const alamatLines = doc.splitTextToSize(pt.alamat ?? "", leftW - (tx - M));
    doc.text(alamatLines, tx, leftY);
    leftY = Math.max(leftY + alamatLines.length * 3.2 + 3, 30);
    const kontakLines = doc.splitTextToSize(
      [pt.telepon, pt.email].filter(Boolean).join(" | "),
      leftW,
    );
    doc.text(kontakLines, M, leftY);
    leftY += kontakLines.length * 3.2 + 4;
    doc
      .setFont("helvetica", "bold")
      .setFontSize(11)
      .text("INVOICE PENJUALAN", W - M, 12, { align: "right" });
    doc.setFont("helvetica", "normal").setFontSize(7.5);
    const meta = [
      ["Invoice #", k.nomor],
      ["Tanggal", tanggal(k.tanggal)],
      ["Jatuh tempo", "-"],
      ["Outlet", k.outlet?.nama ?? "-"],
      ["Penerima", k.nama_penerima || "-"],
    ];
    meta.forEach(([label, value], n) => {
      const y = 22 + n * 5.5;
      doc.text(label, rightX, y);
      // One bounded line; full outlet name/address also appears in the left recipient block.
      doc
        .setFontSize(7)
        .text(
          doc.splitTextToSize(value, rightW - 23).slice(0, 1),
          rightX + 23,
          y,
        );
      doc.setFontSize(7.5);
    });
    doc
      .setFont("helvetica", "bold")
      .setFontSize(7.5)
      .text("Tagih / Kirim ke", M, leftY);
    leftY += 4;
    doc.setFont("helvetica", "normal").setFontSize(7.5);
    const outletLines = doc.splitTextToSize(k.outlet?.nama ?? "-", leftW);
    doc.text(outletLines, M, leftY);
    leftY += outletLines.length * 3.3;
    const outletAlamat = doc.splitTextToSize(k.outlet?.alamat ?? "", leftW);
    doc.text(outletAlamat, M, leftY);
    leftY += outletAlamat.length * 3.3;
    const statusY = Math.max(leftY + 2, 49);
    doc
      .setFont("helvetica", "bold")
      .setFontSize(7)
      .text(
        k.status === "draft"
          ? "DRAFT - BELUM DIKIRIM"
          : k.status === "batal"
            ? "DIBATALKAN"
            : diperiksa
              ? "SUDAH DIPERIKSA OUTLET"
              : "MENUNGGU PEMERIKSAAN OUTLET",
        M,
        statusY,
      );
    doc.setLineWidth(0.3).line(M, statusY + 2, W - M, statusY + 2);
    tableTop = statusY + 6;
  }

  function header() {
    if (invoice) {
      invoiceHeader();
      return;
    }
    doc
      .setTextColor(0)
      .setDrawColor(0)
      .setFont("helvetica", "bold")
      .setFontSize(11);
    const logoW = logo ? Math.min(17, (18 * logo.w) / logo.h) : 0;
    if (logo)
      doc.addImage(
        logo.url,
        "PNG",
        M,
        7,
        logoW,
        (logoW * logo.h) / logo.w,
        "hazna-logo",
      );
    const tx = M + (logo ? logoW + 3 : 0);
    doc.text(
      doc.splitTextToSize(pt.nama.toUpperCase(), W - M - tx).slice(0, 2),
      tx,
      11,
    );
    doc.setFont("helvetica", "normal").setFontSize(8);
    const alamat = doc.splitTextToSize(pt.alamat ?? "", W - M - tx);
    doc.text(alamat, tx, 18);
    const offset = Math.max(0, 18 + alamat.length * 3.3 - 25);
    doc
      .setFont("helvetica", "bold")
      .setFontSize(11)
      .text(invoice ? "INVOICE" : "SURAT JALAN", W - M, 28 + offset, {
        align: "right",
      });
    doc.setFontSize(8).text(k.nomor, M, 28 + offset);
    doc
      .setFont("helvetica", "normal")
      .text("Tanggal: " + k.tanggal, M, 33 + offset);
    doc.text(
      doc
        .splitTextToSize("Kepada: " + (k.outlet?.nama ?? "-"), W - 2 * M)
        .slice(0, 1),
      M,
      37 + offset,
    );
    doc.text(
      doc
        .splitTextToSize("Alamat: " + (k.outlet?.alamat ?? "-"), W - 2 * M)
        .slice(0, 2),
      M,
      41 + offset,
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
        49 + offset,
      );
    doc.setLineWidth(0.3).line(M, 51 + offset, W - M, 51 + offset);
    tableTop = 55 + offset;
  }
  function page() {
    doc.addPage(
      [opsi.lebar, opsi.tinggi],
      opsi.lebar > opsi.tinggi ? "landscape" : "portrait",
    );
    header();
    return tableTop + 1;
  }
  for (let c = 0; c < copies; c++) {
    if (c > 0)
      doc.addPage(
        [opsi.lebar, opsi.tinggi],
        opsi.lebar > opsi.tinggi ? "landscape" : "portrait",
      );
    const first = doc.getNumberOfPages();
    header();
    if (tableTop + 40 > H - 12)
      throw new Error(
        "Alamat terlalu panjang untuk ukuran kertas ini. Pilih kertas lebih tinggi.",
      );
    autoTable(doc, {
      startY: tableTop,
      margin: { left: M, right: M, top: tableTop, bottom: 14 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: invoice ? 7 : 8,
        cellPadding: invoice ? 1.2 : 1.5,
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
          ? [
              "No",
              "SKU",
              "Produk",
              "Qty",
              "Satuan",
              "Harga",
              "Diskon",
              "Jumlah",
              "Pajak",
            ]
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
              "-",
              i.nama,
              nf(qty(i)),
              i.satuan ?? "",
              uang(Number(i.harga)),
              "-",
              uang(Math.round(qty(i) * Number(i.harga))),
              "-",
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
      columnStyles: invoice
        ? {
            0: { cellWidth: 7 },
            1: { cellWidth: 12 },
            2: {},
            3: { cellWidth: 11, halign: "right" },
            4: { cellWidth: 14 },
            5: { cellWidth: 23, halign: "right" },
            6: { cellWidth: 13, halign: "right" },
            7: { cellWidth: 24, halign: "right" },
            8: { cellWidth: 12, halign: "right" },
          }
        : {
            0: { cellWidth: 9 },
            2: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right" },
          },
    });
    let y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 5;
    let summaryPage = 0,
      summaryBottom = 0;
    if (invoice) {
      // Payments are not stored on kiriman; never infer debt or settlement from receipt status.
      // Penyesuaian opsional: hanya tampil bila ada, dengan tanda +/- yang jelas.
      const adj = ringkasan.penyesuaian;
      const rows: [string, string][] = [
        ["Subtotal", uang(total)],
        ["Diskon", "-"],
        ["Pajak", "-"],
        ...(adj ? ([["Penyesuaian", `${adj > 0 ? "+" : "-"} ${uang(Math.abs(adj))}`]] as [string, string][]) : []),
      ];
      const akhir: [string, string][] = [
        ["Pembayaran", "Belum tercatat"],
        ["SISA TAGIHAN", "Belum direkonsiliasi"],
      ];
      const baris = 5;
      const sh = (rows.length + 1 + akhir.length) * baris + 9;
      if (y + sh > H - 14) y = page();
      const sx = W - M - 88;
      // garis atas di atas tinggi huruf (± 2,8 mm untuk 8 pt) agar tidak menabrak "Subtotal"
      doc.setDrawColor(0).setLineWidth(0.2).line(sx, y - 1, W - M, y - 1);
      let ty = y + 4;
      const tulis = (label: string, value: string, tebal: boolean) => {
        doc.setFont("helvetica", tebal ? "bold" : "normal").setFontSize(8);
        doc.text(label, sx, ty);
        doc.text(value, W - M, ty, { align: "right" });
        ty += baris;
      };
      for (const [l, v] of rows) tulis(l, v, false);
      // TOTAL: garis tipis di atasnya + latar abu muda
      ty += 1;
      doc.setLineWidth(0.15).line(sx, ty - 4, W - M, ty - 4);
      doc.setFillColor(238, 238, 238).rect(sx - 1.5, ty - 3.6, W - M - sx + 3, 5.2, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold").text("TOTAL", sx, ty);
      doc.text(uang(ringkasan.total), W - M, ty, { align: "right" });
      ty += baris + 1.5;
      akhir.forEach(([l, v], n) => tulis(l, v, n === akhir.length - 1));
      summaryPage = doc.getNumberOfPages();
      summaryBottom = ty;
    }
    const notes = [
      ...(k.catatan ? ["Catatan: " + k.catatan] : []),
      ...(invoice && k.penyesuaian?.keterangan
        ? ["Penyesuaian: " + k.penyesuaian.keterangan]
        : []),
      ...(invoice
        ? [
            "SKU, diskon, pajak dan jatuh tempo: - (belum dicatat). Pembayaran/sisa tagihan belum direkonsiliasi.",
            diperiksa
              ? "Nilai mengikuti barang baik diterima. Selisih/kiriman susulan tercatat terpisah."
              : "Nilai rencana kirim; menunggu pemeriksaan outlet.",
          ]
        : []),
    ];
    doc.setFont("helvetica", "normal").setFontSize(8);
    for (const note of notes) {
      for (const line of doc.splitTextToSize(
        note,
        invoice ? W - 2 * M - 96 : W - 2 * M,
      )) {
        if (y > H - 18) y = page();
        doc.setFont("helvetica", "normal").setFontSize(8).text(line, M, y);
        y += 4;
      }
      y += 2;
    }
    if (invoice && doc.getNumberOfPages() === summaryPage)
      y = Math.max(y, summaryBottom);
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
