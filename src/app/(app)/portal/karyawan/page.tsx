import { Suspense } from "react";
import { MitraJadwal } from "./jadwal";
import { notFound } from "next/navigation";
import { UsersRound, Store } from "lucide-react";
import { KartuKaryawan, type StafMitra } from "./kartu-karyawan";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

// Mitra: karyawan outletnya; alamat teks sesuai izin, tanpa membuka profil lengkap.
export default async function KaryawanMitra({ searchParams }: { searchParams: Promise<{ mitra_tanggal?: string; mitra_outlet?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s?.active?.role !== "mitra") notFound();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("karyawan_outlet_saya");
  if (error) throw new Error("Daftar karyawan belum dapat dimuat. Silakan coba kembali.");
  const staf = (data ?? []) as StafMitra[];
  const paths = staf.map((x) => x.foto_path).filter((x): x is string => !!x);
  const { data: urls } = paths.length
    ? await supabase.storage.from("profil").createSignedUrls(paths, 3600)
    : { data: [] };
  const foto = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
  const perOutlet = [
    ...new Map(staf.map((x) => [x.outlet_id, x.outlet])).entries(),
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Karyawan Outlet</h1>
        <p className="text-sm text-stone-500">
          Tim yang bertugas di outlet Anda. Setiap karyawan wajib memasang foto
          asli di profilnya.
        </p>
      </div>
      {!staf.length && (
        <p className="rounded-2xl border border-dashed bg-white py-10 text-center text-stone-500">
          Belum ada karyawan terdaftar di outlet Anda.
        </p>
      )}
      {perOutlet.map(([id, nama]) => {
        const list = staf.filter((x) => x.outlet_id === id);
        return (
          <section key={id} className="space-y-3">
            <h2 className="flex flex-wrap items-center gap-2 font-bold text-kopi-900"><span className="grid size-8 place-items-center rounded-lg bg-matur-100 text-matur-700"><Store size={16} aria-hidden="true" /></span>
              {nama}{" "}
              <span className="inline-flex items-center gap-1 rounded-full bg-matur-50 px-2 py-1 text-xs font-normal text-stone-500">
                <UsersRound size={12} aria-hidden="true" />{list.length} orang
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map(x => <KartuKaryawan key={`${id}:${x.id}`} staf={x} foto={x.foto_path ? foto.get(x.foto_path) : null} />)}
            </div>
          </section>
        );
      })}
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-matur-50 motion-reduce:animate-none" aria-label="Menyiapkan jadwal shift" />}><MitraJadwal tanggal={sp.mitra_tanggal} outlet={sp.mitra_outlet} /></Suspense>
    </div>
  );
}
