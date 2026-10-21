"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { mulaiMasuk } from "@/components/masuk-overlay";
import { loginAction, otpAction, type LoginState } from "@/lib/actions";
import { LoginMascot, type MascotPose } from "./login-mascot";

type Mode = "password" | "otp";
type State = LoginState & { sent?: string };
const TABS: [Mode, string][] = [
  ["password", "Email & Password"],
  ["otp", "Kode OTP"],
];

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("password");
  return <LoginMethod key={mode} mode={mode} onModeChange={setMode} />;
}

function LoginMethod({
  mode,
  onModeChange,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}) {
  const router = useRouter();
  const [focus, setFocus] = useState<MascotPose>("welcome");
  const [visible, setVisible] = useState(false);
  const submitting = useRef(false);
  const [state, action, pending] = useActionState<State, FormData>(
    async (previous, form) => {
      try {
        return await (mode === "password"
          ? loginAction(previous, form)
          : otpAction(previous, form));
      } catch {
        return {
          sent: previous.sent,
          error: "Koneksi terganggu. Silakan coba masuk kembali.",
        };
      } finally {
        submitting.current = false;
      }
    },
    {},
  );
  const success = !!state.destination;
  const locked = pending || success;
  const pose = success ? "success" : focus;

  useEffect(() => {
    if (!state.destination) return;
    // This value is returned only after the original server authentication succeeds.
    const destination = state.destination;
    const timer = setTimeout(() => {
      mulaiMasuk({ label: "Sedang menyiapkan dashboard…" });
      router.replace(destination);
    }, 1200);
    return () => clearTimeout(timer);
  }, [state.destination, router]);

  function changeMode(next: Mode) {
    if (locked || submitting.current) return;
    onModeChange(next);
    setFocus("welcome");
    setVisible(false);
  }

  return (
    <div className="space-y-4" data-login>
      <LoginMascot pose={pose} />
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-kopi-900">
          Selamat Datang Kembali!
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Masuk dengan akun Matur kamu.
        </p>
      </div>
      <div
        className="grid grid-cols-2 rounded-xl bg-matur-100 p-1 text-sm font-semibold"
        aria-label="Metode masuk"
      >
        {TABS.map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            disabled={locked}
            onClick={() => changeMode(m)}
            className={`rounded-lg py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matur-600 disabled:opacity-60 ${mode === m ? "bg-white text-matur-700 shadow" : "text-kopi-700"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        key={mode}
        action={action}
        aria-busy={pending}
        onSubmit={(event) => {
          if (submitting.current || locked) {
            event.preventDefault();
            return;
          }
          submitting.current = true;
          setVisible(false);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocus("welcome");
        }}
        className="space-y-4"
      >
        <fieldset disabled={locked} className="space-y-4">
          {mode === "otp" && state.sent ? (
            <>
              <input type="hidden" name="login" value={state.sent} />
              <p className="break-words text-sm text-stone-600">
                Kode dikirim ke <b>{state.sent}</b>. Periksa email Anda.
              </p>
              <Field
                name="secret"
                label="Kode OTP"
                inputMode="numeric"
                autoComplete="one-time-code"
                onFocus={() => setFocus("password")}
              />
            </>
          ) : (
            <Field
              name="login"
              label="Username (email terdaftar)"
              type="email"
              placeholder="nama@email.com"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              onFocus={() => setFocus("focus")}
            />
          )}
          {mode === "password" && (
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium"
              >
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="login-password"
                  name="secret"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  onFocus={() => setFocus("password")}
                  onBlur={() => setFocus("welcome")}
                  className="login-input pr-12"
                />
                <button
                  type="button"
                  aria-label={
                    visible ? "Sembunyikan password" : "Lihat password"
                  }
                  aria-pressed={visible}
                  aria-controls="login-password"
                  onClick={() => setVisible(!visible)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-stone-500 focus-visible:outline-2 focus-visible:outline-matur-600"
                >
                  {visible ? (
                    <EyeOff size={20} aria-hidden="true" />
                  ) : (
                    <Eye size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          )}
          <button
            disabled={locked}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-matur-500 py-3 font-semibold text-white shadow hover:bg-matur-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matur-600 disabled:opacity-60"
          >
            {pending && (
              <LoaderCircle
                size={18}
                className="login-spinner"
                aria-hidden="true"
              />
            )}
            {pending
              ? "Memeriksa…"
              : success
                ? "Berhasil masuk ✓"
                : mode === "otp" && !state.sent
                  ? "Kirim kode"
                  : "Masuk"}
          </button>
        </fieldset>
        {state.error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input required {...props} className="login-input mt-1" />
    </label>
  );
}
