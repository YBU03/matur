"use client";

// Komponen grafik dashboard. Warna kategori mengikuti urutan tetap yang sudah
// divalidasi (CVD-safe); warna mengikuti entitas (outlet), bukan peringkat.
// Slot 3–5 kontrasnya < 3:1, jadi setiap grafik punya label langsung atau tampilan tabel.

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import { SINGLE, angka, rupiah, ringkas } from "@/lib/chart-utils";

// gradasi beberapa warna (kuning → oranye → merah → ungu), makin gelap makin ramai
const HEAT = ["#fdf0b5", "#fcd34d", "#f8a33c", "#ef6c2f", "#d9412b", "#a8234a", "#5e1a63"];
const GRID = "#ece9e2";
const INK2 = "#57534e";

type Col = { key: string; label: string; money?: boolean };

/** Kartu grafik dengan judul dan tombol tampilan tabel (aksesibilitas). */
export function ChartCard({
  title,
  sub,
  rows,
  cols,
  children,
  className = "",
  toolbar,
  showEmptyContent = false,
}: {
  title: string;
  sub?: string;
  rows: Record<string, string | number>[];
  cols: Col[];
  children: React.ReactNode;
  className?: string;
  toolbar?: React.ReactNode;
  showEmptyContent?: boolean;
}) {
  const [table, setTable] = useState(false);
  return (
    <section className={`rounded-2xl border border-matur-200 bg-white p-4 ${className}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {sub && <p className="text-xs text-stone-500">{sub}</p>}
        </div>
        {rows.length > 0 && (
          <button onClick={() => setTable(!table)} className="rounded-lg border px-2 py-1 text-xs text-stone-600 hover:bg-stone-50">
            {table ? "Grafik" : "Tabel"}
          </button>
        )}
      </div>
      {toolbar}
      {rows.length === 0 && !showEmptyContent ? (
        <p className="py-12 text-center text-sm text-stone-400">Belum ada data pada periode ini.</p>
      ) : table && rows.length > 0 ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs text-stone-500">
              <tr>{cols.map((c) => <th key={c.key} className={`py-1 pr-3 ${c.money ? "text-right" : ""}`}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-stone-100">
                  {cols.map((c) => (
                    <td key={c.key} className={`py-1 pr-3 ${c.money ? "text-right tabular-nums" : ""}`}>
                      {c.money ? rupiah(Number(r[c.key] ?? 0)) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Tip({ active, payload, label, money = true, unit = "" }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-stone-800">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-stone-700">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} />
          {p.name}: <b className="tabular-nums">{money ? rupiah(p.value) : `${angka(p.value)}${unit}`}</b>
        </p>
      ))}
    </div>
  );
}

/** Tren omzet: satu garis per outlet. */
export function TrendChart({ data, series }: { data: Record<string, string | number>[]; series: { key: string; name: string; color: string }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK2 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
          <YAxis tickFormatter={ringkas} tick={{ fontSize: 11, fill: INK2 }} tickLine={false} axisLine={false} width={60} />
          <Tooltip content={<Tip />} cursor={{ stroke: "#a8a29e", strokeDasharray: "3 3" }} />
          {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Batang horizontal dengan label nilai langsung. */
export function BarList({
  data,
  money = true,
  unit = "",
  colors,
  max,
  height,
}: {
  data: { name: string; value: number }[];
  money?: boolean;
  unit?: string;
  colors?: string[];
  max?: number;
  height?: number;
}) {
  const h = height ?? Math.max(120, data.length * 34 + 16);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide domain={[0, max ?? "auto"]} />
          <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 12, fill: "#292524" }} tickLine={false} axisLine={false} />
          <Tooltip content={<Tip money={money} unit={unit} />} cursor={{ fill: "#f5f5f4" }} />
          <Bar dataKey="value" name={money ? "Omzet" : "Nilai"} radius={[0, 4, 4, 0]} fill={SINGLE} maxBarSize={24}>
            <LabelList dataKey="value" position="right" formatter={(v) => (money ? ringkas(Number(v)) : `${angka(Number(v))}${unit}`)} style={{ fontSize: 11, fill: INK2 }} />
            {colors && data.map((d, i) => <Cell key={d.name} fill={colors[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Batang berkelompok (mis. estimasi vs realisasi), maksimal beberapa seri, dengan legenda. */
export function GroupedBars({ data, series }: { data: Record<string, string | number>[]; series: { key: string; name: string; color: string }[] }) {
  return (
    <div style={{ height: Math.max(150, data.length * 56 + 40) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} barGap={2} barCategoryGap={10}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 12, fill: "#292524" }} tickLine={false} axisLine={false} />
          <Tooltip content={<Tip />} cursor={{ fill: "#f5f5f4" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[0, 4, 4, 0]} maxBarSize={18}>
              <LabelList dataKey={s.key} position="right" formatter={(v) => (Number(v) ? ringkas(Number(v)) : "")} style={{ fontSize: 11, fill: INK2 }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** urutan baris heatmap: Minggu dulu (isodow 7), lalu Senin–Sabtu */
const URUT_HARI: [number, string][] = [[7, "Min"], [1, "Sen"], [2, "Sel"], [3, "Rab"], [4, "Kam"], [5, "Jum"], [6, "Sab"]];

/** Heatmap jam ramai: hari (Minggu–Sabtu) × jam operasional 06.00–02.00 (lewat tengah malam), gradasi kuning→ungu.
 *  Jam 00–02 masuk baris hari operasional sebelumnya (dow dihitung di DB dengan tutup buku 03.00). */
export function Heatmap({ cells, buka = 6, tutup = 2, hari, scrollJam = false }: {
  cells: { dow: number; jam: number; trx: number }[]; buka?: number; tutup?: number;
  hari?: { dow: number; label: string; tanggal: string }[];
  scrollJam?: boolean;
}) {
  const [hover, setHover] = useState<string>("");
  const scroll = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ kiri: false, kanan: false });
  const panjang = ((tutup - buka + 24) % 24) + 1;
  const utama = Array.from({ length: panjang }, (_, i) => (buka + i) % 24);
  // jam di luar jam operasional tetap ditampilkan bila ada transaksi
  const luar = [...new Set(cells.filter((c) => c.trx > 0 && !utama.includes(c.jam)).map((c) => c.jam))].sort((a, b) => ((a - buka + 24) % 24) - ((b - buka + 24) % 24));
  const jamList = [...utama, ...luar].sort((a, b) => ((a - buka + 24) % 24) - ((b - buka + 24) % 24));
  useEffect(() => {
    const el = scroll.current;
    if (!scrollJam || !el) return;
    const update = () => setScrollPos({ kiri: el.scrollLeft > 1, kanan: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); el.removeEventListener("scroll", update); };
  }, [scrollJam, jamList.length, hari?.length]);
  const map = new Map(cells.map((c) => [`${c.dow}-${c.jam}`, c.trx]));
  const max = Math.max(1, ...cells.map((c) => c.trx));
  const color = (v: number) => (v ? HEAT[Math.min(HEAT.length - 1, Math.floor((v / max) * HEAT.length))] : "#f5f5f4");
  return (
    <div>
      {scrollJam && <div className="mb-2 flex items-center justify-end gap-2 text-xs text-stone-500">
        <span>Geser tabel untuk melihat jam</span>
        <button type="button" aria-label="Geser kolom jam ke kiri" disabled={!scrollPos.kiri} onClick={() => scroll.current?.scrollBy({ left: -240 })} className="rounded-lg border px-3 py-1 text-kopi-900 focus-visible:outline-2 disabled:opacity-30">←</button>
        <button type="button" aria-label="Geser kolom jam ke kanan" disabled={!scrollPos.kanan} onClick={() => scroll.current?.scrollBy({ left: 240 })} className="rounded-lg border px-3 py-1 text-kopi-900 focus-visible:outline-2 disabled:opacity-30">→</button>
      </div>}
      <div ref={scroll} className="overflow-x-auto pb-2" tabIndex={scrollJam ? 0 : undefined} role={scrollJam ? "region" : undefined} aria-label={scrollJam ? "Tabel jam operasional, dapat digeser kanan kiri" : undefined} style={scrollJam ? { touchAction: "pan-x pan-y" } : undefined}>
        <div className="grid min-w-[520px] gap-[2px]" style={{ gridTemplateColumns: `36px repeat(${jamList.length}, 1fr)` }}>
          <span />
          {jamList.map((j) => (
            <span key={j} className="text-center text-[10px] text-stone-500">{String(j).padStart(2, "0")}</span>
          ))}
          {(hari ?? URUT_HARI.map(([dow, label]) => ({ dow, label, tanggal: "" }))).map(({ dow, label: h, tanggal }) => (
            <Row key={dow} label={tanggal ? <><span className="block">{h}</span><span className="block text-[9px] text-stone-400">{tanggal}</span></> : h} sticky={scrollJam}>
              {jamList.map((j) => {
                const v = map.get(`${dow}-${j}`) ?? 0;
                return (
                  <span
                    key={j}
                    onMouseEnter={() => setHover(`${h}${tanggal ? ` ${tanggal}` : ""}${j < 3 ? " (malam)" : ""} ${String(j).padStart(2, "0")}.00–${String((j + 1) % 24).padStart(2, "0")}.00 · ${angka(v)} transaksi`)}
                    onMouseLeave={() => setHover("")}
                    title={`${h}${tanggal ? ` ${tanggal}` : ""} ${j}.00 · ${v} transaksi`}
                    tabIndex={0}
                    role="button"
                    onFocus={() => setHover(`${h} ${tanggal} ${String(j).padStart(2, "0")}.00 · ${angka(v)} transaksi`)}
                    onClick={() => setHover(`${h} ${tanggal} ${String(j).padStart(2, "0")}.00 · ${angka(v)} transaksi`)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHover(`${h} ${tanggal} ${String(j).padStart(2, "0")}.00 · ${angka(v)} transaksi`); } }}
                    className="h-6 rounded-[3px] hover:outline hover:outline-2 hover:outline-stone-800"
                    style={{ background: color(v) }}
                  />
                );
              })}
            </Row>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span className="min-h-4 font-medium text-stone-700">{hover || "Arahkan ke kotak untuk melihat jumlah transaksi"}</span>
        <span className="flex items-center gap-1">
          Sepi {HEAT.map((c) => <span key={c} className="inline-block h-3 w-4 rounded-sm" style={{ background: c }} />)} Ramai
        </span>
      </div>
    </div>
  );
}

function Row({ label, children, sticky = false }: { label: React.ReactNode; children: React.ReactNode; sticky?: boolean }) {
  return (
    <>
      <span className={`self-center text-xs text-stone-600 ${sticky ? "sticky left-0 z-10 bg-white" : ""}`}>{label}</span>
      {children}
    </>
  );
}

export function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-matur-200 bg-white p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-0.5 whitespace-nowrap text-base font-bold tabular-nums sm:text-xl ${tone === "warn" ? "text-red-700" : "text-stone-900"}`}>{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}
