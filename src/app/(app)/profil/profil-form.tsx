"use client";

import { useActionState } from "react";
import { gantiPassword, simpanProfil, type Result } from "@/lib/profil-actions";

const cls = "mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 outline-none focus:border-matur-500";
const Msg = ({ r }: { r: Result }) =>
  r.error || r.ok ? <p className={`rounded-lg px-3 py-2 text-sm ${r.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{r.error ?? r.ok}</p> : null;

export function ProfilForm({ nama, hp, pakaiPassword }: { nama: string; hp: string; pakaiPassword: boolean }) {
  const [s1, a1, p1] = useActionState<Result, FormData>(simpanProfil, {});
  const [s2, a2, p2] = useActionState<Result, FormData>(gantiPassword, {});
  return (
    <>
      <form action={a1} className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="font-bold">Data diri</h2>
        <label className="block text-sm font-medium">
          Nama
          <input name="nama" defaultValue={nama} required minLength={2} maxLength={100} className={cls} />
        </label>
        <label className="block text-sm font-medium">
          No. HP / WhatsApp
          <input name="hp" defaultValue={hp} inputMode="tel" placeholder="08xxxxxxxxxx" className={cls} />
        </label>
        <Msg r={s1} />
        <button disabled={p1} className="w-full rounded-xl bg-matur-500 py-2.5 font-semibold text-white disabled:opacity-60">
          {p1 ? "Menyimpan…" : "Simpan"}
        </button>
      </form>
      {pakaiPassword && (
        <form action={a2} key={s2.ok} className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
          <h2 className="font-bold">Ganti password</h2>
          <label className="block text-sm font-medium">
            Password lama
            <input name="lama" type="password" required autoComplete="current-password" className={cls} />
          </label>
          <label className="block text-sm font-medium">
            Password baru (min. 8 karakter)
            <input name="baru" type="password" required minLength={8} autoComplete="new-password" className={cls} />
          </label>
          <label className="block text-sm font-medium">
            Ulangi password baru
            <input name="baru2" type="password" required minLength={8} autoComplete="new-password" className={cls} />
          </label>
          <Msg r={s2} />
          <button disabled={p2} className="w-full rounded-xl border-2 border-matur-500 py-2.5 font-semibold text-matur-700 disabled:opacity-60">
            {p2 ? "Memproses…" : "Ganti password"}
          </button>
        </form>
      )}
    </>
  );
}
