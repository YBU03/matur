"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LiveRefresh, type Pantau } from "@/components/live-refresh";
import { formatRupiah } from "@/lib/format";
import type { StatusStok } from "@/lib/forecast-stok";
import { hitungStatus, qty, type BarisRt, type ShiftRt } from "@/lib/stok-realtime";

const GAYA: Record<StatusStok, { label: string; chip: string; bar: string }> = {
  habis: { label: "Habis", chip: "bg-red-600 text-white", bar: "bg-red-600" },
  kritis: { label: "Kritis", chip: "bg-red-100 text-red-700", bar: "bg-red-500" },
  menipis: { label: "Menipis", chip: "bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  aman: { label: "Aman", chip: "bg-green-100 text-green-700", bar: "bg-green-500" },
  tidak_dipakai: { label: "Tidak dipakai", chip: "bg-stone-100 text-stone-500", bar: "bg-stone-300" },
};
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const tglPendek = (t: string | null) => (t ? new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }) : "-");
const jam = (t: string | null) => (t ? new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "-");

const saranTeks = (r: BarisRt) => (r.konversi > 1 && r.satuan_beli ? `${r.f.saranKemasan} ${r.satuan_beli}` : `${nf.format(Math.ceil(r.f.saran))} ${r.satuan}`);
const PERLU: StatusStok[] = ["habis", "kritis", "menipis"];

function Sparkline({ data }: { data: { pakai: number }[] }) {
  const xs = data.slice(-14).map((d) => Math.max(d.pakai, 0));
  const max = Math.max(...xs, 1);
  return (
    <svg viewBox={`0 0 ${xs.length * 5} 20`} className="h-5 w-20" aria-label="Pemakaian 14 hari">
      {xs.map((v, i) => (
        <rect key={i} x={i * 5} y={20 - (v / max) * 20} width={4} height={Math.max((v / max) * 20, 0.5)} rx={1} className={i === xs.length - 1 ? "fill-violet-600" : "fill-violet-300"} />
      ))}
    </svg>
  );
}

function SisaBar({ r }: { r: BarisRt }) {
  const acuan = Math.max(r.stok_min * 2, r.f.rata * 7, 1);
  const pct = Math.max(0, Math.min(100, (r.stok / acuan) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${GAYA[r.f.status].bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StokRealtimeView({
  judul,
  lokasi,
  pilihan,
  basePath,
  rows,
  shift,
  tutupTerakhir,
  tampilRp,
  pantau,
  ringkasLokasi,
  titipan = [],
  linkSetor,
}: {
  judul: string;
  lokasi: { id: string; nama: string }[];
  pilihan: string;
  basePath: string;
  rows: BarisRt[];
  shift: ShiftRt[];
  tutupTerakhir: string | null;
  tampilRp: boolean;
  pantau: Pantau[];
  ringkasLokasi?: Record<string, { habis: number; kritis: number; menipis: number }>;
  /** produk jadi titipan (cheesecake, dessert) — stok dalam pcs */
  titipan?: BarisRt[];
  linkSetor?: string;
}) {
  const [cari, setCari] = useState("");
  const [filter, setFilter] = useState<StatusStok | "perlu" | "semua">("semua");
  const [waktu, setWaktu] = useState("");
  useEffect(() => setWaktu(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), [rows]);
  const n = hitungStatus(rows);
  const perlu = rows.filter((r) => ["habis", "kritis", "menipis"].includes(r.f.status));
  const nilai = rows.reduce((t, r) => t + Math.max(r.stok, 0) * r.harga, 0);
  const pakaiRp = rows.reduce((t, r) => t + r.pakaiHariIni * r.harga, 0);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return rows.filter((r) => (filter === "semua" || (filter === "perlu" ? ["habis", "kritis", "menipis"].includes(r.f.status) : r.f.status === filter)) && (!q || `${r.nama} ${r.kategori ?? ""}`.toLowerCase().includes(q)));
  }, [rows, cari, filter]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <LiveRefresh pantau={pantau} cadanganDetik={45} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">{judul}</h1>
          <p className="flex items-center gap-1.5 text-sm text-stone-500">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
            </span>
            Langsung — berkurang otomatis tiap transaksi kasir {waktu && `· diperbarui ${waktu}`}
          </p>
        </div>
      </div>

      {lokasi.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2">
            {lokasi.map((l) => {
              const c = ringkasLokasi?.[l.id];
              return (
                <Link key={l.id} href={`${basePath}?lokasi=${l.id}`} className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-sm font-semibold ${l.id === pilihan ? "border-kopi-900 bg-white text-kopi-900" : "border-matur-200 bg-white text-stone-500"}`}>
                  {l.id === "gudang" ? "🏭 " : "☕ "}
                  {l.nama}
                  {c && c.habis + c.kritis + c.menipis > 0 && <span className="rounded-full bg-red-100 px-1.5 text-xs text-red-700">{c.habis + c.kritis + c.menipis}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Habis", n.habis, "text-red-600", "habis"],
            ["Kritis (< 2 hari)", n.kritis, "text-red-500", "kritis"],
            ["Menipis", n.menipis, "text-amber-600", "menipis"],
            ["Aman", n.aman, "text-green-600", "aman"],
          ] as [string, number, string, StatusStok][]
        ).map(([k, v, c, f]) => (
          <button key={k} onClick={() => setFilter(filter === f ? "semua" : f)} className={`rounded-2xl border bg-white p-3 text-left ${filter === f ? "border-kopi-900 ring-2 ring-kopi-900/20" : "border-matur-200"}`}>
            <p className="text-xs text-stone-500">{k}</p>
            <p className={`text-2xl font-bold tabular-nums ${c}`}>{v}</p>
          </button>
        ))}
        {tampilRp && (
          <>
            <div className="rounded-2xl border border-matur-200 bg-white p-3">
              <p className="text-xs text-stone-500">Nilai stok</p>
              <p className="text-lg font-bold tabular-nums">{formatRupiah(nilai)}</p>
            </div>
            <div className="rounded-2xl border border-matur-200 bg-white p-3">
              <p className="text-xs text-stone-500">Terpakai hari ini</p>
              <p className="text-lg font-bold tabular-nums">{formatRupiah(pakaiRp)}</p>
            </div>
          </>
        )}
      </section>

      {perlu.length > 0 && (
        <section className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-4">
          <h2 className="mb-2 font-bold">🔔 Perlu restock ({perlu.length})</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {perlu.slice(0, 12).map((r) => (
              <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <p className="mr-auto font-semibold leading-tight">{r.nama}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GAYA[r.f.status].chip}`}>{GAYA[r.f.status].label}</span>
                </div>
                <p className="mt-1 text-sm">
                  Sisa <b>{qty(Math.max(r.stok, 0), r)}</b> <span className="text-xs text-stone-500">· min {qty(r.stok_min, r)}</span>
                </p>
                <SisaBar r={r} />
                <p className="mt-1.5 text-xs text-stone-600">
                  {r.f.status === "habis" ? "Stok sudah habis" : r.f.tglHabis ? `Perkiraan habis ${tglPendek(r.f.tglHabis)} (±${nf.format(r.f.hariTersisa ?? 0)} hari)` : "Belum ada pemakaian rutin"}
                  {r.f.rata > 0 && ` · ±${qty(r.f.rata, r)}/hari`}
                </p>
                {r.f.saran > 0 && (
                  <p className="mt-1 rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800">
                    Saran restock: {saranTeks(r)} (cukup ±7 hari)
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-matur-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔍 Cari bahan…" className="min-w-48 flex-1 rounded-lg border px-3 py-2 text-sm" />
          {(["semua", "perlu"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f ? "bg-kopi-900 text-white" : "bg-stone-100 text-stone-600"}`}>
              {f === "semua" ? `Semua (${rows.length})` : `Perlu restock (${perlu.length})`}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#C5E0B3]/40 text-left text-xs text-stone-600">
              <tr>
                <th className="px-2 py-2">Bahan</th>
                <th className="px-2 py-2 text-right">Stok sekarang</th>
                {tutupTerakhir && <th className="px-2 py-2 text-right">Saat tutup shift {jam(tutupTerakhir)}</th>}
                <th className="px-2 py-2 text-right">Terpakai hari ini</th>
                <th className="px-2 py-2 text-right">Rata-rata/hari</th>
                <th className="px-2 py-2">14 hari</th>
                <th className="px-2 py-2">Perkiraan habis</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Saran restock</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((r) => (
                <tr key={r.id} className="border-t border-stone-100 align-middle">
                  <td className="px-2 py-1.5">
                    <p className="font-medium">{r.nama}</p>
                    <p className="text-[11px] text-stone-400">{r.kategori ?? "-"}</p>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    <b className={r.stok <= 0 ? "text-red-600" : ""}>{qty(r.stok, r)}</b>
                    <div className="mt-1 ml-auto w-24"><SisaBar r={r} /></div>
                  </td>
                  {tutupTerakhir && <td className="px-2 py-1.5 text-right tabular-nums text-stone-600">{r.stok_tutup === null ? "-" : qty(r.stok_tutup, r)}</td>}
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.pakaiHariIni ? qty(r.pakaiHariIni, r) : "-"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {r.f.rata ? qty(r.f.rata, r) : "-"}
                    {r.f.tren !== null && r.f.tren !== 0 && <span className={`ml-1 text-[11px] ${r.f.tren > 0 ? "text-amber-600" : "text-green-600"}`}>{r.f.tren > 0 ? "▲" : "▼"}{Math.abs(r.f.tren)}%</span>}
                  </td>
                  <td className="px-2 py-1.5"><Sparkline data={r.harian} /></td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">{r.f.status === "habis" ? "sudah habis" : r.f.tglHabis ? `${tglPendek(r.f.tglHabis)} · ±${nf.format(r.f.hariTersisa ?? 0)} hr` : r.f.rata ? "> 3 bulan" : "-"}</td>
                  <td className="px-2 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GAYA[r.f.status].chip}`}>{GAYA[r.f.status].label}</span></td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs font-semibold text-violet-700">{r.f.saran > 0 && PERLU.includes(r.f.status) ? saranTeks(r) : ""}</td>
                </tr>
              ))}
              {tampil.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-500">Tidak ada bahan yang cocok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-stone-500">
          Smart forecast: rata-rata pemakaian 14 hari terakhir (hari terbaru lebih berbobot) × pola hari dalam seminggu, dikurangi yang sudah terpakai hari ini. Saran restock = kebutuhan ±7 hari + stok minimum − stok sekarang.
        </p>
      </section>

      {titipan.length > 0 && <TitipanSection rows={titipan} tampilRp={tampilRp} linkSetor={linkSetor} />}

      {shift.length > 0 && (
        <section className="rounded-2xl border border-matur-200 bg-white p-4">
          <h2 className="mb-2 font-bold">Pemakaian bahan per shift</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shift.map((s) => (
              <div key={s.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                <p className="font-semibold">
                  {s.kasir ?? "-"} {!s.ditutup_at && <span className="ml-1 rounded-full bg-green-100 px-1.5 text-[11px] text-green-700">berjalan</span>}
                </p>
                <p className="text-xs text-stone-500">
                  {new Date(s.dibuka_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · {jam(s.dibuka_at)}–{s.ditutup_at ? jam(s.ditutup_at) : "sekarang"} · {s.transaksi} transaksi
                </p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {s.bahan.map((b) => (
                    <li key={b.nama} className="flex justify-between gap-2">
                      <span className="truncate">{b.nama}</span>
                      <span className="tabular-nums text-stone-600">{nf.format(b.jumlah)} {b.satuan}</span>
                    </li>
                  ))}
                  {s.bahan.length === 0 && <li className="text-stone-400">Belum ada pemakaian</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TitipanSection({ rows, tampilRp, linkSetor }: { rows: BarisRt[]; tampilRp: boolean; linkSetor?: string }) {
  const n = hitungStatus(rows);
  const perlu = n.habis + n.kritis + n.menipis;
  const minus = rows.filter((r) => r.stok < 0);
  return (
    <section className={`rounded-2xl border-2 bg-white p-4 ${perlu ? "border-pink-300" : "border-matur-200"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-bold">🍰 Produk jadi titipan (cheesecake & dessert)</h2>
        <span className="text-xs text-stone-500">
          {perlu ? <b className="text-red-600">{perlu} perlu setor ulang</b> : "semua aman"} · stok = setoran − terjual − marketing
        </span>
        {linkSetor && (
          <Link href={linkSetor} className="rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white">
            + Catat setoran
          </Link>
        )}
      </div>
      {minus.length > 0 && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ {minus.map((r) => r.nama).join(", ")}: terjual lebih banyak dari setoran yang tercatat — kemungkinan setoran dari produsen belum dicatat.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-pink-50 text-left text-xs text-stone-600">
            <tr>
              <th className="px-2 py-2">Produk</th>
              <th className="px-2 py-2">Produsen</th>
              <th className="px-2 py-2 text-right">Sisa</th>
              <th className="px-2 py-2 text-right">Setor hari ini</th>
              <th className="px-2 py-2 text-right">Terjual hari ini</th>
              <th className="px-2 py-2 text-right">Rata-rata/hari</th>
              <th className="px-2 py-2">14 hari</th>
              <th className="px-2 py-2">Perkiraan habis</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2 text-right">Saran setor (±3 hari)</th>
              {tampilRp && <th className="px-2 py-2 text-right">Nilai sisa</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="px-2 py-1.5 font-medium">{r.nama}</td>
                <td className="px-2 py-1.5 text-xs text-stone-500">{r.kategori}</td>
                <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${r.stok <= 0 ? "text-red-600" : ""}`}>{nf.format(r.stok)} pcs</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.masuk_hari_ini || "-"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.pakaiHariIni || "-"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.f.rata ? nf.format(r.f.rata) : "-"}</td>
                <td className="px-2 py-1.5"><Sparkline data={r.harian} /></td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs">{r.f.status === "habis" ? "sudah habis" : r.f.tglHabis ? `${tglPendek(r.f.tglHabis)} · ±${nf.format(r.f.hariTersisa ?? 0)} hr` : "-"}</td>
                <td className="px-2 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GAYA[r.f.status].chip}`}>{GAYA[r.f.status].label}</span></td>
                <td className="px-2 py-1.5 text-right text-xs font-semibold text-pink-700">{r.f.saran > 0 && PERLU.includes(r.f.status) ? `${Math.ceil(r.f.saran)} pcs` : ""}</td>
                {tampilRp && <td className="px-2 py-1.5 text-right tabular-nums text-xs">{formatRupiah(Math.max(r.stok, 0) * r.harga)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
