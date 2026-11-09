import { readSnapBody } from "../../../../../../supabase/functions/_shared/snap-sandbox";
export const dynamic = "force-dynamic";
async function proxy(req: Request,{params}:{params:Promise<{path:string[]}>}) {
 const path='/'+(await params).path.join('/');
 if(!['/v1.0/access-token/b2b','/v1.0/qr/qr-mpm-notify','/public-key'].includes(path))return Response.json({error:'Not found'},{status:404});
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!base)return Response.json({error:'Sandbox unavailable'},{status:503});
 let raw:string|undefined;
 if(req.method==='POST')try{raw=await readSnapBody(req);}catch{return Response.json({error:'Body invalid or too large'},{status:413});}
 const headers=new Headers();
 for(const k of ['content-type','authorization','x-timestamp','x-client-key','x-signature','x-partner-id','x-external-id','channel-id']){const v=req.headers.get(k);if(v)headers.set(k,v);}
 try{
  const r=await fetch(base+'/functions/v1/matoer-snap-sandbox'+path,{method:req.method,headers,body:raw,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  return new Response(await r.text(),{status:r.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Sandbox temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=proxy;export const POST=proxy;
