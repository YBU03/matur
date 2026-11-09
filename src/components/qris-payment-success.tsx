'use client';
import {useEffect,useRef,useState} from 'react';
import {Modal} from './confirm-edit';
import {formatRupiah} from '@/lib/format';
import {siapkanSuaraQris,suaraQrisSekali} from '@/lib/qris-payment-audio';
export function QrisPaymentSuccess({paymentId,nominal,simulasi=false,onComplete}:{paymentId:string;nominal:number;simulasi?:boolean;onComplete:()=>void}){
 const done=useRef(onComplete);done.current=onComplete;
 const [blocked,setBlocked]=useState(false);
 useEffect(()=>{let active=true;void suaraQrisSekali(paymentId).then(ok=>{if(active)setBlocked(!ok);});return()=>{active=false;};},[paymentId]);
 useEffect(()=>{const timer=setTimeout(()=>done.current(),2000);return()=>clearTimeout(timer);},[paymentId]);
 return <Modal title={simulasi?'Pembayaran simulasi berhasil':'Pembayaran berhasil'}><div data-qris-success className="space-y-4 py-4 text-center" role="status" aria-live="polite"><div className="mx-auto grid size-24 place-items-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50"><svg viewBox="0 0 64 64" className="size-20 text-emerald-600" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" opacity=".2"/><path d="m18 32 9 9 19-20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/></svg></div><p className="text-3xl font-bold tabular-nums text-kopi-900">{formatRupiah(nominal)}</p><p className="text-sm text-stone-600">{simulasi?'Outlet Demo · Tidak ada uang nyata':'Pembayaran telah terkonfirmasi'}</p><p className="text-sm font-semibold text-emerald-700">Sedang menyiapkan struk…</p>{blocked&&<button className="rounded-xl border border-matur-300 px-4 py-2 text-sm font-semibold text-matur-700" onClick={()=>{void siapkanSuaraQris().then(()=>suaraQrisSekali(paymentId)).then(ok=>setBlocked(!ok)).catch(()=>setBlocked(true));}}>Aktifkan suara pembayaran</button>}</div><style>{`
 [data-qris-success] svg{animation:qris-success-pop .45s ease-out both}
 [data-qris-success] path{stroke-dasharray:48;stroke-dashoffset:48;animation:qris-success-check .45s .15s ease-out forwards}
 @keyframes qris-success-pop{from{opacity:0;transform:scale(.7)}60%{transform:scale(1.08)}to{opacity:1;transform:scale(1)}}
 @keyframes qris-success-check{to{stroke-dashoffset:0}}
 @media(prefers-reduced-motion:reduce){[data-qris-success] svg,[data-qris-success] path{animation:none;stroke-dashoffset:0}}
 `}</style></Modal>;
}
