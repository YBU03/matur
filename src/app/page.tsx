import { redirect } from "next/navigation";
import { POS_ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.assignments.length === 0) redirect("/menunggu");
  if (s.active?.role === "tablet") redirect("/pos");
  if(s.assignments.every(a=>POS_ROLES.includes(a.role)))redirect("/karyawan");
  redirect(s.active ? "/dashboard" : "/pilih-peran");
}
