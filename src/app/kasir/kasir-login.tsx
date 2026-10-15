"use client";

import { useActionState, useState } from "react";
import { kasirLoginAction, type LoginState } from "@/lib/actions";

const cls = "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-lg outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-200";

export function KasirLogin({ tujuan = "pos" }: { tujuan?: "pos" | "staf" }) {
  const [email, setEmail] = useState(false);
  const [state, action, pending] = useActionState<LoginState, FormData>(kasirLoginAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value={email ? "email" : "pin"} />
      <input type="hidden" name="tujuan" value={tujuan} />
      {email ? (
        <>
          <label className="block text-sm font-medium">Email<input name="login" type="email" required className={cls} /></label>
          <label className="block text-sm font-medium">Password<input name="secret" type="password" required className={cls} /></label>
        </>
      ) : (
        <>
          <label className="block text-sm font-medium">Kode staf<input name="login" required autoCapitalize="none" autoComplete="username" placeholder="mis. kasir1" className={cls} /></label>
          <label className="block text-sm font-medium">PIN<input name="secret" type="password" required inputMode="numeric" pattern="\d{4,6}" autoComplete="current-password" className={`${cls} tracking-[0.5em]`} /></label>
        </>
      )}
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-matur-500 py-3 text-lg font-bold text-white shadow disabled:opacity-60">
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
      <button type="button" onClick={() => setEmail(!email)} className="w-full text-center text-sm text-stone-500 underline">
        {email ? "Masuk dengan kode staf + PIN" : "Masuk dengan email"}
      </button>
    </form>
  );
}
