"use client";
import { useActionState } from "react";
import { simpanRekening } from "@/lib/rekening-actions";
export function FormRekening({data}:{data:{bank:string|null;no_rekening:string|null;atas_nama:string|null}|null}){
 const [state,action,pending]=useActionState(simpanRekening,{});
 return <form action={action} className="space-y-3"><p className="text-sm text-stone-500">Dipakai untuk rekap gaji. Pastikan nomor dan nama pemilik sesuai buku rekening.</p>{[["bank","Nama Bank",data?.bank],["nomor","Nomor Rekening",data?.no_rekening],["atas_nama","Atas Nama",data?.atas_nama]].map(([name,label,value])=><label key={name} className="block text-sm font-semibold">{label}<input name={name!} defaultValue={value??""} required minLength={name==="nomor"?6:2} maxLength={name==="nomor"?34:name==="bank"?80:120} inputMode={name==="nomor"?"numeric":"text"} pattern={name==="nomor"?"[0-9 ]{6,34}":undefined} className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-3"/></label>)}{state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.ok&&<p role="status" className="text-sm text-green-700">{state.ok}</p>}<button disabled={pending} className="rounded-xl bg-matur-500 px-4 py-3 font-bold text-white disabled:opacity-50">{pending?"Menyimpan…":"Simpan rekening"}</button></form>;
}
