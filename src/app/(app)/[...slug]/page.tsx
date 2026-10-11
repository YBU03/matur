import Image from "next/image";
import { notFound } from "next/navigation";
import { ROLES, findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";

// Halaman sementara untuk menu yang dibangun di tahap berikutnya.
export default async function ComingSoon({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const s = await getSession();
  const item = s?.active && findMenu(s.active.role, "/" + slug.join("/"));
  if (!s?.active || !item) notFound(); // menu di luar hak akses peran (AKS-03)

  return (
    <div className="mx-auto mt-10 max-w-md text-center">
      <Image src={`/mascot/${ROLES[s.active.role].mascot}.png`} alt="" width={160} height={160} className="mx-auto rounded-3xl" />
      <h1 className="mt-4 text-2xl font-bold">🔒 {item.label}</h1>
      <p className="mt-2 text-stone-500">
        Fitur ini masih dikunci dan akan dibuka bertahap setelah siap. Terima kasih sudah menunggu!
      </p>
      <p className="mt-1 text-xs text-stone-400">Rencana pengembangan: Tahap {item.stage}</p>
    </div>
  );
}
