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
    {admin && <div className="mb-4 rounded-xl bg-matur-50 p-3 text-sm">
      <div className="mb-3">{!berubah && !pending && !drag ? <RowEditor entityKey="jadwal_proyek" row={null} initial={{ proyek_id: proyekId, status: "rencana", urutan: String(jadwal.length + 1) }} fields={fields} label="+ Kegiatan" className="rounded-lg border border-matur-300 bg-white px-3 py-2 font-semibold" /> : <p className="text-xs text-stone-500">Simpan atau batalkan urutan sebelum menambah/mengedit kegiatan.</p>}</div>
      <p>Urutan mengikuti nomor. Geser pegangan ⋮⋮ atau gunakan ↑ ↓, lalu simpan.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={!berubah || pending || !!drag} onClick={() => start(async () => {
          setPesan("");
          try {
            const r = await simpanUrutanTimeline(proyekId, ids, Object.fromEntries(jadwal.map((j) => [j.id, j.urutan])));
            if (r.error) { setPesan(r.error); return; }
            setPesan("Urutan berhasil disimpan.");
            router.refresh();
          } catch { setPesan("Urutan belum tersimpan. Coba lagi."); }
        })} className="rounded-lg bg-kopi-900 px-3 py-2 font-semibold text-white disabled:opacity-40">{pending ? "Menyimpan…" : "Simpan urutan"}</button>
        <button type="button" disabled={!berubah || pending || !!drag} onClick={() => { setDraft(null); setPesan(""); }} className="rounded-lg border border-matur-300 px-3 py-2 disabled:opacity-40">Batal</button>
        {pesan && <button type="button" disabled={pending} onClick={() => router.refresh()} className="rounded-lg border px-3 py-2">Muat ulang jadwal</button>}
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-xs">{pesan || (drag ? `Lepaskan untuk memindahkan ke nomor ${drag.tujuan + 1}. Tekan Esc untuk membatalkan geser.` : berubah ? "Perubahan urutan belum disimpan." : "")}</p>
    </div>}
    <ol ref={list} aria-label="Urutan kegiatan pembangunan" className="space-y-3">
      {ids.map((id, index) => {
        const j = byId.get(id)!;
        // Penanda tujuan berada di antara baris, tanpa menggeser baris selama pointer bergerak.
        const lainnya = ids.filter((x) => x !== drag?.id);
        const sebelum = drag && id !== drag.id && lainnya.indexOf(id) === drag.tujuan;
        return <li key={id} data-kegiatan={id} className="relative">
          {sebelum && <div aria-hidden="true" className="absolute -top-2 left-0 right-0 h-1 rounded bg-matur-500" />}
          <div className={`flex gap-3 rounded-xl border p-3 ${drag?.id === id ? "border-matur-500 bg-matur-50 ring-2 ring-matur-200" : "border-stone-200 bg-white"}`}>
            <span aria-label={`Nomor ${index + 1}`} className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${j.status === "selesai" ? "bg-green-100 text-green-800" : j.status === "mundur" ? "bg-red-100 text-red-800" : "bg-matur-100 text-kopi-900"}`}>{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words font-semibold">{j.judul}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs ${j.status === "selesai" ? "bg-green-50 text-green-700" : j.status === "mundur" ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"}`}>{j.status === "selesai" ? "✓ Selesai" : j.status === "mundur" ? "Mundur" : "Rencana"}</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">{j.tgl_rencana ? <>Rencana: <span className={j.status === "mundur" ? "line-through" : ""}>{formatTanggal(j.tgl_rencana)}</span></> : "Belum dijadwalkan"}</p>
              {j.tgl_realisasi && <p className={`mt-1 text-xs ${j.status === "mundur" ? "text-red-600" : "text-stone-500"}`}>{j.status === "mundur" ? "Jadwal baru" : "Realisasi"}: {formatTanggal(j.tgl_realisasi)}</p>}
              {j.keterangan && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-stone-600">{j.keterangan}</p>}
              {admin && <div className="mt-3 flex flex-wrap items-center gap-1">
                <button type="button" disabled={pending || !!drag} onPointerDown={(e) => mulai(id, e)} aria-label={`Geser ${j.judul}`} title="Tahan pegangan lalu geser" className="touch-none select-none rounded-lg border px-3 py-2 text-stone-600 cursor-grab disabled:opacity-40">⋮⋮</button>
                <button type="button" disabled={pending || !!drag || index === 0} onClick={() => pindah(id, index - 1)} aria-label={`Naikkan ${j.judul}`} className="rounded-lg border px-3 py-2 disabled:opacity-30">↑</button>
                <button type="button" disabled={pending || !!drag || index === ids.length - 1} onClick={() => pindah(id, index + 1)} aria-label={`Turunkan ${j.judul}`} className="rounded-lg border px-3 py-2 disabled:opacity-30">↓</button>
                {!berubah && !pending && !drag && <>
                  <RowEditor entityKey="jadwal_proyek" row={j as unknown as Record<string, unknown>} fields={fields} label="✏️" title={`Ubah · ${j.judul}`} />
                  <RowDeleter entityKey="jadwal_proyek" id={j.id} name={`Jadwal ${j.judul}`} />
                </>}
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
