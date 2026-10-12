import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { POS_ONLY, ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default async function PilihPeran() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.assignments.length === 0) redirect("/menunggu");
  if (s.assignments.every((a) => POS_ONLY.includes(a.role))) redirect("/kasir");

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Halo, {s.nama} 👋</h1>
      <p className="mb-6 text-stone-500">Pilih peran dan outlet yang ingin digunakan.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {s.assignments
          .filter((a) => !POS_ONLY.includes(a.role))
          .map((a) => {
            const r = ROLES[a.role];
            return (
              // tautan biasa (bukan server action) agar sesi dibaca ulang di request baru
              <Link
                key={`${a.role}-${a.outletId}`}
                href={`/masuk?role=${a.role}${a.outletId ? `&outlet=${a.outletId}` : ""}`}
                prefetch={false}
                className="flex w-full items-center gap-4 rounded-2xl border border-matur-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Image src={`/mascot/${r.mascot}.png`} alt="" width={72} height={72} className="rounded-xl" />
                <span>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${r.accent}`}>{r.label}</span>
                  <span className="mt-1 block font-semibold">{a.outletNama}</span>
                </span>
              </Link>
            );
          })}
      </div>
    </main>
  );
}
