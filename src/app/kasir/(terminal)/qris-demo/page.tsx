import {notFound} from 'next/navigation';
import {getSession} from '@/lib/session';
import {OUTLET_DEMO_ID} from '@/lib/qris-demo';
import {qrisDemoPos} from '@/lib/qris-demo-actions';
import {DemoHistory} from './history';
export default async function Page(){const s=await getSession();if(s?.active?.outletId!==OUTLET_DEMO_ID)notFound();const r=await qrisDemoPos('history');return <DemoHistory initial={r.history??[]} error={r.error} kasir={s.nama}/>;}
