"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import {PosAlurShift} from "@/components/pos-alur-shift";
import { PosScreen } from "@/app/kasir/(terminal)/pos/pos-screen";
import type { TimStatus } from "@/lib/pos-tim";
import { perbaruiPos } from "@/lib/pos-tim-actions";
import { bukaPindahBeku, simpanSnapshot } from "@/lib/pos-offline";
export type PosSnapshot={screen:Omit<ComponentProps<typeof PosScreen>,"izin">;status:TimStatus;client_at:number};
export function PosRuntime({initial,offlineBoot=false}:{initial:PosSnapshot;offlineBoot?:boolean}){
 const [s,setS]=useState(initial.status);const [online,setOnline]=useState(true);const [storageError,setStorageError]=useState("");const [error,setError]=useState("");const anchor=useRef(initial.client_at);
 useEffect(()=>{
  let live=true;let pending=false;
  const save=async(status:TimStatus)=>{try{await bukaPindahBeku();await simpanSnapshot({...initial,status,client_at:Date.now()});if(live)setStorageError("");}catch{if(live)setStorageError("Penyimpanan perangkat belum tersedia. Gunakan koneksi online untuk transaksi.");}};
  const verify=async()=>{setOnline(navigator.onLine);if(!navigator.onLine||pending)return;pending=true;try{const r=await perbaruiPos();if(!live)return;if(r.data){if(r.data.sesi?.id!==initial.status.sesi?.id){location.replace("/kasir/pos");return;}setS(r.data);anchor.current=Date.now();setError("");await save(r.data);}else if(r.error)setError(r.error);}catch{/* antrean lokal tetap tersimpan saat jaringan terputus */}finally{pending=false;}};
  if(!offlineBoot)void save(initial.status);void verify();const timer=setInterval(()=>void verify(),30000);window.addEventListener("online",verify);window.addEventListener("offline",verify);
  return()=>{live=false;clearInterval(timer);window.removeEventListener("online",verify);window.removeEventListener("offline",verify);};
 },[initial,offlineBoot]);
 if(s.alur_shift&&!s.boleh)return <PosAlurShift status={s} outlet={initial.screen.outletNama}/>;
 return <div className="space-y-3"><div className="rounded-xl bg-matur-50 p-3 text-xs font-semibold">{online?"● Terhubung":"● Offline · tunai saja"} · {initial.screen.outletNama}</div>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error} <Link className="underline" href="/pos">Masuk ulang</Link></p>}{storageError&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">{storageError}</p>}<PosScreen {...initial.screen} kasir={s.operator?.nama??initial.screen.kasir} bisaBayar izin={{id:s.izin!.id,sampai_at:s.izin!.sampai_at,server_at:s.server_at,client_at:anchor.current,offlineBoleh:!storageError}}/></div>;
}
