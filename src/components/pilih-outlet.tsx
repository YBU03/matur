import Image from "next/image";
import Link from "next/link";

// Kartu pilihan outlet (ikon bangunan RUMA) dipakai di halaman laporan per outlet.
export function PilihOutlet({ outlets, pilih, href }: { outlets: { id: string; nama: string }[]; pilih?: string; href: (id: string) => string }) {
  if (outlets.length < 2) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex w-max gap-2">
        {outlets.map((o) => (
          <Link key={o.id} href={href(o.id)} className={`flex items-center gap-2 rounded-2xl border-2 bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold ${o.id === pilih ? "border-kopi-900 text-kopi-900" : "border-matur-200 text-stone-500"}`}>
            <Image src="/brand/outlet.png" alt="" width={36} height={36} className="rounded-lg bg-matur-50" />
            {o.nama}
          </Link>
        ))}
      </div>
    </div>
  );
}
