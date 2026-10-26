"use client";
import {PosAturanShift} from "@/components/pos-aturan-shift";
import type {AturanShift} from "@/lib/pos-alur";
import {useState} from "react";
import type {Pindah} from "./perangkat";
import {AksesOutletPanel,type AksesOutlet} from "./akses-outlet";
import {formatRupiah as rp} from "@/lib/format";
type Staf={id:string;nama:string;email:string;status:string;kode:string|null;ada_pin:boolean;tugas:{outlet_id:string;peran:string}[]};
type Outlet={id:string;nama:string;awal:number;offline:number;lat:number|null;lng:number|null;radius:number};
export type PanelData = {
  serah?: {
    id: string;
    sesi_id: string;
    outlet_id: string;
    pic: string;
    sebelum: string | null;
    shift: string;
    mulai_at: string;
    selesai_at: string | null;
    fisik: number;
    seharusnya: number;
    catatan: string;
  }[];
  pusat: boolean;
  perangkat_admin?: boolean;
  pindah?: Pindah[];
  staf: Staf[];
  devices: {
    id: string;
    outlet_id: string;
    nama: string;
    mode?: string;
    status: string;
    created_at: string;
    info_perangkat?: string | null;
    login_nama?: string | null;
    login_at?: string | null;
    operator_nama?: string | null;
    terlihat_at?: string | null;
    antrean_at?: string | null;
    antrean_jumlah?: number | null;
    pembuka_nama?: string | null;
  }[];
  outlets: Outlet[];
  sessions: {
    id: string;
    outlet_id: string;
    nama: string;
    perangkat_id?: string;
    pembuka_nama?: string;
    buka_at: string;
    batas_at: string | null;
    legacy: boolean;
    ditutup_at: string | null;
    status: string;
    pending: number;
    pindah_menunggu?: number;
    aktual: number | null;
    selisih: number | null;
    anggota: { nama: string; gabung_at: string; keluar_at: string | null }[];
  }[];
};

const waktu=(v:string|null)=>v?new Date(v).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"}):"—";
export function PanelPos({data:d,akses,aturan=[]}:{data:PanelData;role:string;akses:AksesOutlet[];aturan?:AturanShift[]}){
 const [tab,setTab]=useState(akses.length?"akses":"kas");const nama=(id:string)=>d.outlets.find(o=>o.id===id)?.nama??"Outlet";
 return <section className="space-y-4"><nav className="flex flex-wrap gap-2" aria-label="Pengaturan POS">{[...(akses.length?[["akses","Akun POS Outlet"]]:[]),...(aturan.length?[["alur","Alur Shift"]]:[]),["kas","Riwayat Kas"],["serah","Arsip Serah Terima"]].map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>setTab(id)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${tab===id?"bg-kopi-900 text-white":"bg-white"}`}>{label}</button>)}</nav>
 {tab==="alur"&&<PosAturanShift outlets={aturan}/>}
 {tab==="akses"&&<AksesOutletPanel outlets={akses}/>}
 {tab==="kas"&&<div className="grid gap-3 sm:grid-cols-2">{!d.sessions.length&&<p className="text-sm text-stone-500">Belum ada kas tercatat.</p>}{d.sessions.map(s=><article key={s.id} className="space-y-1 rounded-2xl border bg-white p-4"><h2 className="font-bold">{nama(s.outlet_id)}</h2><p className="text-sm">{s.ditutup_at?"Ditutup":"Terbuka"} · {s.nama}</p><p className="text-xs text-stone-500">Dibuka {waktu(s.buka_at)} · ditutup {waktu(s.ditutup_at)}</p>{s.aktual!==null&&<p className="text-sm">Uang fisik {rp(s.aktual)} · Selisih {rp(s.selisih??0)}</p>}{s.pending>0&&<p className="text-xs text-amber-800">{s.pending} transaksi menunggu sinkronisasi.</p>}</article>)}</div>}
 {tab==="serah"&&<div className="space-y-2"><p className="text-sm text-stone-500">Arsip pergantian petugas sebelumnya; tidak menjadi syarat akses POS.</p>{!(d.serah?.length)&&<p className="text-sm">Belum ada arsip.</p>}{d.serah?.map(x=><article key={x.id} className="rounded-xl border bg-white p-3 text-sm"><b>{nama(x.outlet_id)} · {x.shift}</b><p>{x.sebelum?x.sebelum+" → ":""}{x.pic} · {waktu(x.mulai_at)}</p><p>Fisik {rp(x.fisik)} · Catatan {x.catatan||"—"}</p></article>)}</div>}
 </section>;
}
