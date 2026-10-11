"use client";

import { useActionState, useState } from "react";
import { loginAction, otpAction, type LoginState } from "@/lib/actions";

type Mode = "password" | "otp";
const TABS: [Mode, string][] = [
  ["password", "Email & Password"],
  ["otp", "Kode OTP"],
];

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("password");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-matur-100 p-1 text-sm font-semibold">
        {TABS.map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 ${mode === m ? "bg-white text-matur-700 shadow" : "text-kopi-700"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "otp" ? <OtpForm /> : <PasswordForm />}
    </div>
  );
}

function PasswordForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <Field name="login" label="Email" type="email" placeholder="nama@email.com" />
      <Field name="secret" label="Password" type="password" />
      <Error text={state.error} />
      <Submit pending={pending} />
    </form>
  );
}

function OtpForm() {
  const [state, action, pending] = useActionState<LoginState & { sent?: string }, FormData>(otpAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.sent ? (
        <>
          <input type="hidden" name="login" value={state.sent} />
          <p className="text-sm text-stone-600">
            Kode dikirim ke <b>{state.sent}</b>. Periksa email Anda.
          </p>
          <Field name="secret" label="Kode OTP" inputMode="numeric" autoComplete="one-time-code" />
        </>
      ) : (
        <Field name="login" label="Email terdaftar" type="email" placeholder="mitra@email.com" />
      )}
      <Error text={state.error} />
      <Submit pending={pending} label={state.sent ? "Masuk" : "Kirim kode"} />
    </form>
  );
}

const Error = ({ text }: { text?: string }) =>
  text ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{text}</p> : null;

const Submit = ({ pending, label = "Masuk" }: { pending: boolean; label?: string }) => (
  <button disabled={pending} className="w-full rounded-xl bg-matur-500 py-3 font-semibold text-white shadow hover:bg-matur-600 disabled:opacity-60">
    {pending ? "Memeriksa…" : label}
  </button>
);

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
