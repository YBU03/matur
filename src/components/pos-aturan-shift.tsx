"use client";
import { PosRiwayatShift } from "./pos-riwayat-shift";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aturAlurShift } from "@/lib/pos-alur-actions";
import type { AturanShift } from "@/lib/pos-alur";

// Alur Shift POS: satu outlet satu baris (nama, status merah/hijau, switch). Petunjuk dilipat, riwayat lewat Detail.
export function PosAturanShift({ outlets }: { outlets: AturanShift[] }) {
  const [petunjuk, setPetunjuk] = useState(false);
  const jumlahAktif = outlets.filter((o) => o.aktif).length;
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-matur-50 text-xl" aria-hidden>
            🔁
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-kopi-900">Alur Shift POS</h2>
            <p className="text-sm text-stone-500">
              Pilih per outlet: masuk POS langsung, atau pakai alur shift. <b className="text-kopi-800">{jumlahAktif}/{outlets.length}</b> outlet memakai alur shift.
            </p>
          </div>
          <button
            type="button"
            aria-expanded={petunjuk}
            onClick={() => setPetunjuk(!petunjuk)}
            className="w-full rounded-xl border border-matur-200 px-3 py-2 text-sm font-semibold text-kopi-800 hover:bg-matur-50 sm:w-auto"
          >
            {petunjuk ? "Tutup petunjuk" : "📖 Lihat petunjuk"}
          </button>
        </div>
        {petunjuk && <Petunjuk />}
      </section>

      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-matur-100 bg-white shadow-sm">
        {outlets.map((o) => (
          <BarisOutlet key={o.id + ":" + o.versi} o={o} />
        ))}
        {!outlets.length && <li className="p-6 text-center text-sm text-stone-500">Belum ada outlet yang bisa Anda atur.</li>}
      </ul>
    </div>
  );
}

function Petunjuk() {
  return (
    <div className="mt-4 space-y-3 border-t border-stone-100 pt-4 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border-l-4 border-red-500 bg-red-50/60 p-3">
          <p className="font-bold text-red-800">🔴 Akses langsung (switch mati)</p>
          <p className="mt-1 text-stone-700">Login username & password outlet → kasir langsung memakai POS. Tanpa memilih petugas atau PIN. Cocok untuk training; transaksi tetap tercatat.</p>
        </div>
        <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-50/60 p-3">
          <p className="font-bold text-emerald-800">🟢 Alur shift (switch hidup)</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-stone-700">
            <li>Buka kas: pilih petugas, masukkan PIN outlet, isi modal awal laci.</li>
            <li>Kas sudah berjalan: cukup PIN outlet untuk melanjutkan.</li>
            <li>Ganti petugas: Kas → Selesai &amp; Serah Terima. Uang fisik jadi saldo awal petugas berikutnya.</li>
            <li>Petugas terakhir: Tutup operasional hari ini → laporan siap.</li>
          </ul>
        </div>
      </div>
      <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
        <b>Kapan berlaku?</b> Perubahan switch berlaku mulai <b>kas berikutnya</b> setelah kas berjalan ditutup. PIN baru langsung berlaku untuk masuk atau serah terima berikutnya.
      </p>
    </div>
  );
}

function BarisOutlet({ o }: { o: AturanShift }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  // panel: null | "status" (konfirmasi switch) | "pin" (ganti PIN) | "detail" (riwayat)
  const [panel, setPanel] = useState<null | "status" | "pin" | "detail">(null);
  const [aktif, setAktif] = useState(o.aktif);
  const [pin, setPin] = useState("");
  const [pesan, setPesan] = useState<{ ok?: string; error?: string } | null>(null);
  const butuhPin = aktif && !o.ada_pin;

  const tutup = () => {
    setPanel(null);
    setAktif(o.aktif);
    setPin("");
  };
  const simpan = () =>
    start(async () => {
      try {
        const r = await aturAlurShift(o.id, aktif, pin, o.versi);
        setPesan(r.error ? { error: r.error } : { ok: r.ok ?? "Tersimpan." });
        if (!r.error) {
          setPanel(null);
          setPin("");
          router.refresh();
        }
      } catch {
        setPesan({ error: "Belum tersimpan. Periksa koneksi lalu coba lagi." });
      }
    });

  return (
    <li className="p-4">
      <div className="flex items-center gap-3">
        <span className={`size-3 shrink-0 rounded-full ${o.aktif ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-red-500 ring-4 ring-red-100"}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-kopi-900">{o.nama}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className={`font-semibold ${o.aktif ? "text-emerald-700" : "text-red-700"}`}>{o.aktif ? "Alur shift aktif" : "Akses langsung"}</span>
            <span className="text-stone-400">·</span>
            <span className={o.ada_pin ? "text-stone-500" : "text-amber-700"}>{o.ada_pin ? "PIN outlet tersedia" : "PIN outlet belum diatur"}</span>
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={panel === "status" ? aktif : o.aktif}
          aria-label={`Alur shift ${o.nama}`}
          disabled={busy}
          onClick={() => {
            setPesan(null);
            setAktif(!o.aktif);
            setPin("");
            setPanel("status");
          }}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kopi-900 disabled:opacity-60 ${(panel === "status" ? aktif : o.aktif) ? "bg-emerald-500" : "bg-red-500"}`}
        >
          <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${(panel === "status" ? aktif : o.aktif) ? "left-7" : "left-1"}`} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 pl-6">
        <button
          type="button"
          onClick={() => {
            setPesan(null);
            setAktif(o.aktif);
            setPin("");
            setPanel(panel === "pin" ? null : "pin");
          }}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          🔑 {o.ada_pin ? "Ganti PIN" : "Atur PIN"}
        </button>
        <button
          type="button"
          aria-expanded={panel === "detail"}
          onClick={() => setPanel(panel === "detail" ? null : "detail")}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          📋 Detail
        </button>
      </div>

      {(panel === "status" || panel === "pin") && (
        <form
          className="mt-3 ml-6 space-y-3 rounded-xl border border-matur-100 bg-matur-50/50 p-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            simpan();
          }}
        >
          {panel === "status" && (
            <p className="text-kopi-900">
              {aktif ? (
                <>
                  Aktifkan <b>alur shift</b> untuk <b>{o.nama}</b>? Kasir akan memilih petugas & memasukkan PIN outlet mulai <b>kas berikutnya</b>.
                </>
              ) : (
                <>
                  Kembalikan <b>{o.nama}</b> ke <b>akses langsung</b>? Mulai kas berikutnya kasir langsung masuk POS tanpa PIN.
                </>
              )}
            </p>
          )}
          {(panel === "pin" || butuhPin) && (
            <label className="block">
              <span className="font-semibold text-kopi-900">{o.ada_pin ? "PIN outlet baru" : "PIN outlet"} (4–6 angka)</span>
              {butuhPin && <span className="block text-xs text-amber-800">Wajib diisi sebelum alur shift diaktifkan.</span>}
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                type="password"
                autoComplete="new-password"
                inputMode="numeric"
                pattern="[0-9]{4,6}"
                minLength={4}
                maxLength={6}
                required
                autoFocus
                className="mt-1 block w-full max-w-xs rounded-xl border border-matur-200 bg-white px-3 py-2 text-lg tracking-[0.4em] outline-none focus:border-matur-500"
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} className="rounded-xl bg-kopi-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
              {busy ? "Menyimpan…" : panel === "pin" ? "Simpan PIN" : "Ya, simpan"}
            </button>
            <button type="button" disabled={busy} onClick={tutup} className="rounded-xl border border-stone-200 bg-white px-4 py-2 font-semibold text-stone-700">
              Batal
            </button>
          </div>
        </form>
      )}

      {pesan && (
        <p role="status" className={`mt-2 ml-6 rounded-lg px-3 py-2 text-sm ${pesan.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
          {pesan.error ?? pesan.ok}
        </p>
      )}

      {panel === "detail" && (
        <div className="mt-3 ml-6">
          <PosRiwayatShift outlet={o.id} />
        </div>
      )}
    </li>
  );
}
