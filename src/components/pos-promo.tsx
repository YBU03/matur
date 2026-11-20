"use client";
// Panel promo di keranjang kasir.
// - Promo terpilih menempel saat keranjang berubah: reservasi kuota dipesan ulang otomatis (debounce),
//   diperpanjang sebelum kedaluwarsa, dan bisa dipicu ulang dari luar (prop `segar`).
// - Promo yang habis/tidak cukup/lewat jam disembunyikan; penolakan kuota/waktu → info "Harga normal berlaku".
// - Nominal tidak diubah saat pembayaran sedang diproses (`disabled`).
// Harga, kuota dan validasi tetap di server (pesan_promo / buat_transaksi).
import { useCallback, useEffect, useRef, useState } from "react";
import { daftarPromoKasir, pesanPromo, lepasPromo } from "@/lib/promo-actions";
import { formatRupiah } from "@/lib/format";
import type { CartLine } from "@/lib/pos-actions";
import type { Promo, PromoQuote } from "@/lib/promo";
import { alasanPromoNormal, alasanPromoDariError, pesanHargaNormal, type AlasanPromoNormal } from "@/lib/promo-ketersediaan";

/** Kunci keranjang — dipakai juga oleh `promoKey` di pos-screen agar quote tidak terpakai untuk keranjang lain. */
export const kunciPromo = (items: CartLine[], kanal: string, diskon: number, sesiId: string, izinId: string) =>
  JSON.stringify({ items, kanal, diskon, sesiId, izinId });

const layak = (p: Promo, items: CartLine[]) => p.aturan.some((a) => items.some((i) => i.menu_id === a.menu_id && a.varian_ids.every((v) => i.varian_ids.includes(v))));

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
  /** quote + kunci keranjang tempat quote dihitung */
  onQuote: (q: PromoQuote | null, kunci: string) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
  /** promo berlaku dari kotak promo kasir, supaya tidak perlu klik "Muat" dulu */
  awal?: Promo[];
  /** naikkan angka ini untuk memaksa reservasi ulang (mis. pembayaran menolak reservasi lama) */
  segar?: number;
}) {
  const [list, setList] = useState<Promo[]>([]);
  const [selected, setSelected] = useState("");
  const [quote, setQuote] = useState<PromoQuote | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
  // Batas jam/slot dipantau lokal tanpa panggilan server.
  useEffect(() => {
    if (!list.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [list.length]);

  const buangQuote = () => {
    const lama = ref.current;
    ref.current = null;
    terakhir.current = "";
    setQuote(null);
    if (lama) {
      callback.current(null, props.current.kunci);
      void lepasPromo(lama.id).catch(() => {});
    }
  };

  /** Promo tidak tersedia (kuota/waktu): lepas pilihan, harga normal berlaku. */
  const normal = useCallback((alasan: AlasanPromoNormal) => {
    seq.current++;
    buangQuote();
    manualOff.current = true;
    setSelected("");
    setError("");
    setBusy(false);
    setNotice(pesanHargaNormal(alasan));
  }, []);

  /** Lepas reservasi lama lalu pesan ulang untuk keranjang saat ini. Respons usang diabaikan. */
  const terapkan = useCallback(
    async (promoId: string) => {
      const saya = ++seq.current;
      const p = props.current;
      setError("");
      setBusy(true);
      try {
        buangQuote();
        if (!promoId || !p.items.length) return;
        if (!navigator.onLine) return setError("Promo membutuhkan internet.");
        const r = await pesanPromo({ request_id: crypto.randomUUID(), promo_id: promoId, sesi_id: p.sesiId, izin_id: p.izinId, kanal: p.kanal, diskon: p.diskon, items: p.items });
        if (!live.current || saya !== seq.current) {
          if (r.quote) void lepasPromo(r.quote.id).catch(() => {});
          return;
        }
        if (r.error) {
          const alasan = alasanPromoDariError(r.error);
          if (!alasan) return setError(r.error);
          normal(alasan);
          // Rapatkan perubahan kuota dari kasir lain tanpa menambah polling.
          try {
            const fresh = await daftarPromoKasir();
            if (live.current && !fresh.error) setList(fresh.data ?? []);
          } catch {
            /* Harga normal tetap berlaku bila penyegaran gagal. */
          }
          return;
        }
        if (!r.quote) return;
        if (r.quote.subtotal !== p.subtotal) {
          void lepasPromo(r.quote.id).catch(() => {});
          return setError("Harga katalog berubah. Muat ulang kasir sebelum memakai promo.");
        }
        const q = { ...r.quote, promo_id: promoId };
        ref.current = q;
        terakhir.current = p.kunci;
        setQuote(q);
        setNotice("");
        callback.current(q, p.kunci);
        setInfo("Promo diperbarui ✓");
      } catch {
        if (saya === seq.current) setError("Koneksi terputus saat memeriksa promo. Coba lagi.");
      } finally {
        if (saya === seq.current && live.current) setBusy(false);
      }
    },
    [normal],
  );

  const tersedia = list.filter((p) => (p.id === selected && !!quote) || !alasanPromoNormal(p, items, now));

  // Pilih otomatis bila hanya satu promo tersedia dan keranjang berisi menunya.
  useEffect(() => {
    if (!items.length) {
      manualOff.current = false;
      return;
    }
    if (!selected && !manualOff.current && !disabled && tersedia.length === 1 && layak(tersedia[0], items)) {
      setNotice("");
      setSelected(tersedia[0].id);
    }
  }, [items, tersedia, selected, disabled]);

  // Promo terpilih tanpa reservasi menjadi tidak tersedia (jam lewat / kuota habis) → harga normal.
  useEffect(() => {
    if (quote || busy || disabled || !selected) return;
    const p = list.find((x) => x.id === selected);
    const alasan = p ? alasanPromoNormal(p, items, now) : "waktu";
    if (alasan) normal(alasan);
  }, [list, selected, quote, busy, disabled, items, now, normal]);

  // Keranjang/kanal/diskon berubah → reservasi diperbarui otomatis (tanpa klik Terapkan).
  useEffect(() => {
    if (!selected || disabled) return;
    if (!items.length) {
      void terapkan("");
      return;
    }
    if (terakhir.current === kunci && ref.current) return;
    // Langsung tandai sedang menyesuaikan: diskon lama disembunyikan & tombol Bayar menunggu.
    setBusy(true);
    if (ref.current) buangQuote();
    const t = setTimeout(() => void terapkan(selected), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, selected, terapkan, disabled]);

  // Dipicu dari pembayaran yang menemukan reservasi lepas/kedaluwarsa.
  useEffect(() => {
    if (segar && selected && !disabled) void terapkan(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segar]);

  // Perpanjang otomatis sebelum reservasi berakhir (tidak saat pembayaran sedang diproses).
  useEffect(() => {
    if (!quote || !selected || disabled) return;
    const sisa = Date.parse(quote.sampai_at) - Date.now();
    const t = setTimeout(() => {
      if (live.current) void terapkan(selected);
    }, Math.max(0, sisa > 25_000 ? sisa - 20_000 : sisa));
    return () => clearTimeout(t);
  }, [quote, selected, disabled, terapkan]);

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
    seq.current++;
    manualOff.current = true;
    setSelected("");
    setNotice("");
    setInfo("");
    setBusy(false);
    buangQuote();
  };

  return (
    <section className="space-y-2 rounded-xl border border-matur-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <b>Promo outlet</b>
        <button disabled={busy || disabled} onClick={load} className="text-xs font-semibold underline">
          Muat / segarkan promo
        </button>
      </div>
      {tersedia.length > 0 && (
        <div className="flex gap-2">
          <select
            aria-label="Pilih promo"
            className="min-w-0 flex-1 rounded-lg border p-2"
            value={selected}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              terakhir.current = "";
              setNotice("");
              if (!v) return lepas();
              manualOff.current = false;
              setSelected(v);
            }}
          >
            <option value="">Tanpa promo</option>
            {tersedia.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
                {p.cakupan === "transaksi" ? " · voucher sekali/transaksi" : " · per item"}
              </option>
            ))}
          </select>
          {selected && !quote && !busy && (
            <button className="rounded-lg border px-3 py-1.5 text-xs font-semibold" disabled={disabled || !items.length} onClick={() => void terapkan(selected)}>
              Coba lagi
            </button>
          )}
        </div>
      )}
      {busy && selected && <p className="text-xs font-semibold text-matur-700">⏳ Menyesuaikan promo dengan keranjang…</p>}
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
      {!quote && !selected && !tersedia.length && list.length > 0 && !notice && (
        <p role="status" className="rounded-lg bg-stone-50 p-2 text-stone-700">
          Promo belum tersedia untuk keranjang ini atau sudah berakhir. Harga normal berlaku.
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
