import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,it,expect } from 'vitest';
const db=new PGlite();const owner='00000000-0000-0000-0000-000000000001',staff='00000000-0000-0000-0000-000000000002';
beforeAll(async()=>{
 await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create schema vault;create schema storage;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select current_setting('app.role',true)$$;
 create table pengguna(id uuid primary key,status text);create table penugasan(pengguna_id uuid,peran text);
 insert into pengguna values('${owner}','aktif'),('${staff}','aktif');insert into penugasan values('${owner}','owner'),('${staff}','barista');
 create table log_aktivitas(pengguna_id uuid,aksi text,entitas text,entitas_id text,nilai_baru jsonb);
 create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text,name text);
 create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
 create function vault.create_secret(s text,n text) returns uuid language sql as $$insert into vault.secrets(secret,name)values(s,n)returning id$$;
 create function vault.update_secret(k uuid,s text) returns void language sql as $$update vault.secrets set secret=s where id=k$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(s text) returns text[] language sql as $$select string_to_array(s,'/')$$;
 grant usage on schema public,auth,storage to authenticated,anon,service_role;grant select on pengguna,penugasan to authenticated;grant select,insert on storage.objects to authenticated;`);
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261109064803_snap_sandbox_panel.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated;select set_config('app.uid','${owner}',false);select set_config('app.role','authenticated',false);`);
},30000);
afterAll(()=>db.close());
async function admin(action:string,data:unknown={}){return(await db.query<{v:Record<string,unknown>}>('select snap_sandbox_admin($1,$2) v',[action,JSON.stringify(data)])).rows[0].v;}
async function service(action:string,data:unknown={}){return(await db.query<{v:unknown}>('select snap_sandbox_service($1,$2) v',[action,JSON.stringify(data)])).rows[0].v;}
const role=async(r:string)=>{await db.exec(`reset role;set role ${r};select set_config('app.role','${r}',false);`);};
it('stores configuration in vault and returns metadata, never secrets',async()=>{
 const d=await admin('save',{clientId:'test-client',clientSecret:'test-client-secret',privateRef:'test-private-reference',publicRef:'test-public-reference',receiverPrivate:'k'.repeat(600),receiverPublic:'public-pem',jwtSecret:'j'.repeat(48)});
 expect(d.configured).toBe(true);expect(d.aktif).toBe(false);expect(JSON.stringify(d)).not.toContain('test-client-secret');expect(JSON.stringify(d)).not.toContain('test-private-reference');
 await expect(db.query('select * from snap_sandbox_internal.config')).rejects.toThrow(/permission denied/);
 await expect(service('config')).rejects.toThrow(/permission denied/);
 await admin('toggle',{aktif:true});
});
it('requires active privileged role for settings, results and evidence',async()=>{
 await db.query("select set_config('app.uid',$1,false)",[staff]);await expect(admin('status')).rejects.toThrow(/Hanya/);
 await db.query("select set_config('app.uid',$1,false)",[owner]);
 await expect(admin('result',{nomor:1,status:'sesuai',buktiPath:staff+'/wrong.png'})).rejects.toThrow(/Bukti/);
 await db.query('insert into storage.objects(bucket_id,name)values($1,$2)',['snap-sandbox-bukti',owner+'/proof.png']);
 const state=await admin('result',{nomor:1,status:'dicoba',catatan:'test',buktiPath:owner+'/proof.png'});expect((state.hasil as unknown[]).length).toBe(1);
 await role('anon');await expect(admin('status')).rejects.toThrow(/permission denied/);await role('authenticated');
});
it('redacts sensitive results in the database too and requires evidence for reviewed success',async()=>{
 const d=await admin('result',{nomor:3,status:'dicoba',catatan:'test-client-secret eyJabc.def.ghi',respons:{responseCode:'2007300',responseMessage:'test-client-secret eyJabc.def.ghi',accessToken:'do-not-store',signature:'do-not-store'}});
 const rows=d.hasil as {catatan:string;respons:unknown}[];
 expect(JSON.stringify(rows)).not.toContain('test-client-secret');expect(JSON.stringify(rows)).not.toContain('do-not-store');expect(JSON.stringify(rows)).not.toContain('eyJabc');
 await expect(admin('result',{nomor:1,status:'sesuai',respons:{}})).rejects.toThrow(/Lampirkan/);
});
it('changes configuration only with matching credentials and keeps receiver disabled after save',async()=>{
 await expect(admin('save',{clientId:'changed'})).rejects.toThrow(/Client ID berubah/);
 const d=await admin('save',{clientId:'test-client',clientSecret:'',privateRef:'',publicRef:''});expect(d.aktif).toBe(false);
});
it('isolates notifications, matches amount and handles duplicate/conflicting events',async()=>{
 await role('service_role');
 expect((await service('config') as {clientSecret:string}).clientSecret).toBe('test-client-secret');
 await service('intent',{ref:'MATOER-UJI-1',amount:'1000.00'});
 const event={ref:'MATOER-UJI-1',external:'10001',hash:'hash-a',amount:'1000.00',status:'00'};
 expect(await service('receive',{...event,amount:'2000.00'})).toBe('amount_mismatch');
 expect(await service('receive',{...event,ref:'unknown'})).toBe('not_found');
 expect(await service('receive',event)).toBe('received');expect(await service('receive',event)).toBe('duplicate');
 expect(await service('receive',{...event,hash:'hash-b'})).toBe('conflict');
 expect(await service('receive',{...event,external:'10002',hash:'hash-c',status:'03'})).toBe('conflict');
 await role('authenticated');
});
