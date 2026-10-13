"use client";

import { useState } from "react";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { hitung, namaBulan, type Laporan, type Perusahaan } from "@/lib/laporan";
import { gambar } from "@/lib/pdf-kop";

// Unduh laporan resmi sebagai PDF (A4), urutan bagian sama dengan laporan manual
export function UnduhPdf({ l, pt }: { l: Laporan; pt: Perusahaan }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const h = hitung(l);
      const bulan = namaBulan(l.periode);
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const [logo, ttd] = await Promise.all([gambar("/brand/hazna-logo.png"), gambar("/brand/ttd-hazna.png")]);
      doc.addImage(logo.url, "PNG", 14, 8, (18 * logo.w) / logo.h, 18);
      let y = 14;
      doc.setFont("helvetica", "bold").setFontSize(13).text(pt.nama.toUpperCase(), W / 2 + 8, y, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(8);
      if (pt.alamat) doc.text(pt.alamat, W / 2 + 8, (y += 5), { align: "center" });
      if (pt.email || pt.telepon) doc.text(`Email: ${pt.email ?? "-"}  Telp: ${pt.telepon ?? "-"}`, W / 2 + 8, (y += 4), { align: "center" });
      y = Math.max(y, 26);
      doc.setLineWidth(0.6).line(14, (y += 3), W - 14, y);
      doc.setFont("helvetica", "bold").setFontSize(12).text(`LAPORAN KEUANGAN ${l.nama_outlet.toUpperCase()}`, W / 2, (y += 8), { align: "center" });
      const rp = (n: number) => formatRupiah(n);
      const after = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
      const plain = { theme: "plain" as const, styles: { fontSize: 8.5, cellPadding: 0.8 } };
      autoTable(doc, {
        ...plain,
        startY: y + 4,
        body: [
          ["Nama Outlet", ":", l.nama_outlet],
          ["Tanggal Mulai Operasional", ":", l.outlet?.tgl_mulai ? formatTanggal(l.outlet.tgl_mulai) : "-"],
          ["Jam Operasional", ":", l.outlet?.jam_operasional ?? "-"],
          ["Periode Laporan", ":", `Per ${bulan}`],
          ["Mitra", ":", l.mitra ?? "-"],
          ["Penanggung Jawab Laporan", ":", l.pj_laporan ?? "-"],
          ["Jumlah Karyawan", ":", `${l.karyawan.length}\n${l.karyawan.map((k, i) => `${i + 1}. ${k}`).join("\n")}`],
        ],
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 4 } },
      });
      const sec = (judul: string, body: (string | number)[][], bold: number[] = []) => {
        autoTable(doc, {
          ...plain,
          startY: after(),
          head: [[{ content: judul, colSpan: 3 }]],
          headStyles: { fillColor: [255, 239, 194], textColor: 20, fontStyle: "bold" },
          body: body.map((r) => [r[0], typeof r[1] === "number" ? rp(r[1]) : r[1], r[2] ?? ""]),
          columnStyles: { 1: { halign: "right", cellWidth: 40 }, 2: { cellWidth: 8, textColor: 120 } },
          didParseCell: (d) => {
            if (d.section === "body" && bold.includes(d.row.index)) d.cell.styles.fontStyle = "bold";
          },
        });
      };
      sec("HARGA POKOK PENJUALAN", [
        ["Persediaan awal barang dagangan", l.persediaan_awal],
        ["Pembelian bahan baku", l.pembelian, "(+)"],
        ["Barang yang tersedia untuk dijual", h.tersedia],
        ["Persediaan akhir barang dagangan", l.persediaan_akhir, "(-)"],
        ["Harga pokok penjualan", h.hpp],
      ], [4]);
      const pend = [...l.pendapatan.map((p) => [`   ${p.nama}`, p.jumlah]), ["   Discount", -l.diskon, "(+)"]];
      const beban = [[`   Sedekah ${String(l.persen_sedekah).replace(".", ",")}%`, l.sedekah], ...l.beban.map((b) => [`   ${b.nama}`, b.jumlah])];
      const lr: (string | number)[][] = [
        ["Pendapatan", ""],
        ...pend,
        ["Total penjualan", h.totalPenjualan],
        ["Pengeluaran", ""],
        ["   Bahan baku", h.hpp],
        ["Laba kotor", h.labaKotor],
        ["Beban Operasional:", ""],
        ...beban,
        ["Total beban operasional", h.totalBeban, "(-)"],
        ["Laba Bersih", h.labaBersih],
      ];
      const iTot = pend.length + 1;
      sec("LABA RUGI", lr, [0, iTot, iTot + 1, iTot + 3, iTot + 4, lr.length - 2, lr.length - 1]);
      const bh = l.bagi_hasil.map((b) => [`${/pengelola/i.test(b.nama) ? "Untuk" : "Bagi Hasil a.n"} ${b.nama} ${b.persen}%`, b.jumlah]);
      sec("SHARING PROFIT", [["Modal Awal", l.modal_awal], ["Laba Outlet", h.labaBersih, "(+)"], ["Modal", h.modal], ...bh, ["Modal Akhir", l.modal_awal]], [2, bh.length + 3]);
      sec("SALDO SEDEKAH", [["Sedekah bulan ini", l.sedekah], ["Disalurkan (Kelola Pusat)", -l.sedekah], ["Saldo", 0]], [2]);
      autoTable(doc, {
        startY: after(),
        head: [["No", "Keterangan", "Jumlah", "Bank / No Rekening", "Atas Nama"]],
        body: [
          ...l.transfer.map((t, i) => [String(i + 1), t.keterangan, rp(t.jumlah), t.no_rekening ? `${t.bank} ${t.no_rekening}` : "", t.atas_nama ?? ""]),
          ["", "Total", rp(h.totalTransfer), "", ""],
        ],
        styles: { fontSize: 8.5 },
        headStyles: { fillColor: [90, 52, 23] },
        columnStyles: { 2: { halign: "right" } },
      });
      let fy = after() + 6;
      if (fy > 250) {
        doc.addPage();
        fy = 20;
      }
      doc.setFont("helvetica", "normal").setFontSize(9);
      doc.text(`${l.kota_terbit ?? ""}, ${l.tgl_terbit ? formatTanggal(l.tgl_terbit) : ""}`, W - 50, fy, { align: "center" });
      const th = 20, tw = (th * ttd.w) / ttd.h;
      doc.addImage(ttd.url, "PNG", W - 50 - tw / 2, fy + 2, tw, th);
      doc.setFont("helvetica", "bold").text(l.penandatangan ?? "", W - 50, fy + 27, { align: "center" });
      doc.setFont("helvetica", "normal").text(l.jabatan_penandatangan ?? "", W - 50, fy + 32, { align: "center" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(doc.output("blob"));
      a.download = `Laporan Keuangan ${l.nama_outlet} ${bulan}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button disabled={busy} onClick={run} className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
      {busy ? "Menyiapkan…" : "⬇ Unduh PDF"}
    </button>
  );
}
