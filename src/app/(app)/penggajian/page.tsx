import { notFound } from "next/navigation";
import { KOMPONEN_KOSONG } from "@/lib/gaji";
import { muatStaf, outletSdm } from "@/lib/sdm";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { PenggajianView, type Slip } from "./penggajian-view";

// Penggajian bulanan per outlet: komponen gaji staf, hitung dari absensi, slip, finalkan → Biaya Gaji di laporan.
export default async function Penggajian({ searchParams }: { searchParams: Promise<{ outlet?: string; bulan?: string; tab?: string }> }) {
  const s = await getSession();
  if (!s?.active || !["owner", "hrd", "finance"].includes(s.active.role)) notFound();
  const sp = await searchParams;
  const outlets = await outletSdm(s);
  const outlet = outlets.find((o) => o.id === sp.outlet) ?? outlets[0];
  if (!outlet) notFound();
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const supabase = await supabaseServer();
  const [{ data: g }, { data: pt }, staf] = await Promise.all([
    supabase.from("penggajian").select("id, status, final_at").eq("mode", "asli").eq("outlet_id", outlet.id).eq("periode", `${bulan}-01`).maybeSingle(),
    supabase.from("perusahaan").select("nama, alamat, email, telepon").limit(1).maybeSingle(),
    muatStaf(outlet.id),
  ]);
  const [{ data: slips }, { data: komp }] = await Promise.all([
    g ? supabase.from("slip_gaji").select("*").eq("penggajian_id", g.id).order("nama") : Promise.resolve({ data: [] }),
    staf.length ? supabase.from("gaji_staf").select("*").in("pengguna_id", staf.map((x) => x.id)) : Promise.resolve({ data: [] }),
  ]);
  const kmap = new Map((komp ?? []).map((k) => [k.pengguna_id, k]));
  return (
    <PenggajianView
      key={`${outlet.id}-${bulan}`}
      outlets={outlets.map((o) => ({ id: o.id, nama: o.nama }))}
      outlet={{ id: outlet.id, nama: outlet.nama }}
      bulan={bulan}
      tab={sp.tab === "komponen" ? "komponen" : "slip"}
      bisaUbah={["owner", "hrd"].includes(s.active.role)}
      penggajian={g ?? null}
      slips={(slips ?? []) as Slip[]}
      staf={staf.map((x) => ({ id: x.id, nama: x.nama, peran: x.peran, komponen: { ...KOMPONEN_KOSONG, bank: "", no_rekening: "", atas_nama: "", ...(kmap.get(x.id) ?? {}) } }))}
      perusahaan={pt ?? { nama: "CV. Hazna Berkah Indonesia", alamat: null, email: null, telepon: null }}
    />
  );
}
