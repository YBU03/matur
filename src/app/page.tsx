import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.assignments.length === 0) redirect("/menunggu");
  redirect(s.active ? "/dashboard" : "/pilih-peran");
}
