"use server";

import { revalidatePath } from "next/cache";
import type { BagiHasil, Baris, Transfer } from "./laporan";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type DataTerbit = {
  outlet_id: string;
  periode: string;
  nama_outlet: string;
  mitra: string | null;
  pj_laporan: string | null;
  karyawan: string[];
  modal_awal: number;
  persediaan_awal: number;
  pembelian: number;
  tagihan_titipan?: number;
  rincian_titipan?: { produsen: string; jumlah: number }[];
  persediaan_akhir: number;
  pendapatan: Baris[];
  diskon: number;
  persen_sedekah: number;
  sedekah: number;
  beban: Baris[];
  bagi_hasil: BagiHasil[];
  transfer: Transfer[];
  tgl_terbit: string;
  penandatangan: string | null;
  jabatan_penandatangan: string | null;
  catatan: string | null;
};

const bulat = (n: unknown) => Math.round(Number(n) || 0);

// Impor snapshot hanya ke draft privat; persetujuan Mitra melalui RPC terpisah.
export async function imporLaporanInternal(
  d: DataTerbit,
  ganti: boolean,
): Promise<{ error?: string; id?: string }> {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance"].includes(s.active.role)
  )
    return { error: "Tidak diizinkan." };
  if (!/^\d{4}-\d{2}-01$/.test(d.periode))
    return { error: "Periode tidak valid." };
  const baris = (xs: Baris[]) =>
    xs
      .filter((x) => x.nama)
      .map((x) => ({
        nama: String(x.nama).slice(0, 120),
        jumlah: bulat(x.jumlah),
      }));
  const values = {
    mode: "asli",
    outlet_id: d.outlet_id,
    periode: d.periode,
    nama_outlet: d.nama_outlet.slice(0, 100) || "Outlet",
    mitra: d.mitra?.slice(0, 100) || null,
    pj_laporan: d.pj_laporan?.slice(0, 100) || null,
    karyawan: d.karyawan
      .map((k) => k.trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 50),
    modal_awal: bulat(d.modal_awal),
    persediaan_awal: bulat(d.persediaan_awal),
    pembelian: bulat(d.pembelian),
    tagihan_titipan: bulat(d.tagihan_titipan),
    rincian_titipan: (d.rincian_titipan ?? [])
      .filter((r) => r.produsen && bulat(r.jumlah))
      .map((r) => ({
        produsen: String(r.produsen).slice(0, 100),
        jumlah: bulat(r.jumlah),
      })),
    persediaan_akhir: bulat(d.persediaan_akhir),
    pendapatan: baris(d.pendapatan),
    diskon: bulat(d.diskon),
    persen_sedekah: Number(d.persen_sedekah) || 0,
    sedekah: bulat(d.sedekah),
    beban: baris(d.beban),
    bagi_hasil: d.bagi_hasil.map((b) => ({
      nama: String(b.nama).slice(0, 100),
      persen: Number(b.persen) || 0,
      jumlah: bulat(b.jumlah),
    })),
    transfer: d.transfer.map((t) => ({
      keterangan: String(t.keterangan).slice(0, 120),
      jumlah: bulat(t.jumlah),
      bank: t.bank || null,
      no_rekening: t.no_rekening || null,
      atas_nama: t.atas_nama || null,
    })),
    tgl_terbit: /^\d{4}-\d{2}-\d{2}$/.test(d.tgl_terbit) ? d.tgl_terbit : null,
    penandatangan: d.penandatangan,
    jabatan_penandatangan: d.jabatan_penandatangan,
    catatan: d.catatan?.slice(0, 500) || null,
    laba_bersih: null,
    kota_terbit: "Purbalingga",
  };
  const supabase = await supabaseServer();
  const { data: ada } = await supabase
    .from("laporan_bulanan")
    .select("id")
    .eq("outlet_id", d.outlet_id)
    .eq("periode", d.periode)
    .eq("mode", "asli")
    .is("deleted_at", null)
    .maybeSingle();
  if (ada && !ganti)
    return {
      error:
        "Laporan resmi bulan ini sudah ada. Centang penggantian untuk membuat draft revisi internal; versi Mitra tetap sampai disetujui kembali.",
    };
  const { data: draftAda } = await supabase
    .from("laporan_internal")
    .select("updated_at,buka_at")
    .eq("outlet_id", d.outlet_id)
    .eq("periode", d.periode)
    .maybeSingle();
  if (draftAda && !ganti)
    return {
      error:
        "Draft internal sudah ada. Konfirmasi penggantian hasil impor terlebih dahulu.",
    };
  const { error } = await supabase.rpc("simpan_laporan_internal", {
    p_data: {
      outlet_id: d.outlet_id,
      periode: d.periode,
      sumber: "impor",
      snapshot: values,
      isian: {},
      baseline: {},
      alasan: "Impor laporan manual",
      buka_at: draftAda?.buka_at ?? null,
    },
    p_versi: draftAda?.updated_at ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/laporan");
  return {};
}

export type Penutupan = {
  ojol: Record<string, number | null>;
  koreksi_lain: number | null;
  persediaan_akhir: number | null;
  catatan: string | null;
};

// Draft penutupan bulan (cocok ojol, koreksi, persediaan akhir) agar isian Finance tidak hilang
export async function simpanPenutupan(
  outletId: string,
  periode: string,
  d: Penutupan,
): Promise<{ error?: string; ok?: string }> {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance"].includes(s.active.role)
  )
    return { error: "Tidak diizinkan." };
  if (!/^\d{4}-\d{2}-01$/.test(periode))
    return { error: "Periode tidak valid." };
  const ojol = Object.fromEntries(
    Object.entries(d.ojol ?? {})
      .filter(
        ([k, v]) =>
          ["gofood", "grabfood", "shopeefood"].includes(k) &&
          v !== null &&
          Number.isFinite(Number(v)),
      )
      .map(([k, v]) => [k, bulat(v)]),
  );
  const supabase = await supabaseServer();
  const { error } = await supabase.from("penutupan_bulan").upsert(
    {
      mode: "asli",
      outlet_id: outletId,
      periode,
      ojol,
      koreksi_lain: d.koreksi_lain === null ? null : bulat(d.koreksi_lain),
      persediaan_akhir:
        d.persediaan_akhir === null ? null : bulat(d.persediaan_akhir),
      catatan: d.catatan?.slice(0, 500) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "outlet_id,periode,mode" },
  );
  if (error) return { error: error.message };
  return { ok: "Draft penutupan bulan tersimpan." };
}

/** Seluruh isian internal disimpan tanpa memublikasikan angka kepada Mitra. */
export async function simpanInternal(d: {
  outlet_id: string;
  periode: string;
  sumber: "otomatis" | "manual" | "impor";
  isian: import("./laporan-internal").IsianLaporan;
  baseline: import("./laporan-internal").IsianLaporan;
  snapshot: import("./laporan").Laporan;
  alasan: string;
  buka_at: string | null;
  versi: string | null;
}): Promise<{ error?: string; versi?: string }> {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance"].includes(s.active.role)
  )
    return { error: "Tidak diizinkan." };
  if (
    !/^\d{4}-\d{2}-01$/.test(d.periode) ||
    !["otomatis", "manual", "impor"].includes(d.sumber)
  )
    return { error: "Periode/sumber tidak valid." };
  if (d.buka_at && !Number.isFinite(Date.parse(d.buka_at)))
    return { error: "Jadwal tidak valid." };
  if (JSON.stringify(d).length > 150000)
    return { error: "Isian terlalu panjang." };
  if (d.snapshot.outlet_id !== d.outlet_id || d.snapshot.periode !== d.periode)
    return { error: "Outlet/periode tidak cocok." };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("simpan_laporan_internal", {
    p_data: { ...d, alasan: d.alasan.slice(0, 1000) },
    p_versi: d.versi,
  });
  if (error) return { error: error.message };
  revalidatePath("/laporan");
  return { versi: String(data) };
}
export async function setujuiMitra(
  outlet: string,
  periode: string,
  versi: string,
  ganti: boolean,
) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance"].includes(s.active.role)
  )
    return { error: "Tidak diizinkan." };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("setujui_laporan_mitra", {
    p_outlet: outlet,
    p_periode: periode,
    p_versi: versi,
    p_ganti: ganti,
  });
  if (error) return { error: error.message };
  for (const p of ["/laporan", "/dashboard", "/portal/bep", "/transfer"])
    revalidatePath(p);
  return { id: String(data) };
}
