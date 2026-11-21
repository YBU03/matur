import type { LaporanStokOutlet, StokGerak } from "./stok-outlet";
import { LABEL_GERAK } from "./stok-outlet";
export const KOLOM_STOK = [
  "Outlet",
  "Bahan",
  "Satuan",
  "Stok awal*",
  "Masuk",
  "Pemakaian resep POS",
  "Kembali void",
  "Waste",
  "Marketing",
  "Penyesuaian SO",
  "Koreksi",
  "Keluar lainnya",
  "Stok akhir*",
];
export function barisStok(d: LaporanStokOutlet) {
  return d.ringkasan.map((r) => [
    r.outlet,
    r.nama,
    r.satuan,
    ...[
      "awal",
      "masuk",
      "pakai",
      "kembali",
      "waste",
      "marketing",
      "so",
      "koreksi",
      "keluar_lain",
      "akhir",
    ].map((k) => Number(r[k as keyof typeof r])),
  ]);
}
const headerGerak = [
  "Waktu WIB",
  "Outlet",
  "Bahan",
  "Satuan",
  "Jenis",
  "Jumlah (+/-)",
  "Petugas",
  "Keterangan",
  "Referensi",
];
export function barisGerak(rows: StokGerak[]) {
  return rows.map((r) => [
    new Date(r.created_at).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
    }),
    r.outlet,
    r.nama,
    r.satuan,
    LABEL_GERAK[r.jenis] ?? r.jenis,
    Number(r.jumlah),
    r.petugas ?? "-",
    r.keterangan ?? "",
    r.ref_id ?? "",
  ]);
}
export async function eksporStokOutlet(
  jenis: "excel" | "pdf",
  d: LaporanStokOutlet,
  events: StokGerak[],
  periode: string,
  lokasi: string,
) {
  const title = "Laporan Penggunaan Bahan Baku";
  const sub = `${lokasi} | ${periode} | hari operasional`;
  const note =
    "* Saldo direkonstruksi dari stok saat ini dan riwayat mutasi. Pemakaian POS bersifat teoritis berdasarkan resep. Waste, marketing, void dan SO terpisah; selisih SO bukan otomatis pemakaian nyata. Tidak ada penjumlahan lintas satuan.";
  if (jenis === "excel") {
    const { Workbook } = (await import("exceljs")).default;
    const wb = new Workbook();
    for (const [name, head, rows] of [
      ["Ringkasan", KOLOM_STOK, barisStok(d)],
      ["Riwayat mutasi", headerGerak, barisGerak(events)],
    ] as const) {
      const ws = wb.addWorksheet(name);
      ws.addRow([title]).font = { bold: true, size: 15 };
      ws.addRow([sub]);
      ws.addRow([note]);
      const h = ws.addRow([...head]);
      h.font = { bold: true };
      h.eachCell((c) => {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFDE7C8" },
        };
      });
      for (const row of rows) ws.addRow([...row]);
      ws.columns.forEach((c, i) => {
        c.width = i === 1 ? 32 : 20;
      });
      ws.eachRow((r, n) => {
        if (n > 4)
          r.eachCell((c) => {
            if (typeof c.value === "number")
              c.numFmt = "#,##0.###;[Red]-#,##0.###";
          });
      });
      ws.views = [{ state: "frozen", ySplit: 4 }];
      ws.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: head.length },
      };
    }
    const { unduhExcel } = await import("./gudang-laporan-excel");
    await unduhExcel(wb, `${title} ${periode}`);
  } else {
    const [{ jsPDF }, { default: autoTable }, { unduh }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("./pdf-kop"),
    ]);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(15).text(title, 14, 16);
    doc.setFontSize(9).text(sub, 14, 23);
    doc.setFontSize(8).text(doc.splitTextToSize(note, 268), 14, 30);
    autoTable(doc, {
      startY: 44,
      head: [KOLOM_STOK],
      body: barisStok(d).map((r) =>
        r.map((v) =>
          typeof v === "number"
            ? new Intl.NumberFormat("id-ID", {
                maximumFractionDigits: 3,
              }).format(v)
            : v,
        ),
      ),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [58, 31, 11] },
      margin: { top: 18, bottom: 16 },
      rowPageBreak: "avoid",
    });
    if (events.length) {
      doc.addPage();
      doc.setFontSize(13).text("Riwayat mutasi bahan", 14, 13);
      autoTable(doc, {
        startY: 18,
        head: [headerGerak],
        body: barisGerak(events),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [58, 31, 11] },
        margin: { top: 18, bottom: 16 },
        rowPageBreak: "avoid",
      });
    }
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc
        .setFontSize(8)
        .text(`${lokasi} | ${periode} | ${i}/${pages}`, 14, 202);
    }
    unduh(doc, `${title} ${periode}`);
  }
}
