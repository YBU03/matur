import Link from "next/link";
import {
  AlarmClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Store,
  Users,
} from "lucide-react";
import type { BarisRekap, StatusHari } from "@/lib/jadwal/rekap";

export type OutletKehadiran = {
  o: { id: string; nama: string };
  baris: BarisRekap[];
  nama: Record<string, string>;
  hadir: number;
  tepat: number;
  jadwal: number;
  bertugas: number;
  telat: number;
  tidak: number;
  shift: number;
  belum: number;
  izin: number;
};
const STATUS: Record<StatusHari, { label: string; warna: string }> = {
  tepat: {
    label: "Tepat waktu",
    warna: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  telat: { label: "Telat", warna: "border-red-200 bg-red-50 text-red-700" },
  belum: {
    label: "Belum absen",
    warna: "border-amber-200 bg-amber-50 text-amber-800",
  },
  tidak_absen: {
    label: "Tidak absen",
    warna: "border-red-200 bg-red-50 text-red-700",
  },
  tanpa_jadwal: {
    label: "Tanpa jadwal",
    warna: "border-stone-200 bg-stone-100 text-stone-700",
  },
  izin: { label: "Izin", warna: "border-blue-200 bg-blue-50 text-blue-800" },
  sakit: { label: "Sakit", warna: "border-blue-200 bg-blue-50 text-blue-800" },
  libur: {
    label: "Libur",
    warna: "border-stone-200 bg-stone-100 text-stone-700",
  },
};
const jam = (value?: string | null) =>
  value
    ? new Date(value)
        .toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(".", ":")
    : "—";

export function KehadiranHariIni({
  outlets,
  tindakan,
}: {
  outlets: OutletKehadiran[];
  tindakan: { href: string; teks: string }[];
}) {
  const sum = (key: "jadwal" | "bertugas" | "tepat" | "telat" | "belum") =>
    outlets.reduce((n, x) => n + x[key], 0);
  const stats = [
    {
      label: "Terjadwal",
      value: sum("jadwal"),
      icon: CalendarDays,
      warna: "bg-orange-50 text-orange-700",
    },
    {
      label: "Sedang bertugas",
      value: sum("bertugas"),
      icon: Users,
      warna: "bg-blue-50 text-blue-700",
    },
    {
      label: "Tepat waktu",
      value: sum("tepat"),
      icon: CheckCircle2,
      warna: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Telat",
      value: sum("telat"),
      icon: AlarmClock,
      warna: "bg-red-50 text-red-700",
    },
    {
      label: "Belum absen",
      value: sum("belum"),
      icon: Clock3,
      warna: "bg-amber-50 text-amber-700",
    },
  ];
  return (
    <section
      className="space-y-5 rounded-3xl border border-matur-200 bg-white p-4 sm:p-5"
      aria-labelledby="kehadiran-hari-ini"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="kehadiran-hari-ini"
            className="text-lg font-bold text-kopi-900"
          >
            Kehadiran hari ini
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Jadwal dan aktivitas tim per outlet · waktu WIB
          </p>
        </div>
        <Link
          href="/absensi"
          className="rounded-xl border border-matur-200 px-3 py-2 text-xs font-semibold text-matur-700 hover:bg-matur-50 focus-visible:outline-2 focus-visible:outline-matur-600"
        >
          Lihat rekap absensi ›
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, warna }) => (
          <div
            key={label}
            className="relative rounded-2xl border border-stone-100 bg-stone-50/60 p-3"
          >
            <div
              className={`absolute right-3 top-3 grid size-7 place-items-center rounded-lg ${warna}`}
            >
              <Icon size={17} aria-hidden="true" />
            </div>
            <p className="pr-8 text-2xl font-bold tabular-nums text-kopi-900">
              {value}
            </p>
            <p className="mt-1 text-xs text-stone-600">{label}</p>
          </div>
        ))}
      </div>
      {tindakan.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tindakan.map((t) => (
            <Link
              key={t.teks}
              href={t.href}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
            >
              🔔 {t.teks} ›
            </Link>
          ))}
        </div>
      )}
      <div className="space-y-4">
        {[...outlets]
          .sort(
            (a, b) => Number(b.baris.length > 0) - Number(a.baris.length > 0),
          )
          .map((x) => (
            <article
              key={x.o.id}
              className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white"
            >
              <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-matur-50/50 p-4">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Store
                    size={18}
                    className="mt-0.5 shrink-0 text-matur-700"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-bold text-kopi-900">
                      {x.o.nama}
                    </h3>
                    <p className="mt-1 text-xs text-stone-500">
                      {x.jadwal} jadwal · {x.hadir} sesi hadir · {x.bertugas}{" "}
                      bertugas
                    </p>
                  </div>
                </div>
                <Link
                  href={`/absensi?outlet=${x.o.id}`}
                  aria-label={`Lihat rekap ${x.o.nama}`}
                  className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-matur-700 ring-1 ring-matur-200 hover:bg-matur-50"
                >
                  Rekap ›
                </Link>
              </div>
              {x.baris.length === 0 ? (
                <div className="px-4 py-5">
                  <p className="text-sm text-stone-500">
                    {x.shift
                      ? "Belum ada jadwal hari ini."
                      : "Shift belum diatur."}
                  </p>
                  <Link
                    href={`/jadwal?outlet=${x.o.id}`}
                    className="mt-2 inline-block text-xs font-semibold text-matur-700"
                  >
                    Lihat jadwal shift ›
                  </Link>
                </div>
              ) : (
                <ul className="grid gap-x-5 px-4 md:grid-cols-2">
                  {x.baris.map((b, i) => {
                    const name = x.nama[b.pengguna_id] ?? "Staf";
                    const status = STATUS[b.status];
                    const sesi = x.baris.filter(
                      (v) => v.pengguna_id === b.pengguna_id && v.absen,
                    );
                    const nomor =
                      b.absen && sesi.length > 1
                        ? sesi.findIndex((v) => v.absen?.id === b.absen?.id) + 1
                        : null;
                    return (
                      <li
                        key={
                          b.absen?.id ??
                          `${b.pengguna_id}-${b.shift?.id ?? b.status}-${i}`
                        }
                        className="border-b border-stone-100 py-4 last:border-b-0"
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            aria-hidden="true"
                            className="grid size-9 shrink-0 place-items-center rounded-full bg-matur-100 text-xs font-bold text-kopi-700"
                          >
                            {name
                              .trim()
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join("")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="break-words text-sm font-bold text-kopi-900">
                                {name}
                                {nomor && (
                                  <span className="ml-1.5 text-xs font-normal text-stone-500">
                                    Sesi {nomor}
                                  </span>
                                )}
                              </p>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.warna}`}
                              >
                                {b.status === "telat"
                                  ? `Telat ${b.absen?.telat_menit ?? 0} menit`
                                  : status.label}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
                              {b.shift
                                ? `${b.shift.nama} · Jadwal ${b.shift.jam_mulai.slice(0, 5)}–${b.shift.jam_selesai.slice(0, 5)}`
                                : "Tanpa jadwal shift"}
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div className="rounded-xl bg-stone-50 px-3 py-2">
                                <p className="text-[11px] text-stone-500">
                                  Jam masuk
                                </p>
                                <p
                                  className={`mt-0.5 text-sm font-semibold tabular-nums ${b.status === "telat" ? "text-red-700" : b.status === "tepat" ? "text-emerald-700" : "text-kopi-900"}`}
                                >
                                  {jam(b.absen?.masuk_at)}
                                </p>
                              </div>
                              <div className="rounded-xl bg-stone-50 px-3 py-2">
                                <p className="text-[11px] text-stone-500">
                                  Jam pulang
                                </p>
                                <p className="mt-0.5 text-sm font-semibold tabular-nums text-kopi-900">
                                  {jam(b.absen?.pulang_at)}
                                </p>
                              </div>
                            </div>
                            {b.absen && (
                              <p
                                className={`mt-2 text-[11px] font-medium ${b.absen.pulang_at ? "text-stone-500" : "text-blue-700"}`}
                              >
                                {b.absen.pulang_at
                                  ? "Sudah pulang"
                                  : "Sedang bertugas"}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {(x.izin > 0 || x.tidak > 0) && (
                <div className="flex flex-wrap gap-2 border-t border-stone-100 px-4 py-3 text-xs">
                  <span className="text-stone-500">
                    {x.izin} izin/sakit/libur
                  </span>
                  <span className="text-red-700">{x.tidak} tidak absen</span>
                </div>
              )}
            </article>
          ))}
      </div>
      <p className="text-[11px] leading-relaxed text-stone-400">
        Angka mengikuti catatan jadwal dan sesi absensi. Satu orang dapat
        memiliki lebih dari satu sesi; status telat mengikuti aturan absensi
        yang berlaku.
      </p>
    </section>
  );
}
