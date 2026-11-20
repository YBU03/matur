"use client";

// Kotak promo yang sedang berlaku di layar kasir: hitung mundur slot jam + sisa kuota hari ini.
// Hanya tampil bila ada promo aktif & dalam jam/hari berlaku. Timer berjalan lokal; data kuota dimuat
// saat dibuka, setelah transaksi (prop segarkan), saat kembali ke layar, dan tiap 3 menit (5 menit bila kosong).
import { useEffect, useRef, useState } from "react";
import { daftarPromoKasir } from "@/lib/promo-actions";
import type { Promo } from "@/lib/promo";
import { alasanPromoNormal } from "@/lib/promo-ketersediaan";
import { hitungMundur, labelNilai, mulaiLagi } from "@/lib/promo-tampilan";

type Habis = { id: string; nama: string; lagi: string };

function Kuota({
  p,
  menuNames,
}: {
  p: Promo;
  menuNames: Record<string, string>;
}) {
  if (!p.kuota || !p.sisa_kuota) return null;
  const unit = p.cakupan === "transaksi" ? "transaksi" : "cup";
  const baris = Object.entries(p.sisa_kuota);
  return (
    <div className="space-y-1.5">
      {baris.map(([k, sisa]) => {
        const pakai = Math.min(
          100,
          Math.round(((p.kuota! - sisa) / p.kuota!) * 100),
        );
        const habis = sisa <= 0,
          tipis = !habis && sisa <= Math.ceil(p.kuota! * 0.2);
        return (
          <div key={k}>
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="truncate">
                {k === "semua" ? "Sisa kuota" : (menuNames[k] ?? "Menu")}
              </span>
              <span className={`tabular-nums ${habis ? "text-red-100" : ""}`}>
                {habis ? "Kuota habis" : `${sisa} / ${p.kuota} ${unit}`}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div
                className={`h-full rounded-full transition-all duration-700 ${habis ? "bg-red-300" : tipis ? "bg-amber-200" : "bg-emerald-200"}`}
                style={{ width: `${pakai}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KotakPromoKasir({
  segarkan,
  menuNames,
  onList,
}: {
  segarkan?: unknown;
  menuNames: Record<string, string>;
  onList?: (list: Promo[]) => void;
}) {
  const [list, setList] = useState<Promo[]>([]);
  const [habis, setHabis] = useState<Habis[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [buka, setBuka] = useState<string | null>(null);
  const cb = useRef(onList);
  cb.current = onList;
  const muatRef = useRef<() => void>(() => {});

  useEffect(() => {
    let hidup = true;
    const muat = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      daftarPromoKasir()
        .then((r) => {
          if (!hidup || r.error) return;
          const data = (r.data ?? []).filter((p) => p.berakhir_at);
          setList(data);
          cb.current?.(r.data ?? []);
        })
        .catch(() => {});
    };
    muatRef.current = muat;
    muat();
    const fokus = () => document.visibilityState === "visible" && muat();
    document.addEventListener("visibilitychange", fokus);
    return () => {
      hidup = false;
      document.removeEventListener("visibilitychange", fokus);
    };
  }, [segarkan]);

  // Segarkan berkala ringan: 3 menit saat ada promo tampil, 5 menit saat kosong.
  useEffect(() => {
    const t = setInterval(
      () => muatRef.current(),
      list.length ? 180_000 : 300_000,
    );
    return () => clearInterval(t);
  }, [list.length]);

  // Timer lokal per detik hanya bila ada kotak promo.
  useEffect(() => {
    if (!list.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [list.length]);

  // Slot berakhir → kotak hilang; tampilkan "mulai lagi" bila ada slot berikutnya hari ini.
  useEffect(() => {
    const selesai = list.filter((p) => Date.parse(p.berakhir_at!) <= now);
    if (!selesai.length) return;
    setList((l) => l.filter((p) => Date.parse(p.berakhir_at!) > now));
    setHabis((h) => [
      ...h.filter((x) => !selesai.some((p) => p.id === x.id)),
      ...selesai.flatMap((p) => {
        const lagi = mulaiLagi(p, now + 1000);
        return lagi ? [{ id: p.id, nama: p.nama, lagi }] : [];
      }),
    ]);
    const t = setTimeout(() => muatRef.current(), 2000);
    return () => clearTimeout(t);
  }, [now, list]);

  const tunggu = habis.filter((h) => !list.some((p) => p.id === h.id));
  if (!list.length && !tunggu.length) return null;
  return (
    <section aria-label="Promo berlangsung" className="space-y-2">
      <style>{`@keyframes promo-masuk{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}@keyframes promo-kilau{0%{transform:translateX(-120%)}100%{transform:translateX(220%)}}`}</style>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => {
          const normal = alasanPromoNormal(p, [], now) !== null;
          const sisaMs = Date.parse(p.berakhir_at!) - now;
          const kritis = sisaMs <= 10 * 60_000;
          const terbuka = buka === p.id;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => setBuka(terbuka ? null : p.id)}
              aria-expanded={terbuka}
              className={`relative overflow-hidden rounded-2xl p-3 text-left text-white shadow-md ring-1 transition [animation:promo-masuk_.35s_ease-out] ${kritis ? "bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 ring-red-300" : "bg-gradient-to-br from-matur-400 via-matur-500 to-orange-600 ring-matur-300"}`}
            >
              <span
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent [animation:promo-kilau_3.5s_ease-in-out_infinite]"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-white/10"
                aria-hidden
              />
              <div className="relative flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 text-xl backdrop-blur">
                  🏷️
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white/90">
                    {p.nama}
                  </p>
                  <p className="text-base font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-lg">
                    {normal ? "Harga normal berlaku" : labelNilai(p)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                    {kritis ? "Segera berakhir" : "Berakhir"}
                  </p>
                  <p
                    className={`font-mono text-base font-extrabold tabular-nums leading-tight sm:text-lg ${kritis ? "animate-pulse" : ""}`}
                  >
                    ⏱ {hitungMundur(sisaMs)}
                  </p>
                </div>
              </div>
              <div
                className={`relative mt-2 ${terbuka ? "" : "hidden sm:block"}`}
              >
                <Kuota p={p} menuNames={menuNames} />
                {terbuka && (
                  <p className="mt-1.5 text-[11px] text-white/85">
                    Sampai{" "}
                    {new Date(p.berakhir_at!).toLocaleTimeString("id-ID", {
                      timeZone: "Asia/Jakarta",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    WIB
                    {p.subsidi ? ` · ${p.nama_subsidi ?? "Subsidi"}` : ""}
                    {normal
                      ? " · kuota promo habis, lanjutkan penjualan dengan harga normal."
                      : " · pilih di panel keranjang lalu Terapkan."}
                  </p>
                )}
              </div>
              {!terbuka && p.kuota && p.sisa_kuota && (
                <p className="relative mt-1 text-[11px] font-semibold text-white/90 sm:hidden">
                  🎟{" "}
                  {Object.values(p.sisa_kuota).every((n) => n <= 0)
                    ? "Kuota habis"
                    : `Sisa ${Math.min(...Object.values(p.sisa_kuota))} / ${p.kuota}`}{" "}
                  · ketuk untuk detail
                </p>
              )}
            </button>
          );
        })}
        {tunggu.map((h) => (
          <div
            key={h.id}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-matur-300 bg-matur-50 p-3 text-sm text-kopi-800"
          >
            <span className="text-xl">⏳</span>
            <span className="min-w-0">
              <b className="block truncate">{h.nama}</b>Mulai lagi pukul{" "}
              {h.lagi} WIB
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
