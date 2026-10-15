import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { stafLogoutAction } from "@/lib/actions";
import { POS_ROLES, ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";

// Pilih outlet/peran untuk aplikasi staf bila bertugas di beberapa outlet.
export default async function StafPilih() {
  const s = await getSession();
  if (!s) redirect("/staf/login");
  const tugas = s.assignments.filter((a) => POS_ROLES.includes(a.role) && a.outletId);
  if (tugas.length === 1) redirect(`/kasir/masuk?role=${tugas[0].role}&outlet=${tugas[0].outletId}&ke=staf`);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-krem px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-kartu)] border border-garis bg-white p-6 shadow-[var(--shadow-kartu)]">
        <Image src="/brand/logo-192.png" alt="" width={48} height={48} className="mb-3 rounded-xl" />
        <p className="text-[13px] text-redup">Halo,</p>
        <h1 className="mb-4 text-xl font-extrabold text-kopi-900">{s.nama}</h1>
        {tugas.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            {s.status === "aktif" ? "Akun ini tidak bertugas sebagai kasir/barista di outlet mana pun. Hubungi HRD." : "Akun Anda belum disetujui HRD/admin."}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-redup">Pilih outlet tempat Anda bertugas:</p>
            {tugas.map((a) => (
              <Link key={`${a.role}-${a.outletId}`} href={`/kasir/masuk?role=${a.role}&outlet=${a.outletId}&ke=staf`} className="block rounded-2xl border border-garis p-3 hover:bg-krem">
                <b className="text-kopi-900">{a.outletNama}</b> <span className="text-sm text-redup">· {ROLES[a.role].label}</span>
              </Link>
            ))}
          </div>
        )}
        <form action={stafLogoutAction} className="mt-6 text-center">
          <button className="text-sm font-semibold text-red-600">Keluar</button>
        </form>
      </div>
    </main>
  );
}
