import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";
import { POS_ROLES } from "@/lib/roles";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.assignments.some((a) => POS_ROLES.includes(a.role)))
    redirect(s.status === "aktif" ? "/dashboard" : "/menunggu");
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Image
            src="/brand/logo-192.png"
            width={36}
            height={36}
            alt="Matoer"
            className="rounded-xl"
          />
          <div className="mr-auto">
            <p className="font-bold">Matoer · Ruang Karyawan</p>
            <p className="text-xs text-stone-500">
              {s.nama} · {s.active?.outletNama ?? "Pilih outlet"}
            </p>
          </div>
          <form action={logoutAction}>
            <button className="rounded-lg border px-3 py-2 text-xs">
              Keluar
            </button>
          </form>
        </div>
        <nav className="mx-auto mt-3 flex max-w-6xl gap-2 overflow-x-auto whitespace-nowrap text-xs font-semibold">
          {[
            ["/karyawan", "Dashboard & Absen"],
            ["/karyawan/jadwal", "Jadwal"],
            ["/karyawan/izin", "Izin & Tukar"],
            ["/karyawan/slip", "Slip Gaji"],
            ["/karyawan/kiriman", "Terima Barang"],
            ["/karyawan/setoran", "Setoran"],
            ["/karyawan/stok", "Stok Outlet"],
          ].map(([href, l]) => (
            <Link
              key={href}
              className="rounded-full bg-matur-50 px-3 py-2 text-kopi-900"
              href={href}
            >
              {l}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
