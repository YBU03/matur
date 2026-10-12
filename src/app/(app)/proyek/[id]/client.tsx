"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { formatTanggal } from "@/lib/format";
import type { Desain, Foto } from "@/lib/proyek";
import { exportExcel, exportPdf, type RabRow } from "@/lib/rab-excel";
import { compressImage as compress } from "@/lib/compress-image";
import { hapusDesain, laporProgres, periksaFoto, unggahDesain, type Result } from "@/lib/proyek-actions";

export function ReportButton({ proyekId, pekerjaan }: { proyekId: string; pekerjaan: { id: string; nama: string; progres: number } }) {
  const [open, setOpen] = useState(false);
  const [progres, setProgres] = useState(pekerjaan.progres);
  const [ket, setKet] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      if (!file) return setRes({ error: "Pilih foto terlebih dahulu." });
      try {
        const fd = new FormData();
        fd.set("proyek_id", proyekId);
        fd.set("pekerjaan_id", pekerjaan.id);
        fd.set("progres", String(progres));
        fd.set("keterangan", ket);
        fd.set("foto", new File([await compress(file)], "foto.jpg", { type: "image/jpeg" }));
        const r = await laporProgres(fd);
        setRes(r);
        if (!r.error) {
          setFile(null);
          setKet("");
          setTimeout(() => setOpen(false), 1200);
        }
      } catch (e) {
        setRes({ error: e instanceof Error ? e.message : "Gagal mengirim" });
      }
    });

  return (
    <>
      <button onClick={() => (setRes(null), setOpen(true))} className="rounded-lg bg-matur-500 px-3 py-1.5 text-sm font-semibold text-white">
        Lapor progres
      </button>
      {open && (
        <Modal title={`Lapor progres · ${pekerjaan.nama}`}>
          <label className="block text-sm font-medium">
            Progres: <b>{progres}%</b>
            <input type="range" min={0} max={100} step={5} value={progres} onChange={(e) => setProgres(Number(e.target.value))} className="mt-2 w-full accent-matur-500" />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Foto progres
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Keterangan
            <textarea value={ket} onChange={(e) => setKet(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          {res && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${res.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{res.error ?? res.ok}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Tutup</button>
            <button disabled={pending} onClick={submit} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? "Mengirim…" : "Kirim"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// PRY-04: admin menyetujui sebelum foto & progres tampil ke mitra
export function Approvals({ proyekId, admin, items }: { proyekId: string; admin: boolean; items: (Foto & { pekerjaan: string })[] }) {
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <h2 className="mb-3 font-bold">{admin ? "Menunggu persetujuan" : "Laporan saya (menunggu persetujuan Admin)"}</h2>
      {msg && <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{msg.error ?? msg.ok}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <div key={f.id} className="overflow-hidden rounded-xl border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase */}
            {f.url && <img src={f.url} alt="" className="aspect-video w-full object-cover" />}
            <div className="space-y-1 p-3 text-sm">
              <p className="font-semibold">
                {f.pekerjaan} → {f.progres_diajukan}%
              </p>
              {f.keterangan && <p className="text-stone-600">{f.keterangan}</p>}
              <p className="text-xs text-stone-400">
                {f.pengunggah?.nama ?? "PIC"} · {formatTanggal(f.created_at, true)}
              </p>
              {admin && (
                <div className="flex gap-2 pt-1">
                  <button disabled={pending} onClick={() => start(async () => setMsg(await periksaFoto(proyekId, f.id, true)))} className="flex-1 rounded-lg bg-green-600 py-1.5 font-semibold text-white">
                    Setujui
                  </button>
                  <button disabled={pending} onClick={() => start(async () => setMsg(await periksaFoto(proyekId, f.id, false)))} className="flex-1 rounded-lg border border-red-300 py-1.5 text-red-600">
                    Tolak
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Unduh rincian keperluan langsung dari halaman proyek
export function RabDownload({ judul, sub, items }: { judul: string; sub: string; items: RabRow[] }) {
  const [busy, setBusy] = useState("");
  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try {
      await fn();
    } finally {
      setBusy("");
    }
  };
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <button disabled={!!busy} onClick={() => run("x", () => exportExcel(judul, items))} className="rounded-lg border border-green-600 px-3 py-1.5 text-sm font-semibold text-green-700 disabled:opacity-50">
        {busy === "x" ? "Menyiapkan…" : "⬇ Excel"}
      </button>
      <button disabled={!!busy} onClick={() => run("p", () => exportPdf(judul, sub, items))} className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
        {busy === "p" ? "Menyiapkan…" : "⬇ PDF"}
      </button>
    </div>
  );
}

// Galeri desain cafe: admin unggah (bisa beberapa sekaligus), semua yang boleh melihat proyek bisa memperbesar
export function DesainGallery({ proyekId, admin, items }: { proyekId: string; admin: boolean; items: Desain[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Desain | null>(null);
  const [msg, setMsg] = useState<Result | null>(null);
  const [progress, setProgress] = useState("");
  const [pending, start] = useTransition();

  const upload = (files: FileList | null) =>
    files?.length &&
    start(async () => {
      setMsg(null);
      let ok = 0;
      for (const [i, f] of [...files].entries()) {
        setProgress(`Mengunggah ${i + 1}/${files.length}…`);
        try {
          const fd = new FormData();
          fd.set("proyek_id", proyekId);
          fd.set("judul", f.name.replace(/\.[^.]+$/, ""));
          fd.set("foto", new File([await compress(f, 2000, 0.85)], "desain.jpg", { type: "image/jpeg" }));
          const r = await unggahDesain(fd);
          if (r.error) {
            setMsg(r);
            break;
          }
          ok++;
        } catch {
          setMsg({ error: `Gagal memproses ${f.name}` });
          break;
        }
      }
      setProgress("");
      if (ok) {
        setMsg((m) => m ?? { ok: `${ok} gambar desain diunggah.` });
        router.refresh();
      }
    });

  return (
    <section className="rounded-2xl border border-matur-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Rencana Desain Cafe</h2>
        {admin && (
          <label className="cursor-pointer rounded-lg bg-matur-500 px-3 py-1.5 text-sm font-semibold text-white">
            {pending ? progress || "Mengunggah…" : "+ Unggah desain"}
            <input type="file" accept="image/*" multiple className="hidden" disabled={pending} onChange={(e) => (upload(e.target.files), (e.target.value = ""))} />
          </label>
        )}
      </div>
      {msg && <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-stone-400">{admin ? "Belum ada desain. Unggah gambar desain/denah/tampilan cafe." : "Desain akan segera dibagikan."}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((d) => (
            <button key={d.id} onClick={() => setOpen(d)} className="overflow-hidden rounded-xl border bg-stone-50 text-left">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase */}
              {d.url && <img src={d.url} alt={d.judul ?? "Desain"} className="aspect-[4/3] w-full object-cover" />}
              {d.judul && <p className="truncate px-2 py-1.5 text-xs font-medium">{d.judul}</p>}
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3" onClick={() => setOpen(null)}>
          <div className="mb-2 flex items-center gap-2 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="mr-auto truncate text-sm">{open.judul}</p>
            {open.url && (
              <a href={open.url} target="_blank" rel="noreferrer" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm">Buka penuh</a>
            )}
            {admin && (
              <button
                onClick={() =>
                  confirm("Hapus gambar desain ini?") &&
                  start(async () => {
                    const r = await hapusDesain(proyekId, open.id);
                    setMsg(r);
                    setOpen(null);
                    router.refresh();
                  })
                }
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm"
              >
                Hapus
              </button>
            )}
            <button onClick={() => setOpen(null)} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm">✕ Tutup</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase */}
          {open.url && <img src={open.url} alt={open.judul ?? ""} className="m-auto max-h-full max-w-full object-contain" />}
        </div>
      )}
    </section>
  );
}
