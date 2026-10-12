import "server-only";
import { supabaseServer } from "./supabase/server";

export type Proyek = {
  id: string;
  nama: string;
  outlet_id: string;
  estimasi_budget: number;
  tgl_mulai: string | null;
  target_buka: string | null;
  status: string;
  catatan: string | null;
  outlet: { nama: string } | null;
};
export type Pekerjaan = {
  id: string;
  proyek_id: string;
  urutan: number;
  nama: string;
  pic_id: string | null;
  bobot: number;
  progres: number;
  tgl_mulai: string | null;
  tgl_selesai: string | null;
  pic: { nama: string } | null;
};
export type ItemRab = {
  id: string;
  kategori: string;
  bagian: string | null;
  nama: string;
  spesifikasi: string | null;
  qty: number;
  satuan: string | null;
  harga_satuan: number | null;
  harga_estimasi: number;
  harga_realisasi: number | null;
  status: "rencana" | "dibeli" | "terpasang";
  keterangan: string | null;
};
export type Desain = { id: string; path: string; judul: string | null; created_at: string; url?: string };
export type Foto = {
  id: string;
  pekerjaan_id: string;
  path: string;
  keterangan: string | null;
  progres_diajukan: number | null;
  status: string;
  created_at: string;
  url?: string;
  pengunggah: { nama: string } | null;
};
export type Ringkasan = Proyek & { progres: number; realisasi: number; estimasiRab: number };

/** PRY-03: progres total = rata-rata tertimbang bobot */
export const progresTotal = (ks: Pick<Pekerjaan, "bobot" | "progres">[]) => {
  const w = ks.reduce((s, k) => s + Number(k.bobot), 0);
  return w ? Math.round(ks.reduce((s, k) => s + Number(k.bobot) * k.progres, 0) / w) : 0;
};

const PROYEK_COLS = "id, nama, outlet_id, estimasi_budget, tgl_mulai, target_buka, status, catatan, outlet(nama)";

export async function daftarProyek(): Promise<Ringkasan[]> {
  const supabase = await supabaseServer();
  const [{ data: ps }, { data: ks }, { data: rab }] = await Promise.all([
    supabase.from("proyek").select(PROYEK_COLS).is("deleted_at", null).order("target_buka"),
    supabase.from("pekerjaan").select("proyek_id, bobot, progres").is("deleted_at", null),
    supabase.from("item_rab").select("proyek_id, harga_estimasi, harga_realisasi").is("deleted_at", null),
  ]);
  return ((ps ?? []) as unknown as Proyek[]).map((p) => ({
    ...p,
    progres: progresTotal((ks ?? []).filter((k) => k.proyek_id === p.id)),
    realisasi: (rab ?? []).filter((r) => r.proyek_id === p.id).reduce((s, r) => s + (r.harga_realisasi ?? 0), 0),
    estimasiRab: (rab ?? []).filter((r) => r.proyek_id === p.id).reduce((s, r) => s + r.harga_estimasi, 0),
  }));
}

export async function detailProyek(id: string) {
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("proyek").select(PROYEK_COLS).eq("id", id).is("deleted_at", null).maybeSingle();
  if (!p) return null;
  const [{ data: ks }, { data: rab }] = await Promise.all([
    supabase.from("pekerjaan").select("id, proyek_id, urutan, nama, pic_id, bobot, progres, tgl_mulai, tgl_selesai, pic:pengguna(nama)").eq("proyek_id", id).is("deleted_at", null).order("urutan").order("tgl_mulai"),
    supabase
      .from("item_rab")
      .select("id, kategori, bagian, nama, spesifikasi, qty, satuan, harga_satuan, harga_estimasi, harga_realisasi, status, keterangan")
      .eq("proyek_id", id)
      .is("deleted_at", null)
      .order("urutan")
      .order("nama"),
  ]);
  const pekerjaan = (ks ?? []) as unknown as Pekerjaan[];
  const { data: fs } = await supabase
    .from("foto_progres")
    .select("id, pekerjaan_id, path, keterangan, progres_diajukan, status, created_at, pengunggah:pengguna!foto_progres_diunggah_oleh_fkey(nama)")
    .in("pekerjaan_id", pekerjaan.map((k) => k.id).concat("00000000-0000-0000-0000-000000000000"))
    .neq("status", "ditolak")
    .order("created_at", { ascending: false })
    .limit(200);
  const foto = (fs ?? []) as unknown as Foto[];
  if (foto.length) {
    const { data: urls } = await supabase.storage.from("proyek").createSignedUrls(foto.map((f) => f.path), 3600);
    foto.forEach((f, i) => (f.url = urls?.[i]?.signedUrl ?? undefined));
  }
  const { data: ds } = await supabase.from("desain_proyek").select("id, path, judul, created_at").eq("proyek_id", id).order("created_at");
  const desain = (ds ?? []) as Desain[];
  if (desain.length) {
    const { data: urls } = await supabase.storage.from("proyek").createSignedUrls(desain.map((d) => d.path), 3600);
    desain.forEach((d, i) => (d.url = urls?.[i]?.signedUrl ?? undefined));
  }
  const items = ((rab ?? []) as ItemRab[]).map((r) => ({ ...r, qty: Number(r.qty) }));
  return { proyek: p as unknown as Proyek, pekerjaan, rab: items, foto, desain };
}
