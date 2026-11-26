"use client";
import { labelPenyajian, type MenuPromo } from "@/lib/promo-menu";
import { useId, useState } from "react";
export function PilihMenuPromo({
  menus,
  value,
  terpakai,
  onChange,
}: {
  menus: MenuPromo[];
  value: string;
  terpakai: string[];
  onChange: (id: string) => void;
}) {
  const [buka, setBuka] = useState(false),
    [cari, setCari] = useState("");
  const id = useId();
  const pilihan = menus.find((m) => m.id === value);
  const norm = (s: string) => s.toLocaleLowerCase("id-ID").trim();
  const hasil = menus.filter((m) =>
    norm(`${m.nama} ${m.kemasan ?? ""} ${m.penyajian ?? ""} ${m.jenis_kemasan ?? ""}`).includes(norm(cari)),
  );
  return (
    <div className="rounded-lg border border-matur-200 bg-white">
      <button
        type="button"
        aria-expanded={buka}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-semibold"
        onClick={() => {
          setBuka(!buka);
          setCari("");
        }}
      >
        <span>
          {pilihan
            ? `${pilihan.nama}${pilihan.kemasan ? ` · ${pilihan.kemasan}` : ""}`
            : "Cari dan pilih menu / kemasan"}
        </span>
        <span aria-hidden>⌕ ▾</span>
      </button>
      {buka && (
        <div id={id} className="space-y-2 border-t p-2">
          <label className="block text-xs text-stone-600">
            Ketik nama menu atau kemasan
            <input
              autoFocus
              className="mt-1 w-full rounded-lg border p-2 text-sm"
              placeholder="Contoh: kopi susu, matcha, cup…"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </label>
          <p className="text-xs text-stone-500">
            {hasil.length} menu ditemukan
          </p>
          <ul className="max-h-52 overflow-y-auto">
            {hasil.slice(0, 60).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={m.id === value}
                  disabled={m.id !== value && terpakai.includes(m.id)}
                  onClick={() => {
                    onChange(m.id);
                    setBuka(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-matur-50 disabled:opacity-40"
                >
                  <span className="font-semibold">{m.nama}</span>
                  {m.kemasan && (
                    <span className="ml-2 rounded bg-matur-50 px-2 text-xs">
                      {m.kemasan}
                    </span>
                  )}
                  {(m.penyajian || m.jenis_kemasan) && <span className="ml-2 text-xs text-stone-500">{m.penyajian ? labelPenyajian(m.penyajian) : ""}{m.jenis_kemasan ? ` · ${m.jenis_kemasan}` : ""}</span>}
                  {m.id !== value && terpakai.includes(m.id) && (
                    <span className="ml-2 text-xs">Sudah dipilih</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {hasil.length > 60 && (
            <p className="text-xs text-stone-500">
              Ketik lebih spesifik untuk mempersempit hasil.
            </p>
          )}
          {!hasil.length && (
            <p className="p-3 text-sm text-stone-500">Menu tidak ditemukan.</p>
          )}
        </div>
      )}
    </div>
  );
}
