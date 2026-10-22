"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { saveMaster } from "@/lib/master-actions";
import type { Checklist, Dokumen, Jadwal, Komentar, Setoran } from "@/lib/proyek";
import { catatDokumen, hapusDokumen, hapusKomentar, kirimKomentar, tetapkanOpening, type Result } from "@/lib/proyek-actions";
import { supabaseBrowser } from "@/lib/supabase/browser";

const Msg = ({ r }: { r: Result | null }) =>
  r ? <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${r.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{r.error ?? r.ok}</p> : null;

// Admin memakai salah satu usulan sebagai tanggal resmi
export function PakaiTanggal({ proyekId, jenis, tanggal }: { proyekId: string; jenis: "Soft Opening" | "Grand Opening"; tanggal: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        confirm(`Tetapkan ${jenis} pada ${formatTanggal(tanggal)}?`) &&
        start(async () => {
          const r = await tetapkanOpening(proyekId, jenis, tanggal);
          if (r.error) alert(r.error);
          router.refresh();
        })
      }
      className="rounded-lg bg-matur-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
    >
      {pending ? "…" : "Pakai tanggal ini"}
    </button>
  );
}

// Centang checklist langsung (admin)
export function CentangChecklist({ proyekId, item, admin }: { proyekId: string; item: Checklist; admin: boolean }) {
  const router = useRouter();
  const [val, setVal] = useState(item.selesai);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const next = !val;
      setVal(next);
      const r = await saveMaster("checklist_proyek", item.id, {
        proyek_id: proyekId,
        nama: item.nama,
        selesai: next,
        catatan: item.catatan ?? "",
        urutan: String(item.urutan),
      });
      if (r.error) {
        setVal(!next);
        alert(r.error);
      }
      router.refresh();
    });
  return (
    <button
      disabled={!admin || pending}
      onClick={toggle}
      aria-label={val ? "Tandai belum" : "Tandai selesai"}
      className={`grid size-6 shrink-0 place-items-center rounded-md border-2 text-sm font-bold ${val ? "border-green-600 bg-green-600 text-white" : "border-stone-300 bg-white"} ${admin ? "" : "cursor-default"}`}
    >
      {val ? "✓" : ""}
    </button>
  );
}

const JENIS_DOK = ["MoU / Perjanjian", "RAB", "Desain", "Izin", "Invoice / Kuitansi", "Lainnya"];
const ukuran = (n: number | null) => (!n ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export function DokumenPanel({ proyekId, admin, items }: { proyekId: string; admin: boolean; items: Dokumen[] }) {
  const router = useRouter();
  const [jenis, setJenis] = useState("Lainnya");
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const upload = (files: FileList | null) =>
    files?.length &&
    start(async () => {
      setMsg(null);
      const sb = supabaseBrowser();
      let ok = 0;
      for (const f of [...files]) {
        if (f.size > 10 * 1024 * 1024) {
          setMsg({ error: `${f.name} lebih dari 10 MB.` });
          continue;
        }
        const ext = (f.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${proyekId}/dokumen/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from("proyek").upload(path, f, { contentType: f.type });
        if (up.error) {
          setMsg({ error: `Gagal mengunggah ${f.name}: ${up.error.message}` });
          continue;
        }
        const r = await catatDokumen(proyekId, { judul: f.name.replace(/\.[^.]+$/, ""), jenis, path, tipe: f.type, ukuran: f.size });
        if (r.error) setMsg(r);
        else ok++;
      }
      if (ok) {
        setMsg((m) => m ?? { ok: `${ok} dokumen diunggah.` });
        router.refresh();
      }
    });

  return (
    <section className="rounded-2xl border border-matur-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-bold">Dokumen Proyek</h2>
        {admin && (
          <>
            <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm">
              {JENIS_DOK.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>
            <label className="cursor-pointer rounded-lg bg-matur-500 px-3 py-1.5 text-sm font-semibold text-white">
              {pending ? "Mengunggah…" : "+ Unggah"}
              <input type="file" multiple accept="application/pdf,image/*" className="hidden" disabled={pending} onChange={(e) => (upload(e.target.files), (e.target.value = ""))} />
            </label>
          </>
        )}
      </div>
      <p className="mb-2 text-xs text-stone-500">PDF atau gambar, maks. 10 MB per file.</p>
      <Msg r={msg} />
      {items.length === 0 ? (
        <p className="py-4 text-sm text-stone-400">Belum ada dokumen.</p>
      ) : (
        <ul className="divide-y">
          {items.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-matur-50 text-lg">{d.tipe === "application/pdf" ? "📄" : "🖼️"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.judul}</p>
                <p className="text-xs text-stone-500">
                  {d.jenis} · {formatTanggal(d.created_at)} {ukuran(d.ukuran) && `· ${ukuran(d.ukuran)}`}
                </p>
              </div>
              {d.url && (
                <a href={d.url} target="_blank" rel="noreferrer" className="rounded-lg border border-matur-300 px-3 py-1.5 text-sm text-matur-700">
                  Buka
                </a>
              )}
              {admin && (
                <button
                  disabled={pending}
                  onClick={() =>
                    confirm(`Hapus dokumen "${d.judul}"?`) &&
                    start(async () => {
                      setMsg(await hapusDokumen(proyekId, d.id));
                      router.refresh();
                    })
                  }
                  className="rounded-lg px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  title="Hapus"
                >
                  🗑
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Diskusi({ proyekId, userId, admin, items }: { proyekId: string; userId: string; admin: boolean; items: Komentar[] }) {
  const router = useRouter();
  const [isi, setIsi] = useState("");
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const kirim = () =>
    isi.trim() &&
    start(async () => {
      const r = await kirimKomentar(proyekId, isi);
      if (r.error) return setMsg(r);
      setMsg(null);
      setIsi("");
      router.refresh();
    });
  return (
    <section className="rounded-2xl border border-matur-200 bg-white p-4">
      <h2 className="mb-1 font-bold">Diskusi</h2>
      <p className="mb-3 text-xs text-stone-500">Tanya-jawab Admin dan Mitra seputar proyek ini.</p>
      {items.length === 0 && <p className="py-4 text-sm text-stone-400">Belum ada pesan. Mulai diskusi di bawah.</p>}
      <ul className="space-y-3">
        {items.map((k) => {
          const mine = k.pengguna_id === userId;
          return (
            <li key={k.id} className={`flex ${mine ? "justify-end" : ""}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-sm bg-matur-100" : "rounded-bl-sm bg-stone-100"}`}>
                <p className="text-xs font-semibold text-kopi-700">
                  {k.nama}
                  {k.peran && <span className="font-normal text-stone-500"> · {k.peran}</span>}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{k.isi}</p>
                <p className="mt-0.5 flex gap-2 text-[11px] text-stone-400">
                  {formatTanggal(k.created_at, true)}
                  {(mine || admin) && (
                    <button
                      onClick={() =>
                        confirm("Hapus pesan ini?") &&
                        start(async () => {
                          setMsg(await hapusKomentar(proyekId, k.id));
                          router.refresh();
                        })
                      }
                      className="text-red-500"
                    >
                      hapus
                    </button>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <Msg r={msg} />
      <div className="mt-4 flex items-end gap-2">
        <textarea
          ref={ref}
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Tulis pesan…"
          className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-matur-500"
        />
        <button disabled={pending || !isi.trim()} onClick={kirim} className="rounded-xl bg-matur-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "…" : "Kirim"}
        </button>
      </div>
    </section>
  );
}

export type LaporanData = {
  nama: string;
  outlet: string;
  progres: number;
  softOpening: string | null;
  grandOpening: string | null;
  estimasi: number;
  realisasi: number;
  pembayaranProyek: number;
  sisaTagihan: number;
  realisasiLama: number;
  tahapan: { nama: string; progres: number; pic: string }[];
  biaya: { kelompok: string; estimasi: number; realisasi: number }[];
  /** mode split: rekap barang dibeli pusat / mitra */
  pembeli?: { label: string; estimasi: number; realisasi: number }[];
  setoran: Setoran[];
  jadwal: Jadwal[];
  checklist: Checklist[];
};

// Laporan PDF ringkas untuk dikirim ke mitra
export function LaporanPdf({ data, className = "" }: { data: LaporanData; className?: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const tgl = (s: string | null) => (s ? formatTanggal(s) : "belum ditentukan");
      const head = { fillColor: [255, 149, 0] as [number, number, number] };
      let y = 14;
      doc.setFontSize(15).text(`Laporan Proyek · ${data.nama}`, 14, y);
      doc.setFontSize(9).text(`${data.outlet} · dicetak ${formatTanggal(new Date().toISOString(), true)}`, 14, (y += 6));
      const next = () => (y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6);
      const dana = data.setoran.reduce((s, x) => s + x.jumlah, 0);
      autoTable(doc, {
        startY: (y += 4),
        head: [["Ringkasan", ""]],
        body: [
          ["Progres keseluruhan", `${data.progres}%`],
          ["Soft Opening", tgl(data.softOpening)],
          ["Grand Opening", tgl(data.grandOpening)],
          ["Estimasi biaya", formatRupiah(data.estimasi)],
          ["Realisasi biaya", formatRupiah(data.realisasi)],
          ["Dana masuk dari mitra", formatRupiah(dana)],
          ["Pembayaran dari dana proyek", formatRupiah(data.pembayaranProyek)],
          ["Saldo dana tercatat", formatRupiah(dana - data.pembayaranProyek)],
          ["Sisa tagihan nota", formatRupiah(data.sisaTagihan)],
          ...(data.realisasiLama ? [["Realisasi lama (pembayaran belum dirinci)", formatRupiah(data.realisasiLama)], ["Catatan saldo", "Belum termasuk pembayaran realisasi lama"]] : []),
        ],
        headStyles: head,
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: "right" } },
      });
      next();
      if (data.tahapan.length) {
        autoTable(doc, { startY: y, head: [["Tahapan", "PIC", "Progres"]], body: data.tahapan.map((t) => [t.nama, t.pic, `${t.progres}%`]), headStyles: head, styles: { fontSize: 9 } });
        next();
      }
      if (data.jadwal.length) {
        autoTable(doc, {
          startY: y,
          head: [["Jadwal / Kegiatan", "Rencana", "Realisasi", "Status"]],
          body: data.jadwal.map((j) => [j.judul, tgl(j.tgl_rencana), j.tgl_realisasi ? formatTanggal(j.tgl_realisasi) : "-", j.status]),
          headStyles: head,
          styles: { fontSize: 9 },
        });
        next();
      }
      if (data.biaya.length) {
        autoTable(doc, {
          startY: y,
          head: [["Biaya per kelompok", "Estimasi", "Realisasi"]],
          body: data.biaya.map((b) => [b.kelompok, formatRupiah(b.estimasi), formatRupiah(b.realisasi)]),
          headStyles: head,
          styles: { fontSize: 9 },
          columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
        });
        next();
        if (data.pembeli?.length) {
          autoTable(doc, {
            startY: y,
            head: [["Pembelian barang", "Estimasi", "Realisasi"]],
            body: data.pembeli.map((b) => [b.label, formatRupiah(b.estimasi), formatRupiah(b.realisasi)]),
            headStyles: head,
            styles: { fontSize: 9 },
            columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
          });
          next();
        }
      }
      if (data.setoran.length) {
        autoTable(doc, {
          startY: y,
          head: [["Setoran dana mitra", "Keterangan", "Jumlah"]],
          body: [...data.setoran.map((s) => [formatTanggal(s.tanggal), s.keterangan ?? "", formatRupiah(s.jumlah)]), ["Total", "", formatRupiah(dana)]],
          headStyles: head,
          styles: { fontSize: 9 },
          columnStyles: { 2: { halign: "right" } },
        });
        next();
      }
      if (data.checklist.length) {
        autoTable(doc, {
          startY: y,
          head: [["Checklist persiapan buka", "Status"]],
          body: data.checklist.map((c) => [c.nama, c.selesai ? "Selesai" : "Belum"]),
          headStyles: head,
          styles: { fontSize: 9 },
        });
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(doc.output("blob"));
      a.download = `Laporan ${data.nama}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button disabled={busy} onClick={run} className={className}>
      {busy ? "Menyiapkan…" : "⬇ Laporan PDF"}
    </button>
  );
}
