import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
const db=new PGlite();
const user="10000000-0000-0000-0000-000000000001", other="10000000-0000-0000-0000-000000000002", outlet="10000000-0000-0000-0000-000000000003", foreign="10000000-0000-0000-0000-000000000004";
const id=(n:number)=>`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const data=(n:number,day='2026-11-16')=>({version:2,id:id(n),outletId:outlet,tanggal:day,scope:'mandiri',updatedAt:100,isi:{kopi:{kemasan:'1',eceran:'0'}},sistem:{kopi:20},jenis:'rutin',catatan:'SO'});
const save=(d:unknown)=>db.query('select cadangkan_draft_so($1::jsonb)',[JSON.stringify(d)]);
const as=(uid:string)=>db.exec(`set test.uid='${uid}';set role authenticated;`);
beforeAll(async()=>{
 await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to authenticated;create table pengguna(id uuid primary key);create table outlet(id uuid primary key);insert into pengguna values('${user}'),('${other}');insert into outlet values('${outlet}'),('${foreign}');create function gudang_pusat() returns boolean language sql as $$select false$$;create function punya_peran(text[]) returns boolean language sql as $$select false$$;create function peran_di_outlet(uuid,text[]) returns boolean language sql as $$select $1='${outlet}'::uuid and auth.uid()='${user}'::uuid$$;`);
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261116023852_so_harian_draft.sql',import.meta.url),'utf8'));
},30000);
afterAll(()=>db.close());
it('keeps separate dates and scopes without writing any official SO or stock',async()=>{
 await as(user);await save(data(10));await save(data(11,'2026-11-15'));await save({...data(12),scope:'kas-2'});
 expect((await db.query('select count(*)::int n from draft_opname_outlet')).rows).toEqual([{n:3}]);
 expect((await db.query("select to_regclass('public.opname') v")).rows).toEqual([{v:null}]);
});
it('late network response cannot overwrite newer draft; completed marker is kept',async()=>{
 await save({...data(10),updatedAt:102,completedId:id(99)});await save({...data(10),updatedAt:101});
 const r=(await db.query<{data:{completedId:string};versi:string}>('select data,versi::text from draft_opname_outlet where id=$1',[id(10)])).rows[0];
 expect(r.versi).toBe('102');expect(r.data.completedId).toBe(id(99));
});
it('blocks another user, cross-outlet, anonymous access and identity changes',async()=>{
 await expect(save({...data(13),outletId:foreign})).rejects.toThrow(/row-level security/);
 await expect(db.query('update draft_opname_outlet set pengguna_id=$1 where id=$2',[other,id(10)])).rejects.toThrow(/row-level security/);
 await db.exec('reset role');await as(other);
 expect((await db.query('select count(*)::int n from draft_opname_outlet')).rows).toEqual([{n:0}]);
 await expect(save(data(10))).rejects.toThrow(/row-level security/);
 await db.exec('reset role;set role anon');await expect(db.query('select * from draft_opname_outlet')).rejects.toThrow(/permission denied/);
 await db.exec('reset role');await as(user);
});
