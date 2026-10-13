"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { hariIni } from "@/lib/jadwal/waktu";
import { catatIzinStaf, putusIzin, putusTukar, type Result } from "@/lib/sdm-actions";

export type IzinBaris = {
  id: string;
  outlet_id: string;
  pengguna_id: string;
  jenis: "izin" | "libur" | "sakit";
  tanggal: string;
  alasan: string | null;
  status: string;
  alasan_tolak: string | null;
  created_at: string;
};
type JadwalRingkas = { tanggal: string; shift: { nama: string; jam_mulai: string } | null } | null;
export type TukarBaris = {
  id: string;
  outlet_id: string;
  pengaju_id: string;
  rekan_id: string;
  alasan: string | null;
  status: string;
  alasan_tolak: string | null;
  created_at: string;
  a: JadwalRingkas;
  b: JadwalRingkas;
};

const JENIS: Record<string, string> = { izin: "Izin", libur: "Libur mingguan", sakit: "Sakit" };
const STATUS: Record<string, string> = {
  menunggu: "Menunggu",
  menunggu_rekan: "Menunggu rekan",
  menunggu_atasan: "Menunggu persetujuan",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
};
const tgl = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const jadwalTeks = (j: JadwalRingkas) => (j ? `${tgl(j.tanggal)} · ${j.shift?.nama ?? ""} ${j.shift?.jam_mulai.slice(0, 5) ?? ""}` : "(jadwal sudah dihapus)");

export function PersetujuanView({ outlets, nama, stafOutlet, izin, tukar }: { outlets: { id: string; nama: string }[]; nama: Record<string, string>; stafOutlet: Record<string, { id: string; nama: string }[]>; izin: IzinBaris[]; tukar: TukarBaris[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const outletNama = (id: string) => (outlets.length > 1 ? outlets.find((o) => o.id === id)?.nama : null);
  const n = (id: string) => nama[id] ?? "Staf";
  const jalankan = (f: () => Promise<Result>) =>
    start(async () => {
      setMsg(await f());
      router.refresh();
    });
  const tolak = (f: (alasan: string) => Promise<Result>) => {
    const alasan = prompt("Alasan penolakan (wajib, terlihat oleh staf):");
    if (alasan?.trim()) jalankan(() => f(alasan));
  };

  const izinMenunggu = izin.filter((i) => i.status === "menunggu");
  const tukarMenunggu = tukar.filter((t) => t.status === "menunggu_atasan");
  const riwayat = [...izin.filter((i) => i.status !== "menunggu")];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Persetujuan</h1>
        <p className="text-sm text-stone-500">Izin, sakit, libur mingguan, dan tukar shift dari kasir & barista. Izin yang disetujui otomatis melepas jadwal orang itu di tanggal tersebut.</p>
      </div>
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{msg.error ?? msg.ok}</p>}

      <section className="space-y-2">
        <h2 className="font-bold">Izin & libur menunggu ({izinMenunggu.length})</h2>
        {!izinMenunggu.length && <p className="text-sm text-stone-500">Tidak ada pengajuan yang menunggu.</p>}
        {izinMenunggu.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="min-w-48 flex-1">
              <p>
                <b>{n(i.pengguna_id)}</b> · {JENIS[i.jenis]} · <b>{tgl(i.tanggal)}</b>
                {outletNama(i.outlet_id) && <span className="text-stone-500"> · {outletNama(i.outlet_id)}</span>}
              </p>
              {i.alasan && <p className="text-stone-600">“{i.alasan}”</p>}
            </div>
            <button disabled={pending} onClick={() => jalankan(() => putusIzin(i.id, true, ""))} className="rounded-lg bg-green-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
              Setujui
            </button>
            <button disabled={pending} onClick={() => tolak((a) => putusIzin(i.id, false, a))} className="rounded-lg border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50">
              Tolak
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Tukar shift menunggu ({tukarMenunggu.length})</h2>
        {!tukarMenunggu.length && <p className="text-sm text-stone-500">Tidak ada permintaan tukar yang sudah diterima rekan.</p>}
        {tukarMenunggu.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="min-w-48 flex-1">
              <p>
                <b>{n(t.pengaju_id)}</b> ({jadwalTeks(t.a)}) ⇄ <b>{n(t.rekan_id)}</b> ({jadwalTeks(t.b)})
              </p>
              {t.alasan && <p className="text-stone-600">“{t.alasan}”</p>}
            </div>
            <button disabled={pending} onClick={() => jalankan(() => putusTukar(t.id, true, ""))} className="rounded-lg bg-green-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
              Setujui
            </button>
            <button disabled={pending} onClick={() => tolak((a) => putusTukar(t.id, false, a))} className="rounded-lg border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50">
              Tolak
            </button>
          </div>
        ))}
        {tukar
          .filter((t) => t.status === "menunggu_rekan")
          .map((t) => (
            <p key={t.id} className="text-xs text-stone-500">
              {n(t.pengaju_id)} meminta tukar dengan {n(t.rekan_id)} — menunggu jawaban rekan.
            </p>
          ))}
      </section>

      <CatatIzin outlets={outlets} stafOutlet={stafOutlet} pending={pending} jalankan={jalankan} />

      <section className="space-y-1">
        <h2 className="font-bold">Riwayat 30 hari</h2>
        {[...riwayat.map((i) => ({ at: i.created_at, el: <>{n(i.pengguna_id)} · {JENIS[i.jenis]} {tgl(i.tanggal)}</>, status: i.status, tolak: i.alasan_tolak, id: i.id })),
          ...tukar.filter((t) => !["menunggu_rekan", "menunggu_atasan"].includes(t.status)).map((t) => ({ at: t.created_at, el: <>Tukar: {n(t.pengaju_id)} ⇄ {n(t.rekan_id)}</>, status: t.status, tolak: t.alasan_tolak, id: t.id }))]
          .sort((a, b) => b.at.localeCompare(a.at))
          .map((r) => (
            <p key={r.id} className="flex flex-wrap gap-2 border-b py-1.5 text-sm">
              <span className="flex-1">{r.el}</span>
              <span className={r.status === "disetujui" ? "text-green-700" : r.status === "ditolak" ? "text-red-600" : "text-stone-500"}>{STATUS[r.status]}</span>
              {r.tolak && <span className="w-full text-xs text-stone-500">Alasan: {r.tolak}</span>}
            </p>
          ))}
        {!riwayat.length && !tukar.length && <p className="text-sm text-stone-500">Belum ada riwayat.</p>}
      </section>
    </div>
  );
}

function CatatIzin({ outlets, stafOutlet, pending, jalankan }: { outlets: { id: string; nama: string }[]; stafOutlet: Record<string, { id: string; nama: string }[]>; pending: boolean; jalankan: (f: () => Promise<Result>) => void }) {
  const [v, setV] = useState({ outlet: outlets[0]?.id ?? "", staf: "", jenis: "sakit", tanggal: hariIni(), alasan: "" });
  const staf = stafOutlet[v.outlet] ?? [];
  const cls = "mt-1 w-full rounded-lg border px-2 py-2";
  return (
    <details className="rounded-2xl border border-matur-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-bold">Catat izin / sakit untuk staf</summary>
      <p className="mt-1 text-xs text-stone-500">Untuk staf yang memberi kabar lewat telepon/WA. Langsung disetujui tanpa batas H-3, jadwalnya di tanggal itu dilepas.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {outlets.length > 1 && (
          <label>
            Outlet
            <select value={v.outlet} onChange={(e) => setV({ ...v, outlet: e.target.value, staf: "" })} className={cls}>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Staf
          <select value={v.staf} onChange={(e) => setV({ ...v, staf: e.target.value })} className={cls}>
            <option value="">Pilih…</option>
            {staf.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jenis
          <select value={v.jenis} onChange={(e) => setV({ ...v, jenis: e.target.value })} className={cls}>
            <option value="sakit">Sakit</option>
            <option value="izin">Izin</option>
            <option value="libur">Libur</option>
          </select>
        </label>
        <label>
          Tanggal
          <input type="date" value={v.tanggal} onChange={(e) => setV({ ...v, tanggal: e.target.value })} className={cls} />
        </label>
        <label className="sm:col-span-2">
          Keterangan
          <input value={v.alasan} onChange={(e) => setV({ ...v, alasan: e.target.value })} className={cls} />
        </label>
      </div>
      <button
        disabled={pending || !v.staf}
        onClick={() => jalankan(() => catatIzinStaf(v.outlet, v.staf, v.jenis, v.tanggal, v.alasan))}
        className="mt-3 rounded-lg bg-matur-500 px-4 py-2 font-bold text-white disabled:opacity-50"
      >
        Catat
      </button>
    </details>
  );
}
