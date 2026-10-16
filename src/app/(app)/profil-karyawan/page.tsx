import { notFound } from "next/navigation";
import { formatTanggal } from "@/lib/format";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

type Baris = {
  id: string;
  nama: string;
  no_hp: string | null;
  tugas: { outlet: string; peran: string }[] | null;
  kurang: string[];
  profil: {
    foto_path: string | null;
    jenis_kelamin: string | null;
    tempat_lahir: string | null;
    tgl_lahir: string | null;
    alamat_ktp: string | null;
    alamat_domisili: string | null;
    maps_url: string | null;
    darurat_nama: string | null;
    darurat_hubungan: string | null;
    darurat_hp: string | null;
  } | null;
};

// HRD/Owner: profil lengkap karyawan outlet (foto, TTL, alamat KTP, sharelok rumah, kontak darurat).
export default async function ProfilKaryawan({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kurang?: string }>;
}) {
  const s = await getSession();
  if (!s?.active || !["owner", "hrd", "admin_pusat"].includes(s.active.role))
    notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("daftar_profil_karyawan");
  const semua = (data ?? []) as Baris[];
  const q = (sp.q ?? "").toLowerCase();
  const list = semua.filter(
    (x) =>
      (!q || x.nama.toLowerCase().includes(q)) &&
      (sp.kurang !== "1" || x.kurang.length > 0),
  );
  const paths = list
    .map((x) => x.profil?.foto_path)
    .filter((x): x is string => !!x);
  const { data: urls } = paths.length
    ? await supabase.storage.from("profil").createSignedUrls(paths, 3600)
    : { data: [] };
  const foto = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
  const belum = semua.filter((x) => x.kurang.length).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Profil Karyawan</h1>
          <p className="text-sm text-stone-500">
            {semua.length} karyawan ·{" "}
            <b className={belum ? "text-amber-700" : "text-green-700"}>
              {belum ? `${belum} belum lengkap` : "semua lengkap ✓"}
            </b>
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Cari nama…"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              name="kurang"
              value="1"
              defaultChecked={sp.kurang === "1"}
            />{" "}
            belum lengkap
          </label>
          <button className="rounded-lg bg-kopi-900 px-3 py-2 text-sm text-white">
            Terapkan
          </button>
        </form>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((x) => {
          const p = x.profil;
          const url = p?.foto_path ? foto.get(p.foto_path) : null;
          return (
            <details
              key={x.id}
              className="group rounded-2xl border border-matur-200 bg-white p-4 shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-full bg-matur-100">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-xl">
                      👤
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{x.nama}</p>
                  <p className="truncate text-xs text-stone-500">
                    {(x.tugas ?? [])
                      .map((t) => `${t.peran} · ${t.outlet}`)
                      .join(", ")}
                  </p>
                  {x.kurang.length ? (
                    <p className="text-xs text-amber-700">
                      Kurang: {x.kurang.join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-green-700">✓ Profil lengkap</p>
                  )}
                </div>
                <span className="text-stone-400 group-open:rotate-90">›</span>
              </summary>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t pt-3 text-sm">
                <dt className="text-stone-500">TTL</dt>
                <dd>
                  {p?.tempat_lahir ?? "-"}
                  {p?.tgl_lahir ? `, ${formatTanggal(p.tgl_lahir)}` : ""}
                </dd>
                <dt className="text-stone-500">Kelamin</dt>
                <dd>
                  {p?.jenis_kelamin === "L"
                    ? "Laki-laki"
                    : p?.jenis_kelamin === "P"
                      ? "Perempuan"
                      : "-"}
                </dd>
                <dt className="text-stone-500">HP</dt>
                <dd>{x.no_hp ?? "-"}</dd>
                <dt className="text-stone-500">Alamat KTP</dt>
                <dd className="whitespace-pre-line">{p?.alamat_ktp ?? "-"}</dd>
                {p?.alamat_domisili && (
                  <>
                    <dt className="text-stone-500">Domisili</dt>
                    <dd className="whitespace-pre-line">{p.alamat_domisili}</dd>
                  </>
                )}
                <dt className="text-stone-500">Sharelok</dt>
                <dd>
                  {p?.maps_url ? (
                    <a
                      href={p.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-matur-700 underline"
                    >
                      📍 Buka di Google Maps
                    </a>
                  ) : (
                    "-"
                  )}
                </dd>
                <dt className="text-stone-500">Darurat</dt>
                <dd>
                  {p?.darurat_nama
                    ? `${p.darurat_nama}${p.darurat_hubungan ? ` (${p.darurat_hubungan})` : ""} · ${p.darurat_hp ?? "-"}`
                    : "-"}
                </dd>
              </dl>
            </details>
          );
        })}
      </div>
    </div>
  );
}
