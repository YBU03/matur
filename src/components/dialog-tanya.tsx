"use client";

// Pengganti confirm()/prompt()/alert() bawaan browser: jendela konfirmasi seragam yang rapi di HP/tablet.
// Pakai: if (!(await tanya("Hapus data ini?"))) return;  const alasan = await minta("Alasan penolakan");  await kabar("Gagal …");
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Permintaan = {
  id: number;
  jenis: "tanya" | "minta" | "kabar";
  pesan: string;
  judul?: string;
  ya?: string;
  bahaya?: boolean;
  placeholder?: string;
  awal?: string;
  wajib?: boolean;
  selesai: (v: boolean | string | null) => void;
};

let antrean: Permintaan[] = [];
let nomor = 0;
const pendengar = new Set<() => void>();
const kabari = () => pendengar.forEach((f) => f());
function buka<T>(p: Omit<Permintaan, "id" | "selesai">): Promise<T> {
  return new Promise<T>((resolve) => {
    antrean = [...antrean, { ...p, id: ++nomor, selesai: (v) => resolve(v as T) }];
    kabari();
  });
}

const KATA_BAHAYA = /hapus|batalkan|batal|void|lepas|tolak|cabut|keluar|nonaktif|reset|tinggalkan/i;

export type OpsiTanya = { judul?: string; ya?: string; bahaya?: boolean };
/** Konfirmasi ya/tidak → true bila dilanjutkan. */
const KATA_YA: [RegExp, string][] = [[/^hapus/i, "Ya, hapus"], [/^batalkan/i, "Ya, batalkan"], [/^tolak/i, "Ya, tolak"], [/^lepas/i, "Ya, lepas"], [/^tutup/i, "Ya, tutup"], [/^tandai/i, "Ya, tandai"], [/^terbitkan/i, "Ya, terbitkan"], [/^simpan/i, "Ya, simpan"]];
export const tanya = (pesan: string, o: OpsiTanya = {}) =>
  buka<boolean>({ jenis: "tanya", pesan, judul: o.judul, ya: o.ya ?? KATA_YA.find(([r]) => r.test(pesan.trim()))?.[1], bahaya: o.bahaya ?? KATA_BAHAYA.test(pesan) });

export type OpsiMinta = OpsiTanya & { placeholder?: string; awal?: string; wajib?: boolean };
/** Minta isian teks → string (sudah di-trim) atau null bila dibatalkan. */
export const minta = (pesan: string, o: OpsiMinta = {}) =>
  buka<string | null>({ jenis: "minta", pesan, judul: o.judul, ya: o.ya, bahaya: o.bahaya, placeholder: o.placeholder, awal: o.awal, wajib: o.wajib });

/** Pemberitahuan dengan satu tombol OK. */
export const kabar = (pesan: string, judul?: string) => buka<boolean>({ jenis: "kabar", pesan, judul });

const ambil = () => antrean;
const KOSONG: Permintaan[] = [];
const ambilServer = () => KOSONG;
export function DialogTanya() {
  const daftar = useSyncExternalStore(
    (f) => {
      pendengar.add(f);
      return () => pendengar.delete(f);
    },
    ambil,
    ambilServer,
  );
  const p = daftar[0];
  return p ? <Jendela key={p.id} p={p} /> : null;
}

function Jendela({ p }: { p: Permintaan }) {
  const [isi, setIsi] = useState(p.awal ?? "");
  const input = useRef<HTMLTextAreaElement>(null);
  const tombolYa = useRef<HTMLButtonElement>(null);
  const tutup = (v: boolean | string | null) => {
    antrean = antrean.filter((x) => x.id !== p.id);
    kabari();
    p.selesai(v);
  };
  const batal = () => tutup(p.jenis === "minta" ? null : false);
  const lanjut = () => {
    if (p.jenis === "minta") {
      const t = isi.trim();
      if (p.wajib !== false && !t) return input.current?.focus();
      return tutup(t);
    }
    tutup(true);
  };
  useEffect(() => {
    (p.jenis === "minta" ? input.current : tombolYa.current)?.focus();
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") batal();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ikon = p.jenis === "kabar" ? "ℹ️" : p.bahaya ? "⚠️" : p.jenis === "minta" ? "✏️" : "❓";
  const judul = p.judul ?? (p.jenis === "kabar" ? "Informasi" : p.jenis === "minta" ? "Isi keterangan" : p.bahaya ? "Yakin?" : "Konfirmasi");
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && batal()}>
      <div role="alertdialog" aria-modal="true" aria-label={judul} className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl [animation:pos-naik_.2s_ease-out] sm:rounded-3xl">
        <div className="flex items-start gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-xl ${p.bahaya ? "bg-red-50" : "bg-matur-50"}`} aria-hidden>
            {ikon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-kopi-900">{judul}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{p.pesan}</p>
          </div>
        </div>
        {p.jenis === "minta" && (
          <textarea
            ref={input}
            value={isi}
            onChange={(e) => setIsi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                lanjut();
              }
            }}
            rows={2}
            maxLength={500}
            placeholder={p.placeholder ?? "Tulis di sini…"}
            className="mt-4 block w-full rounded-xl border border-matur-200 px-3 py-2.5 text-sm outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100"
          />
        )}
        <div className="mt-5 flex gap-2">
          {p.jenis !== "kabar" && (
            <button type="button" onClick={batal} className="flex-1 rounded-xl border border-stone-200 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50">
              Batal
            </button>
          )}
          <button
            ref={tombolYa}
            type="button"
            onClick={lanjut}
            disabled={p.jenis === "minta" && p.wajib !== false && !isi.trim()}
            className={`flex-1 rounded-xl py-3 text-sm font-bold text-white shadow-sm disabled:opacity-40 ${p.bahaya ? "bg-red-600 hover:bg-red-700" : "bg-matur-500 hover:bg-matur-600"}`}
          >
            {p.ya ?? (p.jenis === "kabar" ? "OK" : p.jenis === "minta" ? "Simpan" : "Ya, lanjutkan")}
          </button>
        </div>
      </div>
    </div>
  );
}
