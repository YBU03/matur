"use server";

// Pengeluaran harian outlet (dicatat kasir/barista/SPV saat shift) dan tutup shift dengan cocok kas.
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string; perluAlasan?: boolean };
export type Pengeluaran = {
  kategori_id: string;
  jumlah: number;
  keterangan: string;
  sumber: "laci" | "pusat";
  tanggal?: string;
  request_id?: string;
  sesi_id?: string;
  items?: { bahan_id: string; qty: number }[];
};

const segarkan = () => {
  revalidatePath("/kasir/shift");
  revalidatePath("/catatan-harian");
  revalidatePath("/karyawan/kas");
  revalidatePath("/laporan/proyeksi");
};
const bersih = (d: Pengeluaran) => {
  const jumlah = Math.round(Number(d.jumlah));
  if (!d.kategori_id) return { error: "Pilih kategori." };
  if (!Number.isFinite(jumlah) || !(jumlah > 0) || jumlah > 1_000_000_000_000)
    return { error: "Nominal harus lebih dari 0." };
  if (d.tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(d.tanggal))
    return { error: "Tanggal tidak valid." };
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

export async function catatPengeluaran(
  d: Pengeluaran,
  outletId?: string,
): Promise<Result> {
  const s = await getSession();
  const outlet = outletId ?? s?.active?.outletId;
  if (!s?.active || !outlet) return { error: "Pilih outlet terlebih dahulu." };
  const b = bersih(d);
  if (!b.v) return { error: b.error };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc(
    d.items?.length ? "catat_belanja_bahan" : "catat_pengeluaran_pos",
    {
      p: {
        ...b.v,
        outlet_id: outlet,
        request_id: d.request_id ?? crypto.randomUUID(),
        sesi_id: d.sesi_id ?? null,
        ...(d.items?.length ? { items: d.items } : {}),
      },
    },
  );
  if (error)
    return {
      error: error.message.includes("row-level")
        ? "Anda tidak bisa mencatat pengeluaran untuk outlet ini."
        : error.message,
    };
  segarkan();
  return { ok: "Pengeluaran tercatat." };
}

/** Pengeluaran di kas shift yang sudah final: lewat RPC (kategori/keterangan oleh outlet; nominal/sumber/hapus khusus akunting + geser kas). */
async function koreksiFinal(id: string, v: { kategori_id?: string; keterangan?: string | null; jumlah?: number; sumber?: string } | null, alasan?: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: lama } = await supabase.from("biaya_outlet").select("kategori_id, keterangan, jumlah, sumber").eq("id", id).maybeSingle();
  if (!lama) return { error: "Pengeluaran tidak ditemukan." };
  const { data, error } = await supabase.rpc("koreksi_biaya_final", {
    p_id: id,
    p_kategori: v?.kategori_id ?? lama.kategori_id,
    p_keterangan: v ? (v.keterangan ?? "") : (lama.keterangan ?? ""),
    p_jumlah: v?.jumlah ?? lama.jumlah,
    p_sumber: v?.sumber ?? lama.sumber,
    p_hapus: !v,
    p_alasan: alasan ?? "",
  });
  if (error) {
    const m = error.message;
    if (m.includes("PERLU_ALASAN")) return { error: "Kas shift sudah final — tulis alasan perbaikan.", perluAlasan: true };
    return { error: m };
  }
  segarkan();
  return { ok: (data as { ok?: string })?.ok ?? "Perubahan tersimpan." };
}
const kasFinal = (m: string) => m.includes("sesi kas final");

export async function ubahPengeluaran(
  id: string,
  d: Pengeluaran,
  alasan?: string,
): Promise<Result> {
  const b = bersih(d);
  if (!b.v) return { error: b.error };
  const supabase = await supabaseServer();
  const { error, count } = await supabase
    .from("biaya_outlet")
    .update(b.v, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);
  if (error && kasFinal(error.message)) return koreksiFinal(id, b.v, alasan);
  if (error) return { error: error.message };
  if (!count) {
    // bukan pembuatnya / lewat batas waktu RLS: coba jalur perbaikan beraudit (akunting & outlet)
    const r = await koreksiFinal(id, b.v, alasan);
    if (!r.error || r.perluAlasan) return r;
    return { error: "Tidak bisa diubah (catatan orang lain atau sudah lebih dari 2 hari)." };
  }
  segarkan();
  return { ok: "Perubahan tersimpan." };
}

export async function hapusPengeluaran(id: string, alasan?: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error, count } = await supabase
    .from("biaya_outlet")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);
  if (error && kasFinal(error.message)) return koreksiFinal(id, null, alasan);
  if (error) return { error: error.message };
  if (!count) {
    const r = await koreksiFinal(id, null, alasan);
    if (!r.error || r.perluAlasan) return r;
    return { error: "Tidak bisa dihapus (catatan orang lain atau sudah lebih dari 2 hari)." };
  }
  segarkan();
  return {
    ok: "Pengeluaran dihapus (bisa dipulihkan admin dari tempat sampah).",
  };
}

export async function tutupShift(
  sesiId: string,
  aktual: number,
): Promise<
  Result & {
    hasil?: {
      tunai: number;
      laci: number;
      seharusnya: number;
      aktual: number;
      selisih: number;
    };
  }
> {
  if (!(aktual >= 0)) return { error: "Isi jumlah uang tunai yang disetor." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("tutup_sesi_kas", {
    p_sesi: sesiId,
    p_aktual: Math.round(aktual),
  });
  if (error) return { error: error.message };
  segarkan();
  revalidatePath("/kasir/pos");
  return { ok: "Shift ditutup.", hasil: data };
}
