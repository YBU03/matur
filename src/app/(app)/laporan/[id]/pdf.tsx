"use client";

import { useState } from "react";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { hitung, namaBulan, type Laporan, type Perusahaan } from "@/lib/laporan";
import { gambar } from "@/lib/pdf-kop";
import { batang, bertumpuk, judul, kaki, kolom, kpi, WARNA } from "@/lib/pdf-grafik";
import { barisBanding, type Visual } from "./visual";

// Unduh laporan resmi sebagai PDF (A4), urutan bagian sama dengan laporan manual
export function UnduhPdf({ l, pt, visual: v }: { l: Laporan; pt: Perusahaan; visual: Visual }) {
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
      // ===== Halaman 1: ringkasan kinerja visual =====
      doc.setFont("helvetica", "bold").setFontSize(15).text(`LAPORAN KEUANGAN ${l.nama_outlet.toUpperCase()}`, W / 2, (y += 10), { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(120, 113, 108).text(`Ringkasan kinerja · Periode ${bulan}`, W / 2, (y += 5.5), { align: "center" });
      doc.setTextColor(0);
      const delta = (a: number, b?: number) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
      const kw = (W - 28 - 9) / 4;
      y += 6;
      kpi(doc, 14, y, kw, "Total penjualan", v.penjualan, delta(v.penjualan, v.prev?.penjualan));
      kpi(doc, 14 + (kw + 3), y, kw, "Laba kotor", v.labaKotor, delta(v.labaKotor, v.prev?.laba_kotor));
      kpi(doc, 14 + 2 * (kw + 3), y, kw, "Laba bersih", v.labaBersih, delta(v.labaBersih, v.prev?.laba_bersih));
      const persen = (x: number) => (v.penjualan ? ((x / v.penjualan) * 100).toFixed(1).replace(".", ",") : "0");
      kpi(doc, 14 + 3 * (kw + 3), y, kw, "Margin laba bersih", `${persen(v.labaBersih)}%`, null, `HPP ${persen(v.hpp)}% dari penjualan`);
      y += 30;
      // perbandingan bulan ini vs bulan lalu
      if (v.prev) {
        const yb = y;
        judul(doc, 14, yb, "Perbandingan dengan bulan lalu", `${v.prev.label} -> ${bulan}`);
        autoTable(doc, {
          startY: yb + 6,
          head: [["Pos", "Bulan lalu", "Bulan ini", "Perubahan"]],
          body: barisBanding(v).map((r) => {
            const d = r.lalu ? ((r.kini - r.lalu) / Math.abs(r.lalu)) * 100 : 0;
            return [r.k, formatRupiah(r.lalu), formatRupiah(r.kini), `${d > 0 ? "Naik" : d < 0 ? "Turun" : "Tetap"} ${Math.abs(d).toFixed(1).replace(".", ",")}%`];
          }),
          styles: { fontSize: 8, cellPadding: 1 },
          headStyles: { fillColor: [58, 31, 11] },
          columnStyles: { 1: { halign: "right" }, 2: { halign: "right", fontStyle: "bold" }, 3: { halign: "right" } },
          didParseCell: (c) => {
            if (c.section === "head" && c.column.index > 0) c.cell.styles.halign = "right";
            if (c.section !== "body" || c.column.index !== 3) return;
            const r = barisBanding(v)[c.row.index];
            const naik = r.kini > r.lalu;
            if (r.kini !== r.lalu) c.cell.styles.textColor = naik === r.naikBaik ? [21, 128, 61] : [220, 38, 38];
          },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
      }
      judul(doc, 14, y, "Ke mana uang penjualan pergi", `Dari total penjualan ${formatRupiah(v.penjualan)}`);
      y = bertumpuk(doc, 14, y + 7, W - 28, [
        { name: "HPP (bahan baku)", value: v.hpp },
        { name: "Beban operasional", value: v.beban },
        { name: "Sedekah", value: v.sedekah },
        { name: "Laba bersih", value: Math.max(v.labaBersih, 0) },
      ]) + 6;
      if (v.riwayat.length > 1) {
        judul(doc, 14, y, "Tren bulanan", "Penjualan dan laba bersih");
        y = kolom(doc, 14, y + 8, W - 28, 30, v.riwayat.map((r) => ({ label: r.label, a: r.penjualan, b: r.laba_bersih })), ["Penjualan", "Laba bersih"]) + 6;
      }
      const half = (W - 28 - 8) / 2;
      judul(doc, 14, y, "Komposisi pendapatan");
      judul(doc, 14 + half + 8, y, "Beban operasional terbesar");
      const y1 = batang(doc, 14, y + 5, half, v.pendapatan.slice(0, 8), WARNA[0]);
      const y2 = batang(doc, 14 + half + 8, y + 5, half, v.bebanRinci.slice(0, 8), WARNA[1]);
      y = Math.max(y1, y2) + 6;
      if (v.bagiHasil.length && y + 8 + v.bagiHasil.length * 6.5 < 278) {
        judul(doc, 14, y, "Bagi hasil laba bersih");
        batang(doc, 14, y + 5, W - 28, v.bagiHasil, WARNA[3], 62);
      }
      // ===== Halaman berikutnya: laporan resmi (format tetap) =====
      doc.addPage();
      y = 10;
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
          headStyles: { fillColor: [58, 31, 11], textColor: 255, fontStyle: "bold" },
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
        ...(Number(l.tagihan_titipan ?? 0) > 0 ? [["Tagihan dessert & cheesecake", Number(l.tagihan_titipan), "(+)"] as [string, number, string]] : []),
        ["Barang yang tersedia untuk dijual", h.tersedia],
        ["Persediaan akhir barang dagangan", l.persediaan_akhir, "(-)"],
        ["Harga pokok penjualan", h.hpp],
      ], [Number(l.tagihan_titipan ?? 0) > 0 ? 5 : 4]);
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
      kaki(doc, `${pt.nama} · Laporan Keuangan ${l.nama_outlet} ${bulan} · dibuat dengan Matoer`);
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
