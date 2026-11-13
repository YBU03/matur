import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const id = (i: number) => `70000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
const [owner, admin, finance, hrd, staf, menu] = [1,2,3,4,5,6].map(id);
const q = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows as Record<string, unknown>[];
const as = (uid: string) => db.exec(`set test.uid='${uid}'`);
beforeAll(async () => {
 await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create type peran as enum('owner','admin_pusat','finance','hrd','admin_gudang','barista');
 create table pengguna(id uuid primary key,nama text,no_hp text,status text default 'aktif',akun_tablet boolean default false);
 create table penugasan(pengguna_id uuid,peran peran);
 create function punya_peran(peran[]) returns boolean language sql stable as $$select exists(select 1 from pengguna u join penugasan t on t.pengguna_id=u.id where u.id=auth.uid() and u.status='aktif' and t.peran=any($1))$$;
 create table profil_karyawan(pengguna_id uuid primary key,foto_path text,alamat_ktp text,alamat_domisili text,nik text,updated_at timestamptz);
 create table log_aktivitas(pengguna_id uuid,aksi text,entitas text,entitas_id text,nilai_lama jsonb,nilai_baru jsonb);
 create schema storage;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
 create table menu(id uuid primary key,mode text,deleted_at timestamptz,titipan boolean,harga_titip numeric,harga_jual numeric);
 create table isi_titipan(menu_id uuid,barang_id uuid,qty numeric);create table barang_titipan(id uuid primary key,harga numeric,updated_at timestamptz);
 create schema menu_internal;
 create function menu_internal.atur_resep(p jsonb) returns void language plpgsql as $$begin if not punya_peran('{owner,admin_pusat,admin_gudang,hrd}') then raise exception 'Denied';end if;end$$;
 insert into pengguna(id,nama) values('${owner}','Owner'),('${admin}','Admin'),('${finance}','Finance'),('${hrd}','HRD'),('${staf}','Barista');
 insert into penugasan values('${owner}','owner'),('${admin}','admin_pusat'),('${finance}','finance'),('${hrd}','hrd'),('${staf}','barista');
 insert into profil_karyawan(pengguna_id,nik) values('${staf}','1234567890123456');
 insert into menu values('${menu}','asli',null,true,12000,25000);
 `);
 const sql = readFileSync(new URL('../../../supabase/migrations/20261113065400_admin_profil_hpp_shift.sql',import.meta.url),'utf8');
 await db.exec(sql.split('-- Read-only report')[0]);
}, 30000);
afterAll(() => db.close());
const save = (uid: string, before: Record<string,unknown>, data: Record<string,unknown>) => q('select edit_profil_admin($1,$2::jsonb,$3::jsonb)',[uid,JSON.stringify(before),JSON.stringify(data)]);
it('admin edits address/photo and basic profile atomically while preserving other employee data',async()=>{
 await as(admin); await q('insert into storage.objects values($1,$2)',['profil',`${staf}/admin.jpg`]);
 await save(staf,{nama:'Barista',no_hp:null},{nama:'Barista Lengkap',no_hp:'0812',alamat_ktp:'Alamat KTP',alamat_domisili:'Domisili',foto_path:`${staf}/admin.jpg`});
 const [p] = await q('select * from profil_karyawan where pengguna_id=$1',[staf]);
 expect(p.alamat_ktp).toBe('Alamat KTP'); expect(p.nik).toBe('1234567890123456');expect(p.foto_path).toBe(`${staf}/admin.jpg`);
});
it('stale editor cannot overwrite names or addresses',async()=>{
 await as(admin);await expect(save(staf,{nama:'Barista',no_hp:null},{nama:'Stale',alamat_ktp:'Lama'})).rejects.toThrow(/sudah berubah/);
 expect((await q('select alamat_ktp from profil_karyawan where pengguna_id=$1',[staf]))[0].alamat_ktp).toBe('Alamat KTP');
});
it('rejects staff and HRD profile edits and protects owner targets from admin',async()=>{
 for(const who of [staf,hrd,finance]){await as(who);await expect(save(staf,{},{})).rejects.toThrow(/tidak dapat/);}
 await as(admin);await expect(save(owner,{nama:'Owner',no_hp:null},{nama:'Change'})).rejects.toThrow(/tidak dapat/);
});
it('rejects photo from another person or missing storage object',async()=>{
 await as(admin);
 for(const foto_path of [`${owner}/admin.jpg`,`${staf}/missing.jpg`]) await expect(save(staf,{nama:'Barista Lengkap',no_hp:'0812'},{nama:'Barista Lengkap',no_hp:'0812',foto_path})).rejects.toThrow(/Foto tidak valid/);
});
it('finance edits only HPP with optimistic concurrency, no price change',async()=>{
 await db.exec(`insert into barang_titipan values('${id(9)}',12000,now());insert into isi_titipan values('${menu}','${id(9)}',1);`);
 await as(finance);await q('select edit_hpp_titipan($1,12000,14000)',[menu]);
 expect((await q('select harga from barang_titipan where id=$1',[id(9)]))[0].harga).toBe('14000');
 expect((await q('select harga_titip,harga_jual from menu where id=$1',[menu]))[0]).toEqual({harga_titip:'14000',harga_jual:'25000'});
 await expect(q('select edit_hpp_titipan($1,12000,16000)',[menu])).rejects.toThrow(/sudah berubah/);
 await expect(q('select edit_hpp_titipan($1,14000,-1)',[menu])).rejects.toThrow(/HPP wajib/);
});
it('staff/inactive accounts cannot change HPP; public functions not callable anonymously',async()=>{
 await as(staf);await expect(q('select edit_hpp_titipan($1,14000,17000)',[menu])).rejects.toThrow(/Tidak berwenang/);
 await q('update pengguna set status=\'nonaktif\' where id=$1',[finance]);await as(finance);await expect(q('select edit_hpp_titipan($1,14000,17000)',[menu])).rejects.toThrow(/Tidak berwenang/);
 expect((await q("select has_function_privilege('anon','public.edit_profil_admin(uuid,jsonb,jsonb)','execute') v"))[0].v).toBe(false);
 expect((await q("select has_function_privilege('anon','public.edit_hpp_titipan(uuid,numeric,numeric)','execute') v"))[0].v).toBe(false);
});
