/** BNI sandbox only. Never writes POS/payments/outlet configuration. */
// @ts-expect-error Deno requires the .ts extension; Next does not compile this server-only module.
import {serviceSignature,stamp} from './snap-sandbox.ts';
export type BniConfig={clientId:string;apiKey:string;apiSecret:string;clientSecret:string;privateKey:string;publicKey:string;certificate:string;merchantId:string;channelId:string;terminalId:string;version:string};
export type BniResult={action:string;ok:boolean;status:number;durationMs:number;request:Record<string,unknown>;response:Record<string,unknown>;version:string;externalId?:string};
export const BNI_BASE='https://sandbox.bni.co.id';
export const BNI_TOKEN='/snap/v1.0/access-token/b2b';
export const BNI_GENERATE='/snap-mpm/v1.0/qr/qr-mpm-generate';
export const BNI_QUERY='/snap-mpm/v1.0/qr/qr-mpm-query';
const encoder=new TextEncoder();
export function validateBniConfig(d:Record<string,unknown>,configured:boolean){
 for(const k of ['clientId','apiKey','merchantId','terminalId','channelId'])if(typeof d[k]!=='string'||String(d[k]).length>100||!/^[A-Za-z0-9._-]*$/.test(String(d[k])))throw Error('Isian identitas tidak valid.');
 if(!/^[A-Za-z0-9._-]{3,100}$/.test(String(d.clientId)))throw Error('Client ID wajib diisi.');
 for(const k of ['apiSecret','clientSecret'])if(typeof d[k]!=='string'||String(d[k]).length>500)throw Error('Isian rahasia tidak valid.');
 if(!configured&&(!d.apiKey||String(d.apiSecret).length<8||String(d.clientSecret).length<8))throw Error('Lengkapi kredensial BNI.');
}
export function cleanBniResponse(input:unknown,secrets:string[]=[]):Record<string,unknown>{
 const allowed=['responseCode','responseMessage','referenceNo','partnerReferenceNo','originalReferenceNo','originalPartnerReferenceNo','latestTransactionStatus','transactionStatusDesc','qrContent','expiresIn','tokenType'];
 if(!input||typeof input!=='object'||Array.isArray(input))return {responseMessage:'Respons BNI bukan JSON.'};
 const obj=input as Record<string,unknown>;const out:Record<string,unknown>={};
 for(const k of allowed){const v=obj[k];if(typeof v!=='string'&&typeof v!=='number')continue;let s=String(v).slice(0,k==='qrContent'?4096:300);for(const secret of secrets.filter(x=>x.length>3))s=s.split(secret).join('[disamarkan]');out[k]=s;}
 const a=obj.additionalInfo as Record<string,unknown>|undefined;if(typeof a?.billNumber==='string')out.billNumber=a.billNumber.slice(0,64);
 return out;
}
async function readResponse(r:Response){const reader=r.body?.getReader();if(!reader)return {};let length=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>32768){await reader.cancel();throw Error('Respons BNI terlalu besar.');}chunks.push(value);}}finally{reader.releaseLock();}const data=new Uint8Array(length);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}try{return JSON.parse(new TextDecoder().decode(data));}catch{return {};}}
export async function bniToken(c:BniConfig,send:typeof fetch=fetch,now=Date.now()){
 const timestamp=stamp(now);const der=Uint8Array.from(atob(c.privateKey.replace(/-----[^-]+-----|\s/g,'')),s=>s.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signed=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(c.clientId+'|'+timestamp));const signature=btoa(String.fromCharCode(...new Uint8Array(signed)));
 const start=Date.now();const request={url:BNI_BASE+BNI_TOKEN,body:{grantType:'client_credentials'},timestamp};
 const r=await send(BNI_BASE+BNI_TOKEN,{method:'POST',headers:{'Content-Type':'application/json','X-CLIENT-KEY':c.clientId,'X-TIMESTAMP':timestamp,'X-SIGNATURE':signature},body:JSON.stringify(request.body),redirect:'error',signal:AbortSignal.timeout(20000)});
 const data=await readResponse(r);const ok=r.ok&&data.responseCode==='2007300'&&typeof data.accessToken==='string'&&data.tokenType==='Bearer'&&Number(data.expiresIn)>0;
 const result:BniResult={action:'token',ok,status:r.status,durationMs:Date.now()-start,request,response:cleanBniResponse(data,[c.apiSecret,c.clientSecret,c.privateKey,data.accessToken??'']),version:c.version};
 return {token:ok?data.accessToken as string:'',result};
}
export async function runBni(action:'token'|'generate'|'query',c:BniConfig,data:Record<string,unknown>,send:typeof fetch=fetch,now=Date.now()):Promise<BniResult>{
 if(action!=='token'&&(!c.channelId||!c.merchantId))throw Error('Lengkapi CHANNEL-ID dan Merchant ID sandbox dari BNI dahulu.');
 let body:Record<string,unknown>={};let path=BNI_GENERATE;
 if(action==='generate'){
  const amount=String(data.amount??'');if(!/^\d{1,10}\.\d{2}$/.test(amount)||Number(amount)<=0)throw Error('Nominal uji harus positif, misalnya 1000.00.');
  body={partnerReferenceNo:'MTR'+now+crypto.randomUUID().replace(/-/g,'').slice(0,8),amount:{value:amount,currency:'IDR'},merchantId:c.merchantId,terminalId:c.terminalId,validityPeriod:stamp(now+900000),additionalInfo:{additionalData:'MATOER_SANDBOX',tipIndicator:'',tipValueFixed:'',tipValuePercentage:''}};
 }
 if(action==='query'){
  const g=data.generation as BniResult|undefined;const b=g?.request.body as Record<string,unknown>|undefined;
  if(!g?.ok||g.action!=='generate'||g.version!==c.version||!g.response.referenceNo||!b?.partnerReferenceNo)throw Error('Pilih Generate QR yang berhasil dengan konfigurasi saat ini.');
  path=BNI_QUERY;body={serviceCode:'47',merchantId:c.merchantId,originalReferenceNo:g.response.referenceNo,originalPartnerReferenceNo:b.partnerReferenceNo,originalExternalId:g.externalId,additionalInfo:g.response.billNumber?{billNumber:g.response.billNumber}:{}};
 }
 const t=await bniToken(c,send,now);if(action==='token')return t.result;
 if(!t.token)return {...t.result,action,request:{...t.result.request,stage:'token'},ok:false};
 const timestamp=stamp(now);const externalId=String(now)+String(crypto.getRandomValues(new Uint32Array(1))[0]).padStart(10,'0');
 const signature=await serviceSignature(c.apiSecret,t.token,timestamp,body,path);
 const start=Date.now();const r=await send(BNI_BASE+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t.token,'X-SIGNATURE':signature,'X-TIMESTAMP':timestamp,'X-PARTNER-ID':c.apiKey,'X-EXTERNAL-ID':externalId,'CHANNEL-ID':c.channelId},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000)});
 const raw=await readResponse(r);const response=cleanBniResponse(raw,[c.apiSecret,c.clientSecret,c.privateKey,t.token,signature]);
 return {action,ok:r.ok&&response.responseCode===(action==='generate'?'2004700':'2005100')&&(action!=='generate'||!!response.referenceNo),status:r.status,durationMs:Date.now()-start,request:{url:BNI_BASE+path,timestamp,channelId:c.channelId,body},response,externalId,version:c.version};
}
