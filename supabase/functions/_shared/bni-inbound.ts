/** SNAP-shaped sandbox inbox. Never settles POS transactions. No unauthenticated token fallback. */
// @ts-expect-error Deno import extension
import { digest, issueToken, verifyToken, readLimited } from './bni-gateway.ts';
export type InboundConfig = {clientId:string; partnerId:string; apiSecret:string; bankPublicKey:string; privateKey:string; publicKey:string; active:boolean};
export type InboundStore = {
 config:(id:string)=>Promise<InboundConfig|null>;
 limit:(key:string,n:number)=>Promise<boolean>;
 receive:(client:string, external:string, hash:string, payload:Record<string,unknown>)=>Promise<'received'|'duplicate'|'conflict'>;
};
const enc=new TextEncoder();
const response=(code:string,message:string,status:number,extra:Record<string,unknown>={})=>Response.json({responseCode:code,responseMessage:message,...extra},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const tokenConfig=(c:InboundConfig)=>({...c,clientSecret:c.apiSecret});
const text=(v:unknown,n=120):v is string=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\x00-\x1f]/.test(v);
async function equal(a:string,b:string){const x=await digest(a),y=await digest(b);let n=0;for(let i=0;i<x.length;i++)n|=x.charCodeAt(i)^y.charCodeAt(i);return n===0;}
export async function inboundSignature(secret:string,method:string,path:string,token:string,timestamp:string,body:unknown){
 const hash=await digest(JSON.stringify(body));
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-512'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',key,enc.encode([method,path,token,hash,timestamp].join(':')));
 return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
async function verifyBank(c:InboundConfig,stamp:string,sig:string){
 try{
  const bytes=Uint8Array.from(atob(c.bankPublicKey.replace(/-----[^-]+-----|\s/g,'')),x=>x.charCodeAt(0));
  const key=await crypto.subtle.importKey('spki',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if((key.algorithm as RsaHashedKeyAlgorithm).modulusLength<2048)return false;
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,Uint8Array.from(atob(sig),x=>x.charCodeAt(0)),enc.encode(c.clientId+'|'+stamp));
 }catch{return false;}
}
export const INBOUND_TOKEN_PATH='/api/integrasi/bni/get-token';
export const INBOUND_NOTIFY_PATH='/api/integrasi/bni/callback';
export async function handleInbound(req:Request,store:InboundStore,now=Math.floor(Date.now()/1000)){
 const path=new URL(req.url).pathname;const isToken=path.endsWith('/get-token'),isNotify=path.endsWith('/callback');
 const service=isToken?'73':'52';const out=(suffix:string,msg:string,http:number,extra:Record<string,unknown>={})=>response(String(http)+service+suffix,msg,http,extra);
 if(!isToken&&!isNotify)return out('00','Not Found',404);
 if(req.method!=='POST')return out('00','Method Not Allowed',405);
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??''))return out('01','Invalid Field Format Content-Type',415);
 try{
  // A global pre-auth budget prevents attacker-controlled client IDs growing the limits table.
  if(!await store.limit('snap-inbound:all',1000))return out('00','Too Many Requests',429);
  const client=req.headers.get(isToken?'x-client-key':'x-partner-id')??'';
  if(!text(client,100))return out('02','Invalid Mandatory Field '+(isToken?'X-CLIENT-KEY':'X-PARTNER-ID'),400);
  const c=await store.config(client);
  if(!c?.active||!c.bankPublicKey)return out('00','Unauthorized. Client unavailable',401);
  if(client!==(isToken?c.clientId:c.partnerId))return out('00','Unauthorized. Invalid Client',401);
  const stamp=req.headers.get('x-timestamp')??'';const sig=req.headers.get('x-signature')??'';
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(stamp)||!Number.isFinite(Date.parse(stamp))||Math.abs(Date.parse(stamp)/1000-now)>300)return out('01','Invalid Field Format X-TIMESTAMP',400);
  let raw:string;try{raw=await readLimited(req,isToken?2048:16384);}catch{return out('00','Payload Too Large',413);}
  let body:Record<string,unknown>;try{body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return out('01','Invalid Field Format body',400);}
  if(isToken){
   if(!await verifyBank(c,stamp,sig))return out('00','Unauthorized. Invalid Signature',401);
   if(body.grantType!=='client_credentials')return out('00','Invalid grantType',400);
   if(!await store.limit('snap-token:'+c.clientId,60))return out('00','Too Many Requests',429);
   return out('00','Successful',200,{accessToken:await issueToken(tokenConfig(c),now),tokenType:'Bearer',expiresIn:'300',additionalInfo:{}});
  }
  const auth=req.headers.get('authorization')??'';
  if(!auth.startsWith('Bearer ')||!await verifyToken(auth.slice(7),tokenConfig(c),now))return out('01','Invalid Token (B2B)',401);
  if(!await equal(sig,await inboundSignature(c.apiSecret,'POST',INBOUND_NOTIFY_PATH,auth.slice(7),stamp,body)))return out('00','Unauthorized. Invalid Signature',401);
  const external=req.headers.get('x-external-id')??'';
  if(!/^[a-zA-Z0-9_-]{1,36}$/.test(external))return out('02','Invalid Mandatory Field X-EXTERNAL-ID',400);
  if(!text(req.headers.get('channel-id'),100))return out('02','Invalid Mandatory Field CHANNEL-ID',400);
  if(!text(body.originalReferenceNo)||!text(body.originalPartnerReferenceNo)||!['00','03','04','05','06','07','09'].includes(String(body.latestTransactionStatus)))return out('02','Invalid Mandatory Field reference/status',400);
  const amount=body.amount as Record<string,unknown>|null;
  if(!amount||amount.currency!=='IDR'||typeof amount.value!=='string'||!/^\d{1,12}\.\d{2}$/.test(amount.value)||Number(amount.value)<=0)return out('01','Invalid Field Format amount',400);
  if(!await store.limit('snap-notify:'+c.clientId,600))return out('00','Too Many Requests',429);
  const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
  const result=await store.receive(c.clientId,external,await digest(canonical(body)),body);
  if(result==='conflict')return out('00','Conflict. X-EXTERNAL-ID payload mismatch',409);
  return out('00','Successful',200);
 }catch{return out('00','General Error',500);}
}
