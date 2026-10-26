import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { statusPos } from "@/lib/pos-tim";
import { MasukPos } from "./masuk-pos";
export const dynamic="force-dynamic";
export default async function PosHome(){const s=await getSession();if(!s||s.active?.role!=="tablet"||!s.active.outletId)return <MasukPos/>;try{await statusPos(s.active.outletId);}catch{return <MasukPos pesan="Masuk kembali menggunakan username/password outlet yang aktif."/>;}redirect("/kasir/pos");}
