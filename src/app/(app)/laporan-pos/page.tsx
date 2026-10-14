import Link from "next/link";
import { notFound } from "next/navigation";
import { LAPORAN, PERAN_LAPORAN, TABS, tabBoleh, type Tab } from "@/lib/laporan-pos";
import { getSession } from "@/lib/session";

// Pusat laporan ala Luna: tab kategori → daftar laporan (tiap laporan bisa harian, mingguan, bulanan, custom).
export default async function PusatLaporan({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await getSession();
  if (!s?.active || !PERAN_LAPORAN.includes(s.active.role)) notFound();
  const boleh = tabBoleh(s.active.role);
  const sp = await searchParams;
  const tab = (boleh.includes(sp.tab as Tab) ? sp.tab : boleh[0]) as Tab;
  const daftar = Object.entries(LAPORAN).filter(([, l]) => l.tab === tab && (s.active!.role !== "spv" || l.lingkup !== "gudang"));
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Laporan POS & Stok</h1>
        <p className="text-sm text-stone-500">Pantau harian, mingguan, bulanan, atau rentang tanggal bebas. Data langsung dari kasir POS dan gudang.</p>
      </div>
      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <nav className="flex flex-wrap gap-1 border-b border-stone-200 pb-3">
          {TABS.filter(([k]) => boleh.includes(k)).map(([k, l]) => (
            <Link key={k} href={`/laporan-pos?tab=${k}`} className={`rounded-lg px-3 py-2 text-sm font-semibold ${k === tab ? "bg-kopi-900 text-white" : "text-kopi-700 hover:bg-matur-50"}`}>
              {l}
            </Link>
          ))}
        </nav>
        <ul className="grid gap-x-8 gap-y-1 pt-3 sm:grid-cols-2">
          {daftar.map(([k, l]) => (
            <li key={k}>
              <Link href={`/laporan-pos/${k}`} className="group block rounded-xl px-3 py-3 hover:bg-matur-50">
                <span className="font-semibold text-violet-700 group-hover:underline">{l.judul}</span>
                {l.lingkup !== "outlet" && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{l.lingkup === "gudang" ? "Gudang" : "Outlet & Gudang"}</span>}
                <span className="block text-xs text-stone-500">{l.info}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
