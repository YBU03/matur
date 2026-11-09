'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {DemoOrder} from '@/lib/qris-demo';
import {formatRupiah} from '@/lib/format';
import {ReceiptDialog} from '@/components/pos-receipt';
export function DemoHistory({initial,error,kasir}:{initial:DemoOrder[];error?:string;kasir:string}){
 const [selected,setSelected]=useState<DemoOrder>();
 return <main className="mx-auto max-w-3xl space-y-4 p-4"><Link href="/kasir/pos" className="font-semibold text-matur-700">← Kembali ke POS</Link><h1 className="text-xl font-bold">Riwayat QR simulasi</h1><p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Outlet Demo · Bukan pembayaran nyata. Tidak masuk omzet, stok atau akunting. Menampilkan 50 percobaan terakhir.</p>{error&&<p role="alert">{error}</p>}{!initial.length&&<p>Belum ada percobaan QR.</p>}{initial.map(o=><article key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4"><div><p className="font-bold">TEST-{o.nomor} · {formatRupiah(o.total)}</p><p className="text-xs text-stone-500">{new Date(o.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</p><p className="text-sm">{o.status==='paid'?'✓ Berhasil':o.status==='cancelled'?'Dibatalkan':Date.parse(o.expires_at)<Date.now()?'Kedaluwarsa':'Menunggu pembayaran'}</p></div>{o.status==='paid'&&<button onClick={()=>setSelected(o)} className="rounded-xl border border-matur-300 px-4 py-2 font-semibold text-matur-700">Lihat struk</button>}</article>)}{selected&&<ReceiptDialog r={{...selected,kembalian:0}} lines={selected.lines} kanal={selected.kanal??"langsung"} metode="qris" testing salinan waktuTransaksi={selected.paid_at??selected.created_at} outletNama="Outlet Demo (uji coba)" kasir={kasir} onClose={()=>setSelected(undefined)}/>}</main>;
}
