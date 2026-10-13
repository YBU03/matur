"use client";

import { useActionState } from "react";
import { daftarAction, type DaftarState } from "@/lib/actions";

const cls = "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-200";

export function DaftarForm() {
  const [state, action, pending] = useActionState<DaftarState, FormData>(daftarAction, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium">Nama lengkap<input name="nama" required minLength={2} className={cls} /></label>
      <label className="block text-sm font-medium">Email<input name="email" type="email" required className={cls} /></label>
      <label className="block text-sm font-medium">No. HP / WhatsApp<input name="hp" inputMode="tel" className={cls} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Password<input name="password" type="password" required minLength={8} className={cls} /></label>
        <label className="block text-sm font-medium">Ulangi password<input name="password2" type="password" required minLength={8} className={cls} /></label>
      </div>
      <label className="flex items-start gap-2 rounded-xl border border-matur-200 bg-matur-50 p-3 text-sm">
        <input type="checkbox" name="staf_outlet" value="1" className="mt-0.5 size-4 accent-matur-500" />
        <span>
          Saya <b>karyawan outlet</b> (kasir/barista)
          <span className="block text-xs text-stone-500">Pendaftaran Anda diperiksa HRD/Gudang. Peran dan outlet tetap ditentukan admin.</span>
        </span>
      </label>
      <label className="block text-sm font-medium">Keterangan untuk admin (opsional)<textarea name="catatan" rows={2} placeholder="mis. mitra outlet Ruma Kopiaksa, kasir baru, dll." className={cls} /></label>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-matur-500 py-3 font-semibold text-white shadow hover:bg-matur-600 disabled:opacity-60">
        {pending ? "Mengirim…" : "Daftar"}
      </button>
    </form>
  );
}
