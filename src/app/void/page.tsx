import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { VOID_ROLES } from "@/lib/data-void";
export default async function VoidRedirect({searchParams}:{searchParams:Promise<{transaksi?:string}>}){
 const s=await getSession();if(!s?.active||!VOID_ROLES.includes(s.active.role))redirect("/login");const p=await searchParams;
 const base=s.active.role==="tablet"?"/kasir/void":["kasir","barista"].includes(s.active.role)?"/karyawan/void":"/data-void";
 redirect(base+(p.transaksi?"?transaksi="+encodeURIComponent(p.transaksi):""));
}
