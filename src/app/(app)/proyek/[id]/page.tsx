import Link from "next/link";
import { notFound } from "next/navigation";
import { Progress, sisaHari } from "@/components/proyek-card";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { detailProyek, progresTotal } from "@/lib/proyek";
import { getSession } from "@/lib/session";
import { Approvals, ReportButton } from "./client";

const STATUS_RAB: Record<string, string> = {
  rencana: "bg-stone-100 text-stone-600",
  dibeli: "bg-amber-100 text-amber-800",
  terpasang: "bg-green-100 text-green-800",
};

// MTR-01 / PRY: budget vs realisasi, RAB, PIC, progres, galeri, timeline
export default async function DetailProyek({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s?.active) notFound();
  const d = await detailProyek(id); // RLS: hanya proyek yang boleh dilihat
  if (!d) notFound();
  const { proyek: p, pekerjaan, rab, foto } = d;
  const admin = s.active.role === "owner" || s.active.role === "admin_pusat";
  const progres = progresTotal(pekerjaan);
  const realisasi = rab.reduce((t, r) => t + (r.harga_realisasi ?? 0), 0);
  const estimasiRab = rab.reduce((t, r) => t + r.harga_estimasi, 0);
  const hari = sisaHari(p.target_buka);
  const disetujui = foto.filter((f) => f.status === "disetujui");
  const menunggu = foto.filter((f) => f.status === "menunggu");
  const namaPekerjaan = Object.fromEntries(pekerjaan.map((k) => [k.id, k.nama]));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-matur-400 to-matur-600 p-6 text-white">
        <Link href={s.active.role === "mitra" ? "/portal/pembangunan" : "/proyek"} className="text-sm text-white/80">
          ← Semua proyek
        </Link>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{p.nama}</h1>
        <p className="text-white/90">
          {p.outlet?.nama} · {p.status === "selesai" ? "Selesai" : "Sedang berjalan"}
        </p>
        <div className="mt-4 flex items-end gap-4">
          <span className="text-5xl font-extrabold">{progres}%</span>
          <div className="flex-1 pb-2">
            <div className="h-3 overflow-hidden rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white" style={{ width: `${progres}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Estimasi Budget" value={formatRupiah(p.estimasi_budget)} sub={estimasiRab ? `RAB ${formatRupiah(estimasiRab)}` : undefined} />
        <Kpi label="Realisasi" value={formatRupiah(realisasi)} sub={p.estimasi_budget ? `${Math.round((realisasi / p.estimasi_budget) * 100)}% dari budget` : undefined} />
        <Kpi label="Sisa Budget" value={formatRupiah(p.estimasi_budget - realisasi)} warn={realisasi > p.estimasi_budget} />
        <Kpi
          label="Target Grand Opening"
          value={p.target_buka ? formatTanggal(p.target_buka) : "-"}
          sub={hari === null || p.status === "selesai" ? undefined : hari >= 0 ? `${hari} hari lagi` : `terlambat ${-hari} hari`}
        />
      </section>

      {admin && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={`/master/pekerjaan?proyek_id=${p.id}`} className="rounded-xl border border-matur-300 bg-white px-3 py-2">Kelola Pekerjaan & PIC</Link>
          <Link href={`/master/item_rab?proyek_id=${p.id}`} className="rounded-xl border border-matur-300 bg-white px-3 py-2">Kelola RAB</Link>
          <Link href="/master/proyek" className="rounded-xl border border-matur-300 bg-white px-3 py-2">Ubah Data Proyek</Link>
        </div>
      )}

      {menunggu.length > 0 && (
        <Approvals proyekId={p.id} admin={admin} items={menunggu.map((f) => ({ ...f, pekerjaan: namaPekerjaan[f.pekerjaan_id] }))} />
      )}

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-3 font-bold">Pekerjaan</h2>
        {pekerjaan.length === 0 && <p className="text-sm text-stone-400">Belum ada pekerjaan.</p>}
        <ul className="divide-y">
          {pekerjaan.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <div className="min-w-48 flex-1">
                <p className="font-semibold">{k.nama}</p>
                <p className="text-xs text-stone-500">
                  PIC: {k.pic?.nama ?? "-"} · bobot {Number(k.bobot)}
                  {k.tgl_mulai && ` · ${formatTanggal(k.tgl_mulai)}`}
                  {k.tgl_selesai && ` – ${formatTanggal(k.tgl_selesai)}`}
                </p>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-56">
                <Progress value={k.progres} className="flex-1" />
                <span className="w-10 text-right text-sm font-semibold">{k.progres}%</span>
              </div>
              {(admin || k.pic_id === s.userId) && <ReportButton proyekId={p.id} pekerjaan={{ id: k.id, nama: k.nama, progres: k.progres }} />}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-3 font-bold">Galeri Progres</h2>
        {disetujui.length === 0 && <p className="text-sm text-stone-400">Belum ada foto.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {disetujui.map((f) => (
            <figure key={f.id} className="overflow-hidden rounded-xl border bg-stone-50">
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase */}
                  <img src={f.url} alt={f.keterangan ?? ""} className="aspect-square w-full object-cover" />
                </a>
              )}
              <figcaption className="p-2 text-xs">
                <p className="font-semibold">{namaPekerjaan[f.pekerjaan_id]}{f.progres_diajukan !== null && ` · ${f.progres_diajukan}%`}</p>
                {f.keterangan && <p className="text-stone-600">{f.keterangan}</p>}
                <p className="text-stone-400">{formatTanggal(f.created_at, true)}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-3 font-bold">Daftar Kebutuhan (RAB)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-stone-500">
              <tr>
                <th className="py-1 pr-3">Kategori</th>
                <th className="pr-3">Item</th>
                <th className="pr-3 text-right">Jumlah</th>
                <th className="pr-3 text-right">Estimasi</th>
                <th className="pr-3 text-right">Realisasi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rab.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-stone-400">Belum ada item RAB.</td>
                </tr>
              )}
              {rab.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 pr-3 text-stone-500">{r.kategori}</td>
                  <td className="pr-3 font-medium">{r.nama}</td>
                  <td className="pr-3 text-right">{Number(r.qty)}</td>
                  <td className="whitespace-nowrap pr-3 text-right tabular-nums">{formatRupiah(r.harga_estimasi)}</td>
                  <td className="whitespace-nowrap pr-3 text-right tabular-nums">{formatRupiah(r.harga_realisasi ?? 0)}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_RAB[r.status]}`}>{r.status}</span></td>
                </tr>
              ))}
              {rab.length > 0 && (
                <tr className="border-t-2 font-bold">
                  <td colSpan={3} className="py-2">Total</td>
                  <td className="whitespace-nowrap pr-3 text-right tabular-nums">{formatRupiah(estimasiRab)}</td>
                  <td className="whitespace-nowrap pr-3 text-right tabular-nums">{formatRupiah(realisasi)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-3 font-bold">Timeline</h2>
        <ol className="relative ml-2 border-l-2 border-matur-200">
          {p.tgl_mulai && <Step date={p.tgl_mulai} title="Proyek dimulai" />}
          {pekerjaan
            .filter((k) => k.tgl_selesai)
            .sort((a, b) => a.tgl_selesai!.localeCompare(b.tgl_selesai!))
            .map((k) => (
              <Step key={k.id} date={k.tgl_selesai!} title={`${k.nama} selesai`} done={k.progres === 100} />
            ))}
          {p.target_buka && <Step date={p.target_buka} title="Grand Opening 🎉" done={p.status === "selesai"} big />}
        </ol>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-matur-200 bg-white p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`text-lg font-bold ${warn ? "text-red-600" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

function Step({ date, title, done, big }: { date: string; title: string; done?: boolean; big?: boolean }) {
  return (
    <li className="mb-4 ml-4">
      <span className={`absolute -left-[9px] mt-1 size-4 rounded-full border-2 border-white ${done ? "bg-green-500" : "bg-matur-400"}`} />
      <p className="text-xs text-stone-500">{formatTanggal(date)}</p>
      <p className={big ? "font-bold" : "font-medium"}>{title}</p>
    </li>
  );
}
