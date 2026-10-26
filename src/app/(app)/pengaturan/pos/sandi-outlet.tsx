"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { Modal } from "@/components/confirm-edit";
import {
  lihatSandiOutlet,
  simpanSandiLamaOutlet,
} from "@/lib/pos-outlet-actions";
import { lihatPinOutlet, simpanPinLamaOutlet } from "@/lib/pos-alur-actions";

export function InputSandi(props: InputHTMLAttributes<HTMLInputElement>) {
  const [lihat, setLihat] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={lihat ? "text" : "password"}
        className={`${props.className ?? ""} pr-12`}
      />
      <button
        type="button"
        aria-label={lihat ? "Sembunyikan sandi" : "Tampilkan sandi"}
        aria-pressed={lihat}
        onClick={() => setLihat(!lihat)}
        className="absolute inset-y-0 right-0 mt-1 flex w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
      >
        {lihat ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function SandiOutlet({
  outlet,
}: {
  outlet: { id: string; nama: string; diubah_at: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sandi, setSandi] = useState<string | null>(null);
  const [lama, setLama] = useState("");
  const [belum, setBelum] = useState(false);
  const [error, setError] = useState("");
  const flight = useRef(false);
  const request = useRef(0);
  const clear = useCallback(() => {
    request.current++;
    setOpen(false);
    setSandi(null);
    setLama("");
    setBelum(false);
    setError("");
  }, []);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(clear, 60_000);
    const hidden = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [open, clear]);
  const run = async (capture = false) => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    const id = ++request.current;
    try {
      if (capture) {
        const r = await simpanSandiLamaOutlet(
          outlet.id,
          lama,
          outlet.diubah_at,
        );
        if (id !== request.current) return;
        if (r.error) {
          setError(r.error);
          return;
        }
        setLama("");
      }
      const r = await lihatSandiOutlet(outlet.id);
      if (id !== request.current) return;
      if (r.error) setError(r.error);
      else {
        setSandi(r.sandi ?? null);
        setBelum(!!r.belum_tersimpan);
      }
    } catch {
      if (id === request.current)
        setError("Sandi belum dapat ditampilkan. Coba lagi.");
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <div className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 p-3 text-sm">
        <span>
          <span className="block text-xs text-stone-500">Password POS</span>
          <span aria-label="Sandi disembunyikan" className="font-mono">
            ••••••••
          </span>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(true);
            void run();
          }}
          className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 font-semibold text-kopi-900 disabled:opacity-50"
        >
          <Eye size={17} /> Lihat sandi
        </button>
      </div>
      {open && (
        <Modal title={`Password POS · ${outlet.nama}`} onClose={clear}>
          <div className="space-y-4">
            {busy && (
              <p role="status" className="text-sm text-stone-600">
                Memeriksa akses…
              </p>
            )}
            {sandi !== null && (
              <>
                <p className="select-all break-all rounded-xl border border-matur-200 bg-matur-50 p-4 font-mono text-lg text-kopi-900">
                  {sandi}
                </p>
                <p className="text-xs text-stone-500">
                  Otomatis disembunyikan setelah 60 detik atau ketika tab
                  ditinggalkan. Pembukaan sandi dicatat dalam riwayat admin.
                </p>
              </>
            )}
            {belum && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(true);
                }}
              >
                <p className="text-sm text-stone-600">
                  Sandi lama belum tersimpan untuk ditampilkan. Login POS sekali
                  dengan sandi yang sama agar tersimpan otomatis, atau masukkan
                  sandi saat ini di bawah. Sandinya tetap sama.
                </p>
                <label className="block text-sm font-medium">
                  Password POS saat ini
                  <InputSandi
                    value={lama}
                    onChange={(e) => setLama(e.target.value)}
                    required
                    maxLength={72}
                    autoComplete="off"
                    className="mt-1 w-full rounded-xl border border-stone-300 p-3"
                  />
                </label>
                <button
                  disabled={busy || !outlet.diubah_at}
                  className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Simpan sandi yang sama
                </button>
              </form>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clear}
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** PIN outlet Alur Shift: tampil/sembunyi lewat tombol mata (berbeda fungsi dengan password login). */
export function PinOutlet({ outlet, adaPin }: { outlet: { id: string; nama: string }; adaPin: boolean }) {
  const [pin, setPin] = useState<string | null>(null);
  const [belum, setBelum] = useState(false);
  const [lama, setLama] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const sembunyikan = useCallback(() => {
    request.current++;
    setPin(null);
    setBelum(false);
    setLama("");
    setError("");
  }, []);
  // otomatis tersembunyi setelah 60 detik atau saat tab ditinggalkan
  useEffect(() => {
    if (pin === null && !belum) return;
    const t = window.setTimeout(sembunyikan, 60_000);
    const hidden = () => document.hidden && sembunyikan();
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [pin, belum, sembunyikan]);
  const lihat = async (capture = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    const id = ++request.current;
    try {
      if (capture) {
        const r = await simpanPinLamaOutlet(outlet.id, lama);
        if (id !== request.current) return;
        if (r.error) return setError(r.error);
        setLama("");
      }
      const r = await lihatPinOutlet(outlet.id);
      if (id !== request.current) return;
      if (r.error) setError(r.error);
      else {
        setPin(r.pin ?? null);
        setBelum(!!r.belum_tersimpan);
      }
    } catch {
      if (id === request.current) setError("PIN belum dapat ditampilkan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };
  const tampil = pin !== null;
  return (
    <div className="rounded-xl bg-stone-50 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>
          <span className="block text-xs text-stone-500">PIN outlet (Alur Shift)</span>
          {adaPin ? (
            <span className={`font-mono ${tampil ? "text-lg font-bold tracking-[0.3em] text-kopi-900" : ""}`} aria-label={tampil ? undefined : "PIN disembunyikan"}>
              {tampil ? pin : "••••••"}
            </span>
          ) : (
            <span className="text-xs font-semibold text-amber-700">Belum diatur — atur di tab Alur Shift</span>
          )}
        </span>
        {adaPin && (
          <button
            type="button"
            disabled={busy}
            aria-pressed={tampil}
            aria-label={tampil ? "Sembunyikan PIN" : "Tampilkan PIN"}
            onClick={() => (tampil || belum ? sembunyikan() : void lihat())}
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-stone-200 bg-white text-kopi-900 disabled:opacity-50"
          >
            {tampil || belum ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {belum && (
        <form
          className="mt-3 space-y-2 border-t border-stone-200 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void lihat(true);
          }}
        >
          <p className="text-xs text-stone-600">PIN lama belum tersimpan untuk ditampilkan. Masukkan PIN outlet saat ini sekali — PIN tidak berubah.</p>
          <div className="flex gap-2">
            <input
              value={lama}
              onChange={(e) => setLama(e.target.value.replace(/\D/g, "").slice(0, 6))}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              minLength={4}
              maxLength={6}
              aria-label="PIN outlet saat ini"
              className="w-32 rounded-lg border border-stone-300 bg-white px-3 py-2 tracking-[0.3em]"
            />
            <button disabled={busy} className="rounded-lg bg-kopi-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              Simpan PIN yang sama
            </button>
          </div>
        </form>
      )}
      {tampil && <p className="mt-1 text-[11px] text-stone-500">Tersembunyi otomatis setelah 60 detik. Pembukaan PIN dicatat di log.</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
