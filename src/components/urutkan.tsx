"use client";

// Daftar yang bisa diurutkan dengan menggeser pegangan ⋮⋮ (mouse & layar sentuh). Khusus admin.
// Server tetap merender tiap <li key={id}>; komponen ini hanya mengatur ulang urutannya.
import { useRouter } from "next/navigation";
import { Children, createContext, isValidElement, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { urutkanBaris } from "@/lib/master-actions";

type Ctx = { grup: string; aktif: string | null; mulai: (id: string, e: React.PointerEvent) => void };
const UrutCtx = createContext<Ctx | null>(null);

const idDari = (key: React.Key | null) => String(key ?? "").replace(/^\.\$/, "");

export function Urutkan({ entityKey, grup, children, after }: { entityKey: string; grup: string; children: ReactNode; after?: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const items = Children.toArray(children).filter(isValidElement);
  const awal = items.map((c) => idDari(c.key));
  const [urutan, setUrutanRaw] = useState<{ ids: string[]; dasar: string } | null>(null);
  const [aktif, setAktif] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const kerja = useRef<string[]>([]);

  // urutan lokal hanya dipakai selama/sesudah geser sampai data server baru datang
  // (dibuang otomatis begitu urutan dari server berubah)
  const tampil = urutan && urutan.dasar === awal.join() ? urutan.ids : awal;
  const setUrutan = (ids: string[]) => setUrutanRaw({ ids, dasar: awal.join() });
  const byId = new Map(items.map((c) => [idDari(c.key), c]));

  const mulai = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    kerja.current = [...tampil];
    const li = (e.currentTarget as HTMLElement).closest("li");
    li?.classList.add("bg-matur-50", "ring-2", "ring-matur-300", "rounded-xl");
    setAktif(id);
    setUrutan(kerja.current);
    const gerak = (ev: PointerEvent) => {
      const baris = [...document.querySelectorAll<HTMLElement>(`[data-urut="${grup}"]`)].map((h) => ({ id: h.dataset.id!, r: (h.closest("li") ?? h).getBoundingClientRect() }));
      const sekarang = kerja.current.indexOf(id);
      let target = sekarang;
      baris.forEach((b) => {
        const i = kerja.current.indexOf(b.id);
        const tengah = b.r.top + b.r.height / 2;
        if (i < sekarang && ev.clientY < tengah) target = Math.min(target, i);
        if (i > sekarang && ev.clientY > tengah) target = Math.max(target, i);
      });
      if (target !== sekarang) {
        const n = [...kerja.current];
        n.splice(target, 0, ...n.splice(sekarang, 1));
        kerja.current = n;
        setUrutan(n);
      }
    };
    const lepas = () => {
      window.removeEventListener("pointermove", gerak);
      window.removeEventListener("pointerup", lepas);
      window.removeEventListener("pointercancel", lepas);
      li?.classList.remove("bg-matur-50", "ring-2", "ring-matur-300", "rounded-xl");
      setAktif(null);
      if (kerja.current.join() === awal.join()) return;
      const ids = kerja.current;
      start(async () => {
        const r = await urutkanBaris(entityKey, ids);
        setErr(r.error ?? "");
        router.refresh();
      });
    };
    window.addEventListener("pointermove", gerak);
    window.addEventListener("pointerup", lepas);
    window.addEventListener("pointercancel", lepas);
  };

  return (
    <UrutCtx.Provider value={{ grup, aktif, mulai }}>
      {tampil.map((id) => byId.get(id))}
      {after}
      {(pending || err) && <li className={`list-none text-xs ${err ? "text-red-600" : "text-stone-400"}`}>{err || "Menyimpan urutan…"}</li>}
    </UrutCtx.Provider>
  );
}

/** Pegangan ⋮⋮ di pojok baris; tekan lalu geser ke atas/bawah. */
export function Pegangan({ id }: { id: string }) {
  const c = useContext(UrutCtx);
  if (!c) return null;
  return (
    <button
      type="button"
      data-urut={c.grup}
      data-id={id}
      onPointerDown={(e) => c.mulai(id, e)}
      title="Tahan lalu geser untuk mengubah urutan"
      aria-label="Geser untuk mengubah urutan"
      className={`cursor-grab touch-none select-none rounded-lg px-1.5 py-1 text-lg leading-none text-stone-400 hover:bg-matur-50 hover:text-kopi-700 active:cursor-grabbing ${c.aktif === id ? "bg-matur-100 text-kopi-900" : ""}`}
    >
      ⋮⋮
    </button>
  );
}
