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
Deno.serve(async req=>{
 const path=new URL(req.url).pathname.replace(/^\/matoer-snap-sandbox/,'');
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
