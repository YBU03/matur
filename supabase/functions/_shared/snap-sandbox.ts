// Pure sandbox protocol. Does not call POS, payments, stock or accounting.
export const SNAP_ROOT = "/api/integrasi/snap-sandbox";
export const TOKEN_PATH = SNAP_ROOT + "/v1.0/access-token/b2b";
export const NOTIFY_PATH = SNAP_ROOT + "/v1.0/qr/qr-mpm-notify";
export type SnapConfig = { clientId: string; clientSecret: string; privateRef: string; publicRef: string; receiverPrivate: string; receiverPublic: string; jwtSecret: string; aktif: boolean };
export type SnapDeps = { config: () => Promise<SnapConfig | null>; limit: (key: string) => Promise<boolean>; receive: (data: Record<string,string>) => Promise<string>; now?: () => number };
const enc = new TextEncoder();
const bytes = (b: ArrayBuffer) => new Uint8Array(b);
export const hex = (b: ArrayBuffer) => [...bytes(b)].map(n => n.toString(16).padStart(2,"0")).join("");
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...bytes(b)));
const un64 = (s: string) => Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const url64 = (b: ArrayBuffer) => b64(b).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const b64text = (s: string) => url64(enc.encode(s).buffer as ArrayBuffer);
const decodeUrl = (s: string) => new TextDecoder().decode(un64(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)));
export async function sha(s: string) { return hex(await crypto.subtle.digest("SHA-256",enc.encode(s))); }
async function mac(secret: string,s: string,hash="SHA-512") {
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash},false,["sign"]);
 return crypto.subtle.sign("HMAC",key,enc.encode(s));
}
export function same(a: string,b: string) { if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0; }
const rawPem = (s: string) => un64(s.replace(/-----[^-]+-----|\s/g,""));
export async function rsaPair() {
 const key=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const pem=(type:string,b:ArrayBuffer)=>`-----BEGIN ${type}-----\n${b64(b).match(/.{1,64}/g)!.join("\n")}\n-----END ${type}-----`;
 return { receiverPrivate:pem("PRIVATE KEY",await crypto.subtle.exportKey("pkcs8",key.privateKey)),receiverPublic:pem("PUBLIC KEY",await crypto.subtle.exportKey("spki",key.publicKey)),jwtSecret:b64(crypto.getRandomValues(new Uint8Array(48)).buffer) };
}
export async function authSignature(c: SnapConfig,timestamp: string) {
 const k=await crypto.subtle.importKey("pkcs8",rawPem(c.receiverPrivate),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 return b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",k,enc.encode(c.clientId+"|"+timestamp)));
}
function signatureBytes(s:string) { return /^[a-f0-9]{512}$/i.test(s)?Uint8Array.from(s.match(/../g)!,v=>parseInt(v,16)):un64(s); }
async function verifyAuth(c:SnapConfig,ts:string,sig:string) {
 try {const k=await crypto.subtle.importKey("spki",rawPem(c.receiverPublic),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",k,signatureBytes(sig),enc.encode(c.clientId+"|"+ts));}catch{return false;}
}
export async function serviceSignature(secret:string,token:string,ts:string,body:unknown,path=NOTIFY_PATH,format:"base64"|"hex"="base64") {
 const input=`POST:${path}:${token}:${await sha(JSON.stringify(body))}:${ts}`;
 const value=await mac(secret,input);return format==="hex"?hex(value):b64(value);
}
export async function makeToken(c:SnapConfig,now=Date.now()) {
 const h=b64text(JSON.stringify({alg:"HS256",typ:"JWT"}));
 const p=b64text(JSON.stringify({sub:c.clientId,aud:"matoer-snap-sandbox",iat:Math.floor(now/1000),exp:Math.floor(now/1000)+900,jti:crypto.randomUUID()}));
 return `${h}.${p}.${url64(await mac(c.jwtSecret,h+"."+p,"SHA-256"))}`;
}
async function verifyToken(c:SnapConfig,t:string,now:number) {
 try {const [h,p,s,extra]=t.split('.');if(extra||!h||!p||!s)return false;
 const header=JSON.parse(decodeUrl(h)),payload=JSON.parse(decodeUrl(p));
 return header.alg==="HS256"&&payload.aud==="matoer-snap-sandbox"&&payload.sub===c.clientId&&Number.isInteger(payload.exp)&&payload.exp>now/1000&&Number.isInteger(payload.iat)&&payload.exp-payload.iat<=900&&payload.exp>payload.iat&&payload.iat<=now/1000+30&&same(s,url64(await mac(c.jwtSecret,h+"."+p,"SHA-256")));
 }catch{return false;}
}
export const stamp = (now=Date.now()) => new Date(now+7*3600000).toISOString().slice(0,19)+"+07:00";
function validStamp(ts:string,now:number) {return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(ts)&&Math.abs(Date.parse(ts)-now)<=300000;}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function readSnapBody(req:Request) {
 const reader=req.body?.getReader();if(!reader)throw Error('body');let n=0,s="";const decoder=new TextDecoder();
 try {while(true){const r=await reader.read();if(r.done)break;n+=r.value.byteLength;if(n>16384){await reader.cancel();throw Error('size');}s+=decoder.decode(r.value,{stream:true});}s+=decoder.decode();return s;}finally{reader.releaseLock();}
}
export async function handleSnap(req:Request,path:string,deps:SnapDeps) {
 const code=path.includes('access-token')?'73':'52';const fail=(http:number,suffix:string,message:string)=>json({responseCode:`${http}${code}${suffix}`,responseMessage:message},http);
 try {
  if(!['/v1.0/access-token/b2b','/v1.0/qr/qr-mpm-notify','/public-key'].includes(path))return fail(404,'00','Sandbox endpoint not found');
  if(req.method!==(path==='/public-key'?'GET':'POST'))return fail(405,'00','Method not allowed');
  if(!await deps.limit(path))return fail(429,'00','Too many requests');
  const c=await deps.config();if(!c||!c.aktif)return fail(503,'00','Sandbox inactive');
  if(path==='/public-key')return json({environment:'sandbox',publicKey:c.receiverPublic});
  if(!(req.headers.get('content-type')??'').toLowerCase().startsWith('application/json'))return fail(415,'00','Use application/json');
  let body:Record<string,unknown>;try{body=JSON.parse(await readSnapBody(req));if(!body||Array.isArray(body)||typeof body!=='object')throw Error();}catch{return fail(400,'01','Invalid JSON or body exceeds 16 KB');}
  const now=deps.now?.()??Date.now(),ts=req.headers.get('x-timestamp')??'',sig=req.headers.get('x-signature')??'';
  if(!ts||!sig)return fail(400,'02','Missing X-TIMESTAMP or X-SIGNATURE');
  if(!validStamp(ts,now))return fail(400,'01','Invalid or expired X-TIMESTAMP');
  if(path==='/v1.0/access-token/b2b'){
   if(req.headers.get('x-client-key')!==c.clientId||!await verifyAuth(c,ts,sig))return fail(401,'00','Unauthorized signature');
   if(body.grantType!=='client_credentials')return fail(400,'01','Invalid grantType');
   return json({responseCode:'2007300',responseMessage:'Successful',accessToken:await makeToken(c,now),tokenType:'Bearer',expiresIn:'900',additionalInfo:{environment:'sandbox'}});
  }
  const auth=req.headers.get('authorization')??'',token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!await verifyToken(c,token,now))return fail(401,'01','Invalid or expired token');
  if(req.headers.get('x-partner-id')!==c.clientId)return fail(401,'00','Invalid partner ID');
  const external=req.headers.get('x-external-id')??'',channel=req.headers.get('channel-id')??'';
  if(!/^[0-9]{1,36}$/.test(external)||!/^\d{5}$/.test(channel))return fail(400,'01','Invalid X-EXTERNAL-ID or CHANNEL-ID');
  const format=/^[0-9a-f]{128}$/i.test(sig)?'hex':'base64';
  if(!same(format==='hex'?sig.toLowerCase():sig,await serviceSignature(c.clientSecret,token,ts,body,NOTIFY_PATH,format)))return fail(401,'00','Unauthorized signature');
  const ref=body.originalPartnerReferenceNo,bankRef=body.originalReferenceNo,status=body.latestTransactionStatus;
  const amount=body.amount as {value?:unknown;currency?:unknown}|undefined;
  if(typeof ref!=='string'||!/^MATOER-UJI-[A-Za-z0-9-]{1,80}$/.test(ref)||typeof bankRef!=='string'||bankRef.length<1||bankRef.length>120||!['00','01','02','03','04','05','06','07','08','09'].includes(String(status))||typeof status!=='string'||!amount||amount.currency!=='IDR'||typeof amount.value!=='string'||!/^\d{1,12}\.\d{2}$/.test(amount.value))return fail(400,'01','Invalid sandbox reference, status or amount');
  const result=await deps.receive({external,ref,hash:await sha(JSON.stringify(body)),status,amount:amount.value});
  if(result==='not_found')return fail(404,'01','Sandbox reference not found');
  if(result==='amount_mismatch')return fail(404,'13','Invalid amount');
  if(result==='conflict')return fail(409,'00','Conflicting notification');
  if(!['received','duplicate'].includes(result))throw Error('storage');
  return json({responseCode:'2005200',responseMessage:'Request has been processed successfully',additionalInfo:{environment:'sandbox',receipt:result}});
 }catch{return fail(503,'00','Sandbox temporarily unavailable');}
}
// Only retain fields useful for evidence; never persist tokens, signatures, credentials or customer identities.
export function cleanResult(value:unknown,c:SnapConfig|null=null):Record<string,string> {
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 const allowed=['responseCode','responseMessage','referenceNo','partnerReferenceNo','originalReferenceNo','originalPartnerReferenceNo','latestTransactionStatus','transactionStatusDesc'];
 return Object.fromEntries(allowed.filter(k=>typeof (value as Record<string,unknown>)[k]==='string').map(k=>[k,cleanNote(String((value as Record<string,unknown>)[k]),c).slice(0,200)]));
}
export function cleanNote(note:string,c:SnapConfig|null) {
 let s=note.slice(0,2000).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[token ditutup]');
 for(const secret of c?[c.clientSecret,c.privateRef,c.receiverPrivate,c.jwtSecret]:[])if(secret)s=s.split(secret).join('[rahasia ditutup]');
 return s;
}
