"use client";
import { useState, useTransition } from "react";
import { riwayatAlurShift, laporanAlurOutlet } from "@/lib/pos-alur-actions";
import { teksLaporanShift } from "@/lib/pos-alur";
import { formatRupiah as rp } from "@/lib/format";
type Riwayat = NonNullable<
  Awaited<ReturnType<typeof riwayatAlurShift>>["data"]
>;
export function PosRiwayatShift({ outlet }: { outlet: string }) {
  const [data, setData] = useState<Riwayat | null>(null),
    [text, setText] = useState(""),
    [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border bg-white p-4">
      <button
        type="button"
        disabled={busy}
        className="font-semibold underline"
        onClick={() =>
          start(async () => {
            try {
              const r = await riwayatAlurShift(outlet);
              if (r.error) setError(r.error);
              else setData(r.data ?? []);
            } catch {
              setError("Periksa koneksi lalu coba lagi.");
            }
          })
        }
      >
        {busy ? "Memuat…" : "Lihat riwayat & laporan shift"}
      </button>
      {data && (
        <div className="mt-3 space-y-2">
          {!data.length && (
            <p className="text-sm">Belum ada riwayat alur shift baru.</p>
          )}
          {data.map((s) => (
            <article key={s.id} className="rounded-xl border p-3 text-sm">
              <b>
                {s.tanggal_shift} · {s.ditutup_at ? "Ditutup" : "Berjalan"}
              </b>
              <p>
                Fisik{" "}
                {s.fisik_akhir == null ? "Belum dihitung" : rp(s.fisik_akhir)} ·
                Selisih {s.selisih == null ? "Belum dihitung" : rp(s.selisih)}
              </p>
              <button
                type="button"
                disabled={busy}
                className="mt-1 underline"
                onClick={() =>
                  start(async () => {
                    try {
                      const r = await laporanAlurOutlet(outlet, s.id);
                      if (r.error) setError(r.error);
                      else if (r.data) setText(teksLaporanShift(r.data));
                    } catch {
                      setError("Laporan belum termuat. Coba lagi.");
                    }
                  })
                }
              >
                Buka laporan
              </button>
            </article>
          ))}
        </div>
      )}
      {text && (
        <>
          <textarea
            readOnly
            aria-label="Laporan shift tersimpan"
            value={text}
            className="mt-3 min-h-80 w-full rounded-xl border p-3 text-xs"
          />
          <button
            type="button"
            className="mt-2 rounded-xl border px-3 py-2 text-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setError("Laporan disalin.");
              } catch {
                setError("Silakan salin teks dari kolom laporan.");
              }
            }}
          >
            Salin laporan
          </button>
        </>
      )}
      {error && (
        <p role="status" className="mt-2 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
