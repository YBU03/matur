"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selesaikanProyek } from "@/lib/proyek-actions";

/** Tombol admin: tandai pembangunan selesai (dengan tanggal) atau buka kembali. */
export function SelesaiProyek({
  id,
  selesai,
}: {
  id: string;
  selesai: boolean;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [tgl, setTgl] = useState(() =>
    new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
  );
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const jalan = (s: boolean) =>
    start(async () => {
      const r = await selesaikanProyek(id, s, s ? tgl : null);
      setMsg(r.error ?? "");
      if (!r.error) {
        setBuka(false);
        router.refresh();
      }
    });
  const btn = "rounded-lg px-3 py-1.5 text-sm font-semibold";
  if (selesai)
    return (
      <button
        disabled={busy}
        onClick={() =>
          confirm(
            "Buka kembali proyek ini? Status kembali menjadi sedang berjalan.",
          ) && jalan(false)
        }
        className={`${btn} bg-white/20 text-white hover:bg-white/30`}
      >
        ↩️ Buka kembali proyek
      </button>
    );
  return (
    <>
      <button
        onClick={() => setBuka(true)}
        className={`${btn} bg-green-600 text-white hover:bg-green-700`}
      >
        ✅ Tandai proyek selesai
      </button>
      {buka && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setBuka(false)}
        >
          <div
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 text-kopi-900 shadow-xl"
          >
            <h2 className="text-lg font-bold">🎉 Pembangunan selesai?</h2>
            <p className="text-sm text-stone-600">
              Proyek ditandai selesai, outlet berubah menjadi <b>operasional</b>
              , dan dashboard mitra menampilkan pembangunan telah selesai.
            </p>
            <label className="block text-sm font-semibold">
              Tanggal selesai / mulai beroperasi
              <input
                type="date"
                value={tgl}
                onChange={(e) => setTgl(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            {msg && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {msg}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBuka(false)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Batal
              </button>
              <button
                disabled={busy || !tgl}
                onClick={() => jalan(true)}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Menyimpan…" : "Ya, selesai"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
