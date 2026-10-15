import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";

// Execute the real migration in PostgreSQL; fixture only supplies pre-existing schema/helpers.
const db = new PGlite();
const outlet = "00000000-0000-0000-0000-000000000001";
const staff = "00000000-0000-0000-0000-000000000002";
const bahan = "00000000-0000-0000-0000-000000000003";
const jadwal = "00000000-0000-0000-0000-000000000004";
const absen = "00000000-0000-0000-0000-000000000005";
const migration = readFileSync(new URL("../../../supabase/migrations/0055_gudang_hrd_outlet.sql", import.meta.url), "utf8");
const hpp = { nama: "Menu tambahan", harga: 20000, harga_ojol: 25000, seri: "Ice", bahan: [{ id: bahan, qty: 20 }] };

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql as $$ select '${staff}'::uuid $$;
    create type peran as enum ('owner','admin_pusat','admin_gudang','hrd','spv','kasir');
    create function punya_peran(p peran[]) returns boolean language sql as $$ select current_setting('app.role',true) = any(p::text[]) $$;
    create function kelola_sdm(o uuid) returns boolean language sql as $$ select current_setting('app.role',true) in ('owner','hrd') or (current_setting('app.role',true)='spv' and o='${outlet}') $$;
    create table outlet(id uuid primary key default gen_random_uuid(), nama text, mode text default 'asli', deleted_at timestamptz, qris_url text, qris_payload text, qris_nama text, qris_dinamis boolean default false);
    create table menu(id uuid primary key default gen_random_uuid(), nama text, mode text, kategori_id uuid, harga_langsung bigint, harga_ojol bigint, aktif boolean, titipan boolean default false, deleted_at timestamptz);
    create table bahan(id uuid primary key, nama text, mode text, satuan_pakai text, harga_pokok numeric, deleted_at timestamptz);
    create table resep(id uuid primary key default gen_random_uuid(), mode text, menu_id uuid references menu, bahan_id uuid references bahan, takaran numeric, deleted_at timestamptz);
    create table hpp_menu(id uuid primary key default gen_random_uuid(),menu_id uuid references menu,nama_hpp text,seri text,komponen jsonb,total_hpp numeric,deleted_at timestamptz);
    create table perusahaan(toleransi_telat_menit int);
    create table shift_outlet(id uuid primary key, jam_mulai time);
    create table jadwal_shift(id uuid primary key,shift_id uuid references shift_outlet);
    create table absensi(id uuid primary key,outlet_id uuid,pengguna_id uuid,jadwal_id uuid,tanggal date,masuk_at timestamptz,pulang_at timestamptz,catatan text,status text,telat_menit int);
    alter table absensi enable row level security;
    create policy kelola on absensi for all to authenticated using(true);
    create table penggajian(mode text default 'asli',id uuid primary key default gen_random_uuid(),outlet_id uuid,periode date,status text);
    create table log_aktivitas(pengguna_id uuid,aksi text,entitas text,entitas_id text,nilai_lama jsonb,nilai_baru jsonb);
    create table transaksi(id uuid primary key default gen_random_uuid(),outlet_id uuid references outlet);
    create table pembayaran(id uuid primary key default gen_random_uuid(),transaksi_id uuid references transaksi,metode text);
    insert into outlet(id,nama) values('${outlet}','Ruma Kopi Usman Janatin');
    insert into bahan values('${bahan}','Beans','asli','g',100,null);
    insert into perusahaan values(5);
    insert into shift_outlet values('${jadwal}','08:00');
    insert into jadwal_shift values('${jadwal}','${jadwal}');
    insert into absensi values('${absen}','${outlet}','${staff}','${jadwal}','2026-01-05','2026-01-05T01:00Z',null,null,'tepat',0);
    set app.role='owner';
  `);
  await db.exec(migration);
}, 30000);
afterAll(async () => { await db.close(); });

describe("migration 0055", () => {
  it("marks Usman Janatin Pusat and accepts an additional ownership type", async () => {
    expect((await db.query<{kepemilikan:string}>("select kepemilikan from outlet")).rows[0].kepemilikan).toBe("Pusat");
    await db.query("update outlet set kepemilikan='Waralaba' where id=$1",[outlet]);
  });
  it("atomically creates POS menu, recipe and calculated HPP", async () => {
    await db.query("select tambah_hpp($1::jsonb)",[JSON.stringify(hpp)]);
    const r = await db.query<{total_hpp:string;takaran:string}>("select h.total_hpp,r.takaran from hpp_menu h join resep r on r.menu_id=h.menu_id");
    expect(Number(r.rows[0].total_hpp)).toBe(2000);
    expect(Number(r.rows[0].takaran)).toBe(20);
  });
  it("rolls back the new menu on invalid material", async () => {
    const before = (await db.query("select id from menu")).rows.length;
    await expect(db.query("select tambah_hpp($1::jsonb)",[JSON.stringify({...hpp,bahan:[{id:outlet,qty:1}]})])).rejects.toThrow("Bahan tidak ditemukan");
    expect((await db.query("select id from menu")).rows.length).toBe(before);
  });
  it("rejects duplicate ingredients and existing recipes", async () => {
    await expect(db.query("select tambah_hpp($1::jsonb)",[JSON.stringify({...hpp,bahan:[...hpp.bahan,...hpp.bahan]})])).rejects.toThrow("berulang");
    const mid = (await db.query<{id:string}>("select id from menu limit 1")).rows[0].id;
    await expect(db.query("select tambah_hpp($1::jsonb)",[JSON.stringify({...hpp,menu_id:mid,seri:"Hot"})])).rejects.toThrow("sudah punya resep");
  });
  it("rejects unauthorized HPP edits", async () => {
    await db.exec("set app.role='kasir'");
    await expect(db.query("select tambah_hpp($1::jsonb)",[JSON.stringify(hpp)])).rejects.toThrow("Tidak diizinkan");
    await db.exec("set app.role='owner'");
  });
  it("saves pending dynamic without payload and blocks a manually paid transaction", async () => {
    await db.query("select atur_qris_integrasi($1,'','','Merchant',true,'Penyedia nanti','merchant-1')",[outlet]);
    const r = await db.query<{qris_mode:string;qris_dinamis:boolean}>("select qris_mode,qris_dinamis from outlet");
    expect(r.rows[0]).toEqual({qris_mode:"dinamis",qris_dinamis:false});
    const t = (await db.query<{id:string}>("insert into transaksi(outlet_id) values($1) returning id",[outlet])).rows[0].id;
    await expect(db.query("insert into pembayaran(transaksi_id,metode) values($1,'qris')",[t])).rejects.toThrow("menunggu konfigurasi");
    await db.query("select atur_qris($1,'image.png','','Merchant',false)",[outlet]);
    await db.query("insert into pembayaran(transaksi_id,metode) values($1,'qris')",[t]);
  });
  it("recalculates lateness, records reason, and rejects reversed times", async () => {
    await db.query("select edit_absensi($1,'2026-01-05T01:12Z','2026-01-05T09:00Z','Koreksi','Jam masuk salah')",[absen]);
    expect((await db.query<{status:string;telat_menit:number}>("select status,telat_menit from absensi")).rows[0]).toEqual({status:"telat",telat_menit:12});
    expect((await db.query("select * from log_aktivitas where nilai_baru->>'alasan'='Jam masuk salah'")).rows).toHaveLength(1);
    await expect(db.query("select edit_absensi($1,'2026-01-05T01:12Z','2026-01-05T01:00Z','','Alasan salah')",[absen])).rejects.toThrow("tidak valid");
  });
  it("respects SPV outlet scope, mandatory reasons and finalized payroll", async () => {
    await db.exec("set app.role='kasir'");
    await expect(db.query("select edit_absensi($1,now(),null,'','Alasan hapus',true)",[absen])).rejects.toThrow("tidak diizinkan");
    await db.exec("set app.role='spv'");
    await expect(db.query("select edit_absensi($1,now(),null,'','',true)",[absen])).rejects.toThrow("Alasan wajib");
    await db.exec(`insert into penggajian(outlet_id,periode,status) values('${outlet}','2026-01-01','final')`);
    await expect(db.query("select edit_absensi($1,now(),null,'','Alasan hapus',true)",[absen])).rejects.toThrow("sudah final");
    await db.exec("delete from penggajian");
  });
  it("deletes with audit while preserving the published schedule", async () => {
    await db.query("select edit_absensi($1,now(),null,'','Duplikat catatan',true)",[absen]);
    expect((await db.query("select * from absensi")).rows).toHaveLength(0);
    expect((await db.query("select * from jadwal_shift")).rows).toHaveLength(1);
    expect((await db.query("select * from log_aktivitas where aksi='hapus_absensi'")).rows).toHaveLength(1);
  });
});
