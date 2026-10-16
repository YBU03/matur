import { notFound } from "next/navigation";
import { formatTanggal } from "@/lib/format";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

type Staf = {
  id: string;
  nama: string;
  outlet_id: string;
  outlet: string;
  peran: string[] | null;
  foto_path: string | null;
  tgl_masuk: string | null;
};
const LABEL: Record<string, string> = {
  spv: "SPV / Kepala Outlet",
  kasir: "Kasir",
  barista: "Barista",
};

// Mitra: karyawan yang bertugas di outletnya (nama, peran, foto, tanggal masuk). Data pribadi tidak ditampilkan.
export default async function KaryawanMitra() {
  const s = await getSession();
  if (s?.active?.role !== "mitra") notFound();
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("karyawan_outlet_saya");
  const staf = (data ?? []) as Staf[];
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
            <h2 className="font-bold">
              {nama}{" "}
              <span className="text-sm font-normal text-stone-500">
                · {list.length} orang
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((x) => {
                const url = x.foto_path ? foto.get(x.foto_path) : null;
                const peran = (x.peran ?? []).includes("spv")
                  ? "spv"
                  : (x.peran ?? []).includes("kasir")
                    ? "kasir"
                    : "barista";
                return (
                  <div
                    key={x.id}
                    className="rounded-2xl border border-matur-200 bg-white p-4 text-center shadow-sm"
                  >
                    <div className="mx-auto size-24 overflow-hidden rounded-full bg-matur-100">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={x.nama}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="grid size-full place-items-center text-xs text-stone-500">
                          Belum ada foto
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-bold">{x.nama}</p>
                    <p className="text-xs text-matur-700">{LABEL[peran]}</p>
                    {x.tgl_masuk && (
                      <p className="mt-1 text-xs text-stone-500">
                        Bergabung {formatTanggal(x.tgl_masuk)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
