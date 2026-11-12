import {runBni,validateBniConfig} from '../_shared/bni-direct.ts';
import * as x509 from 'npm:@peculiar/x509@1.14.3';
import { handleSnap,readSnapBody,rsaPair,authSignature,serviceSignature,stamp,cleanResult,cleanNote,TOKEN_PATH,NOTIFY_PATH } from '../_shared/snap-sandbox.ts';
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
async function rpc(name,body={},jwt=key){
 if(!url||!key)throw Error('unconfigured');
 const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('storage');return r.json();
}
const service=(action,data={})=>rpc('snap_sandbox_service',{p_action:action,p_data:data});
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const BNI='https://sandbox.bni.co.id',BNI_NOTIF_PATH='/bni/v1.0/qr/qr-mpm-notify',BNI_CALLBACK='https://www.matoer.id/api/integrasi/snap-sandbox'+BNI_NOTIF_PATH;
const te=new TextEncoder(),hexs=b=>[...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join(''),b64s=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const extId=()=>String(Date.now())+String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
// Signature simetris SNAP: HMAC-SHA512(clientSecret, METHOD:path:accessToken:lowerhex(SHA256(minified body)):timestamp), base64.
async function symSig(secret,method,path,token,body,ts){
 const h=hexs(await crypto.subtle.digest('SHA-256',te.encode(JSON.stringify(body))));
 const k=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-512'},false,['sign']);
 return b64s(await crypto.subtle.sign('HMAC',k,te.encode(`${method}:${path}:${token}:${h}:${ts}`)));
}
async function bniToken(){
 const o=await rpc('snap_bni_oauth_service',{p_action:'ambil',p_data:{}});
 const r=await fetch(BNI+'/api/oauth/token',{method:'POST',headers:{Authorization:'Basic '+btoa(o.client_id+':'+o.secret),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:'grant_type=client_credentials',redirect:'error',signal:AbortSignal.timeout(20000)});
 const d=await r.json().catch(()=>null);
 if(!r.ok||!d?.access_token){const e=Error('token');e.detail={langkah:'token',status:r.status,respons:d};throw e;}
 return {token:d.access_token,secret:o.secret};
}
async function bniCall(path,body,auth,o,extra={}){
 const ts=stamp(),sig=await symSig(auth.secret,'POST',path,auth.token,body,ts),ext=o.externalId||extId();
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+auth.token,'X-TIMESTAMP':ts,'X-SIGNATURE':sig,'X-PARTNER-ID':o.partnerId,'X-EXTERNAL-ID':ext,'CHANNEL-ID':o.channelId,...extra};
 const mulai=Date.now();let r,teks='';
 try{r=await fetch(BNI+path,{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000)});teks=(await r.text()).slice(0,8000);}
 catch(e){return {ok:false,status:0,durasiMs:Date.now()-mulai,pesan:'Tidak dapat terhubung ke '+BNI+': '+String(e?.message??e).slice(0,200),request:{url:BNI+path,headers:{...headers,Authorization:'Bearer ••••',['X-SIGNATURE']:sig.slice(0,12)+'…'},body},externalId:ext};}
 let data=null;try{data=JSON.parse(teks);}catch{}
 return {ok:r.ok,status:r.status,durasiMs:Date.now()-mulai,request:{url:BNI+path,headers:{...headers,Authorization:'Bearer ••••',['X-SIGNATURE']:sig.slice(0,12)+'…'},body},respons:data??{teks:teks.slice(0,1000)},externalId:ext};
}
const okId=(v,max=64)=>typeof v==='string'&&v.length<=max&&/^[A-Za-z0-9._-]*$/.test(v);
Deno.serve(async req=>{
 const path=new URL(req.url).pathname.replace(/^\/matoer-snap-sandbox/,'');
 // Penerima notifikasi uji dari simulator BNI (sandbox): catat ke inbox uji tanpa data pribadi; tidak menandai transaksi POS.
 if(path===BNI_NOTIF_PATH){
  const balas=(st,code,msg)=>json({responseCode:code,responseMessage:msg},st);
  try{
   if(req.method!=='POST')return balas(405,'4055200','Method not allowed');
   if(!await service('limit',{key:'bni-notif'}))return balas(429,'4295200','Too many requests');
   let b;try{b=JSON.parse(await readSnapBody(req));}catch{return balas(400,'4005201','Invalid JSON');}
   const wajib=['x-timestamp','x-signature','x-external-id','channel-id','x-partner-id','authorization'];
   const ai=b?.additionalInfo??{};
   await rpc('snap_bni_notif_service',{p_data:{external_id:req.headers.get('x-external-id'),reference_no:b?.originalReferenceNo,partner_reference_no:b?.originalPartnerReferenceNo,status:b?.latestTransactionStatus,status_desc:b?.transactionStatusDesc,amount:b?.amount?.value,bill_number:ai.billNumber,header_lengkap:wajib.every(h=>req.headers.get(h)),body_hash:hexs(await crypto.subtle.digest('SHA-256',te.encode(JSON.stringify(b))))}});
   return balas(200,'2005200','Successful');
  }catch{return balas(500,'5005200','General error');}
 }
 if(!path.startsWith('/admin/'))return handleSnap(req,path,{config:()=>service('config'),limit:key=>service('limit',{key}),receive:d=>service('receive',d)});
 try{
  if(req.method!=='POST')return json({error:'Gunakan POST.'},405);
  const auth=req.headers.get('authorization')??'';if(!auth.startsWith('Bearer ')||auth.slice(7)===key)return json({error:'Masuk dengan akun admin.'},401);
  const jwt=auth.slice(7);
  const user=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!user.ok)return json({error:'Sesi tidak berlaku.'},401);
  const admin=(action,data={})=>rpc('snap_sandbox_admin',{p_action:action,p_data:data},jwt);
  let state;try{state=await admin('status');}catch{return json({error:'Hanya Owner, Admin Pusat atau Finance aktif.'},403);}
  const uid=(await user.json()).id;if(!await service('limit',{key:'admin:'+uid}))return json({error:'Terlalu banyak permintaan.'},429);
  const body=JSON.parse(await readSnapBody(req));
  if(path==='/admin/status')return json(state);
  if(path==='/admin/save'){
   if(typeof body.clientId!=='string'||!/^[A-Za-z0-9._-]{3,100}$/.test(body.clientId))return json({error:'Client ID tidak valid.'},400);
   for(const k of ['clientSecret','privateRef','publicRef'])if(typeof body[k]!=='string'||body[k].length>5000)return json({error:'Isian kredensial tidak valid.'},400);
   if(!state.configured&&(body.clientSecret.length<10||body.privateRef.length<10))return json({error:'Isi Client Secret dan Private Key pengujian ASPI.'},400);
   if(state.configured&&state.clientId!==body.clientId&&(!body.clientSecret||!body.privateRef))return json({error:'Client ID berubah. Isi ulang Client Secret dan Private Key ASPI.'},400);
   const pair=state.configured?{}:await rsaPair();
   return json(await admin('save',{clientId:body.clientId,clientSecret:body.clientSecret,privateRef:body.privateRef,publicRef:body.publicRef,...pair}));
  }
  if(path==='/admin/toggle'){
   if(typeof body.aktif!=='boolean')return json({error:'Pilih aktif atau nonaktif.'},400);
   return json(await admin('toggle',{aktif:body.aktif}));
  }
  // SNAP collection BNI: RSA token, APISecret HMAC, sanitized history. All routes already passed authenticated admin guard above.
  if(path.startsWith('/admin/bni-snap-')){
   const action=path.slice('/admin/bni-snap-'.length);
   if(action==='status')return json(await rpc('bni_snap_service',{p_action:'status'}));
   if(action==='save'){
    const status=await rpc('bni_snap_service',{p_action:'status'});validateBniConfig(body,status.configured);
    await rpc('bni_snap_service',{p_action:'save',p_data:{...body,certificate:undefined,oleh:uid}});
    return json(await rpc('bni_snap_service',{p_action:'status'}));
   }
   if(!['token','generate','query'].includes(action))return json({error:'Aksi tidak tersedia.'},404);
   const config=await rpc('bni_snap_service',{p_action:'config'});
   let input=body;
   if(action==='query'){
    if(typeof body.generationId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.generationId))return json({error:'Pilih QR yang berhasil dari riwayat.'},400);
    input={generation:await rpc('bni_snap_service',{p_action:'generation',p_data:{id:body.generationId}})};
   }
   let result;
   try{result=await runBni(action,config,input);}
   catch(e){
    if(e instanceof TypeError||e?.name==='TimeoutError'||e?.name==='AbortError')result={action,ok:false,status:0,durationMs:0,request:{stage:'network'},response:{responseMessage:'Koneksi BNI belum berhasil. Periksa riwayat sebelum mengulang Generate QR.'},version:config.version};
    else return json({error:['generate','query'].includes(action)?'Periksa CHANNEL-ID, Merchant ID, nominal, serta pilihan QR. Konfigurasi berubah memerlukan QR baru.':'Konfigurasi kunci/token belum dapat digunakan.'},400);
   }
   const saved=await rpc('bni_snap_service',{p_action:'record',p_data:{oleh:uid,result}});
   return json({result:{...saved,...result},state:await rpc('bni_snap_service',{p_action:'status'})});
  }
  // Kunci RSA + sertifikat X.509 Matoer untuk BNI Direct API: private key langsung ke Vault, tidak pernah dikirim ke browser.
  if(path==='/admin/bni-kunci')return json(await rpc('snap_bni_kunci_info',{},jwt));
  if(path==='/admin/bni-kunci-buat'){
   const ganti=body.ganti===true;const info=await rpc('snap_bni_kunci_info',{},jwt);
   if(info.ada&&!ganti)return json({error:'Kunci BNI sudah ada. Pilih ganti bila ingin membuat baru.'},400);
   x509.cryptoProvider.set(crypto);
   const alg={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256',publicExponent:new Uint8Array([1,0,1]),modulusLength:2048};
   const keys=await crypto.subtle.generateKey(alg,true,['sign','verify']);
   const now=new Date(Date.now()-60000),akhir=new Date(Date.now()+365*86400000);
   const serial=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('').replace(/^[89a-f]/,'1');
   const cert=await x509.X509CertificateGenerator.createSelfSigned({serialNumber:serial,name:'C=ID, ST=Jawa Tengah, L=Purbalingga, O=CV Hazna Berkah Indonesia, OU=Matoer BNI Sandbox, CN=matoer.id',notBefore:now,notAfter:akhir,signingAlgorithm:alg,keys,extensions:[new x509.BasicConstraintsExtension(false,undefined,true),new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature,true)]});
   const pem=(t,b)=>`-----BEGIN ${t}-----\n${btoa(String.fromCharCode(...new Uint8Array(b))).match(/.{1,64}/g).join('\n')}\n-----END ${t}-----`;
   await rpc('snap_bni_kunci_service',{p_action:'simpan',p_data:{private:pem('PRIVATE KEY',await crypto.subtle.exportKey('pkcs8',keys.privateKey)),public:pem('PUBLIC KEY',await crypto.subtle.exportKey('spki',keys.publicKey)),sertifikat:cert.toString('pem'),oleh:uid,ganti}});
   return json(await rpc('snap_bni_kunci_info',{},jwt));
  }
  if(path==='/admin/bni-signature'){
   const ck=String(body.clientKey??'').trim(),ts=String(body.timestamp??'').trim();
   if(!/^[A-Za-z0-9._-]{3,100}$/.test(ck))return json({error:'X-CLIENT-KEY tidak valid.'},400);
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?([+-]\d{2}:\d{2}|Z)$/.test(ts))return json({error:'Format X-TIMESTAMP harus seperti 2026-11-10T18:30:00+07:00.'},400);
   const k=await rpc('snap_bni_kunci_service',{p_action:'private',p_data:{}});
   const der=Uint8Array.from(atob(k.private.replace(/-----[^-]+-----|\s/g,'')),ch=>ch.charCodeAt(0));
   const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
   const sig=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(ck+'|'+ts)));
   return json({signature:btoa(String.fromCharCode(...sig)),stringToSign:ck+'|'+ts,timestamp:ts,clientKey:ck});
  }
  // OAuth BNI Direct API (sandbox): Client Secret di Vault; tes token ke https://sandbox.bni.co.id/api/oauth/token (Basic auth, grant_type=client_credentials).
  if(path==='/admin/bni-oauth-simpan'){
   const id=String(body.clientId??'').trim(),sec=String(body.clientSecret??'');
   if(!/^[A-Za-z0-9._-]{3,100}$/.test(id))return json({error:'Client ID tidak valid.'},400);
   if(sec.length<8||sec.length>500)return json({error:'Client Secret tidak valid.'},400);
   await rpc('snap_bni_oauth_service',{p_action:'simpan',p_data:{client_id:id,secret:sec,oleh:uid}});
   return json(await rpc('snap_bni_kunci_info',{},jwt));
  }
  if(path==='/admin/bni-token-tes'){
   let o;try{o=await rpc('snap_bni_oauth_service',{p_action:'ambil',p_data:{}});}catch{return json({error:'Simpan Client ID & Client Secret OAuth BNI dahulu.'},400);}
   const mulai=Date.now();let r,teks='';
   try{
    r=await fetch('https://sandbox.bni.co.id/api/oauth/token',{method:'POST',headers:{Authorization:'Basic '+btoa(o.client_id+':'+o.secret),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:'grant_type=client_credentials',redirect:'error',signal:AbortSignal.timeout(20000)});
    teks=(await r.text()).slice(0,4000);
   }catch(e){return json({ok:false,status:0,durasiMs:Date.now()-mulai,pesan:'Tidak dapat terhubung ke sandbox.bni.co.id: '+String(e?.message??e).slice(0,200)});}
   let data=null;try{data=JSON.parse(teks);}catch{}
   const tok=data&&typeof data.access_token==='string'?data.access_token:'';
   const aman=data&&typeof data==='object'?Object.fromEntries(Object.entries(data).map(([k,v])=>[k,k==='access_token'?(tok?tok.slice(0,6)+'…'+tok.slice(-4):''):v])):{teks:teks.replace(/[A-Za-z0-9+/=_-]{40,}/g,'[disamarkan]').slice(0,500)};
   return json({ok:r.ok&&!!tok,status:r.status,durasiMs:Date.now()-mulai,respons:aman,token_type:data?.token_type??null,expires_in:data?.expires_in??null,scope:data?.scope??null});
  }
  // Uji QRIS MPM ke sandbox BNI (dokumentasi BNI Direct API SNAP QRIS MPM).
  if(path==='/admin/bni-generate'||path==='/admin/bni-query'||path==='/admin/bni-notif-sim'){
   const o={partnerId:String(body.partnerId??''),channelId:String(body.channelId??'95221'),externalId:''};
   if(!okId(o.partnerId,100)||!o.partnerId)return json({error:'X-PARTNER-ID tidak valid.'},400);
   if(!/^\d{1,10}$/.test(o.channelId))return json({error:'CHANNEL-ID harus angka.'},400);
   const merchantId=String(body.merchantId??''),terminalId=String(body.terminalId??'');
   if(!okId(merchantId)||!merchantId||!okId(terminalId))return json({error:'merchantId / terminalId tidak valid.'},400);
   let auth;try{auth=await bniToken();}catch(e){return json({ok:false,status:e?.detail?.status??0,pesan:'Gagal mengambil token OAuth BNI.',respons:e?.detail?.respons??null});}
   if(path==='/admin/bni-generate'){
    const amount=String(body.amount??'');if(!/^\d{1,10}\.\d{2}$/.test(amount)||Number(amount)<=0)return json({error:'Nominal harus positif dengan dua desimal, mis. 10000.00'},400);
    const menit=Math.min(Math.max(Number(body.menit)||30,5),1440);
    const isi={partnerReferenceNo:'MTR'+extId().slice(-14),amount:{value:amount,currency:'IDR'},merchantId,...(terminalId?{terminalId}:{}),validityPeriod:stamp(Date.now()+menit*60000),additionalInfo:{additionalData:'',tipIndicator:'',tipValueFixed:'',tipValuePercentage:''}};
    return json(await bniCall('/snap-mpm/v1.0/qr/qr-mpm-generate',isi,auth,o));
   }
   const pref=String(body.partnerReferenceNo??''),ref=String(body.referenceNo??''),bill=String(body.billNumber??''),oext=String(body.externalId??'');
   if(!okId(pref)||!pref||!okId(ref)||!okId(bill)||!okId(oext,32))return json({error:'Data referensi tidak valid. Buat QR terlebih dahulu.'},400);
   if(path==='/admin/bni-query'){
    const isi={serviceCode:'47',originalReferenceNo:ref,originalPartnerReferenceNo:pref,originalExternalId:oext,merchantId,additionalInfo:{billNumber:bill}};
    return json(await bniCall('/snap-mpm/v1.0/qr/qr-mpm-query',isi,auth,o));
   }
   const amount=String(body.amount??'0.00'),qr=String(body.qrContent??'').slice(0,1000);
   const isi={additionalInfo:{feeAmount:{currency:'IDR',value:'0.00'},acquirerName:'BNI',acquirerNns:'93600009',additionalData:'',amountMdr:'0.00',approvalCode:'',billNumber:bill,customerName:'Uji Matoer',customerPan:'',discount:'',issuerName:'BNI',issuerNns:'93600009',merchantCategoryCode:'',merchantCity:'',merchantCountry:'ID',merchantCriteria:'',merchantId,merchantName:'Matoer',merchantPan:'',nmid:'',paidTime:stamp().slice(0,19),qrMethod:'MPM',retrievalReferenceNumber:'',stan:'',terminalId},amount:{currency:'IDR',value:amount},latestTransactionStatus:'00',originalPartnerReferenceNo:pref,originalReferenceNo:ref,qrContent:qr,transactionStatusDesc:'Transaksi Sukses'};
   const hasil=await bniCall('/simulator/callback/mpm/notif',isi,auth,o,{'X-CALLBACK-TARGET':BNI_CALLBACK});
   return json({...hasil,callbackTarget:BNI_CALLBACK});
  }
  const c=await service('config');
  if(path==='/admin/result'){
   if(!Number.isInteger(body.nomor)||body.nomor<1||body.nomor>10||!['dicoba','sesuai','tidak_sesuai'].includes(body.status))return json({error:'Hasil pengujian tidak valid.'},400);
   return json(await admin('result',{nomor:body.nomor,status:body.status,catatan:cleanNote(String(body.catatan??''),c),respons:cleanResult(body.respons,c),buktiPath:typeof body.buktiPath==='string'?body.buktiPath:null}));
  }
  if(path==='/admin/prepare'){
   if(!c)return json({error:'Simpan kredensial pengujian dahulu.'},400);
   const ts=stamp();
   if(body.kind==='service'){
    const allowed=['/v1.0/qr/qr-mpm-generate','/api/v1.0/qr/qr-mpm-generate','/v1.0/qr/qr-mpm-query','/api/v1.0/qr/qr-mpm-query',NOTIFY_PATH];
    if(!allowed.includes(body.endpoint)||typeof body.token!=='string'||!body.token||body.token.length>4096||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))return json({error:'Isi endpoint, token B2B dan JSON body yang valid.'},400);
    const format=body.format==='hex'?'hex':'base64';
    return json({timestamp:ts,signature:await serviceSignature(c.clientSecret,body.token,ts,body.payload,body.endpoint,format),endpoint:body.endpoint,format});
   }
   if(body.kind!=='simulator')return json({error:'Pilih persiapan yang tersedia.'},400);
   if(!c.aktif)return json({error:'Aktifkan penerima sandbox dahulu.'},400);
   const amount=String(body.amount??'');if(!/^\d{1,8}\.\d{2}$/.test(amount)||Number(amount)<=0)return json({error:'Nominal uji harus positif dengan dua angka desimal.'},400);
   const ref='MATOER-UJI-'+crypto.randomUUID();await service('intent',{ref,amount});
   const authSig=await authSignature(c,ts);
   // Exercise the real token validator, instead of bypassing its signature check.
   const tokenRequest=new Request('https://www.matoer.id'+TOKEN_PATH,{method:'POST',headers:{'Content-Type':'application/json','X-TIMESTAMP':ts,'X-CLIENT-KEY':c.clientId,'X-SIGNATURE':authSig},body:JSON.stringify({grantType:'client_credentials',additionalInfo:{environment:'sandbox'}})});
   const tr=await handleSnap(tokenRequest,'/v1.0/access-token/b2b',{config:async()=>c,limit:async()=>true,receive:d=>service('receive',d)});
   const token=await tr.json();if(tr.status!==200||!token.accessToken)throw Error('token');
   const payload={originalReferenceNo:ref,originalPartnerReferenceNo:ref,latestTransactionStatus:'00',transactionStatusDesc:'success',amount:{value:amount,currency:'IDR'},additionalInfo:{environment:'sandbox'}};
   let sig=await serviceSignature(c.clientSecret,token.accessToken,ts,payload);
   const abnormal=body.abnormal===true;if(abnormal)sig=(sig[0]==='A'?'B':'A')+sig.slice(1);
   return json({environment:'sandbox',serviceName:'Payment Notification',uri:'https://www.matoer.id'+NOTIFY_PATH,httpMethod:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token.accessToken,'X-TIMESTAMP':ts,'X-SIGNATURE':sig,'X-PARTNER-ID':c.clientId,'X-EXTERNAL-ID':Date.now().toString()+String(crypto.getRandomValues(new Uint32Array(1))[0]).padStart(10,'0'),'CHANNEL-ID':'00002'},body:payload,expectedResponseCode:abnormal?'4015200':'2005200',tokenRequest:{uri:'https://www.matoer.id'+TOKEN_PATH,headers:{'Content-Type':'application/json','X-TIMESTAMP':ts,'X-CLIENT-KEY':c.clientId,'X-SIGNATURE':authSig},body:{grantType:'client_credentials',additionalInfo:{environment:'sandbox'}}},expiresAt:new Date(Date.now()+300000).toISOString()});
  }
  return json({error:'Aksi tidak tersedia.'},404);
 }catch{return json({error:'Proses sandbox belum berhasil. Periksa isian atau coba lagi.'},400);}
});
