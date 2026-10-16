"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };

export async function simpanProfil(_: Result, form: FormData): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("ubah_profil", { p_nama: String(form.get("nama") ?? ""), p_hp: String(form.get("hp") ?? "") });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Profil tersimpan." };
}

// Ganti password sendiri: password lama diperiksa dulu
export async function gantiPassword(_: Result, form: FormData): Promise<Result> {
  const lama = String(form.get("lama") ?? "");
  const baru = String(form.get("baru") ?? "");
  if (baru.length < 8) return { error: "Password baru minimal 8 karakter." };
  if (baru !== String(form.get("baru2") ?? "")) return { error: "Konfirmasi password baru tidak sama." };
  if (baru === lama) return { error: "Password baru harus berbeda dari yang lama." };
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!email || email.endsWith("@pin.matur.id")) return { error: "Akun ini tidak memakai password." };
  const cek = await supabase.auth.signInWithPassword({ email, password: lama });
  if (cek.error) return { error: "Password lama salah." };
  const { error } = await supabase.auth.updateUser({ password: baru });
  if (error) return { error: "Gagal mengganti password: " + error.message };
  return { ok: "Password berhasil diganti." };
}

// Ganti PIN sendiri (akun kode staf kasir/barista): PIN lama diperiksa dulu
export async function gantiPin(_: Result, form: FormData): Promise<Result> {
  const lama = String(form.get("lama") ?? "");
  const baru = String(form.get("baru") ?? "");
  if (!/^\d{4,6}$/.test(baru)) return { error: "PIN baru harus 4–6 angka." };
  if (baru !== String(form.get("baru2") ?? "")) return { error: "Konfirmasi PIN baru tidak sama." };
  if (baru === lama) return { error: "PIN baru harus berbeda dari yang lama." };
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!email?.endsWith("@pin.matur.id")) return { error: "Akun ini memakai password, bukan PIN." };
  const pin = (x: string) => `pin:${x}:${process.env.PIN_PEPPER}`;
  const cek = await supabase.auth.signInWithPassword({ email, password: pin(lama) });
  if (cek.error) return { error: "PIN lama salah." };
  const { error } = await supabase.auth.updateUser({ password: pin(baru) });
  if (error) return { error: "Gagal mengganti PIN: " + error.message };
  return { ok: "PIN berhasil diganti. Pakai PIN baru saat masuk berikutnya." };
}

export type HasilProfil = Result & { kurang?: string[] };

// Profil lengkap karyawan outlet (wajib): foto diri, NIK, TTL, alamat KTP, sharelok rumah, kontak darurat.
// Foto dikompres di browser lalu diunggah ke bucket privat "profil/<uid>/…".
export async function simpanProfilLengkap(form: FormData): Promise<HasilProfil> {
  const supabase = await supabaseServer();
  const { data: c } = await supabase.auth.getClaims();
  const uid = c?.claims?.sub;
  if (!uid) return { error: "Sesi berakhir. Masuk lagi." };
  let foto: string | null = null;
  const file = form.get("foto");
  if (file instanceof File && file.size > 0) {
    if (file.size > 3 * 1024 * 1024) return { error: "Foto terlalu besar (maks 3 MB)." };
    foto = `${uid}/foto-${Date.now()}.jpg`;
    const up = await supabase.storage.from("profil").upload(foto, file, { contentType: file.type || "image/jpeg" });
    if (up.error) return { error: "Gagal mengunggah foto: " + up.error.message };
  }
  const nilai = (k: string) => String(form.get(k) ?? "").trim();
  const maps = nilai("maps_url");
  if (maps && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(maps))
    return { error: "Link sharelok harus dari Google Maps (contoh: https://maps.app.goo.gl/…)." };
  const nik = nilai("nik").replace(/\D/g, "");
  if (nik && nik.length !== 16) return { error: "NIK harus 16 angka sesuai KTP." };
  const { data, error } = await supabase.rpc("simpan_profil_karyawan", {
    p: {
      foto_path: foto,
      nik,
      jenis_kelamin: nilai("jenis_kelamin"),
      tempat_lahir: nilai("tempat_lahir"),
      tgl_lahir: nilai("tgl_lahir"),
      alamat_ktp: nilai("alamat_ktp"),
      alamat_domisili: nilai("alamat_domisili"),
      maps_url: maps,
      no_hp: nilai("no_hp"),
      darurat_nama: nilai("darurat_nama"),
      darurat_hubungan: nilai("darurat_hubungan"),
      darurat_hp: nilai("darurat_hp"),
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/karyawan", "layout");
  const kurang = (data ?? []) as string[];
  return { ok: kurang.length ? "Tersimpan. Masih ada data yang wajib dilengkapi." : "Profil lengkap tersimpan. Terima kasih!", kurang };
}
