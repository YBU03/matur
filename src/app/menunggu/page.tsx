import Image from "next/image";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import { getSession } from "@/lib/session";

const PESAN: Record<string, [string, string]> = {
  menunggu: ["Menunggu persetujuan", "Pendaftaran Anda sedang diperiksa admin. Anda akan bisa masuk setelah admin menyetujui dan menentukan akses Anda."],
  ditolak: ["Pendaftaran ditolak", "Pendaftaran Anda tidak disetujui. Hubungi admin bila ini keliru."],
  nonaktif: ["Akun dinonaktifkan", "Akun Anda sedang tidak aktif. Hubungi admin untuk mengaktifkan kembali."],
  aktif: ["Belum ada akses", "Akun Anda aktif tetapi belum diberi peran. Hubungi admin."],
};

export default async function Menunggu() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.status === "aktif" && s.assignments.length) redirect("/");
  const [judul, isi] = PESAN[s.status] ?? PESAN.menunggu;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-6 text-center">
      <Image src="/mascot/admin.png" alt="" width={140} height={140} className="rounded-3xl" />
      <h1 className="mt-4 text-2xl font-bold">{judul}</h1>
      <p className="mt-2 text-stone-600">Halo {s.nama}. {isi}</p>
      <form action={logoutAction} className="mt-6">
        <button className="rounded-xl border border-matur-300 px-4 py-2 text-sm">Keluar</button>
      </form>
    </main>
  );
}
