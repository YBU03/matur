"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";
export async function simpanModalPos(sesi:string,jumlah:number):Promise<{ok?:string;error?:string}>{
 try{const db=await supabaseServer();const {buktiTablet}=await import("./pos-tim");const proof=await buktiTablet();const {error}=await db.rpc("atur_modal_pos",{p_sesi:sesi,p_device:proof.device,p_jumlah:jumlah});if(error)return {error:error.message};revalidatePath("/kasir/shift");return {ok:"Modal kas tersimpan."};}catch{return {error:"Modal belum tersimpan. Coba lagi."};}
}
