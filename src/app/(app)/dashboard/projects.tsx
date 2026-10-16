import { totalEstimasiRab } from "@/lib/rab-total";
import Link from "next/link";
import { BarList, ChartCard, GroupedBars } from "@/components/charts";
import { SERIES } from "@/lib/chart-utils";
import { sisaHari } from "@/components/proyek-card";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { daftarProyek, detailProyek, progresTotal } from "@/lib/proyek";
import { groupRab } from "@/lib/rab-excel";

/** Pusat: ringkasan semua proyek berjalan dalam satu grafik progres. */
export async function ProjectsOverview() {
  const list = (await daftarProyek()).filter((p) => p.status === "berjalan");
  if (!list.length) return null;
  return (
    <ChartCard
      title="Progres pembangunan"
      sub={`${list.length} proyek berjalan`}
      rows={list.map((p) => ({ Proyek: p.nama, Progres: `${p.progres}%`, RAB: p.estimasiRab, Realisasi: p.realisasi }))}
      cols={[{ key: "Proyek", label: "Proyek" }, { key: "Progres", label: "Progres" }, { key: "RAB", label: "Grand Total RAB", money: true }, { key: "Realisasi", label: "Realisasi", money: true }]}
    >
      <BarList data={list.map((p) => ({ name: p.nama, value: p.progres }))} money={false} unit="%" max={100} />
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        {list.map((p) => (
          <Link key={p.id} href={`/proyek/${p.id}`} className="rounded-lg border border-matur-200 px-2 py-1 hover:bg-matur-50">{p.nama} →</Link>
        ))}
      </div>
    </ChartCard>
  );
}

/** Mitra & PIC: visual lengkap per proyek. */
export async function ProjectDetailCharts() {
  const semua = await daftarProyek();
  const list = semua.filter((p) => p.status === "berjalan").slice(0, 3);
  const selesai = semua.filter((p) => p.status === "selesai");
  if (!list.length && !selesai.length) return <p className="rounded-2xl border border-dashed border-matur-300 bg-white py-10 text-center text-stone-500">Belum ada proyek pembangunan yang berjalan.</p>;
  const details = await Promise.all(list.map((p) => detailProyek(p.id)));
  return (
    <div className="space-y-6">
      {selesai.map((p) => (
        <Link key={p.id} href={`/proyek/${p.id}`} className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white">
          <span className="text-4xl">🎉</span>
          <div className="mr-auto">
            <p className="text-sm text-white/85">{p.outlet?.nama}</p>
            <h2 className="text-xl font-bold">Pembangunan selesai</h2>
            <p className="text-sm text-white/90">
              {p.nama}
              {p.selesai_at ? ` · selesai ${formatTanggal(p.selesai_at.slice(0, 10))}` : ""} · outlet sudah beroperasi
            </p>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">100% ✓</span>
        </Link>
      ))}
      {details.map((d) => {
        if (!d) return null;
        const { proyek: p, pekerjaan, rab } = d;
        const progres = progresTotal(pekerjaan);
        const groups = groupRab(rab);
        const estimasi = totalEstimasiRab(rab);
        const realisasi = groups.reduce((s, g) => s + g.realisasi, 0);
        const hari = sisaHari(p.target_buka);
        return (
          <section key={p.id} className="space-y-3">
            <Link href={`/proyek/${p.id}`} className="block rounded-2xl bg-gradient-to-r from-matur-400 to-matur-600 p-5 text-white">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-white/80">{p.outlet?.nama}</p>
                  <h2 className="text-xl font-bold">{p.nama}</h2>
                  <p className="text-sm text-white/90">
                    {p.target_buka ? `Grand opening ${formatTanggal(p.target_buka)}${hari !== null ? (hari >= 0 ? ` · ${hari} hari lagi` : ` · terlambat ${-hari} hari`) : ""}` : "Target buka belum diatur"}
                  </p>
                </div>
                <Ring value={progres} />
              </div>
            </Link>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Mini label="Grand Total RAB" value={formatRupiah(estimasi)} />
              <Mini label="Realisasi" value={formatRupiah(realisasi)} />
              <Mini label="Sisa RAB" value={formatRupiah(estimasi - realisasi)} warn={realisasi > estimasi} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Progres per pekerjaan" sub="Persentase selesai" rows={pekerjaan.map((k) => ({ Pekerjaan: k.nama, PIC: k.pic?.nama ?? "-", Progres: `${k.progres}%` }))} cols={[{ key: "Pekerjaan", label: "Pekerjaan" }, { key: "PIC", label: "PIC" }, { key: "Progres", label: "Progres" }]}>
                <BarList data={pekerjaan.map((k) => ({ name: k.nama, value: k.progres }))} money={false} unit="%" max={100} />
              </ChartCard>
              <ChartCard title="Keperluan: estimasi vs realisasi" sub="Per kelompok" rows={groups.map((g) => ({ Kelompok: g.kelompok, Estimasi: g.estimasi, Realisasi: g.realisasi }))} cols={[{ key: "Kelompok", label: "Kelompok" }, { key: "Estimasi", label: "Estimasi", money: true }, { key: "Realisasi", label: "Realisasi", money: true }]}>
                <GroupedBars
                  data={groups.map((g) => ({ name: g.kelompok, estimasi: g.estimasi, realisasi: g.realisasi }))}
                  series={[{ key: "estimasi", name: "Estimasi", color: SERIES[0] }, { key: "realisasi", name: "Realisasi", color: SERIES[1] }]}
                />
              </ChartCard>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-matur-200 bg-white p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`font-bold tabular-nums ${warn ? "text-red-700" : ""}`}>{value}</p>
    </div>
  );
}

/** Angka utama progres dalam cincin (bukan grafik pai). */
function Ring({ value }: { value: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`Progres ${value}%`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="8" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 44 44)" />
      <text x="44" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">{value}%</text>
    </svg>
  );
}

