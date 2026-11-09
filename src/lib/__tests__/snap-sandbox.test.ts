import { beforeAll,expect,it } from "vitest";
import { rsaPair,authSignature,serviceSignature,makeToken,handleSnap,stamp,NOTIFY_PATH,cleanResult,cleanNote,type SnapConfig,type SnapDeps } from '../../../supabase/functions/_shared/snap-sandbox';
let c:SnapConfig;const now=Date.parse('2026-11-09T08:00:00Z');
beforeAll(async()=>{c={clientId:'matoer-test-client',clientSecret:'test-client-secret-not-real',privateRef:'test-aspi-private-reference',publicRef:'test-aspi-public-reference',aktif:true,...await rsaPair()};});
const deps=(over:Partial<SnapDeps>={}):SnapDeps=>({config:async()=>c,limit:async()=>true,receive:async()=> 'received',now:()=>now,...over});
async function tokenReq(over:Record<string,string>={},body:unknown={grantType:'client_credentials'}){
 return new Request('https://unit.test/token',{method:'POST',headers:{'Content-Type':'application/json','X-TIMESTAMP':stamp(now),'X-CLIENT-KEY':c.clientId,'X-SIGNATURE':await authSignature(c,stamp(now)),...over},body:JSON.stringify(body)});
}
async function notify(over:Record<string,string>={},body:unknown=sample(),format:'base64'|'hex'='base64'){
 const token=await makeToken(c,now),ts=stamp(now);
 return new Request('https://unit.test/notify',{method:'POST',headers:{'Content-Type':'application/json','X-TIMESTAMP':ts,'X-PARTNER-ID':c.clientId,'X-EXTERNAL-ID':'2026110900001','CHANNEL-ID':'00002',Authorization:'Bearer '+token,'X-SIGNATURE':await serviceSignature(c.clientSecret,token,ts,body,NOTIFY_PATH,format),...over},body:JSON.stringify(body)});
}
const sample=()=>({originalReferenceNo:'BANK-UJI-1',originalPartnerReferenceNo:'MATOER-UJI-12345',latestTransactionStatus:'00',amount:{value:'1000.00',currency:'IDR'}});
it('issues B2B token only after RSA signature, client and timestamp validation',async()=>{
 const r=await handleSnap(await tokenReq(),'/v1.0/access-token/b2b',deps());const d=await r.json();
 expect(r.status).toBe(200);expect(d.responseCode).toBe('2007300');expect(d.expiresIn).toBe('900');expect(d.accessToken).toMatch(/^eyJ/);
 expect((await handleSnap(await tokenReq({'X-CLIENT-KEY':'wrong'}),'/v1.0/access-token/b2b',deps())).status).toBe(401);
 expect((await handleSnap(await tokenReq({'X-SIGNATURE':'wrong'}),'/v1.0/access-token/b2b',deps())).status).toBe(401);
 expect((await handleSnap(await tokenReq({'X-TIMESTAMP':stamp(now-360000)}),'/v1.0/access-token/b2b',deps())).status).toBe(400);
 expect((await handleSnap(await tokenReq({}, {grantType:'authorization_code'}),'/v1.0/access-token/b2b',deps())).status).toBe(400);
});
it('accepts sandbox notification with correct HMAC in base64 or hex',async()=>{
 for(const fmt of ['base64','hex'] as const){const r=await handleSnap(await notify({},sample(),fmt),'/v1.0/qr/qr-mpm-notify',deps());expect(r.status).toBe(200);expect((await r.json()).responseCode).toBe('2005200');}
});
it('rejects altered signatures, wrong partner, expired/wrong token and missing headers',async()=>{
 const path='/v1.0/qr/qr-mpm-notify';
 for(const change of ([{'X-SIGNATURE':'fake'},{Authorization:'Bearer fake'},{'X-PARTNER-ID':'other'},{Authorization:'Bearer '+await makeToken(c,now-901000)}] as Record<string,string>[]))expect((await handleSnap(await notify(change),path,deps())).status).toBe(401);
 expect((await handleSnap(await notify({'X-TIMESTAMP':''}),path,deps())).status).toBe(400);
 expect((await handleSnap(await notify({'CHANNEL-ID':'bad'}),path,deps())).status).toBe(400);
});
it('binds HMAC to payload and exact public endpoint, never just the presence of a signature',async()=>{
 const token=await makeToken(c,now),ts=stamp(now),body=sample();
 const sig=await serviceSignature(c.clientSecret,token,ts,body,'/another/path');
 expect((await handleSnap(await notify({'X-SIGNATURE':sig}),'/v1.0/qr/qr-mpm-notify',deps())).status).toBe(401);
 const req=await notify();const raw=await req.json();raw.amount.value='2000.00';
 expect((await handleSnap(new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify(raw)}),'/v1.0/qr/qr-mpm-notify',deps())).status).toBe(401);
});
it('returns controlled not-found, amount mismatch, duplicate and conflict responses',async()=>{
 for(const [result,status] of [['not_found',404],['amount_mismatch',404],['duplicate',200],['conflict',409]] as const){expect((await handleSnap(await notify(),'/v1.0/qr/qr-mpm-notify',deps({receive:async()=>result}))).status).toBe(status);}
});
it('does not accept normal outlet references or invalid status/amount',async()=>{
 for(const body of [{...sample(),originalPartnerReferenceNo:'POS-REAL-1'},{...sample(),latestTransactionStatus:'PAID'},{...sample(),amount:{value:'1000',currency:'IDR'}}])expect((await handleSnap(await notify({},body),'/v1.0/qr/qr-mpm-notify',deps())).status).toBe(400);
});
it('honors inactive config, limits, methods, content type, body size and failure without leaking config',async()=>{
 const req=await tokenReq();
 expect((await handleSnap(req.clone(),'/v1.0/access-token/b2b',deps({config:async()=>({...c,aktif:false})}))).status).toBe(503);
 expect((await handleSnap(req.clone(),'/v1.0/access-token/b2b',deps({limit:async()=>false}))).status).toBe(429);
 expect((await handleSnap(new Request(req.url),'/v1.0/access-token/b2b',deps())).status).toBe(405);
 expect((await handleSnap(await tokenReq({'Content-Type':'text/plain'}),'/v1.0/access-token/b2b',deps())).status).toBe(415);
 expect((await handleSnap(await tokenReq({}, {grantType:'x',x:'x'.repeat(17000)}),'/v1.0/access-token/b2b',deps())).status).toBe(400);
 const r=await handleSnap(req.clone(),'/v1.0/access-token/b2b',deps({config:async()=>{throw Error(c.clientSecret);}}));expect(await r.text()).not.toContain(c.clientSecret);
});
it('stores only safe evidence fields and redacts secrets and JWTs from notes',async()=>{
 expect(cleanResult({responseCode:'2007300',accessToken:'secret',signature:'secret',customerNumber:'private'})).toEqual({responseCode:'2007300'});
 const text=cleanNote(c.clientSecret+' '+c.privateRef+' '+await makeToken(c,now),c);expect(text).not.toContain(c.clientSecret);expect(text).not.toContain(c.privateRef);expect(text).not.toContain('eyJ');
});
