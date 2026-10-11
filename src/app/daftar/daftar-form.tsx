"use client";

import Link from "next/link";
import { useActionState } from "react";
import { daftarAction, type DaftarState } from "@/lib/actions";
import { PERAN_DAFTAR } from "@/lib/roles";

const cls = "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-200";

export function DaftarForm() {
  const [state, action, pending] = useActionState<DaftarState, FormData>(daftarAction, {});
  if (state.ok)
    return (
      <div className="rounded-2xl border border-green-300 bg-green-50 p-5 text-green-800">
        <p className="font-bold">Pendaftaran terkirim ✅</p>
        <p className="mt-1 text-sm">Admin akan memeriksa dan menentukan akses Anda. Setelah disetujui, silakan masuk dengan email dan password yang tadi dibuat.</p>
        <Link href="/login" className="mt-3 inline-block rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white">Ke halaman masuk</Link>
      </div>
    );
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium">Nama lengkap<input name="nama" required minLength={2} className={cls} /></label>
      <label className="block text-sm font-medium">Email<input name="email" type="email" required className={cls} /></label>
      <label className="block text-sm font-medium">No. HP / WhatsApp<input name="hp" inputMode="tel" className={cls} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Password<input name="password" type="password" required minLength={8} className={cls} /></label>
        <label className="block text-sm font-medium">Ulangi password<input name="password2" type="password" required minLength={8} className={cls} /></label>
      </div>
      <label className="block text-sm font-medium">
        Mendaftar sebagai
        <select name="peran" required defaultValue="" className={cls}>
          <option value="" disabled>— pilih —</option>
          {PERAN_DAFTAR.map(([r, l]) => <option key={r} value={r}>{l}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Outlet yang dimaksud (jika ada)<input name="outlet" placeholder="mis. Ruma Kopiaksa" className={cls} /></label>
      <label className="block text-sm font-medium">Catatan untuk admin<textarea name="catatan" rows={2} className={cls} /></label>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-matur-500 py-3 font-semibold text-white shadow hover:bg-matur-600 disabled:opacity-60">
        {pending ? "Mengirim…" : "Daftar"}
      </button>
    </form>
  );
}
