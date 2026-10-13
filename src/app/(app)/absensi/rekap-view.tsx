"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDurasi, LABEL_STATUS, type BarisRekap, type RingkasStaf, type StatusHari } from "@/lib/jadwal/rekap";
import type { Absen } from "@/lib/sdm";
import { ubahAbsensi, type Result } from "@/lib/sdm-actions";

export const WARNA_STATUS: Record<StatusHari, string> = {
  tepat: "bg-green-100 text-green-800",
  telat: "bg-amber-100 text-amber-900",
  tanpa_jadwal: "bg-sky-100 text-sky-800",
  tidak_absen: "bg-red-100 text-red-700",
  belum: "bg-stone-100 text-stone-600",
  izin: "bg-violet-100 text-violet-800",
  libur: "bg-violet-100 text-violet-800",
  sakit: "bg-violet-100 text-violet-800",
};

export const jamWib = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "–";
const tglPendek = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
const peta = (lat: number | null, lng: number | null) => (lat !== null && lng !== null ? `https://www.google.com/maps?q=${lat},${lng}` : null);

type Props = {
  outlets: { id: string; nama: string }[];
  outlet: { id: string; nama: string };
  dari: string;
  sampai: string;
  staf: string;
  daftarStaf: { id: string; nama: string }[];
  nama: Record<string, string>;
  rekap: { baris: BarisRekap[]; ringkas: RingkasStaf[] };
  hariIni: BarisRekap[];
  absensi: Record<string, Absen>;
  foto: Record<string, string>;
};

export function RekapView(p: Props) {
  const router = useRouter();
  const [f, setF] = useState({ outlet: p.outlet.id, dari: p.dari, sampai: p.sampai, staf: p.staf });
  const [busy, setBusy] = useState(false);
  const terapkan = (v = f) => router.push(`/absensi?${new URLSearchParams(Object.entries(v).filter(([, x]) => x) as [string, string][])}`);
  const n = (id: string) => p.nama[id] ?? "Staf";

  const ekspor = async () => {
    setBusy(true);
    try {
      const { eksporRekap } = await import("./ekspor");
      await eksporRekap({ outlet: p.outlet.nama, dari: p.dari, sampai: p.sampai, nama: p.nama, rekap: p.rekap, absensi: p.absensi });
    } finally {
      setBusy(false);
    }
  };

  const hadirSekarang = p.hariIni.filter((b) => b.absen && !b.absen.pulang_at).length;
  const telat = p.hariIni.filter((b) => b.status === "telat").length;
  const tidak = p.hariIni.filter((b) => b.status === "tidak_absen").length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Rekap Absensi</h1>
        <p className="text-sm text-stone-500">Absen selfie kasir & barista (dari HP sendiri atau perangkat outlet), dibandingkan dengan jadwal terbit.</p>
      </div>

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-2 font-bold">Hari ini · {p.outlet.nama}</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
          <Kotak label="Sedang bertugas" nilai={hadirSekarang} warna="text-green-700" />
          <Kotak label="Jadwal hari ini" nilai={p.hariIni.filter((b) => b.shift).length} />
          <Kotak label="Telat" nilai={telat} warna="text-amber-700" />
          <Kotak label="Tidak absen" nilai={tidak} warna="text-red-600" />
        </div>
        {p.hariIni.length ? (
          <ul className="divide-y text-sm">
            {p.hariIni.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-32 font-semibold">{n(b.pengguna_id)}</span>
                <span className="text-stone-500">{b.shift ? `${b.shift.nama} ${b.shift.jam_mulai}–${b.shift.jam_selesai}` : "Tanpa jadwal"}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${WARNA_STATUS[b.status]}`}>
                  {LABEL_STATUS[b.status]}
                  {b.status === "telat" && ` ${b.absen?.telat_menit} mnt`}
                </span>
                {b.absen && (
                  <span className="text-xs text-stone-500">
                    masuk {jamWib(b.absen.masuk_at)} · pulang {jamWib(b.absen.pulang_at)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">Belum ada jadwal terbit maupun absen hari ini.</p>
        )}
      </section>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-matur-200 bg-white p-3 text-sm">
        {p.outlets.length > 1 && (
          <select value={f.outlet} onChange={(e) => terapkan({ ...f, outlet: e.target.value, staf: "" })} className="rounded-lg border px-2 py-2">
            {p.outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        )}
        <label>
          <span className="block text-xs text-stone-500">Dari</span>
          <input type="date" value={f.dari} onChange={(e) => setF({ ...f, dari: e.target.value })} className="rounded-lg border px-2 py-1.5" />
        </label>
        <label>
          <span className="block text-xs text-stone-500">Sampai</span>
          <input type="date" value={f.sampai} onChange={(e) => setF({ ...f, sampai: e.target.value })} className="rounded-lg border px-2 py-1.5" />
        </label>
        <select value={f.staf} onChange={(e) => setF({ ...f, staf: e.target.value })} className="rounded-lg border px-2 py-2">
          <option value="">Semua staf</option>
          {p.daftarStaf.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nama}
            </option>
          ))}
        </select>
        <button onClick={() => terapkan()} className="rounded-lg bg-matur-500 px-4 py-2 font-bold text-white">
          Tampilkan
        </button>
        <button disabled={busy} onClick={ekspor} className="rounded-lg border border-green-700 px-4 py-2 font-semibold text-green-800 disabled:opacity-50">
          {busy ? "Menyiapkan…" : "Unduh Excel"}
        </button>
      </div>

      <section>
        <h2 className="mb-2 font-bold">Ringkasan per staf</h2>
        <div className="overflow-x-auto rounded-2xl border border-matur-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-matur-50 text-left text-xs text-stone-600">
              <tr>
                <th className="p-2">Nama</th>
                <th className="p-2 text-right">Jadwal</th>
                <th className="p-2 text-right">Hadir</th>
                <th className="p-2 text-right">Tepat</th>
                <th className="p-2 text-right">Telat</th>
                <th className="p-2 text-right">Tidak absen</th>
                <th className="p-2 text-right">Izin/sakit/libur</th>
                <th className="p-2 text-right">Jam kerja</th>
              </tr>
            </thead>
            <tbody>
              {p.rekap.ringkas
                .sort((a, b) => n(a.pengguna_id).localeCompare(n(b.pengguna_id)))
                .map((r) => (
                  <tr key={r.pengguna_id} className="border-t">
                    <td className="p-2 font-semibold">{n(r.pengguna_id)}</td>
                    <td className="p-2 text-right">{r.jadwal}</td>
                    <td className="p-2 text-right">{r.hadir}</td>
                    <td className="p-2 text-right text-green-700">{r.tepat}</td>
                    <td className="p-2 text-right text-amber-700">
                      {r.telat}
                      {r.menitTelat ? <span className="text-xs"> ({r.menitTelat} mnt)</span> : null}
                    </td>
                    <td className="p-2 text-right text-red-600">{r.tidakAbsen}</td>
                    <td className="p-2 text-right">{r.izin}</td>
                    <td className="p-2 text-right">{formatDurasi(r.menitKerja)}</td>
                  </tr>
                ))}
              {!p.rekap.ringkas.length && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-stone-500">
                    Belum ada data di periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-bold">Detail</h2>
        <div className="space-y-2">
          {p.rekap.baris
            .filter((b) => b.status !== "belum")
            .map((b, i) => (
              <Detail key={i} b={b} nama={n(b.pengguna_id)} a={b.absen ? p.absensi[b.absen.id] : undefined} foto={p.foto} />
            ))}
        </div>
      </section>
    </div>
  );
}

function Kotak({ label, nilai, warna = "" }: { label: string; nilai: number; warna?: string }) {
  return (
    <div className="rounded-xl bg-matur-50 p-2">
      <p className={`text-2xl font-bold ${warna}`}>{nilai}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

function Detail({ b, nama, a, foto }: { b: BarisRekap; nama: string; a?: Absen; foto: Record<string, string> }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [catatan, setCatatan] = useState(a?.catatan ?? "");
  const [pulang, setPulang] = useState("");
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const simpan = () =>
    a &&
    start(async () => {
      // jam pulang diisi dalam WIB; lebih awal dari jam masuk berarti keesokan harinya
      let t: Date | null = null;
      if (pulang) {
        t = new Date(`${a.tanggal}T${pulang}:00+07:00`);
        if (t < new Date(a.masuk_at)) t.setUTCDate(t.getUTCDate() + 1);
      }
      const r = await ubahAbsensi(a.id, { catatan, pulang: t?.toISOString() ?? null });
      setMsg(r);
      if (r.ok) {
        setEdit(false);
        router.refresh();
      }
    });
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-matur-100 bg-white p-3 text-sm">
      <div className="flex gap-1">
        {[a?.masuk_foto, a?.pulang_foto].map((f, i) =>
          f && foto[f] ? (
            <a key={i} href={foto[f]} target="_blank" rel="noreferrer" title={i ? "Selfie pulang" : "Selfie masuk"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto[f]} alt="" className="h-14 w-14 rounded-lg object-cover" />
            </a>
          ) : null,
        )}
      </div>
      <div className="min-w-48 flex-1">
        <p>
          <b>{nama}</b> · {tglPendek(b.tanggal)} {b.shift && <span className="text-stone-500">· {b.shift.nama} {b.shift.jam_mulai}–{b.shift.jam_selesai}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-600">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${WARNA_STATUS[b.status]}`}>
            {LABEL_STATUS[b.status]}
            {b.status === "telat" && ` ${a?.telat_menit} mnt`}
          </span>
          {a && (
            <>
              <span>
                Masuk {jamWib(a.masuk_at)} · Pulang {jamWib(a.pulang_at)} · {formatDurasi(b.menitKerja)}
              </span>
              <span>{a.perangkat === "outlet" ? "📟 perangkat outlet" : "📱 HP sendiri"}</span>
              {peta(a.masuk_lat, a.masuk_lng) ? (
                <a href={peta(a.masuk_lat, a.masuk_lng)!} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  lokasi masuk
                </a>
              ) : (
                <span className="text-stone-400">lokasi tidak diizinkan</span>
              )}
              {peta(a.pulang_lat, a.pulang_lng) && (
                <a href={peta(a.pulang_lat, a.pulang_lng)!} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  lokasi pulang
                </a>
              )}
            </>
          )}
        </p>
        {a?.catatan && !edit && <p className="mt-1 text-xs italic text-stone-600">Catatan: {a.catatan}</p>}
        {edit && a && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs">
              Catatan
              <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className="mt-1 block w-56 rounded-lg border px-2 py-1 text-sm" />
            </label>
            {!a.pulang_at && (
              <label className="text-xs">
                Isi jam pulang (WIB)
                <input type="time" value={pulang} onChange={(e) => setPulang(e.target.value)} className="mt-1 block rounded-lg border px-2 py-1 text-sm" />
              </label>
            )}
            <button disabled={pending} onClick={simpan} className="rounded-lg bg-matur-500 px-3 py-1.5 text-xs font-bold text-white">
              Simpan
            </button>
          </div>
        )}
        {msg?.error && <p className="mt-1 text-xs text-red-600">{msg.error}</p>}
      </div>
      {a && !edit && (
        <button onClick={() => setEdit(true)} className="text-xs text-matur-700 underline">
          Koreksi
        </button>
      )}
    </div>
  );
}
