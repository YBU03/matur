import { redirect } from "next/navigation";
import { LogOut, PackageCheck, Receipt, UserRound, Wallet, Warehouse, Bell, MonitorSmartphone } from "lucide-react";
import { KartuModul, JudulHalaman, tombol } from "@/components/staf/ui";
import { logoutAction } from "@/lib/actions";
import { BISA_JUAL } from "@/lib/roles";
import { getSession } from "@/lib/session";

// Menu lain Ruang Karyawan (yang tidak muat di pil bawah HP).
export default async function Lainnya() {
  const s = await getSession();
  if (!s) redirect("/login");
  const pos = !!s.active && BISA_JUAL.includes(s.active.role);
  return (
    <>
      <JudulHalaman judul="Lainnya" keterangan="Slip gaji, terima barang, setoran, stok, dan akun." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KartuModul href="/karyawan/slip" judul="Slip Gaji" keterangan="Bulan yang sudah final" ikon={Receipt} nada="oranye" />
        <KartuModul href="/karyawan/kiriman" judul="Terima Barang" keterangan="Kiriman gudang" ikon={PackageCheck} nada="kopi" />
        <KartuModul href="/karyawan/setoran" judul="Setoran" keterangan="Setor omzet & bukti" ikon={Wallet} nada="hijau" />
        <KartuModul href="/karyawan/stok" judul="Stok Outlet" keterangan="Cek & opname" ikon={Warehouse} nada="merah" />
        <KartuModul href="/karyawan/notifikasi" judul="Notifikasi" keterangan="Kabar izin & jadwal" ikon={Bell} nada="kopi" />
        <KartuModul href="/karyawan/profil" judul="Profil" keterangan="Data diri & password" ikon={UserRound} nada="oranye" />
        {pos && <KartuModul href="/kasir/pos" judul="Buka POS" keterangan="Khusus tablet outlet" ikon={MonitorSmartphone} nada="merah" />}
      </div>
      <form action={logoutAction} className="mt-6">
        <button className={`${tombol.bahaya} w-full lg:w-auto`}>
          <LogOut className="size-4" aria-hidden /> Keluar
        </button>
      </form>
    </>
  );
}
