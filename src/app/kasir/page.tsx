import { redirect } from "next/navigation";

// Alamat lama aplikasi POS; tablet yang sudah memasang /kasir tetap diarahkan ke /pos.
export default function KasirLama() {
  redirect("/pos");
}
