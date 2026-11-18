"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { daftarPromoKasir, pesanPromo, lepasPromo } from "@/lib/promo-actions";
import { formatRupiah } from "@/lib/format";
import type { CartLine } from "@/lib/pos-actions";
import type { Promo, PromoQuote } from "@/lib/promo";
export function PosPromo({
  sesiId,
  izinId,
  kanal,
  diskon,
  items,
  subtotal,
  menuNames,
  onQuote,
  onBusy,
  disabled,
}: {
  sesiId: string;
  izinId: string;
  kanal: string;
  diskon: number;
  items: CartLine[];
  subtotal: number;
  menuNames: Record<string, string>;
  onQuote: (q: PromoQuote | null) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
}) {
  const [list, setList] = useState<Promo[]>([]);
  const [selected, setSelected] = useState("");
  const [quote, setQuote] = useState<PromoQuote | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const live = useRef(true),
    ref = useRef<PromoQuote | null>(null),
    request = useRef<{ id: string; promo: string } | null>(null);
  useEffect(() => {
    onBusy(pending);
    return () => onBusy(false);
  }, [pending, onBusy]);
  const callback = useRef(onQuote);
  callback.current = onQuote;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (ref.current) void lepasPromo(ref.current.id).catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(
      () => {
        if (live.current) {
          setError(
            "Reservasi berakhir. Pilih promo kembali. Jika pembayaran sudah dilakukan, cek riwayat sebelum mengulang.",
          );
        }
      },
      Math.max(0, Date.parse(quote.sampai_at) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [quote]);
  const release = async (id: string) => {
    const r = await lepasPromo(id);
    if (r.error) throw new Error(r.error);
  };
  const load = () =>
    start(async () => {
      setError("");
      try {
        const r = await daftarPromoKasir();
        if (r.error) setError(r.error);
        else setList(r.data ?? []);
      } catch {
        setError("Tidak dapat memuat promo. Periksa internet.");
      }
    });
  const apply = () =>
    start(async () => {
      setError("");
      if (!navigator.onLine) {
        setError("Promo membutuhkan internet.");
        return;
      }
      try {
        if (ref.current) {
          await release(ref.current.id);
          ref.current = null;
          setQuote(null);
          callback.current(null);
          request.current = null;
        }
        if (!request.current || request.current.promo !== selected)
          request.current = { id: crypto.randomUUID(), promo: selected };
        const r = await pesanPromo({
          request_id: request.current.id,
          promo_id: selected,
          sesi_id: sesiId,
          izin_id: izinId,
          kanal,
          diskon,
          items,
        });
        if (!live.current) {
          if (r.quote) void lepasPromo(r.quote.id).catch(() => {});
          return;
        }
        if (r.error) {
          setError(r.error);
          request.current = null;
        } else if (r.quote) {
          if (r.quote.subtotal !== subtotal) {
            await lepasPromo(r.quote.id);
            setError(
              "Harga katalog berubah. Muat ulang kasir sebelum memakai promo.",
            );
            request.current = null;
            return;
          }
          ref.current = r.quote;
          setQuote(r.quote);
          callback.current(r.quote);
        }
      } catch {
        setError(
          "Koneksi terputus. Klik Terapkan lagi untuk memeriksa reservasi yang sama.",
        );
      }
    });
  const clear = () =>
    start(async () => {
      try {
        if (ref.current) await release(ref.current.id);
        ref.current = null;
        request.current = null;
        setQuote(null);
        callback.current(null);
        setError("");
      } catch {
        setError("Belum dapat melepas reservasi. Coba lagi.");
      }
    });
  return (
    <section className="space-y-2 rounded-xl border border-matur-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <b>Promo outlet</b>
        <button
          disabled={pending || disabled}
          onClick={load}
          className="text-xs font-semibold underline"
        >
          Muat / segarkan promo
        </button>
      </div>
      {list.length > 0 && (
        <>
          <select
            aria-label="Pilih promo"
            className="w-full rounded-lg border p-2"
            value={selected}
            disabled={pending || disabled || !!quote}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Pilih promo aktif</option>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg border px-3 py-1.5 font-semibold"
            disabled={pending || disabled || !selected || !items.length}
            onClick={apply}
          >
            {pending
              ? "Memeriksa…"
              : quote
                ? "Perbarui reservasi"
                : "Terapkan promo"}
          </button>
        </>
      )}
      {quote && (
        <div className="rounded-lg bg-green-50 p-2 text-green-800">
          <b>{quote.nama}</b>
          <p>Diskon {formatRupiah(quote.diskon)}</p>
          <p className="text-xs">
            Berlaku sampai{" "}
            {new Date(quote.sampai_at).toLocaleTimeString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}{" "}
            WIB.
          </p>
          {Object.entries(quote.sisa).map(([id, n]) => (
            <p className="text-xs" key={id}>
              Sisa kuota{" "}
              {id === "semua"
                ? "gabungan"
                : list.flatMap((p) => p.aturan).some((a) => a.menu_id === id)
                  ? (menuNames[id] ?? "menu")
                  : "menu"}
              : {n} item saat reservasi.
            </p>
          ))}
          <button
            className="mt-1 underline"
            disabled={pending || disabled}
            onClick={clear}
          >
            Lepas promo
          </button>
        </div>
      )}
      <p className="text-[11px] text-stone-500">
        Online · pilih ulang jika keranjang/diskon berubah · kuota ditahan
        maksimal 15 menit sebelum bayar. Terapkan ulang saat memuat draft.
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
