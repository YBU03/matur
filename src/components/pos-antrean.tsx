"use client";
import { useEffect, useState } from "react";
import { laporPerangkatPos } from "@/lib/pos-tim-actions";
import {
  bacaAntrean,
  tandaiPindahBeku,
  hapusTertunda,
  kirimCheckout,
  migrasiAntreanLama,
  simpanTertunda,
  type Tertunda,
} from "@/lib/pos-offline";
let running = false;
export function PosAntrean() {
  const [rows, setRows] = useState<Tertunda[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    let beku = false;
    const refresh = async () => {
      try {
        const r = await bacaAntrean();
        if (live) setRows(r);
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    };
    const sync = async () => {
      if (running || !navigator.onLine) return;
      running = true;
      if (live) setBusy(true);
      try {
        await migrasiAntreanLama();
        const awal = await bacaAntrean();
        const status = await laporPerangkatPos(
          awal.map((x) => x.checkout.client_id),
          beku,
        );
        if (status.beku) {
          await tandaiPindahBeku();
          beku = true;
          window.dispatchEvent(new Event("matur-pos-beku"));
        }
        for (const t of awal) {
          if (!t.checkout.izin_id) continue;
          try {
            const r = await kirimCheckout({
              ...t.checkout,
              sinkron_offline: true,
            });
            if (!r.error && r.receipt)
              await hapusTertunda(t.checkout.client_id);
            else
              await simpanTertunda({
                ...t,
                error: r.error ?? "Belum diterima server.",
              });
          } catch {
            break;
          }
        }
        const akhir = await bacaAntrean();
        await laporPerangkatPos(
          akhir.map((x) => x.checkout.client_id),
          beku,
        );
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        running = false;
        if (live) setBusy(false);
        await refresh();
      }
    };
    void refresh();
    void sync();
    const i = setInterval(() => void sync(), 15000);
    const change = () => void refresh();
    const online = () => void sync();
    window.addEventListener("online", online);
    window.addEventListener("matoer-antrean", change);
    window.addEventListener("pos-sync", online);
    return () => {
      live = false;
      clearInterval(i);
      window.removeEventListener("online", online);
      window.removeEventListener("matoer-antrean", change);
      window.removeEventListener("pos-sync", online);
    };
  }, []);
  if (!rows.length && !error) return null;
  return (
    <aside
      className="mx-auto my-3 max-w-6xl rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"
      role="status"
    >
      <div className="flex justify-between gap-3">
        <b>
          {rows.length} transaksi belum tersinkron{" "}
          {busy ? "· sedang mengirim…" : ""}
        </b>
        <button
          disabled={busy}
          onClick={() => window.dispatchEvent(new Event("pos-sync"))}
          className="font-bold underline"
        >
          Kirim sekarang
        </button>
      </div>
      <button
        className="mt-2 underline"
        onClick={() => {
          const a = document.createElement("a");
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(rows, null, 2)], {
              type: "application/json",
            }),
          );
          a.href = url;
          a.download = `antrean-pos-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Unduh salinan antrean untuk pemeriksaan admin
      </button>
      <p className="mt-1">
        Data tersimpan di tablet. Jangan hapus data aplikasi atau keluar akun
        selama antrean belum kosong.
      </p>
      {error && <p className="mt-1 text-red-700">{error}</p>}
      {rows.some((r) => r.error) && (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold">
            Lihat kendala sinkronisasi
          </summary>
          {rows
            .filter((r) => r.error)
            .map((r) => (
              <p key={r.checkout.client_id} className="mt-1">
                {r.nomorSementara} · {r.waktu} · {r.error}
              </p>
            ))}
        </details>
      )}
    </aside>
  );
}
