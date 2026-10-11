"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/lib/actions";

export function LoginForm() {
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-matur-100 p-1 text-sm font-semibold">
        {(["password", "pin"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 ${mode === m ? "bg-white shadow text-matur-700" : "text-kopi-700"}`}
          >
            {m === "password" ? "Email / HP" : "PIN Kasir & Barista"}
          </button>
        ))}
      </div>
      <input type="hidden" name="mode" value={mode} />
      {mode === "password" ? (
        <>
          <Field name="login" label="Email atau No. HP" placeholder="nama@matur.id" />
          <Field name="secret" label="Password" type="password" />
        </>
      ) : (
        <Field name="secret" label="PIN (4–6 digit)" type="password" inputMode="numeric" pattern="\d{4,6}" />
      )}
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-xl bg-matur-500 py-3 font-semibold text-white shadow hover:bg-matur-600 disabled:opacity-60"
      >
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
      <details className="rounded-lg border border-matur-200 bg-matur-50 p-3 text-xs text-kopi-700">
        <summary className="cursor-pointer font-semibold">Akun demo (Tahap 1)</summary>
        <p className="mt-2">Password semua akun: <b>matur123</b></p>
        <p>owner@ · finance@ · hrd@ · gudang@ · spv@ · mitra@ · pic@ (matur.id)</p>
        <p>PIN kasir: <b>1234</b> · barista: <b>5678</b></p>
      </details>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        required
        {...props}
        className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-200"
      />
    </label>
  );
}
