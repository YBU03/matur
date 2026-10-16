import Image from "next/image";
import { LogoutButton } from "@/components/logout-button";

// Layar saat sistem sedang maintenance (dinyalakan owner/admin pusat).
export function MaintenanceScreen({ pesan, pos = false }: { pesan?: string | null; pos?: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fffaf2] p-6 text-center">
      <div className="max-w-md">
        <Image src="/mascot/maintenance.png" alt="" width={600} height={404} priority className="mx-auto w-full max-w-sm" />
        <h1 className="mt-4 text-2xl font-bold text-kopi-900">Sedang Proses Maintenance</h1>
        <p className="mt-2 text-stone-600">{pesan || "Kami sedang melakukan perbaikan untuk memberikan pengalaman terbaik. Silakan coba lagi beberapa saat lagi."}</p>
        <LogoutButton pos={pos} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-matur-300 bg-white px-4 py-2 text-sm font-semibold text-matur-700 mt-5" />
      </div>
    </main>
  );
}
