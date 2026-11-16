"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";
export async function simpanRekening(_: { error?: string; ok?: string }, form: FormData): Promise<{error?:string;ok?:string}> {
 const db=await supabaseServer();
 const {error}=await db.rpc("simpan_rekening_sendiri",{p_bank:String(form.get("bank")??""),p_nomor:String(form.get("nomor")??""),p_nama:String(form.get("atas_nama")??"")});
 if(error)return {error:error.message};
 revalidatePath("/karyawan/profil");revalidatePath("/penggajian");
 return {ok:"Rekening tersimpan dan terhubung ke penggajian. Slip yang sudah final tetap memakai data sebelumnya."};
}
