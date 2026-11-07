"use server";

// Data pribadi karyawan untuk Mitra (No. WA & alamat): tidak ikut terkirim saat halaman dibuka,
// hanya diambil saat ikon mata diketuk (tampil 10 detik di layar).
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export async function bukaDataKaryawan(id: string, jenis: "wa" | "alamat"): Promise<{ ok: true; isi: string } | { ok: false; pesan: string }> {
  const s = await getSession();
  if (s?.active?.role !== "mitra") return { ok: false, pesan: "Tidak berwenang." };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("karyawan_outlet_saya");
  if (error) return { ok: false, pesan: "Data belum dapat dimuat. Coba lagi." };
  const x = ((data ?? []) as { id: string; no_wa: string | null; alamat: string | null }[]).find((k) => k.id === id);
  const isi = (jenis === "wa" ? x?.no_wa : x?.alamat)?.trim();
  return isi ? { ok: true, isi } : { ok: false, pesan: jenis === "wa" ? "No. WA belum diisi." : "Alamat belum diisi." };
}
