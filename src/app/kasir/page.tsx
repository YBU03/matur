import {redirect} from "next/navigation";
import {getSession} from "@/lib/session";
export default async function KasirEntry(){const s=await getSession();redirect(s?"/karyawan":"/login");}
