"use server";
import {revalidatePath} from "next/cache";
import {getSession} from "./session";
import {supabaseServer} from "./supabase/server";
export async function salinKatalog(outlet:string,asal:string|null,requestId:string):Promise<{error?:string;ok?:string}> {
 const s=await getSession();if(!s?.active||!["owner","admin_pusat"].includes(s.active.role))return {error:"Tidak diizinkan."};
 const db=await supabaseServer();const {data,error}=await db.rpc("salin_katalog_outlet",{p:{outlet_id:outlet,asal,request_id:requestId}});
 if(error)return {error:error.message};
 for(const p of ["/pengaturan/usaha","/master/menu","/master/resep","/master/varian","/hpp-menu","/kasir/pos"])revalidatePath(p);
 return {ok:`Katalog mandiri siap: ${data?.jumlah_menu??0} menu/kemasan.`};
}
