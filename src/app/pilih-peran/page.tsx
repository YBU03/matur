import Image from "next/image";
import { redirect } from "next/navigation";
import { chooseAssignment } from "@/lib/actions";
import { ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default async function PilihPeran() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.assignments.length === 0) redirect("/menunggu");

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Halo, {s.nama} 👋</h1>
      <p className="mb-6 text-stone-500">Pilih peran dan outlet yang ingin digunakan.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {s.assignments.map((a) => {
          const r = ROLES[a.role];
          return (
            <form key={`${a.role}-${a.outletId}`} action={chooseAssignment}>
              <input type="hidden" name="role" value={a.role} />
              <input type="hidden" name="outletId" value={a.outletId ?? ""} />
              <button className="flex w-full items-center gap-4 rounded-2xl border border-matur-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <Image src={`/mascot/${r.mascot}.png`} alt="" width={72} height={72} className="rounded-xl" />
                <span>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${r.accent}`}>{r.label}</span>
                  <span className="mt-1 block font-semibold">{a.outletNama}</span>
                </span>
              </button>
            </form>
          );
        })}
      </div>
    </main>
  );
}
