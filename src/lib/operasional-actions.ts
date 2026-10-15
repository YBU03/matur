"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
export type Result = { error?: string; ok?: string; id?: string };
const refresh = () => {
  for (const p of [
    "/operasional/kiriman",
    "/kasir/kiriman",
    "/gudang/kiriman",
    "/setoran",
    "/kasir/setoran",
    "/kasbon",
    "/penggajian",
    "/stok-realtime",
  ])
    revalidatePath(p);
};
async function rpc(
  fn: string,
  args: Record<string, unknown>,
  ok: string,
): Promise<Result> {
  const db = await supabaseServer();
  const { data, error } = await db.rpc(fn, args);
  if (error) return { error: error.message };
  refresh();
  return { ok, id: typeof data === "string" ? data : undefined };
}
export async function unggahBukti(
  form: FormData,
): Promise<Result & { path?: string }> {
  const s = await getSession();
  const db = await supabaseServer();
  if (!s?.active) return { error: "Silakan login." };
  const file = form.get("file");
  const jenis = String(form.get("jenis"));
  const outlet = String(form.get("outlet"));
  if (!["setoran", "kiriman"].includes(jenis))
    return { error: "Jenis bukti tidak valid." };
  if (
    !(file instanceof File) ||
    !file.size ||
    file.size > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    return { error: "Gunakan foto JPG/PNG/WebP maksimal 5 MB." };
  const path = `${jenis}/${outlet}/${s.userId}/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
  const { error } = await db.storage
    .from("operasional-bukti")
    .upload(path, file, { contentType: file.type });
  return error ? { error: error.message } : { path, ok: "Bukti diunggah." };
}
export async function periksaKiriman(
  id: string,
  client: string,
  items: { id: string; baik: number; rusak: number; salah: number }[],
  catatan: string,
  foto: string,
): Promise<Result> {
  return rpc(
    "periksa_kiriman",
    {
      p_id: id,
      p_client: client,
      p_items: items,
      p_catatan: catatan,
      p_foto: foto,
    },
    "Hasil pemeriksaan dicatat. Hanya barang baik yang menambah stok outlet.",
  );
}
export async function selesaikanKiriman(
  id: string,
  tindakan: string,
  retur: { id: string; qty: number }[],
  catatan: string,
): Promise<Result> {
  return rpc(
    "selesaikan_selisih_kiriman",
    { p_id: id, p_tindakan: tindakan, p_retur: retur, p_catatan: catatan },
    "Selisih diselesaikan. Bila dipilih, draft kiriman susulan tersedia di Gudang.",
  );
}
export async function buatSetoran(d: {
  client_id: string;
  outlet_id: string;
  cara: string;
  waktu: string;
  pengambil: string;
  penanggung_jawab: string;
  tujuan: string;
  bukti_path: string;
  catatan: string;
  rincian: { tanggal: string; jumlah: number }[];
  sesi_kas_id?: string;
  pengganti_id?: string;
}): Promise<Result> {
  return rpc(
    "buat_setoran",
    { p: d },
    "Setoran diajukan; menunggu verifikasi Akunting.",
  );
}
export async function verifikasiSetoran(
  id: string,
  setuju: boolean,
  alasan: string,
): Promise<Result> {
  return rpc(
    "verifikasi_setoran",
    { p_id: id, p_setuju: setuju, p_alasan: alasan },
    setuju
      ? "Setoran diverifikasi."
      : "Setoran ditolak; rincian tanggal dapat diajukan kembali.",
  );
}
export async function koreksiRekonsiliasi(
  outlet: string,
  tanggal: string,
  modal: number,
  koreksi: number,
  alasan: string,
): Promise<Result> {
  return rpc(
    "koreksi_rekonsiliasi",
    {
      p_outlet: outlet,
      p_tanggal: tanggal,
      p_modal: modal,
      p_koreksi: koreksi,
      p_alasan: alasan,
    },
    "Penyesuaian Akunting tersimpan beserta alasan dan riwayat.",
  );
}
export async function catatKasbon(
  outlet: string,
  uid: string,
  tanggal: string,
  jumlah: number,
  cicilan: number,
  catatan: string,
  client: string,
): Promise<Result> {
  return rpc(
    "catat_kasbon",
    {
      p_outlet: outlet,
      p_uid: uid,
      p_tanggal: tanggal,
      p_jumlah: jumlah,
      p_cicilan: cicilan,
      p_catatan: catatan,
      p_client: client,
    },
    "Pencairan kasbon dicatat. Cicilan dipotong dari slip dan berlaku setelah gaji final.",
  );
}
export async function setujuiJamGaji(id: string): Promise<Result> {
  return rpc(
    "setujui_jam_gaji",
    { p_slip: id },
    "Hitungan jam dan lembur disetujui.",
  );
}
