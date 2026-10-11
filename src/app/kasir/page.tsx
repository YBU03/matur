import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { kasirLogoutAction } from "@/lib/actions";
import { BISA_JUAL, POS_ROLES, ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { KasirLogin } from "./kasir-login";

// Pintu masuk aplikasi POS: login kode staf + PIN, lalu pilih outlet bila bertugas di beberapa outlet.
export default async function KasirEntry() {
  const s = await getSession();
  if (s?.active?.outletId && POS_ROLES.includes(s.active.role)) redirect(BISA_JUAL.includes(s.active.role) ? "/kasir/pos" : "/kasir/antrean");

  if (!s) {
    return (
      <Shell>
        <KasirLogin />
      </Shell>
    );
  }
  const tugas = s.assignments.filter((a) => POS_ROLES.includes(a.role) && a.outletId);
  if (tugas.length === 1) redirect(`/kasir/masuk?role=${tugas[0].role}&outlet=${tugas[0].outletId}`);
  return (
    <Shell>
      <p className="mb-4 font-semibold">Halo, {s.nama}</p>
      {tugas.length === 0 ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {s.status === "aktif" ? "Akun ini tidak bertugas sebagai kasir/barista di outlet mana pun." : "Akun Anda belum disetujui admin."}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-stone-500">Pilih outlet tempat Anda bertugas:</p>
          {tugas.map((a) => (
            <Link key={`${a.role}-${a.outletId}`} href={`/kasir/masuk?role=${a.role}&outlet=${a.outletId}`} className="block rounded-xl border border-matur-200 bg-white p-3 hover:bg-matur-50">
              <b>{a.outletNama}</b> <span className="text-sm text-stone-500">· {ROLES[a.role].label}</span>
            </Link>
          ))}
        </div>
      )}
      <form action={kasirLogoutAction} className="mt-6 text-center">
        <button className="text-sm text-red-600">Keluar</button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-500 via-matur-500 to-matur-600 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <Image src="/mascot/kasir.png" alt="" width={64} height={64} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-bold">Matoer POS</h1>
            <p className="text-sm text-stone-500">Kasir & barista outlet</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
