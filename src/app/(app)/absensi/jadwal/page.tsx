import Link from "next/link";
import { hariIni } from "@/lib/jadwal/waktu";
import { LiveRefresh } from "@/components/live-refresh";
import { loadJadwalLihat } from "@/lib/jadwal-lihat";
import type { JadwalLihatParams } from "@/lib/jadwal/rentang-lihat";

const dateLabel = (date: string) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const shiftColors = [
  "border-orange-200 bg-orange-50 text-orange-900",
  "border-blue-200 bg-blue-50 text-blue-900",
  "border-violet-200 bg-violet-50 text-violet-900",
  "border-emerald-200 bg-emerald-50 text-emerald-900",
];
export default async function JadwalLihatPage({
  searchParams,
}: {
  searchParams: Promise<JadwalLihatParams>;
}) {
  const d = await loadJadwalLihat(await searchParams);
  const { range: r } = d;
  const href = (extra: Record<string, string>) =>
    `/absensi/jadwal?${new URLSearchParams({ mode: r.mode, tanggal: r.mode === "bulan" ? r.start : r.tanggal, bulan: r.mode === "bulan" ? r.bulan : r.tanggal.slice(0, 7), ...(d.outlet ? { outlet: d.outlet.id } : {}), ...extra })}`;
  const today = hariIni();
  const totalPeople = new Set(d.jadwal.map((j) => j.pengguna_id)).size;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {d.outlet && (
        <LiveRefresh
          pantau={[
            { table: "jadwal_shift", filter: `outlet_id=eq.${d.outlet.id}` },
          ]}
          cadanganDetik={60}
        />
      )}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-matur-700">
          Rekap Absensi
        </p>
        <h1 className="mt-1 text-2xl font-bold text-kopi-900">Jadwal Shift</h1>
        <p className="mt-2 text-sm text-stone-500">
          Jadwal yang sudah diterbitkan HRD · hanya lihat · jam WIB
        </p>
      </header>
      <nav className="flex gap-2" aria-label="Bagian rekap absensi">
        {d.role === "owner" && (
          <Link
            href={`/absensi${d.outlet ? `?outlet=${d.outlet.id}` : ""}`}
            className="rounded-xl border border-matur-200 bg-white px-4 py-2 text-sm font-semibold text-kopi-700"
          >
            Rekap Absensi
          </Link>
        )}
        <span
          aria-current="page"
          className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Jadwal Shift
        </span>
      </nav>
      <section className="space-y-4 rounded-2xl border border-matur-200 bg-white p-4">
        <div className="flex flex-wrap gap-2" aria-label="Rentang jadwal">
          {(
            [
              ["hari", "Harian"],
              ["minggu", "Mingguan"],
              ["bulan", "Bulanan"],
            ] as const
          ).map(([mode, label]) => (
            <Link
              key={mode}
              href={href({ mode })}
              aria-current={r.mode === mode ? "page" : undefined}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${r.mode === mode ? "bg-matur-500 text-white" : "bg-stone-50 text-stone-600"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <form
          action="/absensi/jadwal"
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="mode" value={r.mode} />
          <label className="min-w-0 text-xs font-medium text-stone-600">
            Outlet
            <select
              name="outlet"
              defaultValue={d.outlet?.id ?? ""}
              className="mt-1 block max-w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
            >
              {d.outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-stone-600">
            {r.mode === "bulan" ? "Bulan" : "Tanggal"}
            <input
              key={r.mode === "bulan" ? r.bulan : r.tanggal}
              type={r.mode === "bulan" ? "month" : "date"}
              name={r.mode === "bulan" ? "bulan" : "tanggal"}
              defaultValue={r.mode === "bulan" ? r.bulan : r.tanggal}
              className="mt-1 block rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-semibold text-white">
            Tampilkan
          </button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <p className="text-sm font-semibold text-kopi-900">
            {dateLabel(r.start)}
            {r.end !== r.start && ` – ${dateLabel(r.end)}`}
          </p>
          <div className="flex gap-2">
            <Link
              href={href(r.prev)}
              aria-label="Periode sebelumnya"
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
            >
              ←
            </Link>
            <Link
              href={href({
                tanggal: today,
                bulan: today.slice(0, 7),
              })}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold"
            >
              Periode ini
            </Link>
            <Link
              href={href(r.next)}
              aria-label="Periode berikutnya"
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
            >
              →
            </Link>
          </div>
        </div>
      </section>
      {d.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {d.error}
        </p>
      ) : !d.outlet ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-stone-500">
          Belum ada outlet yang bisa ditampilkan.
        </p>
      ) : (
        <>
          <p className="text-sm text-stone-500">
            <b className="text-kopi-900">{d.jadwal.length}</b> penugasan shift ·{" "}
            <b className="text-kopi-900">{totalPeople}</b> karyawan ·{" "}
            {d.outlet.nama}
          </p>
          <div
            className={`grid items-start gap-3 ${r.mode === "hari" ? "" : "md:grid-cols-2 xl:grid-cols-3"}`}
          >
            {r.days.map((day) => {
              const rows = d.jadwal.filter((j) => j.tanggal === day);
              return (
                <section
                  key={day}
                  className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4"
                >
                  <h2 className="border-b border-stone-100 pb-3 text-sm font-bold text-kopi-900">
                    {dateLabel(day)}
                  </h2>
                  {rows.length === 0 ? (
                    <p className="pt-3 text-xs text-stone-400">
                      Belum ada jadwal terbit.
                    </p>
                  ) : (
                    <ul className="space-y-3 pt-3">
                      {d.shifts
                        .filter((s) => rows.some((j) => j.shift_id === s.id))
                        .map((shift) => (
                          <li
                            key={shift.id}
                            className={`rounded-xl border p-3 ${shiftColors[d.shifts.indexOf(shift) % shiftColors.length]}`}
                          >
                            <p className="text-sm font-bold">{shift.nama}</p>
                            <p className="mt-1 text-xs">
                              {shift.jam_mulai.slice(0, 5)}–
                              {shift.jam_selesai.slice(0, 5)} WIB
                              {shift.jam_selesai <= shift.jam_mulai
                                ? " · selesai besok"
                                : ""}
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {rows
                                .filter((j) => j.shift_id === shift.id)
                                .map((j) => (
                                  <li
                                    key={j.id}
                                    className="break-words rounded-lg bg-white/75 px-2.5 py-2 text-sm font-medium"
                                  >
                                    {d.nama[j.pengguna_id] ??
                                      "Nama belum tersedia"}
                                  </li>
                                ))}
                            </ul>
                          </li>
                        ))}
                      {rows
                        .filter(
                          (j) => !d.shifts.some((s) => s.id === j.shift_id),
                        )
                        .map((j) => (
                          <li
                            key={j.id}
                            className="rounded-xl bg-stone-50 p-3 text-sm"
                          >
                            {d.nama[j.pengguna_id] ?? "Nama belum tersedia"}
                            <p className="text-xs text-stone-500">
                              Detail shift belum tersedia
                            </p>
                          </li>
                        ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
