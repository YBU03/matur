"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { formatTanggal } from "@/lib/format";
import type { Foto } from "@/lib/proyek";
import { laporProgres, periksaFoto, type Result } from "@/lib/proyek-actions";

/** Perkecil foto dari HP (sering >5 MB) menjadi JPEG maks. 1600 px sebelum diunggah. */
async function compress(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Gagal memproses foto"))), "image/jpeg", 0.8));
}

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
