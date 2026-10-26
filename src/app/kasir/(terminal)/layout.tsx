import Link from "next/link";
import { MasukPos } from "@/app/pos/masuk-pos";
import { Alihkan } from "@/components/alihkan";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { statusPos } from "@/lib/pos-tim";
import { PosAntrean } from "@/components/pos-antrean";
import { PosLogout } from "@/components/pos-logout";
import { TerminalNav } from "./terminal-nav";
import { PrinterTombol } from "./printer-tombol";
export default async function TerminalLayout({children}:{children:React.ReactNode}){
 const s=await getSession();if(s?.active?.role!=="tablet"||!s.active.outletId)return <Alihkan ke="/pos"/>;
 const path=(await headers()).get("x-matur-pathname")??"";
 for(const p of ["absen","jadwal","izin","slip","kiriman","setoran"]){if(path.startsWith(`/kasir/${p}`))return <Alihkan ke={p==="absen"?"/karyawan":`/karyawan/${p}`}/>;}
 try{await statusPos(s.active.outletId);}catch{return <MasukPos pesan="Sesi login outlet perlu diperbarui. Silakan masuk kembali."/>;}
 return <div className="min-h-screen"><header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-matur-200 bg-white px-4 py-2"><Link href="/kasir/pos" className="mr-auto font-bold">Matoer POS · {s.active.outletNama}</Link><TerminalNav items={[{href:"/kasir/pos",label:"Kasir"},{href:"/kasir/antrean",label:"Antrean"},{href:"/kasir/riwayat",label:"Riwayat"},{href:"/kasir/shift",label:"Kas"},{href:"/kasir/stok",label:"Stok"}]}/><PrinterTombol/><PosLogout label="Keluar POS"/></header><main className="p-3 sm:p-4"><PosAntrean/>{children}</main></div>;
}
