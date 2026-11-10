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
const NAV=[{href:"/kasir/pos",label:"Kasir",ikon:"pos"},{href:"/kasir/antrean",label:"Antrean",ikon:"antrean"},{href:"/kasir/shift",label:"Kas",ikon:"uang"},{href:"/kasir/stok",label:"Stok",ikon:"stok"}] as const;
export default async function TerminalLayout({children}:{children:React.ReactNode}){
 const s=await getSession();if(s?.active?.role!=="tablet"||!s.active.outletId)return <Alihkan ke="/pos"/>;
 const path=(await headers()).get("x-matur-pathname")??"";
 for(const p of ["absen","jadwal","izin","slip","kiriman","setoran"]){if(path.startsWith(`/kasir/${p}`))return <Alihkan ke={p==="absen"?"/karyawan":`/karyawan/${p}`}/>;}
 try{await statusPos(s.active.outletId);}catch{return <MasukPos pesan="Sesi login outlet perlu diperbarui. Silakan masuk kembali."/>;}
 return <div className="min-h-screen"><header className="sticky top-0 z-40 border-b border-matur-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4"><div className="flex items-center gap-2 sm:gap-3"><Link href="/kasir/pos" className="mr-auto min-w-0 truncate font-bold"><span className="text-matur-600">Matoer POS</span><span className="hidden sm:inline"> · </span><span className="block truncate text-xs font-semibold text-stone-500 sm:inline sm:text-base sm:font-bold sm:text-kopi-900">{s.active.outletNama}</span></Link><div className="hidden md:block"><TerminalNav items={NAV}/></div><PrinterTombol/><PosLogout label="Keluar"/></div><div className="mt-1.5 md:hidden"><TerminalNav items={NAV}/></div></header><main className="p-3 sm:p-4"><PosAntrean/>{children}</main></div>;
}
