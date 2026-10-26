"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";
export async function izinkanLanjutKas(sesi: string, ditutup: string, alasan: string): Promise<{ok?:string;error?:string}> {
  try {
    const db=await supabaseServer();
    const {error}=await db.rpc("izinkan_lanjut_kas_pos",{p_sesi:sesi,p_ditutup:ditutup,p_alasan:alasan});
    if(error)return {error:error.message};
    for(const path of ["/pengaturan/pos","/pos","/kasir","/catatan-harian","/stok-realtime"]) revalidatePath(path);
    return {ok:"Kas diizinkan lanjut. Muat ulang POS, pilih PIC yang sudah Clock In, lalu periksa uang fisik. Modal lama tetap."};
  }catch{return {error:"Izin belum tersimpan. Muat ulang status sebelum mencoba lagi."};}
}
export async function akhiriPresentasiPos(outlet: string): Promise<{ok?:string;error?:string}> {
 try {const db=await supabaseServer();const {error}=await db.rpc("atur_presentasi_pos",{p_outlet:outlet,p_menit:0,p_alasan:"Presentasi selesai; kembalikan aturan shift"});if(error)return {error:error.message};revalidatePath("/pengaturan/pos");revalidatePath("/pos");return {ok:"Pengecualian presentasi dihentikan. Aturan shift/absensi normal berlaku kembali."};}catch{return {error:"Status belum diperbarui. Coba lagi."};}
}
