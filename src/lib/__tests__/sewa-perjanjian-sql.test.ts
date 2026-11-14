import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db=new PGlite();
const q=async(sql:string,args:unknown[]=[]) => (await db.query(sql,args)).rows as Record<string,unknown>[];
const k='e9074d01-68b5-4eb7-a06e-8a8b40a2c4ac',u='a8786407-384b-4fd3-aaad-fc1d7711a288';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create table perjanjian(id uuid primary key default gen_random_uuid(),mode text default 'asli',sewa_bulanan bigint not null default 0,persen_mitra int default 55,persen_pengelola int default 45,sewa_masuk_bep boolean default false);insert into perjanjian(id,sewa_bulanan) values('${k}',1416667),('${u}',25000000);insert into perjanjian(sewa_bulanan,mode) values(1000000,'simulasi');grant select,insert,update on perjanjian to authenticated;`);
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261114064508_sewa_perjanjian_tahunan.sql',import.meta.url),'utf8'));
},30000);
afterAll(()=>db.close());
it('corrects only confirmed records and preserves unrelated old monthly data', async()=>{
 expect((await q('select sewa_tahunan::text,sewa_bulanan::text,persen_mitra,persen_pengelola,sewa_masuk_bep from perjanjian where id=$1',[u]))[0]).toEqual({sewa_tahunan:'25000000',sewa_bulanan:'2083333',persen_mitra:55,persen_pengelola:45,sewa_masuk_bep:false});
 expect((await q('select sewa_tahunan::text from perjanjian where id=$1',[k]))[0].sewa_tahunan).toBe('17000000');
 expect((await q("select sewa_tahunan::text,sewa_bulanan::text from perjanjian where mode='simulasi'"))[0]).toEqual({sewa_tahunan:'12000000',sewa_bulanan:'1000000'});
});
it('authenticated edits sync annual and monthly values without needing RPC privilege',async()=>{
 await db.exec('set role authenticated');
 await q('update perjanjian set sewa_tahunan=24000000 where id=$1',[k]);
 expect((await q('select sewa_bulanan::text from perjanjian where id=$1',[k]))[0].sewa_bulanan).toBe('2000000');
 await q('update perjanjian set sewa_bulanan=1500000 where id=$1',[k]);
 expect((await q('select sewa_tahunan::text from perjanjian where id=$1',[k]))[0].sewa_tahunan).toBe('18000000');
 await q('update perjanjian set sewa_tahunan=0 where id=$1',[k]);
 expect((await q('select sewa_bulanan::text from perjanjian where id=$1',[k]))[0].sewa_bulanan).toBe('0');
 await db.exec('reset role');
});
it('new and legacy inserts use correct units, conflicts prefer explicit annual input',async()=>{
 const [a]=await q('insert into perjanjian(sewa_tahunan) values(25000000) returning sewa_bulanan::text');expect(a.sewa_bulanan).toBe('2083333');
 const [b]=await q('insert into perjanjian(sewa_bulanan) values(2000000) returning sewa_tahunan::text');expect(b.sewa_tahunan).toBe('24000000');
 const [c]=await q('insert into perjanjian(sewa_tahunan,sewa_bulanan) values(12000000,99000000) returning sewa_bulanan::text');expect(c.sewa_bulanan).toBe('1000000');
});
it('unrelated edits preserve exact annual values and invalid rent is rejected',async()=>{
 await q('update perjanjian set persen_mitra=60 where id=$1',[u]);
 expect((await q('select sewa_tahunan::text from perjanjian where id=$1',[u]))[0].sewa_tahunan).toBe('25000000');
 await expect(q('update perjanjian set sewa_tahunan=-1 where id=$1',[u])).rejects.toThrow(/perjanjian_sewa_tahunan_valid/);
 await expect(q('update perjanjian set sewa_tahunan=1000000000001 where id=$1',[u])).rejects.toThrow(/perjanjian_sewa_tahunan_valid/);
 expect((await q("select has_function_privilege('anon','perjanjian_internal.sinkron_sewa()','execute') v"))[0].v).toBe(false);
});
