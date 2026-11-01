"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/charts";
import type { IzinBaris } from "./persetujuan-view";

const JENIS = [
  { key: "izin", nama: "Izin", warna: "#7c3aed" },
  { key: "sakit", nama: "Sakit", warna: "#e11d48" },
  { key: "libur", nama: "Libur mingguan", warna: "#059669" },
] as const;

/** Pengajuan izin/sakit/libur per minggu (berdasarkan tanggal izin), 30 hari terakhir. */
export function GrafikIzin({ izin }: { izin: IzinBaris[] }) {
  const aktif = izin.filter((i) => i.status !== "dibatalkan" && i.status !== "ditolak");
  if (!aktif.length) return null;
  const senin = (t: string) => {
    const d = new Date(t.slice(0, 10) + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const map = new Map<string, { minggu: string; izin: number; sakit: number; libur: number }>();
  for (const i of aktif) {
    const k = senin(i.tanggal);
    if (!k) continue;
    const r = map.get(k) ?? { minggu: k, izin: 0, sakit: 0, libur: 0 };
    r[i.jenis] += 1;
    map.set(k, r);
  }
  const data = [...map.values()]
    .sort((a, b) => a.minggu.localeCompare(b.minggu))
    .map((r) => ({ ...r, label: new Date(r.minggu + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }) }));
  return (
    <ChartCard
      title="📊 Izin, sakit & libur per minggu"
      sub="Pengajuan yang menunggu/disetujui · dikelompokkan per minggu (mulai Senin)"
      rows={data.map((r) => ({ minggu: `Minggu ${r.label}`, izin: r.izin, sakit: r.sakit, libur: r.libur }))}
      cols={[{ key: "minggu", label: "Minggu" }, ...JENIS.map((j) => ({ key: j.key, label: j.nama }))]}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -25 }} accessibilityLayer>
            <CartesianGrid stroke="#ece9e2" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "#fafaf9" }} labelFormatter={(l) => `Minggu mulai ${l}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            {JENIS.map((j, i) => (
              <Bar key={j.key} dataKey={j.key} name={j.nama} stackId="a" fill={j.warna} radius={i === JENIS.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={36} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
