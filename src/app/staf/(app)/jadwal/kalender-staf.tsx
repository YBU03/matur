"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftRight, CalendarX2, X } from "lucide-react";
import { Kartu, KepalaKartu, Kosong, Lencana, tombol } from "@/components/staf/ui";
import { addDays, eachDate, hariIni, monthRange, weekdayIndex, WEEKDAY_LABELS } from "@/lib/jadwal/waktu";
import type { Izin, Jadwal, Shift } from "@/lib/sdm";

const JENIS: Record<string, string> = { izin: "Izin", libur: "Libur", sakit: "Sakit" };
const tglPanjang = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function KalenderStaf({ bulan, saya, shifts, nama, jadwal, izin }: { bulan: string; saya: string; shifts: Shift[]; nama: Record<string, string>; jadwal: Jadwal[]; izin: Izin[] }) {
  const [pilih, setPilih] = useState<string | null>(null);
  const today = hariIni();
  const { start, end } = monthRange(bulan);
  const dates = eachDate(start, end);
  const shift = new Map(shifts.map((s) => [s.id, s]));
  const mulai = (j: Jadwal) => shift.get(j.shift_id)?.jam_mulai ?? "";
  const milik = jadwal.filter((j) => j.pengguna_id === saya).sort((a, b) => a.tanggal.localeCompare(b.tanggal) || mulai(a).localeCompare(mulai(b)));
  const izinTgl = new Map(izin.map((i) => [i.tanggal, i]));

  useEffect(() => {
    if (!pilih) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPilih(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [pilih]);

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[1fr_320px] lg:gap-5 lg:space-y-0">
      <Kartu className="!p-3 sm:!p-5">
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-redup">
          {WEEKDAY_LABELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: weekdayIndex(start) }).map((_, i) => (
            <span key={i} />
          ))}
          {dates.map((d) => {
            const punya = milik.filter((j) => j.tanggal === d);
            const iz = izinTgl.get(d);
            return (
              <button
                key={d}
                onClick={() => setPilih(d)}
                aria-label={`Lihat jadwal ${tglPanjang(d)}`}
                className={`flex min-h-[74px] flex-col gap-1 rounded-[14px] border p-1.5 text-left transition-colors hover:border-matur-400 sm:min-h-[92px] sm:p-2 ${pilih === d ? "border-matur-500 bg-matur-50" : "border-garis bg-white"}`}
              >
                <span className={`tabular inline-flex size-6 items-center justify-center rounded-full text-[12px] font-bold ${d === today ? "bg-matur-600 text-white" : "text-kopi-900"}`}>{Number(d.slice(8))}</span>
                {punya.map((j) => (
                  <span key={j.id} title={shift.get(j.shift_id)?.nama} className="block truncate rounded-md bg-matur-100 px-1 py-0.5 text-center text-[10px] font-bold text-matur-700 sm:text-left sm:text-[11px] sm:font-semibold">
                    <span className="sm:hidden">{shift.get(j.shift_id)?.nama.slice(0, 1)}</span>
                    <span className="hidden sm:inline">{shift.get(j.shift_id)?.nama}</span>
                  </span>
                ))}
                {iz && <span className={`block truncate rounded-md px-1 py-0.5 text-[10px] font-semibold ${iz.status === "disetujui" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-700"}`}><span className="sm:hidden">{JENIS[iz.jenis].slice(0, 1)}</span><span className="hidden sm:inline">{JENIS[iz.jenis]}</span>{iz.status === "menunggu" ? "?" : ""}</span>}
                {!punya.length && !iz && <span className="text-center text-[10px] font-medium text-redup/70 sm:text-left">Libur</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-redup sm:hidden">
          {shifts
            .filter((x) => x.aktif)
            .map((x) => (
              <span key={x.id}>
                <b className="text-matur-700">{x.nama.slice(0, 1)}</b> = {x.nama} {x.jam_mulai}
              </span>
            ))}
          <span>Ketuk tanggal untuk detail</span>
        </p>
      </Kartu>

      <Kartu>
        <KepalaKartu judul="Shift saya bulan ini" keterangan={`${milik.length} shift terjadwal`} />
        {milik.filter((j) => j.tanggal >= today).length ? (
          <ul className="divide-y divide-garis">
            {milik
              .filter((j) => j.tanggal >= today)
              .slice(0, 8)
              .map((j) => (
                <li key={j.id}>
                  <button onClick={() => setPilih(j.tanggal)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left">
                    <span className="text-sm font-semibold capitalize text-kopi-900">{j.tanggal === today ? "Hari ini" : new Date(j.tanggal + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</span>
                    <span className="tabular text-[12px] font-semibold text-redup">
                      {shift.get(j.shift_id)?.nama} · {shift.get(j.shift_id)?.jam_mulai}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <Kosong ikon={CalendarX2} judul="Tidak ada shift tersisa" keterangan="Jadwal baru muncul setelah diterbitkan." />
        )}
      </Kartu>

      {pilih && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={tglPanjang(pilih)}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setPilih(null)} />
          <div className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-[520px] sm:rounded-[28px]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold capitalize text-kopi-900">{tglPanjang(pilih)}</p>
                <p className="text-[13px] text-redup">Siapa saja yang bertugas</p>
              </div>
              <button onClick={() => setPilih(null)} className="grid size-10 place-items-center rounded-full hover:bg-krem" aria-label="Tutup">
                <X className="size-5" />
              </button>
            </div>
            <HariIni tanggal={pilih} saya={saya} shifts={shifts} nama={nama} jadwal={jadwal} izin={izinTgl.get(pilih)} bolehTukar={pilih >= addDays(today, 1)} />
          </div>
        </div>
      )}
    </div>
  );
}

function HariIni({ tanggal, saya, shifts, nama, jadwal, izin, bolehTukar }: { tanggal: string; saya: string; shifts: Shift[]; nama: Record<string, string>; jadwal: Jadwal[]; izin?: Izin; bolehTukar: boolean }) {
  const isi = jadwal.filter((j) => j.tanggal === tanggal);
  const dipakai = shifts.filter((s) => isi.some((j) => j.shift_id === s.id));
  if (!dipakai.length) return <Kosong ikon={CalendarX2} judul="Belum ada yang dijadwalkan" />;
  return (
    <div className="space-y-2">
      {izin && <Lencana nada={izin.status === "disetujui" ? "ungu" : "kuning"}>{JENIS[izin.jenis]} Anda · {izin.status === "disetujui" ? "disetujui" : "menunggu"}</Lencana>}
      {dipakai.map((s) => {
        const orang = isi.filter((j) => j.shift_id === s.id);
        const milikSaya = orang.find((j) => j.pengguna_id === saya);
        return (
          <div key={s.id} className={`rounded-2xl border p-3 ${milikSaya ? "border-matur-300 bg-matur-50" : "border-garis"}`}>
            <div className="flex items-center justify-between gap-2">
              <Lencana nada="oranye">{s.nama}</Lencana>
              <span className="tabular text-[12px] font-semibold text-redup">
                {s.jam_mulai} – {s.jam_selesai}
              </span>
            </div>
            <p className="mt-2 text-sm text-kopi-900">
              {orang.map((j, i) => (
                <span key={j.id}>
                  {i > 0 && ", "}
                  {j.pengguna_id === saya ? <b>Anda</b> : (nama[j.pengguna_id] ?? "Rekan")}
                </span>
              ))}
            </p>
            {milikSaya && bolehTukar && (
              <Link href={`/staf/pengajuan?tukar=${milikSaya.id}`} className={`${tombol.garis} mt-3 !min-h-10 w-full text-xs`}>
                <ArrowLeftRight className="size-4" aria-hidden /> Ajukan tukar shift ini
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
