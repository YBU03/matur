import Image from "next/image";
import Link from "next/link";
import { InstallButton } from "@/components/install-button";
import { LoginForm } from "./login-form";

const MASCOTS = ["mitra", "gudang", "kasir", "akunting", "admin"];

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-matur-300 via-matur-500 to-matur-600 p-10 text-white">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo-192.png"
            alt="Matoer"
            width={48}
            height={48}
            className="rounded-xl"
          />
          <span className="text-2xl font-bold">Matoer</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">
            Satu sistem untuk seluruh outlet.
          </h1>
          <p className="mt-3 max-w-md text-white/90">
            Kelola kegiatan dan pekerjaan Anda dalam satu aplikasi.
          </p>
          <div className="mt-8 flex -space-x-4">
            {MASCOTS.map((m) => (
              <Image
                key={m}
                src={`/mascot/${m}.png`}
                alt=""
                width={88}
                height={88}
                className="rounded-full border-4 border-white/80 shadow-lg"
              />
            ))}
          </div>
        </div>
        <p className="text-sm text-white/80">CV. Hazna Berkah Indonesia</p>
      </section>
      <section className="login-panel flex items-center justify-center bg-gradient-to-b from-matur-50/60 to-white px-5 py-6">
        <div className="w-full max-w-sm">
          <LoginForm />
          <p className="mt-4 text-center text-sm text-stone-500">
            Belum punya akun?{" "}
            <Link href="/daftar" className="font-semibold text-matur-700">
              Daftar di sini
            </Link>
          </p>

          <div className="mt-3">
            <InstallButton />
          </div>
        </div>
      </section>
    </main>
  );
}
