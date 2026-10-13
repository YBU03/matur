"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addDays } from "@/lib/jadwal/waktu";
import type { AturanSdm, Izin } from "@/lib/sdm";
import { ajukanIzin, batalIzin, type Result } from "@/lib/sdm-actions";

const JENIS = { izin: "Izin (tidak masuk)", sakit: "Sakit", libur: "Libur mingguan" } as const;
const STATUS: Record<string, string> = { menunggu: "Menunggu", disetujui: "Disetujui", ditolak: "Ditolak", dibatalkan: "Dibatalkan" };
const WARNA: Record<string, string> = { menunggu: "text-amber-700", disetujui: "text-green-700", ditolak: "text-red-600", dibatalkan: "text-stone-400" };
const tgl = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function IzinView({ today, aturan, riwayat }: { today: string; aturan: AturanSdm; riwayat: Izin[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [jenis, setJenis] = useState<keyof typeof JENIS>("izin");
  const minIzin = addDays(today, aturan.izin_min_hari);
  const min = jenis === "izin" ? minIzin : jenis === "libur" ? addDays(today, 1) : today;
  const [tanggal, setTanggal] = useState(minIzin);
  const [alasan, setAlasan] = useState("");
  const jalankan = (f: () => Promise<Result>) =>
    start(async () => {
      const r = await f();
      setMsg(r);
      if (r.ok) setAlasan("");
      router.refresh();
    });
  const ganti = (j: keyof typeof JENIS) => {
    setJenis(j);
    const m = j === "izin" ? minIzin : j === "libur" ? addDays(today, 1) : today;
    if (tanggal < m) setTanggal(m);
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4 text-sm">
        <h1 className="text-lg font-bold">Ajukan izin / libur</h1>
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(JENIS) as (keyof typeof JENIS)[]).map((j) => (
            <button
              key={j}
              disabled={j === "libur" && !aturan.libur_mingguan_dibuka}
              onClick={() => ganti(j)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold disabled:opacity-40 ${jenis === j ? "border-matur-500 bg-matur-50" : "text-stone-500"}`}
            >
              {JENIS[j]}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-500">
          {jenis === "izin" && `Izin wajib diajukan minimal H-${aturan.izin_min_hari} (paling cepat ${tgl(minIzin)}). Untuk keperluan mendadak hari ini, hubungi SPV/HRD.`}
          {jenis === "sakit" && "Sakit bisa diajukan untuk hari ini. Sertakan keterangan singkat."}
          {jenis === "libur" && "Pilih hari libur mingguan Anda untuk jadwal berikutnya. Yang disetujui akan dipakai saat jadwal disusun."}
        </p>
        {!aturan.libur_mingguan_dibuka && <p className="text-xs text-stone-400">Pengajuan libur mingguan sedang ditutup HRD.</p>}
        <label className="block">
          Tanggal
          <input type="date" min={min} value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block">
          Alasan {jenis === "libur" && <span className="text-stone-400">(opsional)</span>}
          <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        {msg && <p className={`rounded-lg px-3 py-2 ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{msg.error ?? msg.ok}</p>}
        <button disabled={pending || tanggal < min} onClick={() => jalankan(() => ajukanIzin(jenis, tanggal, alasan))} className="w-full rounded-xl bg-matur-500 py-3 font-bold text-white disabled:opacity-50">
          {pending ? "Mengirim…" : "Kirim pengajuan"}
        </button>
      </section>

      <section>
        <h2 className="mb-2 font-bold">Pengajuan saya</h2>
        <ul className="divide-y rounded-2xl border border-matur-200 bg-white text-sm">
          {riwayat.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="flex-1">
                <b>{tgl(i.tanggal)}</b> · {JENIS[i.jenis]}
                {i.alasan && <span className="block text-xs text-stone-500">“{i.alasan}”</span>}
                {i.alasan_tolak && <span className="block text-xs text-red-600">Alasan ditolak: {i.alasan_tolak}</span>}
              </span>
              <span className={`text-xs font-semibold ${WARNA[i.status]}`}>{STATUS[i.status]}</span>
              {i.status === "menunggu" && (
                <button disabled={pending} onClick={() => jalankan(() => batalIzin(i.id))} className="text-xs text-red-600 underline">
                  Batalkan
                </button>
              )}
            </li>
          ))}
          {!riwayat.length && <li className="px-3 py-4 text-center text-stone-500">Belum ada pengajuan.</li>}
        </ul>
      </section>
    </div>
  );
}
