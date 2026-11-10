"use server";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { SnapState } from "./snap-sandbox-model";
export async function snapAction(action:string,data:Record<string,unknown>={}):Promise<{state?:SnapState;generated?:Record<string,unknown>;error?:string}> {
 const s=await getSession();if(!s?.active||!["owner","admin_pusat","finance"].includes(s.active.role))return {error:"Tidak berwenang."};
 if(!['status','save','toggle','result','prepare'].includes(action)||JSON.stringify(data).length>16000)return {error:"Permintaan tidak valid atau terlalu besar."};
 try {
  const db=await supabaseServer();const {data:session}=await db.auth.getSession();const token=session.session?.access_token;
  if(!token)return {error:"Sesi habis. Masuk kembali."};
  const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/matoer-snap-sandbox/admin/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)});
  const body=await r.json();
  if(!r.ok||body.error)return {error:typeof body.error==='string'?body.error:'Proses sandbox belum berhasil.'};
  return action==='prepare'?{generated:body}:{state:body as SnapState};
 }catch{return {error:"Sandbox belum dapat dihubungi. Coba lagi."};}
}
export async function snapBukti(form:FormData):Promise<{path?:string;error?:string}> {
 const s=await getSession();if(!s?.active||!["owner","admin_pusat","finance"].includes(s.active.role))return {error:"Tidak berwenang."};
 const f=form.get('file');if(!(f instanceof File)||f.size<1||f.size>5242880||!['image/png','image/jpeg','application/pdf'].includes(f.type))return {error:"Gunakan PNG, JPG atau PDF maksimal 5 MB."};
 const b=new Uint8Array(await f.slice(0,8).arrayBuffer());
 if(!((f.type==='image/png'&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)||(f.type==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255)||(f.type==='application/pdf'&&b[0]===37&&b[1]===80&&b[2]===68&&b[3]===70)))return {error:"Isi berkas tidak sesuai format."};
 const path=`${s.userId}/${crypto.randomUUID()}.${f.type==='application/pdf'?'pdf':f.type==='image/png'?'png':'jpg'}`;
 const db=await supabaseServer();const {error}=await db.storage.from('snap-sandbox-bukti').upload(path,f,{contentType:f.type,upsert:false});return error?{error:"Bukti belum dapat diunggah."}:{path};
}
export async function snapLihatBukti(path:string):Promise<{url?:string;error?:string}> {
 const s=await getSession();if(!s?.active||!["owner","admin_pusat","finance"].includes(s.active.role))return {error:"Tidak berwenang."};
 const db=await supabaseServer();const {data,error}=await db.storage.from('snap-sandbox-bukti').createSignedUrl(path,60);
 return error?{error:"Bukti belum dapat dibuka."}:{url:data.signedUrl};
}

/** Kunci & Token Signature Matoer untuk BNI Direct API (sandbox). Private key tetap di Vault; browser hanya menerima sertifikat & signature. */
export async function bniAction(action:"bni-kunci"|"bni-kunci-buat"|"bni-signature"|"bni-oauth-simpan"|"bni-token-tes",data:Record<string,unknown>={}):Promise<{data?:Record<string,unknown>;error?:string}> {
 const s=await getSession();if(!s?.active||!["owner","admin_pusat","finance"].includes(s.active.role))return {error:"Tidak berwenang."};
 if(!["bni-kunci","bni-kunci-buat","bni-signature","bni-oauth-simpan","bni-token-tes"].includes(action)||JSON.stringify(data).length>2000)return {error:"Permintaan tidak valid."};
 try {
  const db=await supabaseServer();const {data:session}=await db.auth.getSession();const token=session.session?.access_token;
  if(!token)return {error:"Sesi habis. Masuk kembali."};
  const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/matoer-snap-sandbox/admin/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)});
  const body=await r.json();
  if(!r.ok||body.error)return {error:typeof body.error==='string'?body.error:'Proses kunci BNI belum berhasil.'};
  return {data:body};
 }catch{return {error:"Server belum dapat dihubungi. Coba lagi."};}
}
