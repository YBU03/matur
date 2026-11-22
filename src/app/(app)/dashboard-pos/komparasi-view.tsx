"use client";

// Tampilan Komparasi: papan skor A vs B, kesimpulan otomatis, tren, kanal, jam ramai & sepi, menu & kategori.
import type { ReactNode } from "react";
import { GroupedBars, TrendChart } from "@/components/charts";
import type { Ringkasan } from "../dashboard/sales";
import { URUT_JAM, gabungNama, kesimpulan, labelJam, menuSama, metrik, perJam, porsi, ramaiSepi, selisihPersen, trenGabung, type Sisi } from "@/lib/komparasi";

const A = "#eb6834", B = "#2a78d6";
const KANAL: Record<string, string> = { langsung: "Langsung", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood", tiktok: "TikTok Go", ruma_app: "Ruma App", tumbler: "Tumbler" };
const rp = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n));
const angka = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
type SisiLabel = { judul: string; sub: string };

function Kartu({ ikon, judul, sub, children }: { ikon: string; judul: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-matur-50 text-lg">{ikon}</span>
        <div><h3 className="font-bold text-kopi-900">{judul}</h3>{sub && <p className="text-xs text-stone-500">{sub}</p>}</div>
      </div>
      {children}
    </section>
  );
}

function Tumbuh({ now, prev }: { now: number; prev: number }) {
  const s = prev ? Math.round(((now - prev) / prev) * 100) : null;
  if (s === null) return null;
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${s >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{s >= 0 ? "▲" : "▼"} {Math.abs(s)}%</span>;
}

function BarisSkor({ label, a, b, pa, pb, fmt, trofi = true }: { label: string; a: number; b: number; pa: number; pb: number; fmt: (n: number) => string; trofi?: boolean }) {
  const p = porsi(a, b), s = selisihPersen(a, b);
  const menang = !trofi || a === b ? null : a > b ? "a" : "b";
  return (
    <div className="py-3">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-stone-500">
        <span className="flex items-center gap-1">{menang === "a" && "🏆"} <Tumbuh now={a} prev={pa} /></span>
        <span className="text-center uppercase tracking-wide">{label}</span>
        <span className="flex items-center gap-1"><Tumbuh now={b} prev={pb} /> {menang === "b" && "🏆"}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`min-w-0 truncate text-base font-extrabold tabular-nums sm:text-lg ${menang === "a" ? "text-[#c94f1f]" : "text-kopi-900"}`}>{fmt(a)}</span>
        <span className={`min-w-0 truncate text-right text-base font-extrabold tabular-nums sm:text-lg ${menang === "b" ? "text-[#1d5fae]" : "text-kopi-900"}`}>{fmt(b)}</span>
      </div>
      <div className="relative mt-1.5 h-3 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`${label}: ${p}% vs ${100 - p}%`}>
        <div className="absolute inset-y-0 left-0 rounded-l-full transition-all duration-700" style={{ width: `${p}%`, background: `linear-gradient(90deg, ${A}, #f59e6b)` }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full transition-all duration-700" style={{ width: `${100 - p}%`, background: `linear-gradient(90deg, #7fb2ec, ${B})` }} />
        <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${p}%` }} />
      </div>
      <p className="mt-1 text-center text-[11px] text-stone-400">{s === null ? "—" : s === 0 ? "seimbang" : `selisih ${Math.abs(s)}% · porsi ${p}% : ${100 - p}%`}</p>
    </div>
  );
}

function DaftarMenu({ judul, warna, rows, sama, nilai }: { judul: string; warna: string; rows: { nama: string; v: number }[]; sama?: Set<string>; nilai: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="min-w-0 rounded-xl border border-stone-100 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: warna }}><span className="size-2.5 rounded-full" style={{ background: warna }} />{judul}</p>
      {rows.length ? (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.nama} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate"><b className="mr-1.5 tabular-nums text-stone-400">{i + 1}</b>{r.nama}{sama?.has(r.nama) && <span className="ml-1 text-[10px]" title="Sama-sama laris di kedua sisi">⭐</span>}</span>
                <span className="shrink-0 font-semibold tabular-nums">{nilai(r.v)}</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full" style={{ width: `${(r.v / max) * 100}%`, background: warna, opacity: 0.75 }} /></div>
            </li>
          ))}
        </ol>
      ) : <p className="text-xs text-stone-400">Belum ada data.</p>}
    </div>
  );
}

export function KomparasiView({ jenis, sisiA, sisiB, dA, dB, prevA, prevB, rA, rB, error, simulasi }: {
  jenis: "outlet" | "periode";
  sisiA: SisiLabel; sisiB: SisiLabel;
  dA: Ringkasan | null; dB: Ringkasan | null; prevA: Ringkasan | null; prevB: Ringkasan | null;
  rA: { dari: string; sampai: string; hari: number }; rB: { dari: string; sampai: string; hari: number };
  error: boolean; simulasi: boolean;
}) {
  const a: Sisi = metrik(dA), b: Sisi = metrik(dB), pa = metrik(prevA), pb = metrik(prevB);
  const nA = sisiA.judul, nB = sisiB.judul;
  const series = [{ key: "a", name: nA, color: A }, { key: "b", name: nB, color: B }];
  const tren = trenGabung(dA?.harian, dB?.harian, rA, rB, jenis === "periode");
  const kanal = gabungNama(dA?.kanal, dB?.kanal, (x) => KANAL[x.kanal] ?? x.kanal);
  const kategori = gabungNama(dA?.kategori, dB?.kategori, (x) => x.nama);
  const jamA = perJam(dA?.jam), jamB = perJam(dB?.jam);
  const rsA = ramaiSepi(jamA), rsB = ramaiSepi(jamB);
  const maxJam = Math.max(1, ...URUT_JAM.map((h) => Math.max(jamA[h], jamB[h])));
  const sama = menuSama(dA?.menu, dB?.menu);
  const qty = (d: Ringkasan | null) => [...(d?.menu ?? [])].sort((x, y) => Number(y.qty) - Number(x.qty));
  const top = (d: Ringkasan | null, by: "qty" | "omzet") => [...(d?.menu ?? [])].sort((x, y) => Number(y[by]) - Number(x[by])).slice(0, 10).map((m) => ({ nama: m.nama, v: Number(m[by]) }));
  const bawah = (d: Ringkasan | null) => qty(d).slice(-5).reverse().map((m) => ({ nama: m.nama, v: Number(m.qty) }));
  const poin = kesimpulan(a, b, nA, nB);
  const pemenang = a.omzet === b.omzet ? null : a.omzet > b.omzet ? "a" : "b";

  return (
    <div className="space-y-4">
      {simulasi && <div className="rounded-xl bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-900">MODE SIMULASI — data latihan</div>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Sebagian data belum dapat dimuat. Coba muat ulang.</p>}

      {/* Hero VS */}
      <section className="relative grid gap-3 sm:grid-cols-2">
        {([["a", sisiA, a, A, "from-[#f59e6b] via-[#eb6834] to-[#c94f1f]"], ["b", sisiB, b, B, "from-[#7fb2ec] via-[#2a78d6] to-[#1d5fae]"]] as const).map(([k, s, m, , grad]) => (
          <div key={k} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${grad} p-5 text-white shadow-md ${k === "b" ? "sm:text-right" : ""}`}>
            <span className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-white/10" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">{k === "a" ? "A" : "B"} {pemenang === k && "· 🏆 unggul omzet"}</p>
            <p className="mt-1 text-xl font-extrabold leading-tight [overflow-wrap:anywhere] sm:text-2xl">{s.judul}</p>
            <p className="text-xs text-white/85">{s.sub}</p>
            <p className="mt-3 text-3xl font-black tabular-nums tracking-tight">{rp(m.omzet)}</p>
            <p className="text-xs text-white/85">{angka(m.trx)} struk · rata-rata {rp(m.rataStruk)}</p>
          </div>
        ))}
        <span className="absolute left-1/2 top-1/2 hidden size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-kopi-900 text-lg font-black italic text-white shadow-lg sm:grid">VS</span>
      </section>

      {/* Kesimpulan */}
      <section className="rounded-2xl border border-matur-100 bg-gradient-to-r from-matur-50 via-white to-sky-50 p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-matur-700">💡 Kesimpulan otomatis</p>
        <ul className="space-y-1 text-sm text-kopi-900">{poin.map((x) => <li key={x} className="flex gap-2"><span>•</span><span>{x}</span></li>)}</ul>
        {(rsA.ramai !== null || rsB.ramai !== null) && <p className="mt-2 text-xs text-stone-600">⏰ Jam tersibuk — {nA}: <b>{labelJam(rsA.ramai)}</b> · {nB}: <b>{labelJam(rsB.ramai)}</b></p>}
      </section>

      {/* Papan skor */}
      <Kartu ikon="🧮" judul="Ringkasan periode" sub={`A: ${nA} · B: ${nB}. Persentase kecil = pertumbuhan dibanding periode sebelumnya.`}>
        <div className="mb-1 flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-1.5" style={{ color: A }}><span className="size-2.5 rounded-full" style={{ background: A }} />{nA}</span>
          <span className="flex items-center gap-1.5" style={{ color: B }}>{nB}<span className="size-2.5 rounded-full" style={{ background: B }} /></span>
        </div>
        <div className="divide-y divide-stone-100">
          <BarisSkor label="Omzet" a={a.omzet} b={b.omzet} pa={pa.omzet} pb={pb.omzet} fmt={rp} />
          <BarisSkor label="Jumlah struk" a={a.trx} b={b.trx} pa={pa.trx} pb={pb.trx} fmt={angka} />
          <BarisSkor label="Rata-rata per struk" a={a.rataStruk} b={b.rataStruk} pa={pa.rataStruk} pb={pb.rataStruk} fmt={rp} />
          <BarisSkor label="Item terjual" a={a.item} b={b.item} pa={pa.item} pb={pb.item} fmt={angka} />
          <BarisSkor label="Laba kotor (omzet − HPP)" a={a.labaKotor} b={b.labaKotor} pa={pa.labaKotor} pb={pb.labaKotor} fmt={rp} />
          <BarisSkor label="Diskon & promo" a={a.diskon} b={b.diskon} pa={pa.diskon} pb={pb.diskon} fmt={rp} trofi={false} />
        </div>
      </Kartu>

      <Kartu ikon="📈" judul="Tren penjualan" sub={jenis === "periode" ? "Disejajarkan per hari ke-n dari awal masing-masing periode" : "Omzet per hari"}>
        <TrendChart data={tren} series={series} />
      </Kartu>

      <div className="grid gap-4 lg:grid-cols-2">
        <Kartu ikon="🛵" judul="Kanal penjualan" sub="Omzet per kanal">{kanal.length ? <GroupedBars data={kanal} series={series} /> : <p className="text-sm text-stone-400">Belum ada data.</p>}</Kartu>
        <Kartu ikon="🗂️" judul="Kategori" sub="Omzet per kategori menu">{kategori.length ? <GroupedBars data={kategori.slice(0, 8)} series={series} /> : <p className="text-sm text-stone-400">Belum ada data.</p>}</Kartu>
      </div>

      {/* Jam ramai & sepi */}
      <Kartu ikon="⏰" judul="Jam ramai & sepi" sub="Jumlah struk per jam (06.00 – 02.00)">
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {([[nA, rsA, A], [nB, rsB, B]] as const).map(([n, rs, w]) => (
            <div key={n} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-100 px-3 py-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 font-bold" style={{ color: w }}><span className="size-2.5 shrink-0 rounded-full" style={{ background: w }} /><span className="truncate">{n}</span></span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">🔥 Ramai {labelJam(rs.ramai)}</span>
              <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">🌙 Sepi {labelJam(rs.sepi)}</span>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex h-44 min-w-[620px] items-end gap-1">
            {URUT_JAM.map((h) => (
              <div key={h} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-36 w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t-md transition-all duration-700" title={`${nA} ${labelJam(h)}: ${jamA[h]} struk`} style={{ height: `${(jamA[h] / maxJam) * 100}%`, minHeight: jamA[h] ? 3 : 0, background: A }} />
                  <div className="w-1/2 rounded-t-md transition-all duration-700" title={`${nB} ${labelJam(h)}: ${jamB[h]} struk`} style={{ height: `${(jamB[h] / maxJam) * 100}%`, minHeight: jamB[h] ? 3 : 0, background: B }} />
                </div>
                <span className={`text-[10px] tabular-nums ${h === rsA.ramai || h === rsB.ramai ? "font-bold text-kopi-900" : "text-stone-400"}`}>{String(h).padStart(2, "0")}</span>
              </div>
            ))}
          </div>
        </div>
      </Kartu>

      <Kartu ikon="🏆" judul="Menu terlaris (jumlah)" sub="10 teratas · ⭐ = sama-sama laris di kedua sisi">
        <div className="grid gap-3 md:grid-cols-2"><DaftarMenu judul={nA} warna={A} rows={top(dA, "qty")} sama={sama} nilai={angka} /><DaftarMenu judul={nB} warna={B} rows={top(dB, "qty")} sama={sama} nilai={angka} /></div>
      </Kartu>
      <Kartu ikon="💰" judul="Menu teratas (Rp)" sub="10 teratas berdasarkan omzet">
        <div className="grid gap-3 md:grid-cols-2"><DaftarMenu judul={nA} warna={A} rows={top(dA, "omzet")} nilai={rp} /><DaftarMenu judul={nB} warna={B} rows={top(dB, "omzet")} nilai={rp} /></div>
      </Kartu>
      <Kartu ikon="🐢" judul="Menu kurang laku" sub="5 terbawah berdasarkan jumlah terjual">
        <div className="grid gap-3 md:grid-cols-2"><DaftarMenu judul={nA} warna={A} rows={bawah(dA)} nilai={angka} /><DaftarMenu judul={nB} warna={B} rows={bawah(dB)} nilai={angka} /></div>
      </Kartu>
    </div>
  );
}
