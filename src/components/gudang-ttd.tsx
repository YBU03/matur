"use client";
import { useState } from "react";
import { TANGGAL_TTD, type KotakTtd } from "@/lib/gudang-ttd";

const cls =
  "mt-0.5 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-kopi-900 outline-none focus:border-matur-500";
const hariIni = () =>
  "Tanggal: " +
  new Date()
    .toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replaceAll("/", "-");

// Panel sebelum unduh PDF: judul, nama, dan tanggal 4 kotak tanda tangan bebas diedit/dikosongkan.
// Hanya untuk cetakan ini; data kiriman dan riwayat tidak berubah.
export function PanelTtd({
  judul,
  awal,
  busy,
  onUnduh,
  onTutup,
}: {
  judul: string;
  awal: KotakTtd[];
  busy?: boolean;
  onUnduh: (ttd: KotakTtd[]) => void;
  onTutup: () => void;
}) {
  const [ttd, setTtd] = useState(awal);
  const ubah = (i: number, v: Partial<KotakTtd>) =>
    setTtd(ttd.map((t, n) => (n === i ? { ...t, ...v } : t)));
  const semua = (v: Partial<KotakTtd>) =>
    setTtd(ttd.map((t) => ({ ...t, ...v })));
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Kotak tanda tangan ${judul}`}
      onClick={onTutup}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onUnduh(ttd);
        }}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-3xl sm:rounded-3xl sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-kopi-900">
              ✍️ Kotak tanda tangan · {judul}
            </h2>
            <p className="text-xs text-stone-500">
              Ubah judul, nama, atau tanggal sesuka Anda, atau kosongkan untuk
              ditulis tangan. Hanya untuk cetakan ini; data kiriman tidak
              berubah.
            </p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="rounded-full px-2 text-xl text-stone-400 hover:text-stone-700"
          >
            ✕
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => semua({ nama: "" })}
            className="rounded-lg border border-stone-200 px-2.5 py-1.5 hover:bg-stone-50"
          >
            Kosongkan semua nama
          </button>
          <button
            type="button"
            onClick={() => semua({ tanggal: hariIni() })}
            className="rounded-lg border border-stone-200 px-2.5 py-1.5 hover:bg-stone-50"
          >
            Tanggal hari ini
          </button>
          <button
            type="button"
            onClick={() => semua({ tanggal: "" })}
            className="rounded-lg border border-stone-200 px-2.5 py-1.5 hover:bg-stone-50"
          >
            Kosongkan tanggal
          </button>
          <button
            type="button"
            onClick={() => semua({ judul: "", nama: "", tanggal: "" })}
            className="rounded-lg border border-red-200 px-2.5 py-1.5 text-red-700 hover:bg-red-50"
          >
            Kosongkan semua
          </button>
          <button
            type="button"
            onClick={() => setTtd(awal)}
            className="rounded-lg border border-stone-200 px-2.5 py-1.5 hover:bg-stone-50"
          >
            ↺ Isian awal
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ttd.map((t, i) => (
            <fieldset
              key={i}
              className="space-y-1.5 rounded-xl border border-matur-100 bg-matur-50/40 p-2.5"
            >
              <legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-matur-700">
                Kotak {i + 1}
              </legend>
              <label className="block text-[11px] text-stone-500">
                Judul
                <input
                  value={t.judul}
                  maxLength={40}
                  onChange={(e) => ubah(i, { judul: e.target.value })}
                  className={`${cls} font-semibold`}
                />
              </label>
              <label className="block text-[11px] text-stone-500">
                Nama
                <input
                  value={t.nama}
                  maxLength={80}
                  onChange={(e) => ubah(i, { nama: e.target.value })}
                  placeholder="(kosong, tulis tangan)"
                  className={cls}
                />
              </label>
              <label className="block text-[11px] text-stone-500">
                Tanggal
                <input
                  value={t.tanggal}
                  maxLength={40}
                  onChange={(e) => ubah(i, { tanggal: e.target.value })}
                  placeholder="(kosong)"
                  className={cls}
                />
              </label>
              {t.tanggal !== TANGGAL_TTD && (
                <button
                  type="button"
                  onClick={() => ubah(i, { tanggal: TANGGAL_TTD })}
                  className="text-[11px] font-semibold text-matur-700 underline"
                >
                  Pakai titik-titik
                </button>
              )}
            </fieldset>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            disabled={busy}
            className="flex-1 rounded-xl bg-kopi-900 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:flex-none sm:px-6"
          >
            {busy ? "Menyiapkan…" : `Pratinjau ${judul}`}
          </button>
          <button
            type="button"
            onClick={onTutup}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}
