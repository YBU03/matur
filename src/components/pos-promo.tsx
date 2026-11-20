"use client";
// Panel promo di keranjang kasir. Promo yang dipilih tetap menempel saat keranjang berubah:
// reservasi kuota diperbarui otomatis (debounce), diperpanjang sebelum kedaluwarsa, dan bisa
// dipicu ulang dari luar (prop `segar`) bila pembayaran menemukan reservasi sudah lepas.
// Harga, kuota dan validasi tetap di server (pesan_promo / buat_transaksi).
import { useCallback, useEffect, useRef, useState } from "react";
import { daftarPromoKasir, pesanPromo, lepasPromo } from "@/lib/promo-actions";
import { formatRupiah } from "@/lib/format";
import type { CartLine } from "@/lib/pos-actions";
import type { Promo, PromoQuote } from "@/lib/promo";

/** Kunci keranjang — harus sama persis dengan `promoKey` di pos-screen. */
export const kunciPromo = (items: CartLine[], kanal: string, diskon: number, sesiId: string, izinId: string) =>
  JSON.stringify({ items, kanal, diskon, sesiId, izinId });

const layak = (p: Promo, items: CartLine[]) => p.aturan.some((a) => items.some((i) => i.menu_id === a.menu_id));

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
  segar = 0,
}: {
  sesiId: string;
  izinId: string;
  kanal: string;
  diskon: number;
  items: CartLine[];
  subtotal: number;
  menuNames: Record<string, string>;
  /** quote + kunci keranjang tempat quote dihitung (agar tidak terpakai untuk keranjang lain) */
  onQuote: (q: PromoQuote | null, kunci: string) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
  /** promo berlaku dari kotak promo kasir, supaya tidak perlu klik "Muat" dulu */
  awal?: Promo[];
  /** naikkan angka ini untuk memaksa reservasi ulang (mis. setelah pembayaran menolak reservasi lama) */
  segar?: number;
}) {
  const [list, setList] = useState<Promo[]>([]);
  const [selected, setSelected] = useState("");
  const [quote, setQuote] = useState<PromoQuote | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const kunci = kunciPromo(items, kanal, diskon, sesiId, izinId);
  const live = useRef(true),
    ref = useRef<PromoQuote | null>(null),
    seq = useRef(0),
    manualOff = useRef(false),
    terakhir = useRef(""),
    props = useRef({ items, kanal, diskon, sesiId, izinId, subtotal, kunci });
  props.current = { items, kanal, diskon, sesiId, izinId, subtotal, kunci };
  const callback = useRef(onQuote);
  callback.current = onQuote;

  useEffect(() => {
    onBusy(busy);
  }, [busy, onBusy]);
  useEffect(() => () => onBusy(false), [onBusy]);
  useEffect(() => {
    if (awal) setList(awal);
  }, [awal]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (ref.current) void lepasPromo(ref.current.id).catch(() => {});
    };
  }, []);

  const lepasLama = async () => {
    const lama = ref.current;
    ref.current = null;
    if (lama) await lepasPromo(lama.id).catch(() => {});
  };

  /** Lepas reservasi lama lalu pesan ulang untuk keranjang saat ini. Respons usang diabaikan. */
  const terapkan = useCallback(async (promoId: string) => {
    const saya = ++seq.current;
    const p = props.current;
    setError("");
    setBusy(true);
    try {
      await lepasLama();
      setQuote(null);
      callback.current(null, p.kunci);
      if (!promoId || !p.items.length) return;
      if (!navigator.onLine) return setError("Promo membutuhkan internet.");
      const r = await pesanPromo({ request_id: crypto.randomUUID(), promo_id: promoId, sesi_id: p.sesiId, izin_id: p.izinId, kanal: p.kanal, diskon: p.diskon, items: p.items });
      if (!live.current || saya !== seq.current) {
        if (r.quote) void lepasPromo(r.quote.id).catch(() => {});
        return;
      }
      if (r.error) return setError(/Kuota/i.test(r.error) ? `${r.error}. Promo dilepas sementara; kurangi jumlah atau bayar tanpa promo.` : r.error);
      if (!r.quote) return;
      if (r.quote.subtotal !== p.subtotal) {
        void lepasPromo(r.quote.id).catch(() => {});
        return setError("Harga katalog berubah. Muat ulang kasir sebelum memakai promo.");
      }
      ref.current = r.quote;
      terakhir.current = p.kunci;
      setQuote(r.quote);
      callback.current({ ...r.quote, promo_id: promoId }, p.kunci);
      setInfo("Promo diperbarui ✓");
    } catch {
      if (saya === seq.current) setError("Koneksi terputus saat memeriksa promo. Coba lagi.");
    } finally {
      if (saya === seq.current && live.current) setBusy(false);
    }
  }, []);

  // Pilih otomatis bila hanya ada satu promo berjalan dan keranjang berisi menunya.
  useEffect(() => {
    if (!items.length) {
      manualOff.current = false;
      return;
    }
    if (!selected && !manualOff.current && list.length === 1 && layak(list[0], items)) setSelected(list[0].id);
  }, [items, list, selected]);

  // Keranjang/kanal/diskon berubah → reservasi diperbarui otomatis (tanpa klik Terapkan).
  useEffect(() => {
    if (!selected) return;
    if (!items.length) {
      void terapkan("");
      return;
    }
    if (terakhir.current === kunci && ref.current) return;
    // Langsung tandai sedang menyesuaikan: diskon lama disembunyikan & tombol Bayar menunggu.
    setBusy(true);
    setQuote(null);
    const t = setTimeout(() => void terapkan(selected), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, selected, terapkan]);

  // Dipicu dari pembayaran yang menemukan reservasi lepas/kedaluwarsa.
  useEffect(() => {
    if (segar && selected) {
      terakhir.current = "";
      void terapkan(selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segar]);

  // Perpanjang otomatis sebelum reservasi 15 menit berakhir.
  useEffect(() => {
    if (!quote || !selected) return;
    const t = setTimeout(() => {
      if (live.current) {
        terakhir.current = "";
        void terapkan(selected);
      }
    }, Math.max(1000, Date.parse(quote.sampai_at) - Date.now() - 20_000));
    return () => clearTimeout(t);
  }, [quote, selected, terapkan]);

  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo(""), 2500);
    return () => clearTimeout(t);
  }, [info]);

  const load = async () => {
    setError("");
    try {
      const r = await daftarPromoKasir();
      if (r.error) setError(r.error);
      else setList(r.data ?? []);
    } catch {
      setError("Tidak dapat memuat promo. Periksa internet.");
    }
  };
  const lepas = () => {
    manualOff.current = true;
    setSelected("");
    terakhir.current = "";
    void terapkan("");
    setInfo("");
  };

  return (
    <section className="space-y-2 rounded-xl border border-matur-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <b>Promo outlet</b>
        <button disabled={busy || disabled} onClick={load} className="text-xs font-semibold underline">
          Muat / segarkan promo
        </button>
      </div>
      {list.length > 0 && (
        <div className="flex gap-2">
          <select
            aria-label="Pilih promo"
            className="min-w-0 flex-1 rounded-lg border p-2"
            value={selected}
            disabled={disabled}
            onChange={(e) => {
              manualOff.current = !e.target.value;
              terakhir.current = "";
              setSelected(e.target.value);
              if (!e.target.value) void terapkan("");
            }}
          >
            <option value="">Tanpa promo</option>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
                {p.cakupan === "transaksi" ? " · voucher sekali/transaksi" : " · per item"}
              </option>
            ))}
          </select>
          {selected && !quote && !busy && (
            <button className="rounded-lg border px-3 py-1.5 text-xs font-semibold" disabled={disabled || !items.length} onClick={() => { terakhir.current = ""; void terapkan(selected); }}>
              Coba lagi
            </button>
          )}
        </div>
      )}
      {busy && <p className="text-xs font-semibold text-matur-700">⏳ Menyesuaikan promo dengan keranjang…</p>}
      {quote && (
        <div className="rounded-lg bg-green-50 p-2 text-green-800">
          <div className="flex items-start justify-between gap-2">
            <b>{quote.nama}</b>
            {info && <span className="text-[11px] font-semibold text-green-700">{info}</span>}
          </div>
          {quote.cakupan === "transaksi" && <p className="text-xs font-semibold">Voucher sekali per transaksi · tidak dikalikan jumlah item</p>}
          <p>
            {quote.subsidi ? (quote.nama_subsidi ?? "Subsidi") : quote.cakupan === "transaksi" ? "Voucher" : "Diskon"} {formatRupiah(quote.diskon)}
          </p>
          {quote.subsidi && <p className="text-xs">Ditagihkan ke kantor, bukan pembayaran pelanggan.</p>}
          {Object.entries(quote.sisa).map(([id, n]) => (
            <p className="text-xs" key={id}>
              Sisa kuota {id === "semua" ? "gabungan" : (menuNames[id] ?? "menu")}: {n} {quote.cakupan === "transaksi" ? "transaksi" : "item"} setelah nota ini.
            </p>
          ))}
          <button className="mt-1 underline" disabled={disabled} onClick={lepas}>
            Lepas promo
          </button>
        </div>
      )}
      <p className="text-[11px] text-stone-500">Online · promo ikut menyesuaikan otomatis saat keranjang berubah · satu nota boleh berisi banyak menu promo.</p>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
