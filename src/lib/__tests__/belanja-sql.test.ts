import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
const db=new PGlite();
const uid='00000000-0000-4000-8000-000000000001',p='00000000-0000-4000-8000-000000000002',o='00000000-0000-4000-8000-000000000003',r='00000000-0000-4000-8000-000000000004',foreign='00000000-0000-4000-8000-000000000005';
const id='00000000-0000-4000-8000-000000000010',payId='00000000-0000-4000-8000-000000000011';
const sql=readFileSync(new URL('../../../supabase/migrations/20261022031736_belanja_proyek.sql',import.meta.url),'utf8');
const data={tanggal:'2026-10-22',toko:'Toko uji',penanggung_jawab:'PJ',items:[{item_rab_id:r,qty:'2',harga_satuan:'10000'},{nama:'Ongkir',kategori:'Transport',satuan:'jasa',qty:'1',harga_satuan:'5000'}]};
const save=(bid:string,d:unknown,versi:string|null=null)=>db.query('select simpan_belanja_proyek($1,$2,$3,$4::jsonb)',[bid,p,versi,JSON.stringify(d)]);
const version=async(bid=id)=>(await db.query<{v:string}>("select updated_at::text v from belanja_proyek where id=$1",[bid])).rows[0].v;
const bayar=(pid:string,versi:string,jumlah:number,sumber='dana_proyek')=>db.query('select bayar_belanja_proyek($1,$2,$3,$4::jsonb)',[pid,id,versi,JSON.stringify({tanggal:'2026-10-22',jumlah:String(jumlah),sumber,metode:'transfer'})]);
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select '${uid}'::uuid$$;
 create function admin_proyek() returns boolean language sql stable as $$select current_setting('app.role',true) in ('owner','admin_pusat')$$;
 create function boleh_proyek(uuid) returns boolean language sql stable as $$select $1='${p}'$$;
 create table pengguna(id uuid primary key,nama text,status text);insert into pengguna values('${uid}','Admin','aktif');
 create table proyek(id uuid primary key,deleted_at timestamptz);insert into proyek values('${p}',null),('${o}',null);
 create table item_rab(id uuid primary key,proyek_id uuid,nama text,kategori text,satuan text,deleted_at timestamptz);insert into item_rab values('${r}','${p}','Semen asli','Material','sak',null),('${foreign}','${o}','Asing','Material','sak',null);
 create table log_aktivitas(pengguna_id uuid,aksi text,entitas text,entitas_id text,nilai_lama jsonb,nilai_baru jsonb);
 create schema storage;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 set app.role='admin_pusat';`);
 await db.exec(sql);
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261024022630_belanja_status_pembayaran.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261024033438_hapus_nota_berbayar.sql',import.meta.url),'utf8'));
});
afterAll(()=>db.close());
describe('nota dan pembayaran atomik',()=>{
 it('menolak lintas proyek dan nota invalid tanpa menyimpan sebagian',async()=>{await expect(save(id,{...data,items:[data.items[1],{item_rab_id:foreign,qty:'1',harga_satuan:'1'}]})).rejects.toThrow(/RAB/);expect((await db.query('select * from belanja_proyek')).rows).toHaveLength(0);await expect(save(id,{...data,items:[{nama:'A',qty:'-1',harga_satuan:'1'}]})).rejects.toThrow();});
 it('nota campuran memakai nama RAB server dan tidak menambah baris RAB',async()=>{await save(id,data);const items=(await db.query('select nama,jumlah,item_rab_id from belanja_proyek_item order by urutan')).rows;expect(items).toEqual([{nama:'Semen asli',jumlah:20000,item_rab_id:r},{nama:'Ongkir',jumlah:5000,item_rab_id:null}]);expect((await db.query<{total:number}>('select total from belanja_proyek')).rows[0].total).toBe(25000);});
 it('retry nota sama tidak ganda, revisi harus dengan versi terbaru',async()=>{await save(id,data);expect((await db.query('select * from belanja_proyek')).rows).toHaveLength(1);await expect(save(id,{...data,toko:'Ganti'})).rejects.toThrow(/berubah/);});
 it('pembayaran sebagian idempoten dan overpayment ditolak',async()=>{const v=await version();await bayar(payId,v,10000);await bayar(payId,v,10000);expect((await db.query('select * from belanja_proyek_bayar')).rows).toHaveLength(1);await expect(bayar(crypto.randomUUID(),await version(),20000)).rejects.toThrow(/melebihi/);await expect(bayar(crypto.randomUUID(),v,1)).rejects.toThrow(/berubah/);});
 it('edit tidak mengurangi total di bawah bayar; audit tetap ada',async()=>{await expect(save(id,{...data,items:[{nama:'Salah',qty:'1',harga_satuan:'1'}]},await version())).rejects.toThrow(/lebih kecil/);expect((await db.query('select * from belanja_proyek_item')).rows).toHaveLength(2);expect((await db.query('select * from log_aktivitas')).rows.length).toBeGreaterThan(2);});
 it('nota dibayar tidak dapat dibatalkan',async()=>{await expect(db.query('select batalkan_belanja_proyek($1,$2,$3)',[id,await version(),'Salah input'])).rejects.toThrow(/pembayaran/);});
 it('pembayaran awal invalid rollback header dan item',async()=>{const b=crypto.randomUUID();await expect(save(b,{...data,pembayaran:{id:crypto.randomUUID(),tanggal:'2026-10-22',jumlah:'30000',sumber:'dana_proyek',metode:'tunai'}})).rejects.toThrow(/melebihi/);expect((await db.query('select * from belanja_proyek where id=$1',[b])).rows).toHaveLength(0);});
 it('nota belum dibayar bisa direvisi dan dibatalkan dengan alasan',async()=>{const b=crypto.randomUUID();await save(b,data);await save(b,{...data,toko:'Revisi'},await version(b));await db.query('select batalkan_belanja_proyek($1,$2,$3)',[b,await version(b),'Salah catat nota']);expect((await db.query<{batal:boolean}>('select batal_at is not null batal from belanja_proyek where id=$1',[b])).rows[0].batal).toBe(true);});
 it('pembayaran awal sah dan revisi menjaga pembayaran serta snapshot RAB',async()=>{const b=crypto.randomUUID();const d={...data,pembayaran:{id:crypto.randomUUID(),tanggal:'2026-10-22',jumlah:'5000',sumber:'talangan_pusat',metode:'tunai'}};await save(b,d);await save(b,d);expect((await db.query('select * from belanja_proyek_bayar where belanja_id=$1',[b])).rows).toHaveLength(1);await save(b,{...data,toko:'Toko revisi'},await version(b));expect((await db.query('select * from belanja_proyek_bayar where belanja_id=$1',[b])).rows).toHaveLength(1);});
 it('bukti dari nota lain dan jumlah terlalu presisi ditolak',async()=>{await expect(save(crypto.randomUUID(),{...data,nota_path:p+'/belanja/'+id+'/fake.pdf'})).rejects.toThrow(/nota/);await expect(save(crypto.randomUUID(),{...data,items:[{nama:'Barang',qty:'1.0001',harga_satuan:'1000'}]})).rejects.toThrow(/desimal/);});
 it('peran nonadmin dan tulisan langsung ke tabel ditolak',async()=>{await db.exec("set app.role='mitra'");await expect(save(crypto.randomUUID(),data)).rejects.toThrow(/Hanya/);await db.exec("set app.role='admin_pusat'");const rights=(await db.query<{anon:boolean;direct:boolean;rpc:boolean}>("select has_function_privilege('anon','simpan_belanja_proyek(uuid,uuid,timestamptz,jsonb)','EXECUTE') anon,has_table_privilege('authenticated','belanja_proyek','INSERT') direct,has_function_privilege('authenticated','simpan_belanja_proyek(uuid,uuid,timestamptz,jsonb)','EXECUTE') rpc")).rows[0];expect(rights).toEqual({anon:false,direct:false,rpc:true});});
});

describe('koreksi pembayaran dan nota DP',()=>{
 const b='00000000-0000-4000-8000-000000000050',pid='00000000-0000-4000-8000-000000000051';
 const correct=(pay:string|null,v:string,reason='Salah input pembayaran')=>db.query('select koreksi_bayar_belanja_proyek($1,$2,$3,$4)',[pay,b,v,reason]);
 it('nota DP disimpan dan bayar lalu koreksi tidak menghapus riwayat',async()=>{
  await save(b,{...data,nota_dp:true,pembayaran:{id:pid,tanggal:'2026-10-22',jumlah:'10000',sumber:'dana_proyek',metode:'transfer'}});
  expect((await db.query<{nota_dp:boolean}>('select nota_dp from belanja_proyek where id=$1',[b])).rows[0].nota_dp).toBe(true);
  const v=await version(b);await correct(pid,v);await correct(pid,v);
  const rows=(await db.query<{jumlah:number;batal:boolean;alasan_batal:string;nama_pembatal:string}>('select jumlah,batal_at is not null batal,alasan_batal,nama_pembatal from belanja_proyek_bayar where id=$1',[pid])).rows;
  expect(rows).toEqual([{jumlah:10000,batal:true,alasan_batal:'Salah input pembayaran',nama_pembatal:'Admin'}]);
  expect((await db.query("select * from log_aktivitas where entitas_id=$1 and aksi='update'",[pid])).rows).toHaveLength(1);
 });
 it('retry pembayaran yang dikoreksi tidak menghidupkan pembayaran lama',async()=>{
  await expect(db.query('select bayar_belanja_proyek($1,$2,$3,$4::jsonb)',[pid,b,await version(b),JSON.stringify({tanggal:'2026-10-22',jumlah:'10000',sumber:'dana_proyek',metode:'transfer'})])).rejects.toThrow(/dikoreksi/);
 });
 it('pembayaran pengganti memakai nominal aktif, bukan yang dikoreksi',async()=>{
  await db.query('select bayar_belanja_proyek($1,$2,$3,$4::jsonb)',[crypto.randomUUID(),b,await version(b),JSON.stringify({tanggal:'2026-10-22',jumlah:'25000',sumber:'dana_proyek',metode:'tunai'})]);
  expect((await db.query<{v:number}>('select sum(jumlah)::bigint v from belanja_proyek_bayar where belanja_id=$1 and batal_at is null',[b])).rows[0].v).toBe(25000);
 });
 it('menolak alasan singkat, pembayaran nota lain dan versi lama',async()=>{
  await expect(correct(null,await version(b),'x')).rejects.toThrow(/alasan/);
  await expect(correct(payId,await version(b))).rejects.toThrow(/tidak ditemukan/);
  await expect(correct(null,'2020-01-01')).rejects.toThrow(/berubah/);
 });
 it('belum dibayar mengoreksi semua pembayaran aktif secara idempoten; nota boleh direvisi setelahnya',async()=>{
  const v=await version(b);await correct(null,v);await correct(null,v);
  expect((await db.query('select * from belanja_proyek_bayar where belanja_id=$1 and batal_at is null',[b])).rows).toHaveLength(0);
  expect((await db.query('select * from belanja_proyek_bayar where belanja_id=$1',[b])).rows).toHaveLength(2);
  await save(b,{...data,items:[{nama:'Revisi DP',qty:'1',harga_satuan:'5000'}]},await version(b));
 });
 it('peran lain, akun nonaktif dan akses langsung tidak dapat mengoreksi',async()=>{
  await db.exec("set app.role='mitra'");await expect(correct(null,await version(b))).rejects.toThrow(/Hanya/);await db.exec("set app.role='admin_pusat';update pengguna set status='nonaktif'");
  await expect(correct(null,await version(b))).rejects.toThrow(/aktif/);await db.exec("update pengguna set status='aktif'");
  expect((await db.query<{anon:boolean;direct:boolean}>("select has_function_privilege('anon','koreksi_bayar_belanja_proyek(uuid,uuid,timestamptz,text)','EXECUTE') anon,has_table_privilege('authenticated','belanja_proyek_bayar','UPDATE') direct")).rows[0]).toEqual({anon:false,direct:false});
 });
});

describe('hapus nota dengan arsip dan koreksi atomik',()=>{
 const hapus=(bid:string,v:string,ack=false,reason='Nota salah dicatat')=>db.query('select hapus_belanja_proyek($1,$2,$3,$4)',[bid,v,reason,ack]);
 const newBill=async(paid=false)=>{const bid=crypto.randomUUID();await save(bid,{...data,...(paid?{pembayaran:{id:crypto.randomUUID(),tanggal:'2026-10-22',jumlah:'10000',sumber:'dana_proyek',metode:'transfer'}}:{})});return bid;};
 it('nota belum dibayar diarsipkan tanpa menghapus item dan tidak dihitung ulang saat retry',async()=>{const b=await newBill();const v=await version(b);await hapus(b,v);await hapus(b,v);expect((await db.query<{batal:boolean}>('select batal_at is not null batal from belanja_proyek where id=$1',[b])).rows[0].batal).toBe(true);expect((await db.query('select * from belanja_proyek_item where belanja_id=$1',[b])).rows).toHaveLength(2);});
 it('nota berbayar membutuhkan persetujuan dampak saldo dan riwayat pembayaran tetap ada',async()=>{const b=await newBill(true);const v=await version(b);await expect(hapus(b,v)).rejects.toThrow(/Konfirmasi/);expect((await db.query('select * from belanja_proyek_bayar where belanja_id=$1 and batal_at is null',[b])).rows).toHaveLength(1);await hapus(b,v,true);await hapus(b,v,true);expect((await db.query('select * from belanja_proyek_bayar where belanja_id=$1',[b])).rows).toHaveLength(1);expect((await db.query('select * from belanja_proyek_bayar where belanja_id=$1 and batal_at is null',[b])).rows).toHaveLength(0);});
 it('versi lama dan alasan kosong ditolak sebelum mengoreksi uang keluar',async()=>{const b=await newBill(true);await expect(hapus(b,'2020-01-01',true)).rejects.toThrow(/berubah/);await expect(hapus(b,await version(b),true,' ')).rejects.toThrow(/alasan/);expect((await db.query('select * from belanja_proyek_bayar where belanja_id=$1 and batal_at is null',[b])).rows).toHaveLength(1);});
 it('kegagalan pembatalan nota membatalkan koreksi pembayaran dan perubahan versi sekaligus',async()=>{const b=await newBill(true);const v=await version(b);await db.exec(`create function test_tolak_hapus() returns trigger language plpgsql as $$begin if new.batal_at is not null then raise exception 'Uji rollback hapus';end if;return new;end$$;create trigger test_tolak_hapus before update on belanja_proyek for each row execute function test_tolak_hapus();`);await expect(hapus(b,v,true)).rejects.toThrow(/Uji rollback/);expect(await version(b)).toBe(v);expect((await db.query('select * from belanja_proyek_bayar where belanja_id=$1 and batal_at is null',[b])).rows).toHaveLength(1);await db.exec('drop trigger test_tolak_hapus on belanja_proyek;drop function test_tolak_hapus()');});
 it('mitra/nonaktif/anon ditolak dan wrapper memakai SECURITY INVOKER',async()=>{const b=await newBill();await db.exec("set app.role='mitra'");await expect(hapus(b,await version(b))).rejects.toThrow(/Hanya/);await db.exec("set app.role='admin_pusat';update pengguna set status='nonaktif'");await expect(hapus(b,await version(b))).rejects.toThrow(/aktif/);await db.exec("update pengguna set status='aktif'");expect((await db.query<{anon:boolean;definer:boolean}>("select has_function_privilege('anon','hapus_belanja_proyek(uuid,timestamptz,text,boolean)','EXECUTE') anon,(select prosecdef from pg_proc where oid='hapus_belanja_proyek(uuid,timestamptz,text,boolean)'::regprocedure) definer")).rows[0]).toEqual({anon:false,definer:false});});
});
