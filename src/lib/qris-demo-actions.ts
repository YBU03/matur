'use server';
import { getSession } from './session';
import { supabaseServer } from './supabase/server';
import { OUTLET_DEMO_ID,type DemoOrder } from './qris-demo';
import type { Checkout } from './pos-actions';
export async function qrisDemoPos(action:'create'|'status'|'cancel'|'history',data:Checkout|{id:string}|Record<string,never>={}) : Promise<{order?:DemoOrder;history?:DemoOrder[];error?:string}>{
 const s=await getSession();if(s?.active?.outletId!==OUTLET_DEMO_ID)return {error:'Simulasi hanya tersedia di Outlet Demo.'};
 const db=await supabaseServer();const {data:r,error}=await db.rpc('qris_demo_pos',{a:action,o:OUTLET_DEMO_ID,p:data});
 return error?{error:error.message}:action==='history'?{history:r as DemoOrder[]}:{order:r as DemoOrder};
}
export async function qrisDemoPublik(token:string,bayar=false):Promise<{data?:{nomor:number;total:number;status:string;expires_at:string};error?:string}>{
 if(!/^[a-f0-9]{64}$/.test(token))return {error:'Tautan simulasi tidak valid.'};
 const db=await supabaseServer();const {data,error}=await db.rpc('qris_demo_publik',{t:token,bayar});
 return error?{error:error.message}:{data};
}
