import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const migration=readFileSync(new URL("../../../supabase/migrations/20261107040237_mitra_alamat_karyawan.sql",import.meta.url),"utf8");
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
 create table public.pengguna(id uuid primary key,nama text,status text,akun_tablet boolean,no_hp text default null);
 create table public.penugasan(pengguna_id uuid,outlet_id uuid,peran text);
 create table public.outlet(id uuid primary key,nama text,deleted_at timestamptz);
 create table public.profil_karyawan(pengguna_id uuid,foto_path text,alamat_domisili text,alamat_ktp text,nik text,maps_url text);
 create table public.karyawan(pengguna_id uuid,tgl_masuk date,deleted_at timestamptz);
 insert into pengguna(id,nama,status,akun_tablet) values ('00000000-0000-0000-0000-000000000001','Mitra A','aktif',false),('00000000-0000-0000-0000-000000000002','Mitra B','aktif',false),('00000000-0000-0000-0000-000000000003','Barista A','aktif',false),('00000000-0000-0000-0000-000000000004','Barista B','aktif',false);
 insert into outlet values ('10000000-0000-0000-0000-000000000001','A',null),('10000000-0000-0000-0000-000000000002','B',null);
 insert into penugasan values ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','mitra'),('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','mitra'),('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','barista'),('00000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','barista');
 insert into profil_karyawan values ('00000000-0000-0000-0000-000000000003',null,'Alamat domisili A','Alamat KTP A','rahasia','https://rahasia'),('00000000-0000-0000-0000-000000000004',null,'  ','Alamat KTP B','rahasia','https://rahasia');`);
 await db.exec(migration);
 await db.exec(readFileSync(new URL("../../../supabase/migrations/20261107040425_mitra_nomor_wa_karyawan.sql",import.meta.url),"utf8"));
 await db.exec("update pengguna set no_hp='081234567890' where nama='Barista A'");
});
afterAll(()=>db.close());
async function baca(id:string){await db.query("select set_config('app.uid',$1,false)",[id]);return (await db.query<{data:{nama:string;alamat:string;no_wa:string|null}[]}>("select karyawan_outlet_saya() data")).rows[0].data;}
it("mitra hanya melihat alamat staf outletnya tanpa NIK/Maps",async()=>{const rows=await baca('00000000-0000-0000-0000-000000000001');expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({nama:'Barista A',alamat:'Alamat domisili A',no_wa:'081234567890'});expect(JSON.stringify(rows)).not.toMatch(/rahasia|maps_url|nik/);});
it("alamat KTP dipakai jika domisili kosong",async()=>{expect((await baca('00000000-0000-0000-0000-000000000002'))[0].alamat).toBe('Alamat KTP B');});
it("staf dan sesi kosong tidak mendapat daftar mitra",async()=>{expect(await baca('00000000-0000-0000-0000-000000000003')).toEqual([]);expect(await baca('')).toEqual([]);});
it("mitra nonaktif tidak mendapat alamat",async()=>{await db.exec("update pengguna set status='nonaktif' where nama='Mitra A'");expect(await baca('00000000-0000-0000-0000-000000000001')).toEqual([]);});
it("anon tidak berhak memanggil fungsi",async()=>{expect((await db.query<{ok:boolean}>("select has_function_privilege('anon','public.karyawan_outlet_saya()','execute') ok")).rows[0].ok).toBe(false);});
