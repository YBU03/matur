"use server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { buktiTablet, statusPos, POS_DEVICE, POS_UNLOCK } from "./pos-tim";
import { COOKIE_SESI } from "./shift";
export type PosHasil = { error?: string; ok?: string; id?: string };
const segarkan = () => {
  for (const path of [
    "/karyawan",
    "/kasir/pos",
    "/kasir/shift",
    "/pengaturan/pos",
  ])
    revalidatePath(path);
};
const perangkatInfo = (ua: string) => {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iPhone/iPad"
      : /Windows/.test(ua)
        ? "Windows"
        : /Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Perangkat";
  return `${browser} · ${os}`;
};
const options = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
async function rpc(
  fn: string,
  args: Record<string, unknown>,
  ok: string,
): Promise<PosHasil> {
  const db = await supabaseServer();
  const { data, error } = await db.rpc(fn, args);
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  segarkan();
  return { ok, id: typeof data === "string" ? data : undefined };
}
export async function mintaTablet(nama: string): Promise<PosHasil> {
  const s = await getSession();
  if (!s?.active?.outletId) return { error: "Pilih outlet dahulu." };
  const c = await cookies();
  let key = c.get(POS_DEVICE)?.value;
  if (!key) {
    key = randomBytes(32).toString("hex");
    c.set(POS_DEVICE, key, { ...options, maxAge: 60 * 60 * 24 * 365 });
  }
  return rpc(
    "minta_tablet_pos",
    { p_outlet: s.active.outletId, p_nama: nama, p_rahasia: key },
    "Permintaan perangkat dikirim. Minta HRD/Admin Gudang menyetujui tablet ini.",
  );
}
export async function bukaPos(
  kode: string,
  pin: string,
  modal: number,
  anggota: string[],
): Promise<PosHasil> {
  const s = await getSession();
  if (!s?.active?.outletId) return { error: "Sesi berakhir." };
  const proof = await buktiTablet();
  const token = randomBytes(32).toString("hex");
  const db = await supabaseServer();
  const { data, error } = await db.rpc("buka_pos_tim", {
    p_outlet: s.active.outletId,
    p_device: proof.device,
    p_kode: kode,
    p_pin: pin,
    p_modal: modal,
    p_anggota: anggota,
    p_token: token,
  });
  if (error || data?.error) return { error: error?.message ?? data.error };
  const c = await cookies();
  c.set(POS_UNLOCK, token, { ...options, maxAge: 60 * 60 * 20 });
  c.set(COOKIE_SESI, data.sesi_id, { ...options, maxAge: 60 * 60 * 20 });
  segarkan();
  return { ok: "POS tim terbuka.", id: data.sesi_id };
}
export async function perbaruiPos() {
  const s = await getSession();
  if (!s?.active?.outletId) return { error: "Sesi akun berakhir." };
  try {
    return { data: await statusPos(s.active.outletId, true) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
export async function kunciPos(): Promise<PosHasil> {
  const s = await getSession();
  if (!s?.active?.outletId) return { error: "Sesi berakhir." };
  const p = await buktiTablet();
  const r = await rpc(
    "kunci_pos_tim",
    { p_outlet: s.active.outletId, p_device: p.device, p_token: p.token },
    "POS dikunci; pilih PIC yang masih bertugas untuk melanjutkan.",
  );
  if (!r.error) (await cookies()).delete(POS_UNLOCK);
  return r;
}
export async function gabungTim(id: string) {
  return rpc(
    "gabung_pos_tim",
    { p_sesi: id },
    "Anda tercatat dalam tim shift.",
  );
}
export async function tutupPos(
  id: string,
  kode: string,
  pin: string,
  aktual: number,
  catatan: string,
  pending: string[],
): Promise<PosHasil> {
  const p = await buktiTablet();
  const r = await rpc(
    "tutup_pos_tim",
    {
      p_sesi: id,
      p_device: p.device,
      p_kode: kode,
      p_pin: pin,
      p_aktual: aktual,
      p_catatan: catatan,
      p_pending: pending,
    },
    pending.length
      ? "Sesi ditutup sementara; rekap diperbarui setelah seluruh transaksi tersinkron."
      : "Kas tim ditutup. Periksa status rekap: tetap sementara jika perangkat asal belum selesai menyinkronkan data.",
  );
  if (!r.error) {
    const c = await cookies();
    c.delete(COOKIE_SESI);
    c.delete(POS_UNLOCK);
  }
  return r;
}
export async function aturTablet(id: string, aktif: boolean, alasan: string) {
  return rpc(
    "atur_tablet_pos",
    { p_id: id, p_aktif: aktif, p_alasan: alasan },
    "Akses tablet diperbarui.",
  );
}
export async function aturPinPos(uid: string, kode: string, pin: string) {
  return rpc(
    "atur_pos_pin",
    { p_uid: uid, p_kode: kode, p_pin: pin },
    "Kode staf dan PIN POS disimpan. Password login HP tetap berlaku.",
  );
}
export async function lihatPinPos(
  uid: string,
): Promise<{ error?: string; pin?: string }> {
  const db = await supabaseServer();
  const { data, error } = await db.rpc("lihat_pos_pin", { p_uid: uid });
  return error ? { error: error.message } : { pin: data };
}
export async function aksesPosStaf(
  uid: string,
  outlet: string,
  boleh: boolean,
) {
  return rpc(
    "akses_pos_staf",
    { p_uid: uid, p_outlet: outlet, p_boleh: boleh },
    "Akses POS diperbarui.",
  );
}
export async function aturOutletPos(
  o: string,
  awal: number,
  offline: number,
  lat: number | null,
  lng: number | null,
  radius: number,
) {
  return rpc(
    "atur_operasional_outlet",
    {
      p_outlet: o,
      p_awal: awal,
      p_offline: offline,
      p_lat: lat,
      p_lng: lng,
      p_radius: radius,
    },
    "Aturan POS dan lokasi absensi disimpan.",
  );
}
export async function perpanjangPos(id: string, menit: number, alasan: string) {
  return rpc(
    "perpanjang_pos_tim",
    { p_sesi: id, p_menit: menit, p_alasan: alasan },
    "Batas sesi diperpanjang dan alasan tercatat.",
  );
}
export async function tutupPosLama(id: string, aktual: number, alasan: string) {
  return rpc(
    "tutup_pos_lama",
    { p_sesi: id, p_aktual: aktual, p_alasan: alasan },
    "Sesi lama ditutup tanpa menghapus riwayat.",
  );
}
export async function emailLoginStaf(
  uid: string,
  email: string,
  password: string,
) {
  return rpc(
    "email_login_staf",
    { p_uid: uid, p_email: email, p_password: password },
    "Email login dihubungkan ke identitas lama. Riwayat tetap tersimpan.",
  );
}

export async function mintaPindahPos(
  sesi: string,
  nama: string,
  alasan: string,
): Promise<PosHasil> {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "hrd", "admin_pusat", "admin_gudang"].includes(s.active.role)
  )
    return { error: "Hanya admin perangkat." };
  const c = await cookies();
  let secret = c.get(POS_DEVICE)?.value;
  if (!secret) {
    secret = randomBytes(32).toString("hex");
    c.set(POS_DEVICE, secret, { ...options, maxAge: 60 * 60 * 24 * 400 });
  }
  const { headers } = await import("next/headers");
  const info = perangkatInfo((await headers()).get("user-agent") ?? "");
  return rpc(
    "minta_pindah_pos",
    {
      p_sesi: sesi,
      p_rahasia: secret,
      p_nama: nama,
      p_info: info,
      p_alasan: alasan,
    },
    "Permintaan pindah tercatat. Perangkat lama dikunci saat online; selesaikan setelah antrean bersih atau izin offline berakhir.",
  );
}
export async function selesaikanPindahPos(
  id: string,
  akui: boolean,
): Promise<PosHasil> {
  const proof = await buktiTablet();
  return rpc(
    "selesaikan_pindah_pos",
    { p_id: id, p_rahasia: proof.device, p_akui: akui },
    "POS dipindahkan. Shift, modal dan transaksi tetap sama. Buka /pos dengan akun outlet dan pilih PIC shift.",
  );
}
export async function laporPerangkatPos(
  ids: string[],
  beku: boolean,
): Promise<{ beku?: boolean }> {
  const s = await getSession();
  if (
    !s?.active?.outletId ||
    !["tablet", "kasir", "barista", "spv"].includes(s.active.role)
  )
    return {};
  const proof = await buktiTablet();
  if (!proof.device) return {};
  const { headers } = await import("next/headers");
  const db = await supabaseServer();
  const { data, error } = await db.rpc("lapor_perangkat_pos", {
    p_rahasia: proof.device,
    p_ids: ids,
    p_beku: beku,
    p_info: perangkatInfo((await headers()).get("user-agent") ?? ""),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function batalPindahPos(id: string, alasan: string) {
  return rpc(
    "batal_pindah_pos",
    { p_id: id, p_alasan: alasan },
    "Permintaan pindah dibatalkan. Petugas dapat membuka kembali perangkat asal memakai kode/PIN; sesi kas tetap sama.",
  );
}

export async function resetAksesPos(outlet: string | null, alasan: string) {
  return rpc(
    "reset_akses_pos",
    { p_outlet: outlet, p_alasan: alasan },
    "Akses perangkat direset. Login ulang di /pos dengan akun outlet; perangkat pertama yang valid melanjutkan sesi tim tanpa mengulang modal.",
  );
}
