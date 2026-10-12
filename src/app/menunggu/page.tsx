import Image from "next/image";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import { getSession } from "@/lib/session";
import { AutoCek } from "./auto-cek";

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
  const tunggu = s.status === "menunggu";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-6 text-center">
      <div className="relative">
        {tunggu && <div className="absolute inset-x-6 -bottom-2 h-4 animate-[bayang_2s_ease-in-out_infinite] rounded-full bg-kopi-900/10 blur-sm" />}
        <Image
          src="/mascot/admin.png"
          alt=""
          width={150}
          height={150}
          priority
          className={`relative rounded-3xl ${tunggu ? "animate-[melayang_2s_ease-in-out_infinite]" : ""}`}
        />
        {tunggu && (
          <span className="absolute -right-3 -top-3 grid size-12 animate-[goyang_2s_ease-in-out_infinite] place-items-center rounded-full bg-white text-2xl shadow-md" aria-hidden>
            ⏳
          </span>
        )}
      </div>
      <h1 className="mt-6 text-2xl font-bold">
        {judul}
        {tunggu && (
          <span className="ml-1 inline-flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="inline-block size-1.5 animate-bounce rounded-full bg-matur-500" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        )}
      </h1>
      <p className="mt-2 text-stone-600">Halo {s.nama}. {isi}</p>
      {tunggu && (
        <>
          <ol className="mt-6 w-full space-y-0 text-left text-sm">
            {[
              ["Pendaftaran terkirim", "selesai"],
              ["Admin memeriksa & menentukan akses", "proses"],
              ["Anda bisa masuk ke Matoer", "nanti"],
            ].map(([t, st], i) => (
              <li key={t} className="flex items-center gap-3 rounded-xl px-3 py-2">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    st === "selesai" ? "bg-green-600 text-white" : st === "proses" ? "animate-pulse bg-matur-500 text-white" : "bg-stone-200 text-stone-500"
                  }`}
                >
                  {st === "selesai" ? "✓" : i + 1}
                </span>
                <span className={st === "nanti" ? "text-stone-400" : st === "proses" ? "font-semibold" : ""}>{t}</span>
              </li>
            ))}
          </ol>
          <AutoCek />
        </>
      )}
      <form action={logoutAction} className="mt-6">
        <button className="rounded-xl border border-matur-300 px-4 py-2 text-sm">Keluar</button>
      </form>
    </main>
  );
}
