"use client";

// Komponen grafik dashboard. Warna kategori mengikuti urutan tetap yang sudah
// divalidasi (CVD-safe); warna mengikuti entitas (outlet), bukan peringkat.
// Slot 3–5 kontrasnya < 3:1, jadi setiap grafik punya label langsung atau tampilan tabel.

import { useState } from "react";
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

const HEAT = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
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
}: {
  title: string;
  sub?: string;
  rows: Record<string, string | number>[];
  cols: Col[];
  children: React.ReactNode;
  className?: string;
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
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-400">Belum ada data pada periode ini.</p>
      ) : table ? (
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
          <YAxis tickFormatter={ringkas} tick={{ fontSize: 11, fill: INK2 }} tickLine={false} axisLine={false} width={48} />
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

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Heatmap jam ramai: hari × jam, satu warna (biru) terang→gelap. */
export function Heatmap({ cells }: { cells: { dow: number; jam: number; trx: number }[] }) {
  const [hover, setHover] = useState<string>("");
  const jamList = Array.from({ length: 16 }, (_, i) => i + 7); // 07–22
  const map = new Map(cells.map((c) => [`${c.dow}-${c.jam}`, c.trx]));
  const max = Math.max(1, ...cells.map((c) => c.trx));
  const color = (v: number) => (v ? HEAT[Math.min(HEAT.length - 1, Math.floor((v / max) * HEAT.length))] : "#f5f5f4");
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[520px] gap-[2px]" style={{ gridTemplateColumns: `36px repeat(${jamList.length}, 1fr)` }}>
          <span />
          {jamList.map((j) => (
            <span key={j} className="text-center text-[10px] text-stone-500">{j % 2 ? "" : String(j).padStart(2, "0")}</span>
          ))}
          {HARI.map((h, di) => (
            <Row key={h} label={h}>
              {jamList.map((j) => {
                const v = map.get(`${di + 1}-${j}`) ?? 0;
                return (
                  <span
                    key={j}
                    onMouseEnter={() => setHover(`${h} ${String(j).padStart(2, "0")}.00–${String(j + 1).padStart(2, "0")}.00 · ${angka(v)} transaksi`)}
                    onMouseLeave={() => setHover("")}
                    title={`${h} ${j}.00 · ${v} transaksi`}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="self-center text-xs text-stone-600">{label}</span>
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
