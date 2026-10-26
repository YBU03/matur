import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
const db = new PGlite();
const admin='00000000-0000-4000-8000-000000000001',hrd='00000000-0000-4000-8000-000000000002',a='00000000-0000-4000-8000-000000000011',b='00000000-0000-4000-8000-000000000012';
const user=(id:string)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const toggle=(o:string,on:boolean,v:string|null)=>db.query('select public.atur_testing_pos($1,$2,$3)',[o,on,v]);
const panel=async()=>(await db.query<{r:{id:string;aktif:boolean;versi:string|null}[]}>('select public.panel_testing_pos() r')).rows[0].r;
const version=async(o=a)=>(await db.query<{v:string}>('select diubah_at::text v from matur_internal.pos_testing where outlet_id=$1',[o])).rows[0]?.v??null;
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema matur_internal;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table pengguna(id uuid primary key,status text);create table penugasan(pengguna_id uuid,peran text,outlet_id uuid);
 create table outlet(id uuid primary key,nama text,deleted_at timestamptz);
 create table matur_internal.pos_testing(outlet_id uuid primary key references outlet(id),aktif boolean,diubah_at timestamptz,diubah_oleh uuid);
 alter table matur_internal.pos_testing enable row level security;
 create table log_aktivitas(pengguna_id uuid,aksi text,entitas text,entitas_id text,nilai_baru jsonb);
 create function peran_di_outlet(uuid,text[]) returns boolean language sql stable as $$select exists(select 1 from public.penugasan where pengguna_id=auth.uid() and outlet_id=$1 and peran=any($2))$$;
 insert into pengguna values('${admin}','aktif'),('${hrd}','aktif');insert into penugasan values('${admin}','admin_pusat',null),('${hrd}','hrd','${a}');
 insert into outlet values('${a}','Outlet A',null),('${b}','Outlet B',null);`);
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026033059_pos_testing_hrd_outlet.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026033444_pos_testing_private_rpc_schema.sql',import.meta.url),'utf8'));
 await db.exec('grant usage on schema auth,public to authenticated');
});
afterAll(()=>db.close());
it('pusat melihat outlet tanpa allowlist dengan default nonaktif',async()=>{await user(admin);expect(await panel()).toEqual([{id:a,nama:'Outlet A',aktif:false,versi:null},{id:b,nama:'Outlet B',aktif:false,versi:null}]);});
it('HRD hanya melihat/mengubah outlet penugasannya; pertama kali boleh versi null',async()=>{await user(hrd);expect((await panel()).map(r=>r.id)).toEqual([a]);await toggle(a,true,null);expect((await panel())[0].aktif).toBe(true);await expect(toggle(b,true,null)).rejects.toThrow(/berwenang/);await expect(db.query('select public.status_testing_pos($1)',[b])).rejects.toThrow(/berwenang/);});
it('versi lama dan retry null tidak menimpa perubahan; nonaktif dengan versi tepat',async()=>{await user(hrd);const v=await version();await expect(toggle(a,false,null)).rejects.toThrow(/berubah/);await toggle(a,false,v);await expect(toggle(a,true,v)).rejects.toThrow(/berubah/);expect((await panel())[0].aktif).toBe(false);});
it('HRD pusat dapat memilih semua outlet; tidak memberi akses admin gudang atau kasir',async()=>{await db.exec(`update penugasan set outlet_id=null where pengguna_id='${hrd}'`);await user(hrd);expect(await panel()).toHaveLength(2);await toggle(b,true,null);for(const role of ['admin_gudang','kasir','mitra']){await db.query('update penugasan set peran=$1 where pengguna_id=$2',[role,hrd]);await expect(toggle(b,false,await version(b))).rejects.toThrow(/berwenang/);await expect(panel()).rejects.toThrow(/Hanya/);}await db.query("update penugasan set peran='hrd' where pengguna_id=$1",[hrd]);});
it('akun nonaktif, anonim, outlet dihapus dan status null ditolak',async()=>{await user(hrd);await db.query("update pengguna set status='nonaktif' where id=$1",[hrd]);await expect(panel()).rejects.toThrow(/Hanya/);await expect(toggle(a,true,await version())).rejects.toThrow(/berwenang/);await db.query("update pengguna set status='aktif' where id=$1",[hrd]);await db.query('update outlet set deleted_at=now() where id=$1',[b]);await expect(toggle(b,false,await version(b))).rejects.toThrow(/tersedia/);await expect(db.query('select public.atur_testing_pos($1,null,$2)',[a,await version()])).rejects.toThrow(/status/);await user('');await expect(panel()).rejects.toThrow(/Hanya/);});
it('audit tetap ada, tabel privat dan wrapper invoker; anon tidak dapat execute',async()=>{const rows=(await db.query<{n:number}>('select count(*)::int n from log_aktivitas')).rows;expect(rows[0].n).toBe(3);const r=(await db.query("select has_table_privilege('authenticated','matur_internal.pos_testing','select') direct,has_function_privilege('anon','public.atur_testing_pos(uuid,boolean,timestamptz)','execute') anon,(select prosecdef from pg_proc where oid='public.atur_testing_pos(uuid,boolean,timestamptz)'::regprocedure) definer")).rows[0];expect(r).toEqual({direct:false,anon:false,definer:false});});

it('wrapper bekerja dengan role authenticated tanpa membuka schema lama',async()=>{
 await user(hrd);await db.exec('set role authenticated');
 try {expect((await panel()).map(r=>r.id)).toEqual([a]);await toggle(a,true,(await panel())[0].versi);expect((await panel())[0].aktif).toBe(true);await expect(db.query('select * from matur_internal.pos_testing')).rejects.toThrow(/permission denied/);}
 finally {await db.exec('reset role');}
});
