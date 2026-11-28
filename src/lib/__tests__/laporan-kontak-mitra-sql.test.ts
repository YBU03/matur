import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
const db=new PGlite();
const id=(n:number)=>`88000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [finance,mitra,other,outlet,report,otherOutlet,master]=Array.from({length:7},(_,i)=>id(i+1));
const as=async(uid:string)=>{await db.query("select set_config('test.uid',$1,false)",[uid]);};
const contacts=async(l=report)=>(await db.query<{v:{id:string;nama:string;no_hp:string|null}[]}>('select public.kontak_mitra_laporan($1) v',[l])).rows[0].v;
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema laporan_lanjut_internal;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table pengguna(id uuid primary key,nama text,no_hp text,status text,peran text);
 create table outlet(id uuid primary key,deleted_at timestamptz);
 create table laporan_bulanan(id uuid primary key,outlet_id uuid,mode text default 'asli',deleted_at timestamptz);
 create table mitra(id uuid primary key,pengguna_id uuid,nama text,no_hp text,deleted_at timestamptz);
 create table perjanjian(id uuid default gen_random_uuid(),mitra_id uuid,outlet_id uuid,mode text default 'asli',deleted_at timestamptz);
 create table penugasan(pengguna_id uuid,peran text,outlet_id uuid);
 create function laporan_lanjut_internal.pusat() returns boolean language sql stable as $$select exists(select 1 from public.pengguna where id=auth.uid() and peran in ('owner','admin_pusat','finance'))$$;
 insert into pengguna values('${finance}','Finance',null,'aktif','finance'),('${mitra}','Mitra satu','08111111111','aktif','mitra'),('${other}','Mitra lain','08222222222','aktif','mitra');
 insert into outlet(id) values('${outlet}'),('${otherOutlet}');
 insert into laporan_bulanan(id,outlet_id) values('${report}','${outlet}');
 insert into mitra values('${master}','${mitra}','Nama Master','08333333333',null);
 insert into penugasan values('${mitra}','mitra','${outlet}'),('${other}','mitra','${otherOutlet}');
 insert into perjanjian(mitra_id,outlet_id) values('${master}','${outlet}'),('${master}','${outlet}');`);
 await db.exec(readFileSync('supabase/migrations/20261128015053_laporan_kontak_mitra.sql','utf8'));
 await as(finance);
},30000);
afterAll(async()=>{await db.close();});
it('matches report outlet, deduplicates agreement/account, prefers current master phone and falls back to account',async()=>{
 expect(await contacts()).toEqual([{id:'mitra:'+master,nama:'Nama Master',no_hp:'08333333333'}]);
 await db.query('update mitra set no_hp=$1 where id=$2',['08444444444',master]);expect((await contacts())[0].no_hp).toBe('08444444444');
 await db.query('update mitra set no_hp=null where id=$1',[master]);expect((await contacts())[0].no_hp).toBe('08111111111');
});
it('handles future partners, multiple recipients and master partners without an account; missing numbers remain visible',async()=>{
 await db.query('insert into penugasan values($1,\'mitra\',$2)',[other,outlet]);
 const m=id(20);await db.query('insert into mitra values($1,null,\'Partner belum punya akun\',null,null)',[m]);await db.query('insert into perjanjian(mitra_id,outlet_id) values($1,$2)',[m,outlet]);
 const c=await contacts();expect(c).toHaveLength(3);expect(c.find(x=>x.id==='akun:'+other)?.no_hp).toBe('08222222222');expect(c.find(x=>x.id==='mitra:'+m)?.no_hp).toBeNull();
});
it('omits deleted or simulation agreements and does not revive deleted master records through assignments',async()=>{
 const m=id(21);await db.query('insert into mitra values($1,null,\'Simulasi\',\'08555555555\',null)',[m]);await db.query("insert into perjanjian(mitra_id,outlet_id,mode) values($1,$2,'simulasi')",[m,outlet]);
 expect((await contacts()).some(x=>x.id==='mitra:'+m)).toBe(false);
 await db.query('update mitra set deleted_at=now() where id=$1',[master]);const c=await contacts();expect(c.some(x=>x.id==='mitra:'+master||x.id==='akun:'+mitra)).toBe(false);
});
it('rejects partners, unrelated roles, inactive users, anonymous and unavailable reports',async()=>{
 for(const uid of [mitra,other,'']){await as(uid);await expect(contacts()).rejects.toThrow('Tidak diizinkan');}
 await as(finance);await db.query("update pengguna set status='nonaktif' where id=$1",[finance]);await expect(contacts()).rejects.toThrow('Tidak diizinkan');await db.query("update pengguna set status='aktif' where id=$1",[finance]);
 await expect(contacts(id(999))).rejects.toThrow('Laporan tidak tersedia');await db.query("update laporan_bulanan set mode='simulasi' where id=$1",[report]);await expect(contacts()).rejects.toThrow('Laporan tidak tersedia');
 expect((await db.query<{allowed:boolean}>("select has_function_privilege('anon','public.kontak_mitra_laporan(uuid)','execute') allowed")).rows[0].allowed).toBe(false);
});
