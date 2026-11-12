import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
it('keeps BNI secrets server-only, preserves blank credentials, blocks identity changes and caps safe history',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role service_role;create role authenticated;create role anon;create schema auth;create schema vault;create schema snap_sandbox_internal;create schema bni_internal;
 create function auth.role() returns text language sql as $$select current_setting('app.role',true)$$;
 create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text,name text);create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
 create function vault.create_secret(s text,n text)returns uuid language sql as $$insert into vault.secrets(secret,name)values(s,n)returning id$$;
 create function vault.update_secret(k uuid,s text)returns void language sql as $$update vault.secrets set secret=s where id=k$$;
 create table bni_internal.konfigurasi(id boolean,public_key text,private_secret_id uuid);create table public.log_aktivitas(pengguna_id uuid,aksi text,entitas text,entitas_id text,nilai_baru jsonb);
 insert into bni_internal.konfigurasi select true,'GATEWAY_PUBLIC',vault.create_secret('GATEWAY_PRIVATE','key');`);
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261112043734_bni_snap_collection_panel.sql',import.meta.url),'utf8'));
 const rpc=async(action:string,data:unknown={})=>(await db.query<{v:Record<string,unknown>}>('select public.bni_snap_service($1,$2) v',[action,JSON.stringify(data)])).rows[0].v;
 await db.exec("set role service_role;select set_config('app.role','service_role',false)");
 const form={clientId:'client-test',apiKey:'api-test',apiSecret:'API_SECRET_TEST',clientSecret:'CLIENT_SECRET_TEST',merchantId:'',terminalId:'',channelId:''};await rpc('save',form);
 const status=await rpc('status');expect(status.configured).toBe(true);expect(JSON.stringify(status)).not.toMatch(/API_SECRET_TEST|CLIENT_SECRET_TEST|GATEWAY_PRIVATE/);
 const conf=await rpc('config');expect(conf.apiSecret).toBe('API_SECRET_TEST');expect(conf.privateKey).toBe('GATEWAY_PRIVATE');
 await rpc('save',{...form,apiKey:'',apiSecret:'',clientSecret:'',channelId:'API'});expect((await rpc('config')).apiKey).toBe('api-test');
 await expect(rpc('save',{...form,clientId:'different',apiSecret:'',clientSecret:''})).rejects.toThrow(/Lengkapi/);
 await expect(rpc('record',{result:{action:'token',response:{accessToken:'BAD'}}})).rejects.toThrow(/rahasia/);
 const result={action:'generate',ok:true,response:{responseCode:'2004700',referenceNo:'BANK'},request:{body:{partnerReferenceNo:'RUMA'}},version:'v1'};
 const rec=await rpc('record',{result});expect((await rpc('generation',{id:rec.id})).action).toBe('generate');
 for(let i=0;i<201;i++)await rpc('record',{result:{action:'token',ok:true,response:{responseCode:'2007300'}}});
 expect((await rpc('status')).history).toHaveLength(50);
 await db.exec("reset role;select set_config('app.role','authenticated',false);set role authenticated");await expect(rpc('config')).rejects.toThrow(/permission denied/);await expect(db.query('select * from snap_sandbox_internal.bni_snap_config')).rejects.toThrow(/permission denied/);
 await db.exec('reset role');expect((await db.query<{n:number}>('select count(*)::int n from snap_sandbox_internal.bni_snap_history')).rows[0].n).toBe(200);
 }finally{await db.close();}
},30000);
