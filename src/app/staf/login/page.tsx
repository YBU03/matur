import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InstallButton } from "@/components/install-button";
import { getSession } from "@/lib/session";
import { KasirLogin } from "../../kasir/kasir-login";

// Masuk aplikasi staf (HP pribadi kasir & barista): kode staf + PIN atau email.
export default async function StafLogin() {
  const s = await getSession();
  if (s) redirect("/staf");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-krem px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/mascot/kasir.png" alt="" width={96} height={96} priority className="rounded-3xl" />
          <p className="mt-4 text-[13px] font-medium text-redup">Selamat datang di</p>
          <h1 className="text-2xl font-extrabold text-kopi-900">Matoer Staf</h1>
          <p className="mt-1 text-[13px] text-redup">Absen, jadwal shift, dan pengajuan izin untuk kasir & barista.</p>
        </div>
        <div className="rounded-[var(--radius-kartu)] border border-garis bg-white p-6 shadow-[var(--shadow-kartu)]">
          <KasirLogin tujuan="staf" />
        </div>
        <div className="mt-4">
          <InstallButton />
        </div>
        <p className="mt-6 text-center text-[13px] text-redup">
          Tablet kasir di outlet? <Link href="/pos" className="font-semibold text-matur-700">Buka Aplikasi POS</Link>
        </p>
      </div>
    </main>
  );
}
