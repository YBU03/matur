"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { LoadingKasir } from "@/components/loading-kasir";
import { formatRupiah } from "@/lib/format";
import {
  masukPos,
  type HasilMasuk,
  type OutletPos,
} from "@/lib/pos-tablet-actions";
import { bukaPos } from "@/lib/pos-tim-actions";

const CEPAT = [100000, 150000, 200000, 300000, 500000];

// Login POS tablet: kode staf + PIN → (bila shift belum dibuka) pop-up modal kas → beranda tablet.
export function MasukPos({ pesan, kunci }: { pesan?: string; kunci?: string }) {
  const [kode, setKode] = useState("");
  const [pin, setPin] = useState("");
  const [pilih, setPilih] = useState<OutletPos[] | null>(null);
  const [shift, setShift] = useState<HasilMasuk["modal"] | null>(null);
  const [modal, setModal] = useState("");
  const [anggota, setAnggota] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState("");
  const [busy, start] = useTransition();
  const cls = "mt-1 w-full rounded-xl border border-stone-300 p-3 text-lg";

  const keBeranda = () => {
    setLoading("Menyiapkan kasir…");
    location.href = "/pos";
  };
  const kirim = (outlet: string | null) =>
    start(async () => {
      setErr("");
      setLoading("Masuk sebagai kasir…");
      try {
        const r = await masukPos(kode, pin, outlet);
        if (r.error) {
          setErr(r.error);
          setLoading("");
          return;
        }
        if (r.pilih) {
          setPilih(r.pilih);
          setLoading("");
          return;
        }
        if (r.modal) {
          setShift(r.modal);
          setAnggota(r.modal.tim.map((t) => t.id));
          setLoading("");
          return;
        }
        keBeranda();
      } catch {
        setErr("Koneksi terputus. Coba lagi saat online.");
        setLoading("");
      }
    });
  const bukaShift = () =>
    start(async () => {
      setErr("");
      setLoading("Membuka shift…");
      try {
        const r = await bukaPos(kode, pin, Number(modal || 0), anggota);
        if (r.error) {
          setErr(r.error);
          setLoading("");
          return;
        }
        setPin("");
        keBeranda();
      } catch {
        setErr("Koneksi terputus. Coba lagi saat online.");
        setLoading("");
      }
    });

  return (
    <>
      {loading && <LoadingKasir teks={loading} />}
      <div className="mx-auto mt-8 max-w-md space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-center">
          <Image
            src="/brand/logo-192.png"
            alt="Matoer"
            width={64}
            height={64}
            className="mx-auto rounded-2xl"
          />
          <h1 className="mt-3 text-2xl font-bold">
            {kunci ? "🔒 Buka kunci" : "Matoer POS"}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {kunci ?? "Masuk dengan kode staf dan PIN POS dari HRD."}
          </p>
        </div>
        {pesan && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            {pesan}
          </p>
        )}
        {!pilih ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              kirim(null);
            }}
          >
            <label className="block text-sm font-semibold">
              Kode staf
              <input
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                required
                autoCapitalize="none"
                autoComplete="off"
                className={cls}
              />
            </label>
            <label className="block text-sm font-semibold">
              PIN POS
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                required
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,6}"
                maxLength={6}
                autoComplete="off"
                className={`${cls} tracking-widest`}
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-xl bg-matur-500 p-3 text-lg font-bold text-white disabled:opacity-50"
            >
              {kunci ? "Buka" : "Masuk"}
            </button>
          </form>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              Kamu bertugas di beberapa outlet. Tablet ini untuk outlet mana?
            </p>
            {pilih.map((o) => (
              <button
                key={o.id}
                disabled={busy}
                onClick={() => kirim(o.id)}
                className="w-full rounded-xl border-2 border-matur-300 p-3 text-left font-semibold disabled:opacity-50"
              >
                {o.nama}
              </button>
            ))}
            <button
              onClick={() => setPilih(null)}
              className="text-sm underline"
            >
              Kembali
            </button>
          </div>
        )}
        {err && !shift && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {err}
          </p>
        )}
        <p className="text-center text-xs text-stone-500">
          Absen, jadwal, izin & slip gaji tetap di HP masing-masing (/karyawan).
        </p>
      </div>

      {shift && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <form
            role="dialog"
            aria-label="Modal kas awal"
            onSubmit={(e) => {
              e.preventDefault();
              bukaShift();
            }}
            className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
          >
            <div className="text-center">
              <p className="text-4xl">💵</p>
              <h2 className="mt-1 text-xl font-bold">Uang modal di laci</h2>
              <p className="text-sm text-stone-500">Shift {shift.shift}</p>
            </div>
            <label className="block">
              <span className="sr-only">Modal kas awal</span>
              <div className="flex items-center rounded-2xl border-2 border-matur-300 px-4 focus-within:border-matur-500">
                <span className="text-xl font-bold text-stone-400">Rp</span>
                <input
                  autoFocus
                  required
                  inputMode="numeric"
                  value={modal ? Number(modal).toLocaleString("id-ID") : ""}
                  onChange={(e) =>
                    setModal(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="0"
                  className="w-full bg-transparent p-3 text-right text-3xl font-bold tabular-nums outline-none"
                />
              </div>
            </label>
            <div className="flex flex-wrap justify-center gap-2">
              {CEPAT.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setModal(String(n))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${Number(modal) === n ? "border-matur-500 bg-matur-500 text-white" : "border-matur-200 bg-matur-50"}`}
                >
                  {formatRupiah(n)}
                </button>
              ))}
            </div>
            <fieldset className="rounded-2xl border p-3">
              <legend className="px-1 text-sm font-semibold">
                Tim shift ini (sudah Clock In)
              </legend>
              <div className="flex flex-wrap gap-2">
                {shift.tim.map((t) => {
                  const on = anggota.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={t.id === shift.saya}
                      onClick={() =>
                        setAnggota(
                          on
                            ? anggota.filter((x) => x !== t.id)
                            : [...anggota, t.id],
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-green-600 bg-green-50 font-semibold text-green-800" : "border-stone-300 text-stone-500"}`}
                    >
                      {on ? "✓ " : ""}
                      {t.nama}
                      {t.kasir ? " · kasir" : ""}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {err && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {err}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShift(null);
                  setErr("");
                }}
                className="rounded-xl border px-4 py-3 text-sm"
              >
                Batal
              </button>
              <button
                disabled={busy || modal === ""}
                className="flex-1 rounded-xl bg-matur-500 p-3 text-lg font-bold text-white disabled:opacity-50"
              >
                Buka Shift
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
