"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addDays, eachDate } from "@/lib/jadwal/waktu";
import type { Izin, Jadwal, Shift } from "@/lib/sdm";
import { ajukanTukar, batalTukar, jawabTukar, type Result } from "@/lib/sdm-actions";

type Tukar = { id: string; pengaju_id: string; rekan_id: string; jadwal_pengaju: string; jadwal_rekan: string; alasan: string | null; status: string; alasan_tolak: string | null };

const STATUS: Record<string, string> = {
  menunggu_rekan: "Menunggu jawaban rekan",
  menunggu_atasan: "Menunggu persetujuan HRD/SPV",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
};
const JENIS: Record<string, string> = { izin: "Izin", libur: "Libur", sakit: "Sakit" };
const tgl = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });

export function JadwalSaya({ saya, today, shifts, nama, jadwal, izin, tukar }: { saya: string; today: string; shifts: Shift[]; nama: Record<string, string>; jadwal: Jadwal[]; izin: Izin[]; tukar: Tukar[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [tab, setTab] = useState<"saya" | "semua">("saya");
  const [pilih, setPilih] = useState<string | null>(null);
  const [tujuan, setTujuan] = useState("");
  const [alasan, setAlasan] = useState("");
  const shift = new Map(shifts.map((s) => [s.id, s]));
  const byId = new Map(jadwal.map((j) => [j.id, j]));
  const n = (id: string) => nama[id] ?? "Rekan";
  const besok = addDays(today, 1);
  const urut = (a: Jadwal, b: Jadwal) => a.tanggal.localeCompare(b.tanggal) || (shift.get(a.shift_id)?.jam_mulai ?? "").localeCompare(shift.get(b.shift_id)?.jam_mulai ?? "");
  const milikSaya = jadwal.filter((j) => j.pengguna_id === saya).sort(urut);
  const sedangDitukar = new Set(tukar.filter((t) => ["menunggu_rekan", "menunggu_atasan"].includes(t.status)).flatMap((t) => [t.jadwal_pengaju, t.jadwal_rekan]));
  const pilihan = jadwal.filter((j) => j.pengguna_id !== saya && j.tanggal >= besok && !sedangDitukar.has(j.id)).sort(urut);
  const label = (j: Jadwal | undefined) => (j ? `${tgl(j.tanggal)} · ${shift.get(j.shift_id)?.nama ?? ""} ${shift.get(j.shift_id)?.jam_mulai ?? ""}` : "jadwal lama");
  const jalankan = (f: () => Promise<Result>) =>
    start(async () => {
      const r = await f();
      setMsg(r);
      if (r.ok) {
        setPilih(null);
        setTujuan("");
        setAlasan("");
      }
      router.refresh();
    });

  const masuk = tukar.filter((t) => t.rekan_id === saya && t.status === "menunggu_rekan");
  const hari = eachDate(today, addDays(today, 13));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{msg.error ?? msg.ok}</p>}

      {masuk.map((t) => (
        <div key={t.id} className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm">
          <p>
            <b>{n(t.pengaju_id)}</b> ingin menukar <b>{label(byId.get(t.jadwal_pengaju))}</b> miliknya dengan jadwal Anda <b>{label(byId.get(t.jadwal_rekan))}</b>.
          </p>
          {t.alasan && <p className="text-stone-600">“{t.alasan}”</p>}
          <div className="mt-2 flex gap-2">
            <button disabled={pending} onClick={() => jalankan(() => jawabTukar(t.id, true))} className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white">
              Terima
            </button>
            <button disabled={pending} onClick={() => jalankan(() => jawabTukar(t.id, false))} className="rounded-lg border border-red-300 px-4 py-2 text-red-700">
              Tolak
            </button>
          </div>
        </div>
      ))}

      <div className="flex rounded-xl bg-matur-50 p-1 text-sm font-semibold">
        {(["saya", "semua"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 ${tab === t ? "bg-white shadow" : "text-stone-500"}`}>
            {t === "saya" ? "Jadwal saya" : "Semua rekan (2 minggu)"}
          </button>
        ))}
      </div>

      {tab === "saya" ? (
        <ul className="space-y-2">
          {!milikSaya.length && <li className="rounded-xl bg-white p-4 text-center text-sm text-stone-500">Belum ada jadwal terbit untuk Anda.</li>}
          {milikSaya.map((j) => {
            const s = shift.get(j.shift_id);
            return (
              <li key={j.id} className={`rounded-xl border bg-white p-3 text-sm ${j.tanggal === today ? "border-matur-500" : "border-matur-200"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1">
                    <b className="capitalize">{j.tanggal === today ? "Hari ini" : tgl(j.tanggal)}</b>
                    <br />
                    {s?.nama} · {s?.jam_mulai}–{s?.jam_selesai}
                  </span>
                  {j.tanggal >= besok && !sedangDitukar.has(j.id) && (
                    <button onClick={() => setPilih(pilih === j.id ? null : j.id)} className="rounded-lg border border-matur-300 px-3 py-1.5 text-xs font-semibold">
                      Tukar
                    </button>
                  )}
                  {sedangDitukar.has(j.id) && <span className="text-xs text-amber-700">sedang diajukan tukar</span>}
                </div>
                {pilih === j.id && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <select value={tujuan} onChange={(e) => setTujuan(e.target.value)} className="w-full rounded-lg border px-2 py-2">
                      <option value="">Tukar dengan jadwal rekan…</option>
                      {pilihan.map((x) => (
                        <option key={x.id} value={x.id}>
                          {n(x.pengguna_id)} — {label(x)}
                        </option>
                      ))}
                    </select>
                    <input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan (opsional)" className="w-full rounded-lg border px-2 py-2" />
                    <button disabled={pending || !tujuan} onClick={() => jalankan(() => ajukanTukar(j.id, tujuan, alasan))} className="rounded-lg bg-matur-500 px-4 py-2 font-bold text-white disabled:opacity-50">
                      Kirim permintaan
                    </button>
                    <p className="text-xs text-stone-500">Rekan harus menerima dulu, lalu HRD/SPV menyetujui. Paling lambat H-1.</p>
                  </div>
                )}
              </li>
            );
          })}
          {izin.map((i) => (
            <li key={i.id} className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm">
              <b className="capitalize">{tgl(i.tanggal)}</b> · {JENIS[i.jenis]} {i.status === "menunggu" ? "(menunggu persetujuan)" : "✓"}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2">
          {hari.map((d) => {
            const isi = jadwal.filter((j) => j.tanggal === d).sort(urut);
            return (
              <div key={d} className={`rounded-xl border bg-white p-3 text-sm ${d === today ? "border-matur-500" : "border-matur-100"}`}>
                <p className="mb-1 font-bold capitalize">{tgl(d)}</p>
                {shifts
                  .filter((s) => isi.some((j) => j.shift_id === s.id))
                  .map((s) => (
                    <p key={s.id} className="text-stone-700">
                      <span className="text-stone-500">
                        {s.nama} {s.jam_mulai}:
                      </span>{" "}
                      {isi
                        .filter((j) => j.shift_id === s.id)
                        .map((j) => (j.pengguna_id === saya ? <b key={j.id}>Anda </b> : <span key={j.id}>{n(j.pengguna_id)} </span>))}
                    </p>
                  ))}
                {!isi.length && <p className="text-stone-400">Belum ada jadwal terbit.</p>}
              </div>
            );
          })}
        </div>
      )}

      {tukar.some((t) => t.pengaju_id === saya) && (
        <section>
          <h2 className="mb-2 font-bold">Permintaan tukar saya</h2>
          <ul className="divide-y rounded-2xl border border-matur-200 bg-white text-sm">
            {tukar
              .filter((t) => t.pengaju_id === saya)
              .map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="flex-1">
                    Dengan {n(t.rekan_id)}: {label(byId.get(t.jadwal_pengaju))}
                    <br />
                    <span className="text-xs text-stone-500">
                      {STATUS[t.status]}
                      {t.alasan_tolak && ` — ${t.alasan_tolak}`}
                    </span>
                  </span>
                  {["menunggu_rekan", "menunggu_atasan"].includes(t.status) && (
                    <button disabled={pending} onClick={() => jalankan(() => batalTukar(t.id))} className="text-xs text-red-600 underline">
                      Batalkan
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
