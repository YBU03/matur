"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeftRight, ClipboardList, Send } from "lucide-react";
import { Kartu, KepalaKartu, Kosong, Lencana, masukan, Pesan, tombol } from "@/components/staf/ui";
import { addDays } from "@/lib/jadwal/waktu";
import type { AturanSdm, Izin, Jadwal, Shift } from "@/lib/sdm";
import { ajukanIzin, ajukanTukar, batalIzin, batalTukar, jawabTukar, type Result } from "@/lib/sdm-actions";

export type Tukar = { id: string; pengaju_id: string; rekan_id: string; jadwal_pengaju: string; jadwal_rekan: string; alasan: string | null; status: string; alasan_tolak: string | null; created_at: string };

const JENIS = { izin: "Izin", sakit: "Sakit", libur: "Libur mingguan" } as const;
const STATUS_IZIN: Record<string, { label: string; nada: "kuning" | "hijau" | "merah" | "netral" }> = {
  menunggu: { label: "Menunggu", nada: "kuning" },
  disetujui: { label: "Disetujui", nada: "hijau" },
  ditolak: { label: "Ditolak", nada: "merah" },
  dibatalkan: { label: "Dibatalkan", nada: "netral" },
};
const STATUS_TUKAR: Record<string, { label: string; nada: "kuning" | "hijau" | "merah" | "netral" }> = {
  menunggu_rekan: { label: "Menunggu rekan", nada: "kuning" },
  menunggu_atasan: { label: "Menunggu HRD/SPV", nada: "kuning" },
  disetujui: { label: "Disetujui", nada: "hijau" },
  ditolak: { label: "Ditolak", nada: "merah" },
  dibatalkan: { label: "Dibatalkan", nada: "netral" },
};
const tgl = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

export function PengajuanStaf(p: { saya: string; today: string; aturan: AturanSdm; izin: Izin[]; shifts: Shift[]; nama: Record<string, string>; jadwal: Jadwal[]; tukar: Tukar[]; tukarAwal: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hasil, setHasil] = useState<Result | null>(null);
  const [tab, setTab] = useState<"izin" | "tukar">(p.tukarAwal || p.tukar.some((t) => t.rekan_id === p.saya && t.status === "menunggu_rekan") ? "tukar" : "izin");
  const jalankan = (f: () => Promise<Result>, selesai?: () => void) =>
    start(async () => {
      const r = await f();
      setHasil(r);
      if (r.ok) selesai?.();
      router.refresh();
    });

  const masukTukar = p.tukar.filter((t) => t.rekan_id === p.saya && t.status === "menunggu_rekan");
  return (
    <div className="space-y-4">
      <div className="flex rounded-full bg-white p-1 shadow-[var(--shadow-kartu)] lg:max-w-md">
        {(
          [
            ["izin", "Izin & libur"],
            ["tukar", `Tukar shift${masukTukar.length ? ` (${masukTukar.length})` : ""}`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => {
              setTab(k);
              setHasil(null);
            }} className={`min-h-11 flex-1 rounded-full text-sm font-bold ${tab === k ? "bg-matur-600 text-white" : "text-redup"}`}>
            {l}
          </button>
        ))}
      </div>
      <Pesan hasil={hasil} />
      {tab === "izin" ? <TabIzin {...p} pending={pending} jalankan={jalankan} /> : <TabTukar {...p} masuk={masukTukar} pending={pending} jalankan={jalankan} />}
    </div>
  );
}

type Aksi = { pending: boolean; jalankan: (f: () => Promise<Result>, selesai?: () => void) => void };

function TabIzin({ today, aturan, izin, pending, jalankan }: { today: string; aturan: AturanSdm; izin: Izin[] } & Aksi) {
  const [jenis, setJenis] = useState<keyof typeof JENIS>("izin");
  const minIzin = addDays(today, aturan.izin_min_hari);
  const min = jenis === "izin" ? minIzin : jenis === "libur" ? addDays(today, 1) : today;
  const [tanggal, setTanggal] = useState(minIzin);
  const [alasan, setAlasan] = useState("");
  const ganti = (j: keyof typeof JENIS) => {
    setJenis(j);
    const m = j === "izin" ? minIzin : j === "libur" ? addDays(today, 1) : today;
    if (tanggal < m) setTanggal(m);
  };
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
      <Kartu>
        <KepalaKartu judul="Ajukan baru" keterangan="Disetujui HRD/SPV, hasilnya dikabarkan lewat notifikasi." />
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(JENIS) as (keyof typeof JENIS)[]).map((j) => (
            <button
              key={j}
              disabled={j === "libur" && !aturan.libur_mingguan_dibuka}
              onClick={() => ganti(j)}
              className={`min-h-11 rounded-2xl border px-2 text-xs font-bold disabled:opacity-40 ${jenis === j ? "border-matur-500 bg-matur-50 text-matur-700" : "border-garis text-redup"}`}
            >
              {JENIS[j]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-redup">
          {jenis === "izin" && `Wajib minimal H-${aturan.izin_min_hari} (paling cepat ${tgl(minIzin)}). Mendadak hari ini? Hubungi SPV/HRD.`}
          {jenis === "sakit" && "Bisa untuk hari ini. Tulis keterangan singkat."}
          {jenis === "libur" && "Pilih hari libur mingguanmu. Yang disetujui dipakai saat jadwal disusun."}
          {!aturan.libur_mingguan_dibuka && jenis !== "libur" && " Pengajuan libur mingguan sedang ditutup HRD."}
        </p>
        <label className="mt-3 block text-sm font-semibold text-kopi-900">
          Tanggal
          <input type="date" min={min} value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={masukan} />
        </label>
        <label className="mt-3 block text-sm font-semibold text-kopi-900">
          Alasan {jenis === "libur" && <span className="font-normal text-redup">(opsional)</span>}
          <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={3} className={masukan} />
        </label>
        <button disabled={pending || tanggal < min} onClick={() => jalankan(() => ajukanIzin(jenis, tanggal, alasan), () => setAlasan(""))} className={`${tombol.utama} mt-4 w-full`}>
          <Send className="size-4" aria-hidden /> {pending ? "Mengirim…" : "Kirim pengajuan"}
        </button>
      </Kartu>
      <Kartu>
        <KepalaKartu judul="Pengajuan saya" />
        {izin.length ? (
          <ul className="divide-y divide-garis">
            {izin.map((i) => (
              <li key={i.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold capitalize text-kopi-900">
                    {JENIS[i.jenis]} · {tgl(i.tanggal)}
                  </span>
                  <Lencana nada={STATUS_IZIN[i.status].nada}>{STATUS_IZIN[i.status].label}</Lencana>
                </div>
                {i.alasan && <p className="mt-0.5 text-[12px] text-redup">“{i.alasan}”</p>}
                {i.alasan_tolak && <p className="mt-0.5 text-[12px] text-red-600">Alasan ditolak: {i.alasan_tolak}</p>}
                {i.status === "menunggu" && (
                  <button disabled={pending} onClick={() => jalankan(() => batalIzin(i.id))} className="mt-1 text-[12px] font-semibold text-red-600 underline">
                    Batalkan
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Kosong ikon={ClipboardList} judul="Belum ada pengajuan" />
        )}
      </Kartu>
    </div>
  );
}

function TabTukar({ saya, today, shifts, nama, jadwal, tukar, tukarAwal, masuk, pending, jalankan }: { saya: string; today: string; shifts: Shift[]; nama: Record<string, string>; jadwal: Jadwal[]; tukar: Tukar[]; tukarAwal: string; masuk: Tukar[] } & Aksi) {
  const shift = new Map(shifts.map((s) => [s.id, s]));
  const byId = new Map(jadwal.map((j) => [j.id, j]));
  const besok = addDays(today, 1);
  const sedang = new Set(tukar.filter((t) => ["menunggu_rekan", "menunggu_atasan"].includes(t.status)).flatMap((t) => [t.jadwal_pengaju, t.jadwal_rekan]));
  const urut = (a: Jadwal, b: Jadwal) => a.tanggal.localeCompare(b.tanggal) || (shift.get(a.shift_id)?.jam_mulai ?? "").localeCompare(shift.get(b.shift_id)?.jam_mulai ?? "");
  const milikSaya = jadwal.filter((j) => j.pengguna_id === saya && j.tanggal >= besok && !sedang.has(j.id)).sort(urut);
  const milikRekan = jadwal.filter((j) => j.pengguna_id !== saya && j.tanggal >= besok && !sedang.has(j.id)).sort(urut);
  const [dari, setDari] = useState(milikSaya.some((j) => j.id === tukarAwal) ? tukarAwal : "");
  const [ke, setKe] = useState("");
  const [alasan, setAlasan] = useState("");
  const label = (j: Jadwal | undefined) => (j ? `${tgl(j.tanggal)} · ${shift.get(j.shift_id)?.nama ?? ""} ${shift.get(j.shift_id)?.jam_mulai ?? ""}` : "jadwal lama");
  const n = (id: string) => nama[id] ?? "Rekan";

  return (
    <div className="space-y-4">
      {masuk.map((t) => (
        <Kartu key={t.id} className="!border-amber-300 !bg-amber-50">
          <p className="text-sm text-kopi-900">
            <b>{n(t.pengaju_id)}</b> ingin menukar <b>{label(byId.get(t.jadwal_pengaju))}</b> miliknya dengan jadwal kamu <b>{label(byId.get(t.jadwal_rekan))}</b>.
          </p>
          {t.alasan && <p className="mt-1 text-[13px] text-redup">“{t.alasan}”</p>}
          <div className="mt-3 flex gap-2">
            <button disabled={pending} onClick={() => jalankan(() => jawabTukar(t.id, true))} className={`${tombol.utama} flex-1`}>
              Terima
            </button>
            <button disabled={pending} onClick={() => jalankan(() => jawabTukar(t.id, false))} className={`${tombol.bahaya} flex-1`}>
              Tolak
            </button>
          </div>
        </Kartu>
      ))}
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
        <Kartu>
          <KepalaKartu judul="Ajukan tukar shift" keterangan="Paling lambat H-1. Rekan menerima dulu, lalu HRD/SPV menyetujui." />
          <label className="block text-sm font-semibold text-kopi-900">
            Shift saya
            <select value={dari} onChange={(e) => setDari(e.target.value)} className={masukan}>
              <option value="">Pilih shift…</option>
              {milikSaya.map((j) => (
                <option key={j.id} value={j.id}>
                  {label(j)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-semibold text-kopi-900">
            Ditukar dengan
            <select value={ke} onChange={(e) => setKe(e.target.value)} className={masukan}>
              <option value="">Pilih shift rekan…</option>
              {milikRekan.map((j) => (
                <option key={j.id} value={j.id}>
                  {n(j.pengguna_id)} — {label(j)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-semibold text-kopi-900">
            Alasan <span className="font-normal text-redup">(opsional)</span>
            <input value={alasan} onChange={(e) => setAlasan(e.target.value)} className={masukan} />
          </label>
          <button
            disabled={pending || !dari || !ke}
            onClick={() =>
              jalankan(
                () => ajukanTukar(dari, ke, alasan),
                () => {
                  setDari("");
                  setKe("");
                  setAlasan("");
                },
              )
            }
            className={`${tombol.utama} mt-4 w-full`}
          >
            <ArrowLeftRight className="size-4" aria-hidden /> Kirim permintaan
          </button>
          {!milikSaya.length && <p className="mt-2 text-[12px] text-redup">Belum ada shift terbit mulai besok yang bisa ditukar.</p>}
        </Kartu>
        <Kartu>
          <KepalaKartu judul="Riwayat tukar shift" />
          {tukar.length ? (
            <ul className="divide-y divide-garis">
              {tukar.map((t) => {
                const sayaPengaju = t.pengaju_id === saya;
                return (
                  <li key={t.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-kopi-900">{sayaPengaju ? `Dengan ${n(t.rekan_id)}` : `Dari ${n(t.pengaju_id)}`}</span>
                      <Lencana nada={STATUS_TUKAR[t.status].nada}>{STATUS_TUKAR[t.status].label}</Lencana>
                    </div>
                    <p className="mt-0.5 text-[12px] capitalize text-redup">
                      {label(byId.get(t.jadwal_pengaju))} ⇄ {label(byId.get(t.jadwal_rekan))}
                    </p>
                    {t.alasan_tolak && <p className="mt-0.5 text-[12px] text-red-600">{t.alasan_tolak}</p>}
                    {sayaPengaju && ["menunggu_rekan", "menunggu_atasan"].includes(t.status) && (
                      <button disabled={pending} onClick={() => jalankan(() => batalTukar(t.id))} className="mt-1 text-[12px] font-semibold text-red-600 underline">
                        Batalkan
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Kosong ikon={ArrowLeftRight} judul="Belum ada tukar shift" />
          )}
        </Kartu>
      </div>
    </div>
  );
}
