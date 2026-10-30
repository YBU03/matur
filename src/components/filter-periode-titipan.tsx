"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  periodeTitipan,
  tautanTitipan,
  type PeriodeTitipan,
} from "@/lib/periode-titipan";
const cls =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";
function tanggalIndonesia(tanggal: string) {
  return new Date(`${tanggal}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function FilterPeriodeTitipan({
  outletId,
  tanggal,
  periode,
  akhir,
}: {
  outletId: string;
  tanggal: string;
  periode: PeriodeTitipan;
  akhir: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(periode);
  const [acuan, setAcuan] = useState(tanggal);
  const [sampai, setSampai] = useState(akhir);
  const [pending, start] = useTransition();
  let rentang: { awal: string; akhir: string } | undefined;
  let error = "";
  try {
    rentang = periodeTitipan(acuan, mode, sampai);
  } catch (e) {
    error = (e as Error).message;
  }
  const bagian =
    Number(acuan.slice(8)) <= 10 ? 1 : Number(acuan.slice(8)) <= 20 ? 11 : 21;
  return (
    <form
      className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rentang) return;
        start(() => router.push(tautanTitipan(outletId, acuan, mode, sampai)));
      }}
    >
      <fieldset
        disabled={pending}
        className="grid items-end gap-3 sm:grid-cols-3"
      >
        <label className="space-y-1 text-sm">
          <span>Periode rekap</span>
          <select
            className={cls}
            value={mode}
            onChange={(e) => setMode(e.target.value as PeriodeTitipan)}
          >
            <option value="harian">Harian</option>
            <option value="mingguan">Mingguan (Senin–Minggu)</option>
            <option value="sepuluh_hari">Per 10 Hari</option>
            <option value="bulanan">Bulanan</option>
            <option value="kustom">Kustom tanggal</option>
          </select>
        </label>
        {mode === "sepuluh_hari" || mode === "bulanan" ? (
          <label className="space-y-1 text-sm">
            <span>Bulan</span>
            <input
              type="month"
              required
              className={cls}
              value={acuan.slice(0, 7)}
              onChange={(e) =>
                setAcuan(
                  e.target.value
                    ? `${e.target.value}-${mode === "sepuluh_hari" ? String(bagian).padStart(2, "0") : "01"}`
                    : "",
                )
              }
            />
          </label>
        ) : (
          <label className="space-y-1 text-sm">
            <span>{mode === "kustom" ? "Tanggal mulai" : "Tanggal acuan"}</span>
            <input
              type="date"
              required
              className={cls}
              value={acuan}
              onChange={(e) => setAcuan(e.target.value)}
            />
          </label>
        )}
        {mode === "sepuluh_hari" && (
          <label className="space-y-1 text-sm">
            <span>Bagian bulan</span>
            <select
              className={cls}
              value={bagian}
              onChange={(e) =>
                setAcuan(
                  `${acuan.slice(0, 7)}-${String(e.target.value).padStart(2, "0")}`,
                )
              }
            >
              <option value={1}>Periode 1 · tanggal 1–10</option>
              <option value={11}>Periode 2 · tanggal 11–20</option>
              <option value={21}>Periode 3 · tanggal 21–akhir bulan</option>
            </select>
          </label>
        )}
        {mode === "kustom" && (
          <label className="space-y-1 text-sm">
            <span>Tanggal akhir</span>
            <input
              type="date"
              required
              min={acuan}
              className={cls}
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={!rentang || pending}
          className="rounded-xl bg-matur-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Memuat rekap…" : "Terapkan"}
        </button>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        rentang && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
            Rentang pilihan:{" "}
            <b>
              {tanggalIndonesia(rentang.awal)} –{" "}
              {tanggalIndonesia(rentang.akhir)}
            </b>
            {mode === "kustom" && " (termasuk tanggal awal dan akhir)"}
          </p>
        )
      )}
      <p className="text-xs text-stone-500">
        Pilih periode lalu klik Terapkan. Stok awal mengikuti riwayat sebelum
        tanggal mulai.
      </p>
    </form>
  );
}
