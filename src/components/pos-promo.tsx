"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { daftarPromoKasir, pesanPromo, lepasPromo } from "@/lib/promo-actions";
import { formatRupiah } from "@/lib/format";
import type { CartLine } from "@/lib/pos-actions";
import type { Promo, PromoQuote } from "@/lib/promo";
import {
  alasanPromoNormal,
  alasanPromoDariError,
  pesanHargaNormal,
  type AlasanPromoNormal,
} from "@/lib/promo-ketersediaan";
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
  awal,
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
  /** promo berlaku dari kotak promo kasir, supaya tidak perlu klik "Muat" dulu */
  awal?: Promo[];
}) {
  const [list, setList] = useState<Promo[]>([]);
  const [selected, setSelected] = useState("");
  const [quote, setQuote] = useState<PromoQuote | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const live = useRef(true),
    ref = useRef<PromoQuote | null>(null),
    request = useRef<{ id: string; promo: string } | null>(null);
  useEffect(() => {
    onBusy(pending);
    return () => onBusy(false);
  }, [pending, onBusy]);
  useEffect(() => {
    if (awal && !ref.current) setList(awal);
  }, [awal]);
  const callback = useRef(onQuote);
  callback.current = onQuote;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (ref.current) void lepasPromo(ref.current.id).catch(() => {});
    };
  }, []);
  // Reservasi aktif memiliki kuota sendiri: jangan cabut hanya karena sisa umum nol.
  const normal = (alasan: AlasanPromoNormal) => {
    const hadQuote = !!ref.current;
    ref.current = null;
    request.current = null;
    setQuote(null);
    setSelected("");
    if (hadQuote) callback.current(null);
    setError("");
    setNotice(pesanHargaNormal(alasan));
  };
  const normalRef = useRef(normal);
  normalRef.current = normal;
  useEffect(() => {
    if (!list.length) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [list.length]);
  useEffect(() => {
    // Jangan mengubah nominal saat permintaan pembayaran sedang diproses.
    if (!quote || disabled) return;
    const expire = () => {
      if (live.current) normalRef.current("waktu");
    };
    const timer = setTimeout(
      expire,
      Math.max(0, Date.parse(quote.sampai_at) - Date.now()),
    );
    const focus = () => {
      if (
        document.visibilityState === "visible" &&
        Date.parse(quote.sampai_at) <= Date.now()
      )
        expire();
    };
    document.addEventListener("visibilitychange", focus);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [quote, disabled]);
  useEffect(() => {
    if (quote || pending || disabled || !selected) return;
    const p = list.find((p) => p.id === selected);
    const reason = p ? alasanPromoNormal(p, items, now) : "waktu";
    if (reason) normalRef.current(reason);
  }, [list, selected, quote, pending, disabled, items, now]);
  const tersedia = list.filter(
    (p) => p.id === quote?.promo_id || !alasanPromoNormal(p, items, now),
  );
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
      setNotice("");
      const chosen = list.find((p) => p.id === selected);
      const unavailable = chosen ? alasanPromoNormal(chosen, items) : "waktu";
      if (!ref.current && unavailable) {
        normal(unavailable);
        return;
      }
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
          const reason = alasanPromoDariError(r.error);
          if (reason) {
            normal(reason);
            // Rapatkan perubahan kuota dari kasir lain tanpa menambah polling.
            try {
              const fresh = await daftarPromoKasir();
              if (live.current && !fresh.error) setList(fresh.data ?? []);
            } catch {
              /* Harga normal tetap tersedia jika penyegaran gagal. */
            }
          } else setError(r.error);
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
          const reserved = { ...r.quote, promo_id: selected };
          ref.current = reserved;
          setQuote(reserved);
          setNotice("");
          callback.current(reserved);
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
        setSelected("");
        setNotice("");
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
      {tersedia.length > 0 && (
        <>
          <select
            aria-label="Pilih promo"
            className="w-full rounded-lg border p-2"
            value={selected}
            disabled={pending || disabled || !!quote}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Pilih promo aktif</option>
            {tersedia.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
                {p.cakupan === "transaksi"
                  ? " · voucher sekali/transaksi"
                  : " · per item"}
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
          {quote.cakupan === "transaksi" && (
            <p className="text-xs font-semibold">
              Voucher sekali per transaksi · tidak dikalikan jumlah item
            </p>
          )}
          <p>
            {quote.subsidi
              ? (quote.nama_subsidi ?? "Subsidi")
              : quote.cakupan === "transaksi"
                ? "Voucher"
                : "Diskon"}{" "}
            {formatRupiah(quote.diskon)}
          </p>
          {quote.subsidi && (
            <p className="text-xs">
              Ditagihkan ke kantor, bukan pembayaran pelanggan.
            </p>
          )}
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
              : {n} {quote.cakupan === "transaksi" ? "transaksi" : "item"} saat
              reservasi.
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
      {!quote && !tersedia.length && list.length > 0 && !notice && (
        <p role="status" className="rounded-lg bg-stone-50 p-2 text-stone-700">
          Promo belum tersedia untuk keranjang ini atau sudah berakhir. Harga
          normal berlaku.
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-amber-50 p-2 text-amber-900">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
