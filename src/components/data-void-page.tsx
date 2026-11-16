import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { VOID_ROLES,rentangVoid,type VoidRow } from "@/lib/data-void";
import { DataVoidView } from "./data-void-view";
export type VoidParams={periode?:string;dari?:string;sampai?:string;outlet?:string;transaksi?:string};
export async function DataVoidPage({searchParams}:{searchParams:Promise<VoidParams>}){
 const s=await getSession();if(!s?.active)redirect("/login");const a=s.active;
 if(!VOID_ROLES.includes(a.role))notFound();
 const own=["kasir","barista","tablet","spv"].includes(a.role);if(own&&!a.outletId)notFound();
 const p=await searchParams;const db=await supabaseServer();
 const {data:outlets,error:oe}=await db.from("outlet").select("id,nama").eq("mode","asli").is("deleted_at",null).order("nama");
 if(oe)throw Error("Outlet belum dapat dimuat: "+oe.message);
 const outlet=own?a.outletId:(p.outlet||null);
 if(outlet&&!outlets?.some(o=>o.id===outlet))notFound();
 let range;try{range=rentangVoid(p.periode??"hariini",p.dari,p.sampai);}catch(e){return <div role="alert">{(e as Error).message} <a href="?periode=hariini">Kembali ke hari ini</a></div>;}
 if(p.transaksi&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.transaksi))notFound();
 const {data,error}=await db.rpc("data_void",{p_outlet:outlet,p_dari:range.dari,p_sampai:range.sampai,p_id:p.transaksi??null});
 if(error)throw Error("Data void belum dapat dimuat: "+error.message);
 return <DataVoidView rows={(data??[]) as VoidRow[]} outlets={outlets??[]} own={own} outlet={outlet??""} periode={p.periode??"hariini"} range={range} detail={!!p.transaksi}/>;
}
