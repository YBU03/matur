"use client";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
export function KehadiranGrafik(p: {
  hari: number;
  tepat: number;
  telat: number;
  izin: number;
  alpa: number;
  menitTelat: number;
  baris: { tanggal: string; status: string; menit: number }[];
}) {
  const data = [
    { nama: "Tepat waktu", jumlah: p.tepat, warna: "#16a34a" },
    { nama: "Terlambat", jumlah: p.telat, warna: "#f59e0b" },
    { nama: "Izin/libur/sakit", jumlah: p.izin, warna: "#3b82f6" },
    { nama: "Tidak hadir", jumlah: p.alpa, warna: "#ef4444" },
  ];
  const hari = [...new Set(p.baris.map((b) => b.tanggal))].map((t) => ({
    tanggal: t.slice(5),
    menit: p.baris
      .filter((b) => b.tanggal === t)
      .reduce((n, b) => n + b.menit, 0),
  }));
  return (
    <section className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Kehadiran saya</h2>
        <nav className="flex gap-2 text-xs">
          {[7, 30].map((n) => (
            <Link
              href={`/karyawan?rentang=${n}`}
              key={n}
              className={`rounded-full px-3 py-2 ${p.hari === n ? "bg-kopi-900 text-white" : "bg-stone-100"}`}
            >
              {n} hari
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-2 text-sm text-stone-500">
        {p.telat} kali terlambat · total {p.menitTelat} menit
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {data.map((d) => (
          <div key={d.nama} className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">{d.nama}</p>
            <b style={{ color: d.warna }} className="text-2xl">
              {d.jumlah}
            </b>
          </div>
        ))}
      </div>
      <div
        className="mt-4 h-52"
        role="img"
        aria-label={data.map((d) => `${d.nama}: ${d.jumlah}`).join(", ")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="nama" tick={{ fontSize: 10 }} interval={0} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="jumlah" name="Kehadiran" radius={[7, 7, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.nama} fill={d.warna} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs font-semibold text-stone-500">
        Tren keterlambatan (menit per tanggal)
      </p>
      <div
        className="h-32"
        role="img"
        aria-label="Grafik menit keterlambatan per hari"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hari}>
            <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="menit" fill="#f59e0b" name="Menit terlambat" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
