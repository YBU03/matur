import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const a='10000000-0000-0000-0000-000000000001', b='10000000-0000-0000-0000-000000000002',m='20000000-0000-0000-0000-000000000001',v='30000000-0000-0000-0000-000000000001';
const sql=readFileSync('supabase/migrations/20261123050943_brand_katalog_outlet.sql','utf8');
beforeAll(async()=>{
 db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create schema auth;create schema extensions;create schema matur_internal;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create function public.punya_peran(text[]) returns boolean language sql as $$select current_setting('test.admin',true) is distinct from 'false'$$;
 create function public.catat_log() returns trigger language plpgsql as $$begin return coalesce(new,old);end$$;
 create type mode_data as enum('asli','simulasi');
 create table outlet(id uuid primary key default gen_random_uuid(),nama text,mode mode_data default 'asli',deleted_at timestamptz);
 create table menu(id uuid primary key default gen_random_uuid(),mode mode_data default 'asli',nama text,kategori_id uuid,harga_langsung bigint,harga_ojol bigint,aktif boolean default true,foto_url text,urutan int,titipan boolean default false,produsen text,harga_titip bigint,produsen_id uuid,induk_id uuid,kemasan text,deleted_at timestamptz);
 create table varian(id uuid primary key default gen_random_uuid(),mode mode_data default 'asli',menu_id uuid,grup text,nama text,tambahan_harga bigint,deleted_at timestamptz);
 create table resep(id uuid primary key default gen_random_uuid(),mode mode_data default 'asli',menu_id uuid,varian_id uuid,bahan_id uuid,takaran numeric,deleted_at timestamptz);
 create table bahan(id uuid,harga_pokok numeric,mode mode_data,deleted_at timestamptz);
 create table hpp_menu(menu_id uuid,nama_hpp text,seri text,komponen jsonb,total_hpp numeric,harga_jual bigint,deleted_at timestamptz);create table isi_titipan(menu_id uuid,barang_id uuid,qty numeric);
 create table transaksi(outlet_id uuid);create table log_aktivitas(pengguna_id uuid,aksi text,entitas text,entitas_id text,nilai_baru jsonb);
 create function extensions.digest(text,text) returns bytea language sql as $$select convert_to($1,'UTF8')$$;
 create function matur_internal.buat_transaksi(p jsonb) returns jsonb language plpgsql as $f$ declare v_outlet uuid; begin
  if not peran_di_outlet(v_outlet, '{kasir,barista,spv}') then raise exception 'x';end if;
 return '{}';end $f$;
 insert into outlet(id,nama) values('${a}','Ruma A');
 insert into menu(id,nama,harga_langsung,harga_ojol) values('${m}','Kopi',23000,25000);
 insert into varian(id,menu_id,grup,nama,tambahan_harga) values('${v}','${m}','Extra','Shot',4000);
 insert into resep(menu_id,varian_id,bahan_id,takaran) values('${m}',null,gen_random_uuid(),20),('${m}','${v}',gen_random_uuid(),5);
 `);
 await db.exec(sql);
 await db.exec(`insert into outlet(id,nama) values('${b}','Bakery B')`);
},30000);
afterAll(async()=>{await db.close()});
it('preserves existing catalogue and starts future outlets empty',async()=>{
 const r=await db.query<{ok:boolean}>(`select usaha_internal.menu_boleh('${a}','${m}') and not usaha_internal.menu_boleh('${b}','${m}') ok`);expect(r.rows[0].ok).toBe(true);
});
it('copies independent menu, variants and recipes without financial/stock writes',async()=>{
 const payload=JSON.stringify({request_id:randomUUID(),outlet_id:b,asal:a});
 await db.query(`select public.salin_katalog_outlet($1::jsonb)`,[payload]);
 await db.query(`select public.salin_katalog_outlet($1::jsonb)`,[payload]);
 const r=await db.query<{id:string;outlet_id:string}>(`select id,outlet_id from menu where outlet_id='${b}'`);expect(r.rows).toHaveLength(1);expect(r.rows[0].id).not.toBe(m);
 const id=r.rows[0].id;const rs=await db.query(`select * from resep where menu_id='${id}'`);expect(rs.rows).toHaveLength(2);
 expect((await db.query(`select * from varian where menu_id='${id}'`)).rows).toHaveLength(1);
 await db.exec(`update menu set harga_langsung=12000 where id='${id}';update resep set takaran=30 where menu_id='${id}'`);
 expect((await db.query<{harga_langsung:number}>(`select harga_langsung from menu where id='${m}'`)).rows[0].harga_langsung).toBe(23000);
 expect((await db.query<{takaran:string}>(`select takaran from resep where menu_id='${m}' and varian_id is null`)).rows[0].takaran).toBe('20');
 expect((await db.query<{ok:boolean}>(`select not usaha_internal.menu_boleh('${a}','${id}') ok`)).rows[0].ok).toBe(true);
 expect((await db.query(`select * from transaksi`)).rows).toHaveLength(0);
});
it('denies changing existing menu ownership and cross-outlet packaging',async()=>{
 await expect(db.exec(`update menu set outlet_id='${b}' where id='${m}'`)).rejects.toThrow('Pindah outlet');
 const id=(await db.query<{id:string}>(`select id from menu where outlet_id='${b}'`)).rows[0].id;
 await expect(db.exec(`insert into menu(nama,outlet_id,induk_id) values('Kemasan','${a}','${id}')`)).rejects.toThrow('satu katalog');
});
it('rejects recopy and noncentral callers',async()=>{
 await expect(db.query(`select public.salin_katalog_outlet($1::jsonb)`,[JSON.stringify({request_id:randomUUID(),outlet_id:b,asal:a})])).rejects.toThrow('tanpa menu');
 await db.exec("set test.admin='false'");await expect(db.query(`select public.salin_katalog_outlet($1::jsonb)`,[JSON.stringify({request_id:randomUUID(),outlet_id:a,asal:null})])).rejects.toThrow('Hanya Admin');await db.exec("set test.admin='true'");
});
it('denies resetting an outlet that already has sales',async()=>{
 await db.exec(`insert into transaksi(outlet_id) values('${a}')`);
 await expect(db.query(`select public.salin_katalog_outlet($1::jsonb)`,[JSON.stringify({request_id:randomUUID(),outlet_id:a,asal:null})])).rejects.toThrow('riwayat penjualan');
});

it('packaging inserted by the existing variant editor inherits outlet ownership',async()=>{
 const id=(await db.query<{id:string}>(`select id from menu where outlet_id='${b}'`)).rows[0].id;
 await db.exec(`insert into menu(nama,induk_id) values('Kemasan B','${id}')`);
 expect((await db.query<{outlet_id:string}>(`select outlet_id from menu where nama='Kemasan B'`)).rows[0].outlet_id).toBe(b);
});
