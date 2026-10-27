import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { LabaGudang } from "./view";
import type { GudangLaporan } from "@/lib/gudang-laporan";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    awal?: string;
    akhir?: string;
    outlet?: string;
    bahan?: string;
  }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang", "finance"].includes(s.active.role)
  )
    notFound();
  const sp = await searchParams;
  const hari = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const awal = sp.awal ?? hari.slice(0, 7) + "-01",
    akhir = sp.akhir ?? hari;
  const db = await supabaseServer();
  const [{ data, error }, { data: outlets }, { data: bahan }] =
    await Promise.all([
      db.rpc("laporan_laba_gudang", {
        p_awal: awal,
        p_akhir: akhir,
        p_outlet: sp.outlet || null,
        p_bahan: sp.bahan || null,
      }),
      db
        .from("outlet")
        .select("id,nama")
        .eq("mode", "asli")
        .is("deleted_at", null)
        .order("nama"),
      db
        .from("bahan")
        .select("id,nama")
        .eq("mode", "asli")
        .is("deleted_at", null)
        .order("nama"),
    ]);
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/gudang/stok" className="text-sm underline">
        ← Stok Gudang
      </Link>
      <h1 className="text-2xl font-bold">Laba Rugi Gudang</h1>
      <p className="text-sm text-stone-600">
        Berdasarkan barang baik yang diterima outlet pada periode ini. HPP
        dikunci saat pengiriman baru. Ini laporan manajemen gudang, bukan
        pencatatan pembayaran atau laba gabungan perusahaan.
      </p>
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4">
        <label className="text-sm">
          Dari
          <input
            type="date"
            required
            name="awal"
            defaultValue={awal}
            className="mt-1 block rounded-lg border p-2"
          />
        </label>
        <label className="text-sm">
          Sampai
          <input
            type="date"
            required
            name="akhir"
            defaultValue={akhir}
            className="mt-1 block rounded-lg border p-2"
          />
        </label>
        <label className="text-sm">
          Outlet
          <select
            name="outlet"
            defaultValue={sp.outlet ?? ""}
            className="mt-1 block max-w-64 rounded-lg border p-2"
          >
            <option value="">Semua outlet</option>
            {outlets?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Bahan
          <select
            name="bahan"
            defaultValue={sp.bahan ?? ""}
            className="mt-1 block max-w-64 rounded-lg border p-2"
          >
            <option value="">Semua bahan</option>
            {bahan?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-xl bg-kopi-900 px-4 py-2 text-white">
          Tampilkan
        </button>
      </form>
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error.message}
        </p>
      ) : (
        <LabaGudang
          key={[awal, akhir, sp.outlet, sp.bahan].join(":")}
          data={data as GudangLaporan}
          awal={awal}
          akhir={akhir}
          outlet={sp.outlet ?? ""}
          bahan={sp.bahan ?? ""}
          outlets={outlets ?? []}
          boleh={s.active.role !== "finance"}
        />
      )}
    </div>
  );
}
