"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarList, ChartCard } from "@/components/charts";
import type { BarisRekap, RingkasStaf } from "@/lib/jadwal/rekap";

const SERI = [
  { key: "tepat", nama: "Tepat waktu", warna: "#047857" },
  { key: "telat", nama: "Telat", warna: "#d97706" },
  { key: "tidak", nama: "Tidak absen", warna: "#be123c" },
  { key: "izin", nama: "Izin/sakit/libur", warna: "#7c3aed" },
] as const;

const labelTgl = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });

/** Grafik rekap absensi untuk periode terpilih (dihitung dari data yang sudah dimuat halaman). */
export function GrafikAbsensi({ baris, ringkas, nama }: { baris: BarisRekap[]; ringkas: RingkasStaf[]; nama: Record<string, string> }) {
  const perTgl = new Map<string, { tanggal: string; tepat: number; telat: number; tidak: number; izin: number }>();
  for (const b of baris) {
    const r = perTgl.get(b.tanggal) ?? { tanggal: b.tanggal, tepat: 0, telat: 0, tidak: 0, izin: 0 };
    if (b.status === "tepat" || b.status === "tanpa_jadwal") r.tepat++;
    else if (b.status === "telat") r.telat++;
    else if (b.status === "tidak_absen") r.tidak++;
    else if (b.status === "izin" || b.status === "sakit" || b.status === "libur") r.izin++;
    perTgl.set(b.tanggal, r);
  }
  const harian = [...perTgl.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map((r) => ({ ...r, label: labelTgl(r.tanggal) }));
  const total = harian.reduce((t, r) => ({ tepat: t.tepat + r.tepat, telat: t.telat + r.telat, tidak: t.tidak + r.tidak, izin: t.izin + r.izin }), { tepat: 0, telat: 0, tidak: 0, izin: 0 });
  const donut = SERI.map((s) => ({ nama: s.nama, jumlah: total[s.key], warna: s.warna })).filter((x) => x.jumlah > 0);
  const semua = donut.reduce((t, x) => t + x.jumlah, 0);
  const telatTop = ringkas
    .filter((r) => r.menitTelat > 0)
    .sort((a, b) => b.menitTelat - a.menitTelat)
    .slice(0, 8)
    .map((r) => ({ name: (nama[r.pengguna_id] ?? "Staf").split(" ").slice(0, 2).join(" "), value: r.menitTelat }));
  const jamKerja = ringkas
    .filter((r) => r.menitKerja > 0)
    .sort((a, b) => b.menitKerja - a.menitKerja)
    .slice(0, 8)
    .map((r) => ({ name: (nama[r.pengguna_id] ?? "Staf").split(" ").slice(0, 2).join(" "), value: Math.round(r.menitKerja / 6) / 10 }));

  if (!harian.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard
        title="Kehadiran harian"
        sub="Jumlah orang per status setiap hari"
        className="lg:col-span-2"
        rows={harian.map((r) => ({ label: r.label, tepat: r.tepat, telat: r.telat, tidak: r.tidak, izin: r.izin }))}
        cols={[{ key: "label", label: "Tanggal" }, ...SERI.map((s) => ({ key: s.key, label: s.nama }))]}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={harian} margin={{ top: 10, right: 10, bottom: 0, left: -25 }} accessibilityLayer>
              <CartesianGrid stroke="#ece9e2" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#fafaf9" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              {SERI.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.nama} stackId="a" fill={s.warna} radius={i === SERI.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={28} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <ChartCard title="Komposisi periode" sub={`${semua} catatan kehadiran`} rows={donut.map((x) => ({ nama: x.nama, jumlah: x.jumlah }))} cols={[{ key: "nama", label: "Status" }, { key: "jumlah", label: "Jumlah" }]}>
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer>
              <Pie data={donut} dataKey="jumlah" nameKey="nama" innerRadius={55} outerRadius={80} paddingAngle={3} stroke="none" isAnimationActive={false}>
                {donut.map((x) => (
                  <Cell key={x.nama} fill={x.warna} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-2xl">{semua ? Math.round(((total.tepat + total.telat) / semua) * 100) : 0}%</b>
            <span className="text-xs text-stone-500">hadir</span>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-1.5 text-xs">
          {donut.map((x) => (
            <li key={x.nama} className="flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: x.warna }} />
              <span className="flex-1 text-stone-600">{x.nama}</span>
              <b>{x.jumlah}</b>
            </li>
          ))}
        </ul>
      </ChartCard>
      <ChartCard title="Menit telat terbanyak" sub="Total menit telat per staf di periode ini" rows={telatTop.map((x) => ({ nama: x.name, menit: x.value }))} cols={[{ key: "nama", label: "Staf" }, { key: "menit", label: "Menit" }]}>
        {telatTop.length ? <BarList data={telatTop} money={false} unit=" mnt" colors={telatTop.map(() => "#d97706")} /> : <p className="rounded-xl bg-emerald-50 p-6 text-center text-sm text-emerald-800">🎉 Tidak ada yang telat.</p>}
      </ChartCard>
      <ChartCard title="Jam kerja per staf" sub="Total jam kerja tercatat (8 teratas)" className="lg:col-span-2" rows={jamKerja.map((x) => ({ nama: x.name, jam: x.value }))} cols={[{ key: "nama", label: "Staf" }, { key: "jam", label: "Jam" }]}>
        {jamKerja.length ? <BarList data={jamKerja} money={false} unit=" jam" colors={jamKerja.map(() => "#0f766e")} /> : <p className="rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500">Belum ada jam kerja tercatat.</p>}
      </ChartCard>
    </div>
  );
}
