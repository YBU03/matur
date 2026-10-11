import Image from "next/image";
import Link from "next/link";
import { DaftarForm } from "./daftar-form";

export default function DaftarPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="mb-6 flex items-center gap-3">
        <Image src="/brand/logo-192.png" alt="Matoer" width={48} height={48} className="rounded-xl" />
        <div>
          <h1 className="text-2xl font-bold">Daftar akun</h1>
          <p className="text-sm text-stone-500">Peran dan akses ditentukan admin setelah mendaftar.</p>
        </div>
      </div>
      <DaftarForm />
      <p className="mt-6 text-center text-sm text-stone-500">
        Sudah punya akun? <Link href="/login" className="font-semibold text-matur-700">Masuk</Link>
      </p>
    </main>
  );
}
