"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import {
  cekAdminTablet,
  pasangTablet,
  type OutletPasang,
} from "@/lib/pos-tablet-actions";

// Pemasangan tablet sekali oleh admin/SPV. Staf tidak perlu tahu email/password apa pun.
export function PasangTablet({
  akunSekarang,
  pesan,
}: {
  akunSekarang?: string | null;
  pesan?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [outlets, setOutlets] = useState<OutletPasang[] | null>(null);
  const [outlet, setOutlet] = useState("");
  const [nama, setNama] = useState("");
  const [mode, setMode] = useState<"kasir" | "antrean">("kasir");
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const cls = "mt-1 w-full rounded-xl border border-stone-300 p-3 text-base";
  const run = (f: () => Promise<void>) =>
    start(async () => {
      setErr("");
      try {
        await f();
      } catch {
        setErr("Koneksi terputus. Coba lagi saat online.");
      }
    });
  return (
    <div className="mx-auto mt-6 max-w-lg space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-center">
        <Image
          src="/brand/logo-192.png"
          alt="Matoer"
          width={64}
          height={64}
          className="mx-auto rounded-2xl"
        />
        <h1 className="mt-3 text-2xl font-bold">Pasangkan Tablet POS</h1>
        <p className="mt-1 text-sm text-stone-500">
          Dilakukan sekali oleh Owner / HRD / Admin Gudang atau SPV outlet.
          Setelah terpasang, tablet terkunci ke outlet dan staf cukup memakai
          kode staf + PIN.
        </p>
      </div>
      {pesan && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {pesan}
        </p>
      )}
      {akunSekarang && (
        <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
          Perangkat ini sedang masuk sebagai <b>{akunSekarang}</b>. Untuk absen,
          jadwal, dan slip di HP pribadi buka <b>/karyawan</b>. Memasangkan
          tablet akan mengganti akun di perangkat ini.
        </p>
      )}
      {!outlets ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await cekAdminTablet(email, password);
              if (r.error) return setErr(r.error);
              setOutlets(r.outlets!);
              setOutlet(r.outlets!.length === 1 ? r.outlets![0].id : "");
            });
          }}
        >
          <label className="block text-sm font-semibold">
            Email admin / SPV
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="off"
              className={cls}
            />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="off"
              className={cls}
            />
          </label>
          <button
            disabled={busy}
            className="w-full rounded-xl bg-kopi-900 p-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? "Memeriksa…" : "Lanjut"}
          </button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await pasangTablet(email, password, outlet, nama, mode);
              if (r.error) return setErr(r.error);
              setPassword("");
              location.href = mode === "antrean" ? "/kasir/antrean" : "/pos";
            });
          }}
        >
          <label className="block text-sm font-semibold">
            Outlet
            <select
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
              required
              className={cls}
            >
              <option value="">Pilih outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Nama tablet
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
              minLength={3}
              maxLength={100}
              placeholder="Contoh: Tablet Kasir 1"
              className={cls}
            />
          </label>
          <fieldset className="space-y-2 rounded-xl border p-3">
            <legend className="px-1 text-sm font-semibold">
              Fungsi tablet
            </legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                checked={mode === "kasir"}
                onChange={() => setMode("kasir")}
                className="mt-1"
              />
              <span>
                <b>Kasir (wajib 1 per outlet)</b> — kasir, antrean, draft,
                riwayat, kas, stok, printer, tutup shift.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                checked={mode === "antrean"}
                onChange={() => setMode("antrean")}
                className="mt-1"
              />
              <span>
                <b>Antrean saja</b> — layar barista (HP/tablet) yang hanya
                menampilkan pesanan masuk.
              </span>
            </label>
          </fieldset>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOutlets(null)}
              className="rounded-xl border px-4 py-3 text-sm"
            >
              Kembali
            </button>
            <button
              disabled={busy || !outlet}
              className="flex-1 rounded-xl bg-matur-500 p-3 font-bold text-white disabled:opacity-50"
            >
              {busy ? "Memasangkan…" : "Pasangkan tablet ini"}
            </button>
          </div>
        </form>
      )}
      {err && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {err}
        </p>
      )}
    </div>
  );
}
