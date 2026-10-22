"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RowDeleter, RowEditor } from "@/components/row-editor";
import { formatTanggal } from "@/lib/format";
import type { Jadwal } from "@/lib/proyek";
import { simpanUrutanTimeline } from "@/lib/timeline-actions";
import { pindahKegiatan, tujuanGeser } from "@/lib/urutan-timeline";

const fields = ["judul", "tgl_rencana", "tgl_realisasi", "status", "keterangan", "urutan"];

export function TimelineKegiatan({ proyekId, jadwal, admin }: { proyekId: string; jadwal: Jadwal[]; admin: boolean }) {
  const router = useRouter();
  const [atur, setAtur] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<{ id: string; tujuan: number } | null>(null);
  const [pesan, setPesan] = useState("");
  const [pending, start] = useTransition();
  const list = useRef<HTMLOListElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const awal = jadwal.map((j) => j.id);
  const ids = draft ?? awal;
  const berubah = ids.join() !== awal.join();
  const byId = new Map(jadwal.map((j) => [j.id, j]));
  useEffect(() => () => cleanup.current?.(), []);

  function pindah(id: string, tujuan: number) {
    setDraft(pindahKegiatan(ids, id, tujuan));
    setPesan("");
  }

  function mulai(id: string, e: React.PointerEvent<HTMLButtonElement>) {
    if (pending || drag || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const pointer = e.pointerId;
    const button = e.currentTarget;
    button.setPointerCapture(pointer);
    const posisi = ids.indexOf(id);
    let tujuan = posisi;
    setDrag({ id, tujuan });
    const hitung = (ev: PointerEvent) => {
      const baris = [...(list.current?.querySelectorAll<HTMLElement>("[data-kegiatan]") ?? [])].map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.dataset.kegiatan!, tengah: r.top + r.height / 2 };
      });
      tujuan = tujuanGeser(ev.clientY, baris, id);
      setDrag({ id, tujuan });
    };
    const gerak = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      if (Math.abs(ev.clientY - e.clientY) < 6 && tujuan === posisi) return;
      hitung(ev);
    };
    const bersih = () => {
      window.removeEventListener("pointermove", gerak);
      window.removeEventListener("pointerup", selesai);
      window.removeEventListener("pointercancel", batal);
      window.removeEventListener("keydown", keyboard);
      button.removeEventListener("lostpointercapture", batal);
      cleanup.current = null;
      if (button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
    };
    const tutup = (simpan: boolean) => {
      bersih();
      setDrag(null);
      if (simpan) pindah(id, tujuan);
    };
    const selesai = (ev: PointerEvent) => { if (ev.pointerId === pointer) tutup(true); };
    const batal = (ev: PointerEvent) => { if (ev.pointerId === pointer) tutup(false); };
    const keyboard = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.preventDefault(); tutup(false); } };
    cleanup.current = bersih;
    window.addEventListener("pointermove", gerak);
    window.addEventListener("pointerup", selesai);
    window.addEventListener("pointercancel", batal);
    window.addEventListener("keydown", keyboard);
    button.addEventListener("lostpointercapture", batal);
  }

  return <>
    {admin && <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-stone-100 pb-3 text-xs">
      {!berubah && !pending && !drag && !atur && <RowEditor entityKey="jadwal_proyek" row={null} initial={{ proyek_id: proyekId, status: "rencana", urutan: String(jadwal.length + 1) }} fields={fields} label="+ Kegiatan" className="rounded-lg bg-kopi-900 px-3 py-2 font-semibold text-white" />}
      {!atur && jadwal.length > 1 && <button type="button" onClick={() => setAtur(true)} className="rounded-lg border border-matur-200 px-3 py-2 font-semibold text-kopi-700">Atur urutan</button>}
      {atur && <>
      <span className="mr-auto text-stone-500">Geser ⋮⋮ atau gunakan ↑ ↓</span>
        <button type="button" disabled={!berubah || pending || !!drag} onClick={() => start(async () => {
          setPesan("");
          try {
            const r = await simpanUrutanTimeline(proyekId, ids, Object.fromEntries(jadwal.map((j) => [j.id, j.urutan])));
            if (r.error) { setPesan(r.error); return; }
            setPesan("Urutan berhasil disimpan.");
            router.refresh();
          } catch { setPesan("Urutan belum tersimpan. Coba lagi."); }
        })} className="rounded-lg bg-kopi-900 px-3 py-2 font-semibold text-white disabled:opacity-40">{pending ? "Menyimpan…" : "Simpan urutan"}</button>
        <button type="button" disabled={pending || !!drag} onClick={() => { setDraft(null); setPesan(""); setAtur(false); }} className="rounded-lg border border-matur-300 px-3 py-2 disabled:opacity-40">Batal</button>
        {pesan && <button type="button" disabled={pending} onClick={() => router.refresh()} className="rounded-lg border px-3 py-2">Muat ulang jadwal</button>}
      </>}
      {(pesan || drag || berubah) && <p role="status" aria-live="polite" className="w-full text-xs text-stone-500">{pesan || (drag ? `Lepaskan untuk memindahkan ke nomor ${drag.tujuan + 1}. Tekan Esc untuk membatalkan geser.` : "Perubahan urutan belum disimpan.")}</p>}
    </div>}
    <ol ref={list} aria-label="Urutan kegiatan pembangunan" className="relative">
      {ids.map((id, index) => {
        const j = byId.get(id)!;
        // Penanda tujuan berada di antara baris, tanpa menggeser baris selama pointer bergerak.
        const lainnya = ids.filter((x) => x !== drag?.id);
        const sebelum = drag && id !== drag.id && lainnya.indexOf(id) === drag.tujuan;
        return <li key={id} data-kegiatan={id} className="relative pb-5 pl-10 last:pb-0">
          {sebelum && <div aria-hidden="true" className="absolute -top-2 left-0 right-0 h-1 rounded bg-matur-500" />}
          {index < ids.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-7 w-px bg-matur-200" />}
          <div className={`min-w-0 rounded-lg ${drag?.id === id ? "bg-matur-50 ring-2 ring-matur-300" : ""}`}>
            <span aria-label={`Nomor ${index + 1}`} className={`absolute left-0 top-0 flex size-7 items-center justify-center rounded-full text-xs font-bold ${j.status === "selesai" ? "bg-green-100 text-green-800" : j.status === "mundur" ? "bg-red-100 text-red-800" : "bg-matur-100 text-kopi-900"}`}>{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><p className="break-words font-semibold">{j.judul}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs ${j.status === "selesai" ? "bg-green-50 text-green-700" : j.status === "mundur" ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"}`}>{j.status === "selesai" ? "✓ Selesai" : j.status === "mundur" ? "Mundur" : "Rencana"}</span></div>
                {admin && !atur && !berubah && !pending && !drag && <div className="flex shrink-0 items-center">
                  <RowEditor entityKey="jadwal_proyek" row={j as unknown as Record<string, unknown>} fields={fields} label="✏️" title={`Ubah · ${j.judul}`} />
                  <RowDeleter entityKey="jadwal_proyek" id={j.id} name={`Jadwal ${j.judul}`} />
                </div>}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-kopi-900">
                <div className="min-w-0 rounded-xl border border-amber-200/70 bg-amber-50 px-2.5 py-2.5 sm:px-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/70">Rencana</dt>
                  <dd className={`mt-1 font-semibold leading-5 tabular-nums ${j.status === "mundur" && j.tgl_rencana ? "line-through decoration-amber-700/50" : ""}`}>
                    {j.tgl_rencana ? formatTanggal(j.tgl_rencana) : "Belum diisi"}
                  </dd>
                </div>
                <div className="min-w-0 rounded-xl border border-green-200 bg-green-50 text-green-900 px-2.5 py-2.5 sm:px-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-green-800">{j.status === "mundur" ? "Jadwal baru" : "Realisasi"}</dt>
                  <dd className="mt-1 font-semibold leading-5 tabular-nums">
                    {j.tgl_realisasi ? formatTanggal(j.tgl_realisasi) : "Belum diisi"}
                  </dd>
                </div>
              </dl>
              {j.keterangan && <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-stone-600">{j.keterangan}</p>}
              {admin && atur && <div className="mt-2 flex flex-wrap items-center gap-1">
                <button type="button" disabled={pending || !!drag} onPointerDown={(e) => mulai(id, e)} aria-label={`Geser ${j.judul}`} title="Tahan pegangan lalu geser" className="touch-none select-none rounded-md border px-2.5 py-1.5 text-stone-600 cursor-grab disabled:opacity-40">⋮⋮</button>
                <button type="button" disabled={pending || !!drag || index === 0} onClick={() => pindah(id, index - 1)} aria-label={`Naikkan ${j.judul}`} className="rounded-md border px-2.5 py-1.5 disabled:opacity-30">↑</button>
                <button type="button" disabled={pending || !!drag || index === ids.length - 1} onClick={() => pindah(id, index + 1)} aria-label={`Turunkan ${j.judul}`} className="rounded-md border px-2.5 py-1.5 disabled:opacity-30">↓</button>

              </div>}
            </div>
          </div>
        </li>;
      })}
      {drag && drag.tujuan === ids.length - 1 && <li aria-hidden="true" className="h-1 rounded bg-matur-500" />}
    </ol>
    {!jadwal.length && <p className="py-4 text-sm text-stone-500">Belum ada kegiatan.</p>}
  </>;
}
