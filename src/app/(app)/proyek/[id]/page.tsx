import Link from "next/link";
import { notFound } from "next/navigation";
import { Progress, sisaHari } from "@/components/proyek-card";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { detailProyek, progresTotal } from "@/lib/proyek";
import { groupRab } from "@/lib/rab-excel";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { RowDeleter, RowEditor } from "@/components/row-editor";
import { Approvals, DesainGallery, RabDownload, ReportButton } from "./client";

// MTR-01 / PRY: budget vs realisasi, RAB, PIC, progres, galeri, timeline
export default async function DetailProyek({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s?.active) notFound();
  const d = await detailProyek(id); // RLS: hanya proyek yang boleh dilihat
  if (!d) notFound();
  const { proyek: p, pekerjaan, rab, foto, desain } = d;
  const admin = s.active.role === "owner" || s.active.role === "admin_pusat";
  const progres = progresTotal(pekerjaan);
  const realisasi = rab.reduce((t, r) => t + (r.harga_realisasi ?? 0), 0);
  const estimasiRab = rab.reduce((t, r) => t + r.harga_estimasi, 0);
  const hari = sisaHari(p.target_buka);
  const disetujui = foto.filter((f) => f.status === "disetujui");
  const menunggu = foto.filter((f) => f.status === "menunggu");
  const namaPekerjaan = Object.fromEntries(pekerjaan.map((k) => [k.id, k.nama]));
  // daftar PIC untuk form tahapan (admin saja)
  let picRefs: { id: string; label: string }[] = [];
  if (admin) {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("pengguna").select("id, nama").eq("status", "aktif").order("nama");
    picRefs = (data ?? []).map((u) => ({ id: u.id, label: u.nama }));
  }
  const PROYEK_FIELDS = ["nama", "estimasi_budget", "tgl_mulai", "target_buka", "status", "catatan"];
  const TAHAP_FIELDS = ["nama", "pic_id", "bobot", "progres", "tgl_mulai", "tgl_selesai", "urutan"];
  // tahap saat ini = tahapan pertama (urut) yang belum 100%
  const tahap = pekerjaan.find((k) => k.progres < 100);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-matur-400 to-matur-600 p-6 text-white">
        <Link href={s.active.role === "mitra" ? "/portal/pembangunan" : "/proyek"} className="text-sm text-white/80">
          ← Semua proyek
        </Link>
        <div className="mt-1 flex flex-wrap items-start gap-2">
          <h1 className="mr-auto text-2xl font-bold sm:text-3xl">{p.nama}</h1>
          {admin && (
            <RowEditor
              entityKey="proyek"
              row={p as unknown as Record<string, unknown>}
              fields={PROYEK_FIELDS}
              label="✏️ Ubah data proyek"
              className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
            />
          )}
        </div>
        <p className="text-white/90">
          {p.outlet?.nama} · {p.status === "selesai" ? "Selesai" : "Sedang berjalan"}
        </p>
        {p.status !== "selesai" && tahap && (
          <p className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">Tahap saat ini: {tahap.nama}</p>
        )}
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
        <Kpi label="Estimasi Biaya" value={formatRupiah(p.estimasi_budget)} sub={estimasiRab ? `RAB ${formatRupiah(estimasiRab)}` : undefined} />
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
          <Link href={`/master/pekerjaan?proyek_id=${p.id}`} className="rounded-xl border border-matur-300 bg-white px-3 py-2">Kelola Tahapan & PIC</Link>
          <Link href={`/proyek/${p.id}/rab`} className="rounded-xl border border-matur-300 bg-white px-3 py-2">Rincian Keperluan (import/export)</Link>
          <Link href="/master/proyek" className="rounded-xl border border-matur-300 bg-white px-3 py-2">Ubah Data Proyek</Link>
        </div>
      )}

      {menunggu.length > 0 && (
        <Approvals proyekId={p.id} admin={admin} items={menunggu.map((f) => ({ ...f, pekerjaan: namaPekerjaan[f.pekerjaan_id] }))} />
      )}

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-bold">Estimasi Biaya & Rincian Keperluan</h2>
          <RabDownload judul={`Rincian Keperluan ${p.nama}`} sub={`${p.outlet?.nama ?? ""} · Estimasi ${formatRupiah(estimasiRab)}`} items={rab} />
          <Link href={`/proyek/${p.id}/rab`} className="rounded-lg bg-matur-500 px-3 py-1.5 text-sm font-semibold text-white">
            Lihat detail →
          </Link>
        </div>
        {rab.length === 0 && <p className="text-sm text-stone-400">Belum ada rincian keperluan.</p>}
        <table className="w-full text-sm">
          <tbody>
            {groupRab(rab).map((g) => (
              <tr key={g.kelompok} className="border-t">
                <td className="py-2">
                  <Link href={`/proyek/${p.id}/rab#${g.kelompok}`} className="font-medium hover:underline">{g.kelompok}</Link>
                  <span className="ml-2 text-xs text-stone-500">{g.items.length} item · {g.items.filter((i) => i.status !== "rencana").length} dibeli/terpasang</span>
                </td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatRupiah(g.estimasi)}</td>
                <td className="whitespace-nowrap pl-3 text-right text-xs text-stone-500 tabular-nums">{g.realisasi ? `realisasi ${formatRupiah(g.realisasi)}` : ""}</td>
              </tr>
            ))}
            {rab.length > 0 && (
              <tr className="border-t-2 font-bold">
                <td className="py-2">Grand Total</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatRupiah(estimasiRab)}</td>
                <td className="whitespace-nowrap pl-3 text-right text-xs tabular-nums">{realisasi ? `realisasi ${formatRupiah(realisasi)}` : ""}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <DesainGallery proyekId={p.id} admin={admin} items={desain} />

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="mr-auto font-bold">Tahapan & Progres</h2>
          {admin && (
            <RowEditor
              entityKey="pekerjaan"
              row={null}
              initial={{ proyek_id: p.id, bobot: "1", progres: "0", urutan: String(pekerjaan.length + 1) }}
              fields={TAHAP_FIELDS}
              refs={{ pic_id: picRefs }}
              label="+ Tambah tahapan"
              className="rounded-lg border border-matur-300 px-3 py-1.5 text-sm text-matur-700 hover:bg-matur-50"
            />
          )}
        </div>
        {pekerjaan.length === 0 && <p className="text-sm text-stone-400">Belum ada tahapan.</p>}
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
              {admin && (
                <span className="flex">
                  <RowEditor entityKey="pekerjaan" row={k as unknown as Record<string, unknown>} fields={TAHAP_FIELDS} refs={{ pic_id: picRefs }} title={`Ubah tahapan · ${k.nama}`} />
                  <RowDeleter entityKey="pekerjaan" id={k.id} name={`Tahapan / Pekerjaan ${k.nama}`} />
                </span>
              )}
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
