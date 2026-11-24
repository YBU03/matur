import {
  rekapKeuangan,
  marginLaba,
  persenLaba,
  hakLaporan,
  ringkasBayar,
  rupiahLaporan,
  type Bayar,
} from "./laporan-rekap";
import { namaBulan, type Laporan } from "./laporan";
export async function eksporRekap(
  list: Laporan[],
  bayar: Bayar[],
  scope: string,
  jenis: "pdf" | "excel",
  simpan = true,
) {
  const rows = rekapKeuangan(list);
  const totals = rows.reduce(
    (t, r) => ({
      omzet: t.omzet + r.omzet,
      laba: t.laba + r.laba,
      mitra: t.mitra + r.mitra,
      pusat: t.pusat + r.pusat,
    }),
    { omzet: 0, laba: 0, mitra: 0, pusat: 0 },
  );
  const rincian = list.flatMap((l) =>
    hakLaporan(l).map((h) => ({
      ...h,
      laporan: l.outlet?.nama ?? l.nama_outlet,
      bulan: namaBulan(l.periode),
      ...ringkasBayar(
        h,
        bayar.filter((b) => b.laporan_id === l.id),
      ),
    })),
  );
  const file = `Rekap-Keuangan-${new Date().toISOString().slice(0, 10)}`;
  if (jenis === "excel") {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Rekap bulanan");
    ws.addRow([scope]);
    ws.addRow([
      "Outlet",
      "Bulan",
      "Omzet setelah diskon",
      "Laba bersih",
      "Margin laba",
      "Hak Mitra",
      "Hak Pusat",
    ]);
    for (const r of rows)
      ws.addRow([
        r.outlet,
        namaBulan(r.periode),
        r.omzet,
        r.laba,
        r.margin === null ? null : r.margin / 100,
        r.mitra,
        r.pusat,
      ]);
    ws.addRow([
      "Total",
      "",
      totals.omzet,
      totals.laba,
      marginLaba(totals.laba, totals.omzet) === null
        ? null
        : totals.laba / totals.omzet,
      totals.mitra,
      totals.pusat,
    ]);
    ws.getColumn(5).numFmt = "0.00%";
    for (const c of [3, 4, 6, 7]) ws.getColumn(c).numFmt = "#,##0.############";
    const d = wb.addWorksheet("Hak dan pembayaran");
    d.addRow([
      "Outlet",
      "Bulan",
      "Penerima",
      "Keterangan",
      "Hak",
      "Pembayaran tercatat",
      "Sisa",
      "Penyesuaian pembulatan",
      "Status",
      "Periksa",
    ]);
    rincian.forEach((r) =>
      d.addRow([
        r.laporan,
        r.bulan,
        r.nama,
        r.jenis,
        Number(r.jumlah),
        r.dibayar,
        r.sisa,
        r.pembulatan,
        r.status,
        r.perluCek ? "Hak berubah" : "",
      ]),
    );
    const b = wb.addWorksheet("Riwayat pembayaran");
    b.addRow([
      "ID",
      "Laporan",
      "Penerima",
      "Tanggal",
      "Metode",
      "Jumlah",
      "Penyesuaian pembulatan",
      "Status",
      "Catatan",
      "Bukti tersedia",
    ]);
    bayar.forEach((p) =>
      b.addRow([
        p.id,
        list.find((l) => l.id === p.laporan_id)?.nama_outlet ?? "",
        p.hak_snapshot.nama,
        p.tanggal,
        p.metode,
        Number(p.jumlah),
        Number(p.pembulatan ?? 0),
        p.status,
        p.catatan,
        p.bukti ? "Ya (akses dari aplikasi)" : "Tidak",
      ]),
    );
    const penerima = wb.addWorksheet("Pembagian laporan");
    penerima.addRow(["Outlet", "Bulan", "Penerima", "Persentase", "Nominal"]);
    list.forEach((l) =>
      l.bagi_hasil.forEach((p) =>
        penerima.addRow([
          l.outlet?.nama ?? l.nama_outlet,
          namaBulan(l.periode),
          p.nama,
          Number(p.persen) / 100,
          Number(p.jumlah),
        ]),
      ),
    );
    penerima.getColumn(4).numFmt = "0.00%";
    penerima.getColumn(5).numFmt = "#,##0.############";
    for (const s of [ws, d, b, penerima]) {
      s.views = [{ state: "frozen", ySplit: s === ws ? 2 : 1 }];
      s.autoFilter = {
        from: { row: s === ws ? 2 : 1, column: 1 },
        to: { row: s === ws ? 2 : 1, column: s.columnCount },
      };
      s.columns.forEach((c) => {
        c.width = 24;
      });
    }
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (simpan) download(blob, `${file}.xlsx`);
    return { blob, nama: `${file}.xlsx` };
  } else {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    const header = (title: string) => {
      doc.setFontSize(15);
      doc.text(title, 14, 15);
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(scope, 265), 14, 22);
    };

    autoTable(doc, {
      startY: 34,
      didDrawPage: () => header("Rekap Keuangan & Bagi Hasil"),
      head: [
        [
          "Outlet",
          "Bulan",
          "Omzet",
          "Laba bersih",
          "Margin",
          "Hak Mitra",
          "Hak Pusat",
        ],
      ],
      body: [
        ...rows.map((r) => [
          r.outlet,
          namaBulan(r.periode),
          rupiahLaporan(r.omzet),
          rupiahLaporan(r.laba),
          persenLaba(r.margin),
          rupiahLaporan(r.mitra),
          rupiahLaporan(r.pusat),
        ]),
        [
          "Total",
          "",
          rupiahLaporan(totals.omzet),
          rupiahLaporan(totals.laba),
          persenLaba(marginLaba(totals.laba, totals.omzet)),
          rupiahLaporan(totals.mitra),
          rupiahLaporan(totals.pusat),
        ],
      ],
      styles: { fontSize: 8, cellPadding: 3 },
      rowPageBreak: "avoid",
      margin: { top: 34, bottom: 18 },
      headStyles: { fillColor: [74, 42, 15] },
    });
    doc.addPage();
    autoTable(doc, {
      startY: 34,
      didDrawPage: () => header("Rincian Hak & Pembayaran Tercatat"),
      head: [
        [
          "Outlet / bulan",
          "Penerima / keterangan",
          "Hak",
          "Tercatat dibayar",
          "Pembulatan",
          "Sisa",
          "Status",
        ],
      ],
      body: rincian.map((r) => [
        `${r.laporan}\n${r.bulan}`,
        `${r.nama}\n${r.jenis}`,
        rupiahLaporan(Number(r.jumlah)),
        rupiahLaporan(r.dibayar),
        rupiahLaporan(r.pembulatan),
        rupiahLaporan(r.sisa),
        r.status + (r.perluCek ? " · periksa hak" : ""),
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      rowPageBreak: "avoid",
      margin: { top: 34, bottom: 18 },
      headStyles: { fillColor: [74, 42, 15] },
    });
    doc.addPage();
    autoTable(doc, {
      startY: 34,
      didDrawPage: () => header("Persentase & Nominal per Penerima"),
      head: [["Outlet", "Bulan", "Penerima", "Bagian (%)", "Nominal"]],
      body: list.flatMap((l) =>
        l.bagi_hasil.map((p) => [
          l.outlet?.nama ?? l.nama_outlet,
          namaBulan(l.periode),
          p.nama,
          persenLaba(Number(p.persen)),
          rupiahLaporan(Number(p.jumlah)),
        ]),
      ),
      styles: { fontSize: 8, cellPadding: 3 },
      rowPageBreak: "avoid",
      margin: { top: 34, bottom: 18 },
      headStyles: { fillColor: [74, 42, 15] },
    });
    if (bayar.length) {
      doc.addPage();
      autoTable(doc, {
        startY: 34,
        didDrawPage: () => header("Riwayat Pembayaran"),
        head: [
          [
            "Tanggal / ID",
            "Penerima",
            "Metode",
            "Jumlah",
            "Pembulatan",
            "Status",
            "Catatan",
          ],
        ],
        body: bayar.map((p) => [
          `${p.tanggal}\n${p.id}`,
          p.hak_snapshot.nama,
          p.metode,
          rupiahLaporan(Number(p.jumlah)),
          rupiahLaporan(Number(p.pembulatan ?? 0)),
          p.status,
          p.catatan,
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        rowPageBreak: "avoid",
        margin: { top: 34, bottom: 18 },
        headStyles: { fillColor: [74, 42, 15] },
      });
    }
    for (let n = 1; n <= doc.getNumberOfPages(); n++) {
      doc.setPage(n);
      doc.setFontSize(8);
      doc.text(
        "Hak sesuai laporan bukan bukti pembayaran. Margin total = total laba / total omzet.",
        14,
        202,
      );
      doc.text(`${n}/${doc.getNumberOfPages()}`, 278, 202, { align: "right" });
    }
    const blob = doc.output("blob");
    if (simpan) download(blob, `${file}.pdf`);
    return { blob, nama: `${file}.pdf` };
  }
}
function download(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
