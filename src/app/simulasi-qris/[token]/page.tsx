import type { Metadata } from 'next';
import { DemoPayment } from './payment';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Pembayaran Simulasi · Matoer',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}:{params:Promise<{token:string}>}){return <DemoPayment token={(await params).token}/>;}
