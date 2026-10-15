import { redirect } from "next/navigation";

// Dipindah ke aplikasi staf.
export default function Pindah() {
  redirect("/staf/jadwal");
}
