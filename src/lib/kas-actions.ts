"use server";

// Pengeluaran harian outlet (dicatat kasir/barista/SPV saat shift) dan tutup shift dengan cocok kas.
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };
export type Pengeluaran = { kategori_id: string; jumlah: number; keterangan: string; sumber: "laci" | "pusat"; tanggal?: string };

const segarkan = () => {
  revalidatePath("/kasir/shift");
  revalidatePath("/catatan-harian");
};
const bersih = (d: Pengeluaran) => {
  const jumlah = Math.round(Number(d.jumlah));
  if (!d.kategori_id) return { error: "Pilih kategori." };
  if (!(jumlah > 0)) return { error: "Nominal harus lebih dari 0." };
  if (d.tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(d.tanggal)) return { error: "Tanggal tidak valid." };
  return {
    v: {
      kategori_id: d.kategori_id,
      jumlah,
      keterangan: d.keterangan.trim().slice(0, 200) || null,
      sumber: d.sumber === "pusat" ? "pusat" : "laci",
      ...(d.tanggal ? { tanggal: d.tanggal } : {}),
    },
  };
};

export async function catatPengeluaran(d: Pengeluaran, outletId?: string): Promise<Result> {
  const s = await getSession();
  const outlet = outletId ?? s?.active?.outletId;
  if (!s?.active || !outlet) return { error: "Pilih outlet terlebih dahulu." };
  const b = bersih(d);
  if (!b.v) return { error: b.error };
  const supabase = await supabaseServer();
  let sesiId: string | null = null;
  if(b.v.sumber === "laci") {
    const {data,error} = await supabase.from("sesi_kas").select("id").eq("outlet_id",outlet).eq("mode","asli").eq("pos_tim",true).is("ditutup_at",null).maybeSingle();
    if(error || !data) return {error:"Buka sesi kas tim dahulu untuk mencatat pengeluaran dari laci."};
    sesiId=data.id;
  }
  const { error } = await supabase.from("biaya_outlet").insert({ ...b.v, sesi_kas_id:sesiId, outlet_id: outlet, dibuat_oleh: s.userId });
  if (error) return { error: error.message.includes("row-level") ? "Anda tidak bisa mencatat pengeluaran untuk outlet ini." : error.message };
  segarkan();
  return { ok: "Pengeluaran tercatat." };
}

export async function ubahPengeluaran(id: string, d: Pengeluaran): Promise<Result> {
  const b = bersih(d);
  if (!b.v) return { error: b.error };
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("biaya_outlet").update(b.v, { count: "exact" }).eq("id", id).is("deleted_at", null);
  if (error || !count) return { error: "Tidak bisa diubah (catatan orang lain atau sudah lebih dari 2 hari)." };
  segarkan();
  return { ok: "Perubahan tersimpan." };
}

export async function hapusPengeluaran(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("biaya_outlet").update({ deleted_at: new Date().toISOString() }, { count: "exact" }).eq("id", id).is("deleted_at", null);
  if (error || !count) return { error: "Tidak bisa dihapus (catatan orang lain atau sudah lebih dari 2 hari)." };
  segarkan();
  return { ok: "Pengeluaran dihapus (bisa dipulihkan admin dari tempat sampah)." };
}

export async function tutupShift(sesiId: string, aktual: number): Promise<Result & { hasil?: { tunai: number; laci: number; seharusnya: number; aktual: number; selisih: number } }> {
  if (!(aktual >= 0)) return { error: "Isi jumlah uang tunai yang disetor." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("tutup_sesi_kas", { p_sesi: sesiId, p_aktual: Math.round(aktual) });
  if (error) return { error: error.message };
  segarkan();
  revalidatePath("/kasir/pos");
  return { ok: "Shift ditutup.", hasil: data };
}
