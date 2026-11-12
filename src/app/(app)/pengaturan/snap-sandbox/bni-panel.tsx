"use client";
import {useEffect,useState,useTransition} from 'react';
import {Eye,EyeOff,KeyRound,QrCode,Search,History,Download,RefreshCw} from 'lucide-react';
import {bniAction} from '@/lib/snap-sandbox-actions';
import type {BniResult} from '../../../../../supabase/functions/_shared/bni-direct';

type Row={id:string;created_at:string;action:string;result:BniResult};
type State={configured:boolean;clientId?:string;apiKeyMasked?:string;merchantId:string;channelId:string;terminalId:string;publicKey?:string;certificate?:string;history:Row[]};
const input='mt-1 w-full min-w-0 rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500';
const button='inline-flex items-center justify-center gap-2 rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40';
const blank={clientId:'',apiKey:'',apiSecret:'',clientSecret:'',merchantId:'',channelId:'',terminalId:''};
const labels={clientId:'Client ID BNI',apiKey:'API Key / X-PARTNER-ID',apiSecret:'Secret Key API',clientSecret:'Client Secret BNI',merchantId:'Merchant ID sandbox',channelId:'CHANNEL-ID dari BNI',terminalId:'Terminal ID (jika diwajibkan)'};
function download(name:string,content:string,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function title(action:string){return action==='token'?'Token B2B':action==='generate'?'Generate QR':'Query Payment';}
export function BniPanel(){
 const [state,setState]=useState<State|null>(null),[form,setForm]=useState(blank),[amount,setAmount]=useState('1000.00'),[show,setShow]=useState<Record<string,boolean>>({}),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState(''),[qr,setQr]=useState('');
 const [pending,start]=useTransition();
 const dirty=!!state&&(form.clientId!==(state.clientId??'')||form.merchantId!==state.merchantId||form.channelId!==state.channelId||form.terminalId!==state.terminalId||!!form.apiKey||!!form.apiSecret||!!form.clientSecret);
 function load(s:State){setState(s);setForm({...blank,clientId:s.clientId??'',merchantId:s.merchantId??'',channelId:s.channelId??'',terminalId:s.terminalId??''});}
 function refresh(){start(async()=>{setError('');const r=await bniAction('bni-snap-status');if(r.error)setError(r.error);else load(r.data as unknown as State);});}
 useEffect(()=>{let active=true;void bniAction('bni-snap-status').then(r=>{if(!active)return;if(r.error)setError(r.error);else load(r.data as unknown as State);});return()=>{active=false;};},[]);
 const generations=state?.history.filter(r=>r.action==='generate'&&r.result.ok)??[];
 const chosen=generations.find(r=>r.id===selected);
 const content=typeof chosen?.result.response.qrContent==='string'?chosen.result.response.qrContent:'';
 useEffect(()=>{let active=true;setQr('');if(content)void import('qrcode').then(q=>q.toDataURL(content,{width:240,margin:1})).then(s=>{if(active)setQr(s);}).catch(()=>{});return()=>{active=false;};},[content]);
 function save(){start(async()=>{setError('');setNotice('');const r=await bniAction('bni-snap-save',form);if(r.error)setError(r.error);else{load(r.data as unknown as State);setNotice('Konfigurasi sandbox BNI tersimpan.');setSelected('');}});}
 function run(action:'token'|'generate'|'query'){start(async()=>{setError('');setNotice('');const r=await bniAction(`bni-snap-${action}`,action==='generate'?{amount}:action==='query'?{generationId:selected}:{});if(r.error){setError(r.error);return;}const d=r.data as unknown as {state:State;result:BniResult&{id:string}};setState(d.state);if(action==='generate'&&d.result.ok)setSelected(d.result.id);setNotice(d.result.ok?`${title(action)} berhasil. Hasil tersimpan di riwayat.`:`${title(action)} belum berhasil. Periksa respons asli BNI di riwayat.`);});}
 return <div className="space-y-4">
  <section className="rounded-2xl border border-matur-200 bg-matur-50 p-4"><h2 className="font-bold text-kopi-900">BNI Sandbox · SNAP QRIS MPM</h2><p className="mt-1 text-sm text-stone-600">Uji langsung ke sandbox BNI, terpisah dari simulasi ASPI dan transaksi POS. Token, timestamp, signature, dan referensi dibuat oleh server.</p><p className="mt-2 text-xs text-stone-500">Alur collection BNI: token RSA → Generate QR → Query Payment. Token/secret/private key tidak ditampilkan dalam hasil.</p></section>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">{notice}</p>}
  {!state&&!error&&<p className="animate-pulse p-4 text-sm">Memuat konfigurasi BNI…</p>}
  {state&&<>
   <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
    <div className="flex flex-wrap items-center gap-2"><KeyRound size={19}/><h3 className="mr-auto font-bold">Kredensial & identitas sandbox</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${state.configured?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900'}`}>{state.configured?'Kredensial tersimpan':'Belum lengkap'}</span></div>
    <p className="text-xs text-stone-500">API Key tersimpan: {state.apiKeyMasked||'belum ada'}. Kosongkan kredensial rahasia untuk mempertahankan nilai lama. Mengganti Client ID memerlukan kredensial lengkap.</p>
    <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(blank) as (keyof typeof blank)[]).map(k=>{const secret=['apiSecret','clientSecret','apiKey'].includes(k);return <label key={k} className="min-w-0 text-xs font-semibold text-stone-600">{labels[k]}<span className="flex items-center gap-1"><input aria-label={labels[k]} autoComplete="off" type={secret&&!show[k]?'password':'text'} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value.trim()})} placeholder={secret&&state.configured?'Tersimpan; isi jika ingin mengganti':k==='merchantId'||k==='channelId'?'Isi sesuai informasi BNI':''} className={input}/>{secret&&<button type="button" aria-label={`${show[k]?'Sembunyikan':'Lihat'} ${labels[k]}`} onClick={()=>setShow({...show,[k]:!show[k]})} className="rounded-xl border p-2">{show[k]?<EyeOff size={16}/>:<Eye size={16}/>}</button>}</span></label>;})}</div>
    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Merchant ID QRIS statis outlet belum tentu berlaku di sandbox. CHANNEL-ID “API” dari contoh ditolak pada uji sebelumnya; isi nilai yang dikonfirmasi BNI. Tidak ada nilai merchant/channel contoh yang diaktifkan otomatis.</p>
    <button type="button" className={button} disabled={pending||!form.clientId} onClick={save}>Simpan konfigurasi BNI</button>
   </section>
   <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4"><h3 className="font-bold">Mulai pengujian</h3>
    <label className="block max-w-xs text-xs font-semibold">Nominal uji IDR<input aria-label="Nominal uji IDR" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" className={input}/></label>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={pending||dirty||!state.configured} onClick={()=>run('token')}><KeyRound size={16}/>1. Tes Token B2B</button><button className={button} disabled={pending||dirty||!state.configured||!state.merchantId||!state.channelId} onClick={()=>run('generate')}><QrCode size={16}/>2. Generate QR tanpa Tip</button></div>
    {dirty&&<p className="text-xs text-amber-800">Simpan perubahan konfigurasi sebelum menguji.</p>}
    {(!state.merchantId||!state.channelId)&&<p className="text-xs text-amber-800">Token dapat diuji sekarang. Generate QR menunggu Merchant ID dan CHANNEL-ID sandbox BNI.</p>}
    <label className="block text-xs font-semibold">QR berhasil dari riwayat<select aria-label="QR berhasil dari riwayat" value={selected} onChange={e=>setSelected(e.target.value)} className={input}><option value="">Pilih hasil Generate QR</option>{generations.map(r=><option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString('id-ID')} · {String(r.result.response.referenceNo??r.id)}</option>)}</select></label>
    <button className={button} disabled={pending||dirty||!chosen} onClick={()=>run('query')}><Search size={16}/>3. Query Payment</button>
    {qr&&<figure className="w-fit rounded-xl border p-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={qr} alt="QR sandbox BNI" width={200} height={200}/><figcaption className="text-center text-xs">QR sandbox · jangan dibayar</figcaption></figure>}
    <p className="text-xs text-stone-500">Setiap pengujian mengambil token BNI baru di server. Query yang berhasil berarti pengecekan berhasil, belum tentu pembayaran lunas.</p>
    <p className="rounded-xl bg-stone-50 p-3 text-xs">Notifikasi pembayaran: menunggu kontrak/skenario simulator dari BNI. Inbox simulasi sebelumnya tidak dianggap sebagai bukti verifikasi pembayaran bank atau lunas POS.</p>
    {pending&&<p role="status" className="animate-pulse text-sm text-matur-700">Memproses sandbox BNI…</p>}
   </section>
   <details className="rounded-2xl border border-matur-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold">Public key & sertifikat gateway yang digunakan</summary><p className="my-2 text-xs text-stone-500">Pasangan kunci gateway Ruma/Matoer tetap di server. Tidak memakai private key contoh collection atau referensi ASPI.</p><div className="flex flex-wrap gap-2">{state.publicKey&&<button className={button} onClick={()=>download('ruma-matoer-public.pem',state.publicKey!)}><Download size={15}/>Unduh public key</button>}{state.certificate&&<button className={button} onClick={()=>download('ruma-matoer-x509.pem',state.certificate!)}><Download size={15}/>Unduh sertifikat</button>}</div></details>
   <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4"><div className="flex flex-wrap items-center gap-2"><History size={18}/><h3 className="mr-auto font-bold">Riwayat respons BNI</h3><button aria-label="Muat ulang riwayat" disabled={pending} onClick={refresh} className="rounded-xl border p-2"><RefreshCw size={16}/></button><button className="text-xs font-semibold underline" onClick={()=>download('hasil-sandbox-bni.json',JSON.stringify(state.history,null,2),'application/json')}>Unduh hasil JSON</button></div>
    {!state.history.length&&<p className="text-sm text-stone-500">Belum ada pengujian dari panel ini.</p>}
    {state.history.map(r=><details key={r.id} className="rounded-xl border border-stone-200 p-3"><summary className="cursor-pointer text-sm"><span className={`mr-2 rounded-lg px-2 py-1 text-xs font-bold ${r.result.ok?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900'}`}>{r.result.ok?'Berhasil':'Perlu diperiksa'}</span>{title(r.action)} · HTTP {r.result.status} · {String(r.result.response.responseCode??'')}<span className="mt-2 block text-xs text-stone-500">{new Date(r.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB · {String(r.result.response.responseMessage??'')}</span></summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-stone-50 p-3 text-[11px]">{JSON.stringify({request:r.result.request,response:r.result.response},null,2)}</pre></details>)}
   </section>
  </>}
 </div>;
}
