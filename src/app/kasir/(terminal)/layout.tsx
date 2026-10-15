import {headers} from "next/headers";
import {PosAntrean} from "@/components/pos-antrean";
import {PosLogout} from "@/components/pos-logout";
import {infoTablet,statusPos} from "@/lib/pos-tim";
import {TabletHeader} from "@/components/tablet-header";
import {AutoKunci,TombolKunci} from "@/components/tablet-kunci";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { POS_ROLES, ROLES, BISA_JUAL } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { InstallButton } from "@/components/install-button";
import { TerminalNav } from "./terminal-nav";
import { PrinterTombol } from "./printer-tombol";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { statusMaintenance } from "@/lib/maintenance";
import { pengingatShift } from "@/lib/sdm";

// Tampilan aplikasi POS: tanpa menu admin, khusus perangkat di outlet.
export default async function TerminalLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s?.active?.outletId || !POS_ROLES.includes(s.active.role)) redirect("/kasir");
  const m = await statusMaintenance();
  if (m.aktif) return <MaintenanceScreen pesan={m.pesan} />;
  const path=(await headers()).get("x-matur-pathname")??"/kasir/pos";
  for(const p of ["absen","jadwal","izin","slip","kiriman","setoran","stok"]){if(p==="stok"&&s.active.role==="tablet")continue;if(path.startsWith(`/kasir/${p}`))redirect(p==="absen"?"/karyawan":`/karyawan/${p}`);}
  const status=await statusPos(s.active.outletId);
  if(s.active.role==="tablet"){
    // tablet outlet: terkunci → layar PIN di /pos (kecuali tutup shift); mode antrean hanya layar antrean
    if(!status.device||status.device.status!=="aktif")redirect("/pos");
    if(status.mode==="antrean"){
      if(!path.startsWith("/kasir/antrean"))redirect("/kasir/antrean");
      return (<div className="min-h-screen"><TabletHeader info={{...infoTablet(status,s.active.outletNama),operator:null}} beranda/><main className="p-3 sm:p-4">{children}</main></div>);
    }
    if(!status.boleh&&!path.startsWith("/kasir/shift"))redirect("/pos");
    return (
      <div className="min-h-screen">
        {!path.startsWith("/kasir/pos")&&<AutoKunci/>}
        <TabletHeader info={infoTablet(status,s.active.outletNama)}>
          <TerminalNav items={[{href:"/kasir/pos",label:"Kasir"},{href:"/kasir/antrean",label:"Antrean"},{href:"/kasir/riwayat",label:"Riwayat"},{href:"/kasir/shift",label:"Kas"},{href:"/kasir/stok",label:"Stok"}]} />
          <PrinterTombol />
          {status.boleh&&<TombolKunci/>}
        </TabletHeader>
        <main className="p-3 sm:p-4"><PosAntrean/>{children}</main>
      </div>
    );
  }
  if(path!=="/kasir/pos"&&(!status.device||status.device.status!=="aktif"))redirect("/kasir/pos");
  const items=[{href:"/kasir/pos",label:"POS Tim"},{href:"/kasir/antrean",label:"Antrean"},{href:"/kasir/riwayat",label:"Riwayat"},{href:"/kasir/shift",label:"Kas & Pengeluaran"}];
  const ingat = await pengingatShift(s.userId, s.active.outletId);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-matur-200 bg-white px-4 py-2">
        <Image src="/brand/logo-192.png" alt="Matoer" width={32} height={32} className="rounded-lg" />
        <div className="mr-auto leading-tight">
          <p className="text-sm font-bold">Matoer POS · {s.active.outletNama}</p>
          <p className="text-xs text-stone-500">{s.nama} · {ROLES[s.active.role].label}</p>
        </div>
        <TerminalNav items={items} />
        {BISA_JUAL.includes(s.active.role) && <PrinterTombol />}
        <InstallButton className="!w-auto" />
        <PosLogout />
      </header>
      {ingat && (
        <Link href={ingat.href} className={`block px-4 py-2 text-sm font-semibold ${ingat.mendesak ? "bg-red-600 text-white" : "bg-matur-100 text-kopi-900"}`}>
          {ingat.teks} ›
        </Link>
      )}
      <main className="p-3 sm:p-4"><PosAntrean/>{children}</main>
    </div>
  );
}
