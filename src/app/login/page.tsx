import Image from "next/image";
import { LoginForm } from "./login-form";

const MASCOTS = ["mitra", "gudang", "kasir", "akunting", "admin"];

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-matur-300 via-matur-500 to-matur-600 p-10 text-white">
        <div className="flex items-center gap-3">
          <Image src="/brand/logo-192.png" alt="Matur" width={48} height={48} className="rounded-xl" />
          <span className="text-2xl font-bold">Matur</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">Satu sistem untuk seluruh outlet.</h1>
          <p className="mt-3 max-w-md text-white/90">
            POS kasir & barista, gudang, akunting, dan portal mitra — semuanya terhubung dalam satu data.
          </p>
          <div className="mt-8 flex -space-x-4">
            {MASCOTS.map((m) => (
              <Image key={m} src={`/mascot/${m}.png`} alt="" width={88} height={88} className="rounded-full border-4 border-white/80 shadow-lg" />
            ))}
          </div>
        </div>
        <p className="text-sm text-white/80">CV. Hazna Berkah Indonesia</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Image src="/brand/logo-192.png" alt="Matur" width={72} height={72} className="rounded-2xl" />
            <span className="mt-2 text-2xl font-bold">Matur</span>
          </div>
          <h2 className="text-2xl font-bold">Masuk</h2>
          <p className="mb-6 text-sm text-stone-500">Satu halaman login untuk semua peran.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
