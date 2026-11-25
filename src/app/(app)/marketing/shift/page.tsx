import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { HeaderHalaman } from "@/components/ui-halaman";
import type { JadwalMarketing } from "@/lib/marketing";
export default async function ShiftHariIni({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["marketing", "owner", "admin_pusat"].includes(s.active.role)
  )
    notFound();
  const sp = await searchParams;
  const db = await supabaseServer();
  const { data, error } = await db.rpc("jadwal_marketing_hari_ini");
  if (error || !data)
    return (
      <div role="alert" className="rounded-xl border border-red-300 p-4">
        Jadwal belum dapat dimuat. Silakan muat ulang. {error?.message}
      </div>
    );
  const d = data as JadwalMarketing;
  const selected = d.outlets.some((o) => o.id === sp.outlet) ? sp.outlet : "";
  const os = d.outlets.filter((o) => !selected || o.id === selected);
  return (
    <div className="space-y-5">
      <HeaderHalaman
        judul="Shift Hari Ini"
        keterangan={`Jadwal terbit · ${d.tanggal} · WIB. Jadwal kerja, bukan bukti kehadiran atau kasir yang sedang login.`}
      />
      <form className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          Outlet
          <select
            name="outlet"
            defaultValue={selected}
            className="mt-1 block rounded-xl border p-2"
          >
            <option value="">Semua outlet</option>
            {d.outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-xl bg-kopi-900 px-4 py-2 text-white">
          Tampilkan
        </button>
        <Link
          href="/marketing/shift"
          prefetch={false}
          className="text-sm text-orange-700 underline"
        >
          Semua outlet
        </Link>
      </form>
      {!os.length && <p>Belum ada outlet aktif.</p>}
      {os.map((o) => {
        const rows = d.jadwal.filter((j) => j.outlet_id === o.id);
        return (
          <section
            key={o.id}
            className="rounded-2xl border border-orange-200 bg-white p-4"
          >
            <h2 className="mb-3 font-bold">
              {o.nama}{" "}
              <span className="text-sm font-normal text-stone-500">
                · {rows.length} petugas terjadwal
              </span>
            </h2>
            {!rows.length ? (
              <p className="text-sm text-stone-500">
                Belum ada jadwal terbit untuk hari ini. Hubungi HRD/SPV untuk
                memastikan petugas.
              </p>
            ) : (
              <ul className="divide-y">
                {rows.map((j) => (
                  <li
                    key={j.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="font-semibold">{j.nama}</p>
                      <p className="text-sm text-stone-500">
                        {j.jabatan || "Petugas outlet"} · {j.shift}
                      </p>
                    </div>
                    <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold">
                      {j.jam_mulai.slice(0, 5)}–{j.jam_selesai.slice(0, 5)} WIB
                      {j.jam_selesai <= j.jam_mulai ? " (+1 hari)" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
