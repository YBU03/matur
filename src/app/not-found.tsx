import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fffaf2] p-6 text-center">
      <div className="max-w-md">
        <Image src="/mascot/404.png" alt="" width={600} height={397} priority className="mx-auto w-full max-w-sm" />
        <h1 className="mt-4 text-2xl font-bold text-kopi-900">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-stone-600">Halaman yang kamu buka tidak ada atau kamu belum punya akses ke sana.</p>
        <Link href="/dashboard" className="mt-5 inline-block rounded-xl bg-matur-500 px-5 py-2.5 text-sm font-semibold text-white">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
