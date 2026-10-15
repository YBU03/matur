"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Users, UserCheck, Clock3, CalendarDays, ArrowUpRight, BellRing, Building2, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartCard } from "@/components/charts";
import type { RingkasanHrd } from "@/lib/hrd-dashboard";
import { LABEL_STATUS, type StatusHari } from "@/lib/jadwal/rekap";

export type StaffHrd = { key: string; nama: string; outlet: string; shift: string; mulai: string; selesai: string; status: StatusHari; masuk: string | null; pulang: string | null; telat: number };
export type HrdProps = { outlets: { id: string; nama: string }[]; selected: string; days: number; today: string; summary: RingkasanHrd; trend: (RingkasanHrd & { tanggal: string })[]; comparison: (RingkasanHrd & { nama: string })[]; staff: StaffHrd[]; actions: { izin: number; tukar: number; draft: number } };
const warna: Record<StatusHari, string> = { tepat: "bg-emerald-50 text-emerald-800", telat: "bg-amber-50 text-amber-900", tanpa_jadwal: "bg-sky-50 text-sky-800", belum: "bg-stone-100 text-stone-600", tidak_absen: "bg-rose-50 text-rose-800", izin: "bg-violet-50 text-violet-800", sakit: "bg-violet-50 text-violet-800", libur: "bg-slate-100 text-slate-700" };
const jam = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : "—";
const tanggal = (d: string) => new Date(d + "T00:00:00+07:00").toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });

export function HrdVisual(p: HrdProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("semua");
  const filter = (key: string, value: string) => { const q = new URLSearchParams(params.toString()); if (value) q.set(key, value); else q.delete(key); start(() => router.push(`/dashboard?${q.toString()}`, { scroll: false })); };
  const cakupan = p.outlets.find((o) => o.id === p.selected)?.nama ?? "Semua Outlet";
  const s = p.summary;
  const donut = [
    { nama: "Tepat waktu", jumlah: s.tepat, warna: "#047857" }, { nama: "Telat", jumlah: s.telat, warna: "#b45309" },
    { nama: "Belum absen", jumlah: s.belum, warna: "#94a3b8" }, { nama: "Tidak absen", jumlah: s.tidak, warna: "#be123c" },
    { nama: "Izin / sakit", jumlah: s.izin + s.sakit, warna: "#7c3aed" }, { nama: "Libur", jumlah: s.libur, warna: "#475569" },
    { nama: "Tanpa jadwal", jumlah: s.tanpaJadwal, warna: "#0369a1" },
  ].filter((x) => x.jumlah > 0);
  const trend = p.trend.map((x) => ({ ...x, label: tanggal(x.tanggal) }));
  const compare = p.comparison.filter((x) => x.tercatat > 0);
  const filtered = p.staff.filter((x) => (status === "semua" || x.status === status) && `${x.nama} ${x.outlet} ${x.shift}`.toLocaleLowerCase("id").includes(search.toLocaleLowerCase("id")));
  const shifts = [...new Set(filtered.map((x) => `${x.outlet}|${x.shift}|${x.mulai}|${x.selesai}`))];
  const link = (path: string) => p.selected ? `${path}?outlet=${encodeURIComponent(p.selected)}` : path;
  const cards = [
    { label: "Terjadwal hari ini", value: s.terjadwal, hint: "Staf pada jadwal terbit", icon: CalendarDays, tone: "bg-sky-50 text-sky-700" },
    { label: "Sudah hadir", value: s.hadir, hint: s.persen === null ? "Belum ada jadwal terbit" : `${s.persen}% staf terjadwal sudah hadir`, icon: Users, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Tepat waktu", value: s.tepat, hint: "Sesuai toleransi kehadiran", icon: UserCheck, tone: "bg-teal-50 text-teal-700" },
    { label: "Datang terlambat", value: s.telat, hint: "Lihat nama & menit telat di bawah", icon: Clock3, tone: "bg-amber-50 text-amber-800" },
    { label: "Belum absen", value: s.belum, hint: "Termasuk shift yang belum mulai", icon: Clock3, tone: "bg-slate-100 text-slate-600" },
  ];
  return <div className="space-y-6" aria-busy={pending}>
    <section className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-matur-700">People & Kehadiran</p><h2 className="text-2xl font-bold tracking-tight">Overview HRD</h2><p className="mt-1 text-sm text-stone-500">{cakupan} · {new Date(p.today + "T00:00:00+07:00").toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <label className="min-w-48 flex-1 text-xs font-semibold text-stone-600">Outlet<select aria-label="Pilih outlet HRD" disabled={pending} value={p.selected} onChange={(e) => filter("hrd_outlet", e.target.value)} className="mt-1 block w-full rounded-xl border bg-stone-50 px-3 py-2.5 text-sm text-stone-900"><option value="">Semua Outlet</option>{p.outlets.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}</select></label>
        <label className="text-xs font-semibold text-stone-600">Periode tren<select aria-label="Periode tren HRD" disabled={pending} value={String(p.days)} onChange={(e) => filter("hrd_periode", e.target.value)} className="mt-1 block rounded-xl border bg-stone-50 px-3 py-2.5 text-sm text-stone-900"><option value="7">7 hari terakhir</option><option value="30">30 hari terakhir</option></select></label>
      </div>
      <p className="w-full text-xs text-stone-500">{pending ? "Memuat data outlet…" : "Ringkasan & jadwal: hari ini · Grafik tren: periode pilihan · Semua waktu WIB"}</p>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map((c) => <section key={c.label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between gap-2"><p className="text-xs font-semibold text-stone-500">{c.label}</p><span className={`rounded-xl p-2 ${c.tone}`}><c.icon size={18} aria-hidden /></span></div><p className="text-3xl font-bold tracking-tight">{c.value}<span className="ml-1 text-xs font-normal text-stone-400">orang</span></p><p className="mt-2 text-xs text-stone-500">{c.hint}</p></section>)}</div>

    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="Komposisi kehadiran hari ini" sub={`${s.tercatat} staf tercatat · ${cakupan}`} rows={donut} cols={[{ key: "nama", label: "Status" }, { key: "jumlah", label: "Orang" }]}>
        <div className="relative h-56"><ResponsiveContainer width="100%" height="100%"><PieChart accessibilityLayer><Pie data={donut} dataKey="jumlah" nameKey="nama" innerRadius={65} outerRadius={90} paddingAngle={3} stroke="none" isAnimationActive={false}>{donut.map((x) => <Cell key={x.nama} fill={x.warna} />)}</Pie><Tooltip formatter={(v) => `${v} orang`} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="text-3xl">{s.hadir}</b><span className="text-xs text-stone-500">sudah hadir</span></div></div>
        <ul className="grid grid-cols-2 gap-2 text-xs">{donut.map((x) => <li key={x.nama} className="flex items-center gap-1.5"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: x.warna }} /><span className="flex-1 text-stone-600">{x.nama}</span><b>{x.jumlah}</b><span className="text-stone-400">({Math.round(x.jumlah / s.tercatat * 100)}%)</span></li>)}</ul>
      </ChartCard>
      <ChartCard title="Tren kehadiran" sub={`${p.days} hari terakhir · angka dihitung per orang per hari`} className="lg:col-span-2" rows={p.trend.some((x) => x.tercatat) ? trend.map((x) => ({ label: x.label, hadir: x.hadir, telat: x.telat, tidak: x.tidak })) : []} cols={[{ key: "label", label: "Tanggal" }, { key: "hadir", label: "Hadir" }, { key: "telat", label: "Telat" }, { key: "tidak", label: "Tidak absen" }]}>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 15, right: 15, bottom: 5, left: -25 }} accessibilityLayer><CartesianGrid stroke="#ece9e2" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={25} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="hadir" name="Hadir" stroke="#047857" strokeWidth={3} dot={p.days === 7} isAnimationActive={false} /><Line type="monotone" dataKey="telat" name="Telat" stroke="#b45309" strokeWidth={2} strokeDasharray="5 3" dot={p.days === 7} isAnimationActive={false} /><Line type="monotone" dataKey="tidak" name="Tidak absen" stroke="#be123c" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
        <div className="flex flex-wrap gap-4 text-xs"><span className="font-semibold text-emerald-800">● Hadir</span><span className="font-semibold text-amber-800">┄ Telat (bagian dari hadir)</span><span className="font-semibold text-rose-800">● Tidak absen</span></div>
      </ChartCard>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="Kehadiran per outlet" sub="Hari ini · tepat waktu dan telat dihitung terpisah" className="lg:col-span-2" rows={compare.map((x) => ({ nama: x.nama, tepat: x.tepat, telat: x.telat, belum: x.belum, tidak: x.tidak }))} cols={[{ key: "nama", label: "Outlet" }, { key: "tepat", label: "Tepat" }, { key: "telat", label: "Telat" }, { key: "belum", label: "Belum absen" }, { key: "tidak", label: "Tidak absen" }]}>
        <div style={{ height: Math.max(180, compare.length * 65 + 50) }}><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={compare} margin={{ left: 0, right: 20 }} accessibilityLayer><CartesianGrid stroke="#ece9e2" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="nama" width={145} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#fafaf9" }} /><Bar dataKey="tepat" name="Tepat waktu" stackId="a" fill="#047857" isAnimationActive={false} /><Bar dataKey="telat" name="Telat" stackId="a" fill="#b45309" isAnimationActive={false} /><Bar dataKey="belum" name="Belum absen" stackId="a" fill="#94a3b8" isAnimationActive={false} /><Bar dataKey="tidak" name="Tidak absen" stackId="a" fill="#be123c" isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
        <p className="text-xs text-stone-500">Hijau: tepat waktu · Cokelat: telat · Abu-abu: belum absen · Merah: tidak absen. Izin/libur tersedia di komposisi dan jadwal.</p>
      </ChartCard>
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-2 flex items-center gap-2"><BellRing size={18} className="text-matur-700" /><h3 className="font-semibold">Perlu tindakan</h3></div><p className="mb-4 text-xs text-stone-500">{cakupan} · pengajuan menunggu saat ini</p>{[{ n: p.actions.izin, label: "Izin / sakit / libur", path: "/persetujuan" }, { n: p.actions.tukar, label: "Persetujuan tukar shift", path: "/persetujuan" }, { n: p.actions.draft, label: "Jadwal draft · 45 hari ke depan", path: "/jadwal" }].map((a) => <Link key={a.label} href={link(a.path)} className="mb-2 flex items-center gap-3 rounded-xl bg-stone-50 p-3 hover:bg-matur-50"><span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${a.n ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-500"}`}>{a.n}</span><span className="flex-1 text-xs font-medium">{a.label}</span><ArrowUpRight size={15} /></Link>)}{!p.actions.izin && !p.actions.tukar && !p.actions.draft && <p className="mt-3 flex gap-2 text-xs text-emerald-800"><CheckCircle2 size={15} />Semua pengajuan sudah ditangani.</p>}</section>
    </div>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Jadwal & staf hari ini</h3><p className="mt-1 text-xs text-stone-500">Dikelompokkan per outlet dan shift · {cakupan}</p></div><Link href={link("/absensi")} className="flex items-center gap-1 text-sm font-semibold text-matur-700">Buka rekap <ArrowUpRight size={15} /></Link></div>
      <div className="mb-4 flex flex-wrap gap-2"><input aria-label="Cari staf atau shift" placeholder="Cari nama staf atau shift…" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-48 flex-1 rounded-xl border px-3 py-2 text-sm" /><select aria-label="Filter status staf" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="semua">Semua status</option>{Object.entries(LABEL_STATUS).map(([key, label]) => <option key={key} value={key}>{key === "belum" ? "Belum absen" : label}</option>)}</select></div>
      {!filtered.length && <p className="rounded-xl bg-stone-50 p-8 text-center text-sm text-stone-500">{p.staff.length ? "Tidak ada staf sesuai pencarian atau status ini." : "Belum ada jadwal terbit, absensi, atau izin untuk hari ini."}</p>}
      <div className="grid items-start gap-4 xl:grid-cols-2">{shifts.map((key) => { const rows = filtered.filter((x) => `${x.outlet}|${x.shift}|${x.mulai}|${x.selesai}` === key); const x = rows[0]; return <section key={key} className="overflow-hidden rounded-xl border"><div className="border-b bg-stone-50 p-3"><p className="flex items-center gap-1.5 text-xs text-stone-500"><Building2 size={13} />{x.outlet}</p><p className="mt-1 font-semibold">{x.shift} <span className="text-xs font-normal text-stone-500">{x.mulai && `${x.mulai}–${x.selesai}`}</span></p></div><ul className="divide-y">{rows.map((r) => <li key={r.key} className="flex flex-wrap items-center gap-3 p-3"><span className="flex size-9 items-center justify-center rounded-full bg-matur-100 text-xs font-bold text-kopi-700" aria-hidden>{r.nama.split(" ").slice(0,2).map((n) => n[0]).join("")}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{r.nama}</p><p className="mt-0.5 text-xs text-stone-500">Masuk {jam(r.masuk)} · Pulang {jam(r.pulang)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${warna[r.status]}`}>{r.status === "belum" ? "Belum absen" : LABEL_STATUS[r.status]}{r.status === "telat" && ` · ${r.telat} mnt`}</span></li>)}</ul></section>; })}</div>
    </section>
  </div>;
}
