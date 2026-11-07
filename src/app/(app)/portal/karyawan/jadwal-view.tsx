"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { addDays } from "@/lib/jadwal/waktu";
import { statusJadwalMitra, type DataJadwalMitra } from "@/lib/mitra-jadwal";
const jam = (s: string) => new Date(s).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
export function MitraJadwalView({ data, tanggal, today, outlet }: { data: DataJadwalMitra; tanggal: string; today: string; outlet?: string }) {
  const router = useRouter(), params = useSearchParams();
  const [pending, start] = useTransition();
  const selected = data.outlets.some(o => o.id === outlet) ? outlet! : "semua";
  const href = (date: string, id = selected) => { const q = new URLSearchParams(params.toString()); q.delete("mitra_minggu"); q.set("mitra_tanggal", date); q.set("mitra_outlet", id); return `/portal/karyawan?${q}#jadwal-mitra`; };
  const namaOutlet = (id: string) => data.outlets.find(o => o.id === id)?.nama ?? "Outlet";
  const aktif = data.aktif.filter(a => selected === "semua" || a.outlet_id === selected);
  const rows = data.jadwal.filter(a => a.tanggal === tanggal && (selected === "semua" || a.outlet_id === selected));
  const date = new Date(`${tanggal}T00:00:00Z`);
  return <section id="jadwal-mitra" aria-busy={pending} className="scroll-mt-4 overflow-hidden rounded-2xl border border-matur-200 bg-white shadow-sm">
    <LiveRefresh pantau={[]} cadanganDetik={60} />
    <header className="space-y-3 border-b border-matur-100 bg-gradient-to-r from-matur-50 via-amber-50 to-white p-3 sm:p-4">
      <div className="flex items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-matur-100 text-matur-600"><CalendarDays size={19} /></span><div className="min-w-0 flex-1"><h2 className="font-bold text-kopi-900">Jadwal Shift</h2><p className="text-[11px] text-stone-500">Jadwal terbit HRD · WIB · hanya lihat</p></div><Link href={href(today)} scroll={false} className="shrink-0 rounded-lg bg-kopi-900 px-3 py-2 text-xs font-semibold text-white">Hari ini</Link></div>
      <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 rounded-xl border border-matur-200 bg-white p-1">
        <Link aria-label="Tanggal sebelumnya" href={href(addDays(tanggal, -1))} scroll={false} className="grid size-10 place-items-center rounded-lg text-kopi-800 hover:bg-matur-50 focus-visible:ring-2 focus-visible:ring-matur-400"><ChevronLeft size={19} /></Link>
        <div aria-live="polite" className="min-w-0 text-center"><p className="text-xs font-semibold text-matur-700">{date.toLocaleDateString("id-ID", { timeZone: "UTC", weekday: "long" })}{tanggal === today && " · Hari ini"}</p><p className="text-sm font-bold text-kopi-900">{date.toLocaleDateString("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}</p></div>
        <Link aria-label="Tanggal berikutnya" href={href(addDays(tanggal, 1))} scroll={false} className="grid size-10 place-items-center rounded-lg text-kopi-800 hover:bg-matur-50 focus-visible:ring-2 focus-visible:ring-matur-400"><ChevronRight size={19} /></Link>
      </div>
      {data.outlets.length > 1 && <select aria-label="Outlet jadwal mitra" value={selected} disabled={pending} onChange={e => start(() => router.push(href(tanggal, e.target.value), { scroll: false }))} className="w-full min-w-0 rounded-lg border border-matur-200 bg-white px-3 py-2 text-xs font-semibold text-kopi-800 focus:ring-2 focus:ring-matur-300"><option value="semua">Semua Outlet Saya</option>{data.outlets.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}</select>}
      {pending && <p role="status" className="text-xs text-matur-700">Sedang menyiapkan jadwal…</p>}
    </header>
    <div className="px-3 py-2 sm:px-4">
      {tanggal === today && <div className="mb-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><p><span className="font-semibold">Bertugas sekarang: </span>{aktif.length ? aktif.map(a => `${a.nama}${selected === "semua" && data.outlets.length > 1 ? ` (${namaOutlet(a.outlet_id)})` : ""}`).join(", ") : "Belum ada absensi aktif"}</p><p className="mt-0.5 text-[10px] text-emerald-700">Sudah masuk dalam 24 jam terakhir dan belum absen pulang.</p></div>}
      {!rows.length ? <p className="py-6 text-center text-xs text-stone-500">{data.outlets.length ? "Belum ada jadwal terbit atau libur/izin tercatat pada tanggal ini." : "Belum ada outlet yang ditugaskan kepada Anda."}</p> : <ul className="divide-y divide-stone-100">{rows.map(r => {
        const status = statusJadwalMitra(r);
        const bertugas = tanggal === today && aktif.some(a => a.outlet_id === r.outlet_id && a.nama === r.nama && a.masuk_at === r.masuk_at);
        return <li key={r.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-bold text-kopi-900">{r.nama}</p>{selected === "semua" && data.outlets.length > 1 && <p className="mt-0.5 text-[11px] text-stone-500">{namaOutlet(r.outlet_id)}</p>}{r.shift && <p className="mt-1 flex items-center gap-1 text-xs text-stone-600"><Clock3 size={12} className="shrink-0" /><span>{r.shift} · {r.mulai?.slice(0, 5)}–{r.selesai?.slice(0, 5)}{r.mulai && r.selesai && r.selesai <= r.mulai ? " (+1 hari)" : ""}</span></p>}{r.masuk_at && <p className="mt-1 text-[10px] text-stone-500">Masuk {jam(r.masuk_at)}{r.pulang_at ? ` · Pulang ${jam(r.pulang_at)}` : " · Belum pulang"}</p>}</div><div className="max-w-[110px] shrink-0 space-y-1 text-right"><span className={`inline-block rounded-md px-2 py-1 text-[10px] font-semibold ${status.warna}`}>{status.teks}</span>{bertugas && <p className="text-[10px] font-semibold text-emerald-700">● Bertugas</p>}</div></li>;
      })}</ul>}
    </div>
  </section>;
}
