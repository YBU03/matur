import "server-only";
import { cookies } from "next/headers";
import { supabaseServer } from "./supabase/server";
export const POS_DEVICE = "matur_pos_device";
export const POS_UNLOCK = "matur_pos_unlock";
export type TimStatus = {
  alur_shift?: boolean;
  shift_aktif?: import("./pos-alur").ShiftBaru | null;
  pilihan?: import("./pos-alur").PilihanShift[];
  langsung?: boolean;
  presentasi?: boolean;
  katalog?: {
    menu: Record<string, { langsung: number; ojol: number }>;
    varian: Record<string, number>;
  };
  pic?: { id: string; nama: string } | null;
  server_at: string;
  device: { id: string; nama: string; status: string } | null;
  sesi: {
    id: string;
    nama: string;
    pembuka_id: string;
    modal: number;
    buka_at: string;
    batas_at: string;
    shift_id: string;
    tanggal: string;
    legacy: boolean;
    kas_harian?: boolean;
    perangkat_sama: boolean;
    menunggu_reset?: boolean;
    aktif_tim: boolean;
    anggota: {
      id: string;
      nama: string;
      gabung_at: string;
      keluar_at: string | null;
    }[];
  } | null;
  izin: { id: string; mulai_at: string; sampai_at: string } | null;
  boleh: boolean;
  /** mode perangkat: kasir penuh atau layar antrean saja */
  mode?: "kasir" | "antrean";
  /** anggota tim yang terakhir membuka kunci PIN (tercatat di struk/riwayat) */
  operator?: { id: string; nama: string; kasir: boolean } | null;
  omzet?: { total: number; jumlah: number };
  roster: {
    id: string;
    nama: string;
    shift_id: string;
    tanggal: string;
    shift: string;
    kasir: boolean;
  }[];
};
export async function buktiTablet() {
  const c = await cookies();
  const device = c.get(POS_DEVICE)?.value ?? "";
  return { device, token: c.get(POS_UNLOCK)?.value ?? device };
}
export async function statusPos(outlet: string, perbarui = false) {
  const db = await supabaseServer();
  const p = await buktiTablet();
  const { data, error } = await db.rpc("status_pos_tim", {
    p_outlet: outlet,
    p_device: p.device,
    p_token: p.token,
    p_perbarui: perbarui,
  });
  if (error) throw new Error(error.message);
  const status = data as TimStatus;
  if(status.pilihan){
    await Promise.all(status.pilihan.map(async p=>{if(!p.foto_path)return;const {data: foto}=await db.storage.from("profil").createSignedUrl(p.foto_path,3600);if(foto?.signedUrl)p.foto_url=foto.signedUrl;}));
  }
  return status;
}

/** ringkasan untuk header tablet POS */
export function infoTablet(st: TimStatus, outlet: string) {
  const tim = (st.sesi?.anggota ?? [])
    .filter((a) => !a.keluar_at)
    .map((a) => a.nama);
  return {
    outlet,
    tablet: st.device?.nama ?? "Tablet",
    shift: st.sesi
      ? `${st.sesi.nama.replace(/ · Tim$/, "")} · ${st.sesi.tanggal}`
      : null,
    tim,
    operator:
      st.boleh && st.operator
        ? { nama: st.operator.nama, kasir: st.operator.kasir }
        : null,
    omzet: st.sesi ? (st.omzet ?? { total: 0, jumlah: 0 }) : null,
  };
}
