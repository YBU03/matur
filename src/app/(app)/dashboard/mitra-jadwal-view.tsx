"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Eye, Store, Users } from "lucide-react";
import { addDays } from "@/lib/jadwal/waktu";
import { statusJadwalMitra, type DataJadwalMitra } from "@/lib/mitra-jadwal";
const tgl = (s: string, weekday = false) => new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { timeZone: "UTC", ...(weekday ? { weekday: "long" } : { day: "numeric", month: "short", year: "numeric" }) });
const jam = (s: string) => new Date(s).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
export function MitraJadwalView({ data, awal, today, outlet }: { data: DataJadwalMitra; awal: string; today: string; outlet?: string }) {
  const router = useRouter(), params = useSearchParams();
  const [pending, start] = useTransition();
  const selected = data.outlets.some(o => o.id === outlet) ? outlet! : "semua";
  const namaOutlet = (id: string) => data.outlets.find(o => o.id === id)?.nama ?? "Outlet";
  const href = (minggu: string, id = selected) => { const q = new URLSearchParams(params.toString()); q.set("mitra_minggu", minggu); q.set("mitra_outlet", id); return `/dashboard?${q}#jadwal-mitra`; };
  const aktif = data.aktif.filter(a => selected === "semua" || a.outlet_id === selected);
  const rows = data.jadwal.filter(a => selected === "semua" || a.outlet_id === selected);
  return <section id="jadwal-mitra" aria-busy={pending} className="overflow-hidden rounded-3xl border border-matur-200 bg-white shadow-sm">
    <header className="space-y-4 border-b border-matur-100 bg-gradient-to-br from-matur-100 via-amber-50 to-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-white text-matur-600 shadow-sm"><CalendarDays size={26} /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-kopi-900">Jadwal Shift Mingguan</h2><p className="text-xs text-stone-600">Tim outlet Anda · jadwal terbit dari HRD · waktu WIB</p></div><span className="flex items-center gap-1 rounded-full border border-matur-200 bg-white px-3 py-1 text-xs font-semibold text-kopi-800"><Eye size={13} /> Hanya lihat</span></div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-0 text-xs font-semibold text-stone-600">Outlet<select aria-label="Outlet jadwal mitra" value={selected} disabled={pending || !data.outlets.length} onChange={e => start(() => router.push(href(awal, e.target.value), { scroll: false }))} className="mt-1 block w-full max-w-xs rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm text-kopi-900 shadow-sm focus:ring-2 focus:ring-matur-300"><option value="semua">Semua Outlet Saya</option>{data.outlets.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-2"><Link aria-label="Minggu sebelumnya" href={href(addDays(awal, -7))} scroll={false} className="rounded-xl border border-matur-200 bg-white p-2 text-kopi-800 hover:bg-matur-50 focus-visible:ring-2 focus-visible:ring-matur-400"><ChevronLeft size={18} /></Link><p className="text-xs font-bold text-kopi-900">{tgl(awal)} – {tgl(addDays(awal, 6))}</p><Link aria-label="Minggu berikutnya" href={href(addDays(awal, 7))} scroll={false} className="rounded-xl border border-matur-200 bg-white p-2 text-kopi-800 hover:bg-matur-50 focus-visible:ring-2 focus-visible:ring-matur-400"><ChevronRight size={18} /></Link><Link href={href(today)} scroll={false} className="rounded-xl bg-kopi-900 px-3 py-2 text-xs font-semibold text-white">Minggu ini</Link></div>
      </div>
      {pending && <p role="status" className="text-xs text-matur-700">Sedang menyiapkan jadwal…</p>}
    </header>
    <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-bold text-emerald-900"><span className="size-2 rounded-full bg-emerald-500" /> Sedang bertugas sekarang</h3><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{aktif.length} orang</span></div>
        <p className="mb-3 text-xs text-stone-500">Absensi masuk belum ditutup dalam 24 jam terakhir, termasuk shift lewat tengah malam. Diperbarui berkala.</p>
        {aktif.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{aktif.map(a => <div key={a.id} className="min-w-0 rounded-xl border border-emerald-100 bg-white p-3"><p className="break-words font-bold text-kopi-900">{a.nama}</p><p className="mt-1 text-xs text-stone-600">{namaOutlet(a.outlet_id)} · {a.shift ?? "Tanpa jadwal"}</p><p className="mt-1 text-xs font-semibold text-emerald-800">Masuk {jam(a.masuk_at)}{a.telat_menit > 0 && <span className="text-red-700"> · Telat {a.telat_menit} menit</span>}</p></div>)}</div> : <p className="text-sm text-stone-600">Belum ada absensi masuk yang masih aktif.</p>}
      </div>
      <div className="flex flex-wrap gap-2 text-xs"><span className="flex items-center gap-1 rounded-lg bg-matur-50 px-3 py-2 text-kopi-800"><Users size={14} /> {rows.filter(r => !!r.shift).length} penugasan terbit</span><span className="flex items-center gap-1 rounded-lg bg-stone-50 px-3 py-2 text-stone-600"><Store size={14} /> {selected === "semua" ? data.outlets.length : 1} outlet</span></div>
      {!data.outlets.length ? <p className="rounded-xl border border-dashed border-matur-200 p-6 text-center text-sm text-stone-500">Belum ada outlet yang ditugaskan kepada Anda.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 7 }, (_, i) => {
        const date = addDays(awal, i), hari = rows.filter(r => r.tanggal === date), now = date === today;
        return <article key={date} className={`min-w-0 overflow-hidden rounded-2xl border ${now ? "border-matur-400 ring-1 ring-matur-200" : "border-stone-200"}`}><div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${now ? "border-matur-200 bg-matur-100" : "border-stone-100 bg-stone-50"}`}><div><h3 className="font-bold text-kopi-900">{tgl(date, true)}</h3><p className="text-xs text-stone-500">{tgl(date)}</p></div>{now && <span className="rounded-full bg-matur-500 px-2 py-1 text-[10px] font-bold text-white">Hari ini</span>}</div>
          <div className="space-y-2 p-3">{!hari.length ? <p className="py-4 text-center text-xs text-stone-400">Belum ada jadwal terbit atau libur/izin tercatat.</p> : hari.map(r => {const status = statusJadwalMitra(r); return <div key={r.id} className="rounded-xl border border-matur-100 bg-white p-3"><p className="break-words text-sm font-bold text-kopi-900">{r.nama}</p><p className="mt-1 text-[11px] text-stone-500">{namaOutlet(r.outlet_id)}</p>{r.shift && <p className="mt-1 flex items-center gap-1 text-xs text-stone-700"><Clock3 size={12} className="shrink-0" />{r.shift} · {r.mulai?.slice(0, 5)}–{r.selesai?.slice(0, 5)}{r.mulai && r.selesai && r.selesai <= r.mulai ? " (+1 hari)" : ""}</p>}<span className={`mt-2 inline-block rounded-md px-2 py-1 text-[10px] font-semibold ${status.warna}`}>{status.teks}</span>{r.masuk_at && <p className="mt-2 text-[11px] text-stone-500">Masuk {jam(r.masuk_at)}{r.pulang_at ? ` · Pulang ${jam(r.pulang_at)}` : " · Belum absen pulang"}</p>}</div>; })}</div>
        </article>;
      })}</div>}
    </div>
  </section>;
}
