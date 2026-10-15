"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { buktiTablet, statusPos } from "./pos-tim";
import { idSesiPerangkat } from "./shift";
import { supabaseServer } from "./supabase/server";

export type CartLine = {
  menu_id: string;
  varian_ids: string[];
  qty: number;
  catatan?: string;
};
export type Checkout = {
  client_id: string;
  /** shift saat transaksi dibuat (penting untuk antrean offline yang dikirim belakangan) */
  sesi_id?: string;
  izin_id?: string;
  waktu_asli?: string;
  sinkron_offline?: boolean;
  kanal: string;
  tipe: "dine_in" | "take_away";
  pelanggan?: string;
  meja?: string;
  diskon: number;
  metode: string;
  diterima?: number;
  /** split payment: beberapa metode; jumlah nominal harus sama dengan total */
  pembayaran?: { metode: string; nominal: number; diterima?: number }[];
  /** izin diskon besar dari SPV (sekali pakai) */
  otorisasi?: string;
  /** dibayar dari pesanan draft → draft otomatis berstatus dibayar */
  draft_id?: string;
  items: CartLine[];
};
export type Receipt = {
  id: string;
  nomor: number;
  subtotal: number;
  diskon: number;
  total: number;
  kembalian: number;
};

async function outlet() {
  const s = await getSession();
  return s?.active?.outletId ?? null;
}

export async function bukaShift(modal: number): Promise<{ error?: string }> {
  const o = await outlet();
  if (!o) return { error: "Pilih outlet terlebih dahulu." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("buka_sesi_kas", {
    p_outlet: o,
    p_modal: Math.round(modal) || 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/kasir/pos");
  return {};
}

export async function bayar(
  c: Checkout,
): Promise<{ error?: string; receipt?: Receipt }> {
  const o = await outlet();
  if (!o) return { error: "Pilih outlet terlebih dahulu." };
  const supabase = await supabaseServer();
  const memakaiQris =
    c.metode === "qris" ||
    c.pembayaran?.some((p) => p.metode === "qris" && p.nominal > 0);
  if (memakaiQris) {
    const { data: q, error: qe } = await supabase
      .from("outlet")
      .select("qris_mode")
      .eq("id", o)
      .single();
    if (qe || !q)
      return { error: "Pengaturan QRIS tidak dapat diperiksa. Coba lagi." };
    if (q.qris_mode === "dinamis")
      return {
        error: "QRIS dinamis menunggu konfigurasi penyedia. Pilih metode lain.",
      };
  }
  const proof = await buktiTablet();
  // Tablet proof never comes from the browser payload; PostgreSQL validates device, team and lease.
  const { data, error } = await supabase.rpc("buat_transaksi", {
    p: {
      ...c,
      outlet_id: o,
      sesi_id: c.sesi_id ?? (await idSesiPerangkat()),
      device_token: proof.device,
      pos_token: proof.token,
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/kasir/antrean");
  return { receipt: data as Receipt };
}

export async function ubahStatus(
  id: string,
  status: "diproses" | "siap" | "diambil",
): Promise<{ error?: string }> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("ubah_status_pesanan", {
    p_id: id,
    p_status: status,
  });
  if (error) return { error: error.message };
  revalidatePath("/kasir/antrean");
  return {};
}

/** Masuk sebagai SPV/Owner di klien terpisah (sesi kasir di perangkat ini tidak berubah).
 *  Kode staf → PIN, email → password. */
async function klienAtasan(login: string, rahasia: string) {
  const l = login.trim().toLowerCase();
  if (!l || !rahasia) return null;
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = l.includes("@")
    ? await c.auth.signInWithPassword({ email: l, password: rahasia })
    : await c.auth.signInWithPassword({
        email: `${l}@pin.matur.id`,
        password: `pin:${rahasia}:${process.env.PIN_PEPPER}`,
      });
  return error ? null : c;
}
const pesanDb = (m: string) => m.replace(/^.*?ERROR:\s*/, "");

/** SPV menyetujui diskon besar dengan PIN-nya di perangkat kasir; hasilnya kode izin sekali pakai (10 menit). */
export async function izinDiskonSpv(
  login: string,
  rahasia: string,
  persen: number,
): Promise<{ error?: string; otorisasi?: string; nama?: string }> {
  const o = await outlet();
  if (!o) return { error: "Pilih outlet terlebih dahulu." };
  if (!login.includes("@")) {
    const db = await supabaseServer();
    const proof = await buktiTablet();
    const { data, error } = await db.rpc("otorisasi_pin_pos", {
      p_outlet: o,
      p_device: proof.device,
      p_kode: login,
      p_pin: rahasia,
      p_aksi: "diskon",
      p_nilai: Math.ceil(persen),
      p_transaksi: null,
      p_alasan: "Persetujuan diskon POS",
    });
    if (error || data?.error) return { error: error?.message ?? data.error };
    return { otorisasi: data.otorisasi, nama: data.nama };
  }
  const c = await klienAtasan(login, rahasia);
  if (!c) return { error: "Kode/email atau PIN/password SPV salah." };
  const { data, error } = await c.rpc("izinkan_diskon", {
    p_outlet: o,
    p_persen: Math.ceil(persen),
  });
  if (error) return { error: pesanDb(error.message) };
  const { data: u } = await c
    .from("pengguna")
    .select("nama")
    .eq("id", (await c.auth.getUser()).data.user!.id)
    .single();
  return { otorisasi: data as string, nama: u?.nama };
}

/** Void transaksi: disetujui SPV (PIN) selama shift masih buka; stok resep dikembalikan. */
export async function voidTransaksi(
  id: string,
  alasan: string,
  login: string,
  rahasia: string,
): Promise<{ error?: string; ok?: string }> {
  if (!login.includes("@")) {
    const o = await outlet();
    if (!o) return { error: "Pilih outlet." };
    const db = await supabaseServer();
    const proof = await buktiTablet();
    const { data, error } = await db.rpc("otorisasi_pin_pos", {
      p_outlet: o,
      p_device: proof.device,
      p_kode: login,
      p_pin: rahasia,
      p_aksi: "void",
      p_nilai: 0,
      p_transaksi: id,
      p_alasan: alasan,
    });
    if (error || data?.error) return { error: error?.message ?? data.error };
    revalidatePath("/kasir/riwayat");
    return { ok: data.ok };
  }
  const c = await klienAtasan(login, rahasia);
  if (!c) return { error: "Kode/email atau PIN/password SPV salah." };
  const { error } = await c.rpc("void_transaksi", {
    p_id: id,
    p_alasan: alasan,
  });
  if (error) return { error: pesanDb(error.message) };
  revalidatePath("/kasir/riwayat");
  revalidatePath("/kasir/antrean");
  return { ok: "Transaksi dibatalkan (void). Stok bahan dikembalikan." };
}

// ---------- Pesanan draft (simpan dulu, bayar nanti) ----------
export type DraftItem = CartLine & { nama: string; harga: number };
export type DraftInput = {
  id?: string;
  label: string;
  kanal: string;
  tipe: string;
  pelanggan: string;
  meja: string;
  diskon: number;
  items: DraftItem[];
  total: number;
};

export async function simpanDraft(
  d: DraftInput,
): Promise<{ error?: string; id?: string }> {
  const o = await outlet();
  if (!o) return { error: "Pilih outlet terlebih dahulu." };
  if (!d.items.length) return { error: "Keranjang kosong." };
  const supabase = await supabaseServer();
  const proof = await buktiTablet();
  const st = await statusPos(o);
  if (!st.boleh) return { error: "POS terkunci atau sesi shift berakhir." };
  const { data, error } = await supabase.rpc("draft_pos_tim", {
    p: {
      ...d,
      outlet_id: o,
      sesi_id: st.sesi!.id,
      device_token: proof.device,
      pos_token: proof.token,
      aksi: "simpan",
    },
  });
  if (error)
    return {
      error:
        error.message.includes("0 rows") || error.code === "PGRST116"
          ? "Draft sudah dibayar/dibatalkan."
          : pesanDb(error.message),
    };
  revalidatePath("/kasir/pos");
  revalidatePath("/kasir/riwayat");
  return { id: data as string };
}

export async function batalDraft(
  id: string,
  alasan: string,
): Promise<{ error?: string }> {
  const supabase = await supabaseServer();
  const o = await outlet();
  if (!o) return { error: "Pilih outlet." };
  const proof = await buktiTablet();
  const st = await statusPos(o);
  if (!st.boleh) return { error: "POS terkunci atau sesi shift berakhir." };
  const { error } = await supabase.rpc("draft_pos_tim", {
    p: {
      id,
      alasan,
      outlet_id: o,
      sesi_id: st.sesi!.id,
      device_token: proof.device,
      pos_token: proof.token,
      aksi: "batal",
    },
  });
  if (error) return { error: pesanDb(error.message) };
  revalidatePath("/kasir/pos");
  revalidatePath("/kasir/riwayat");
  return {};
}
