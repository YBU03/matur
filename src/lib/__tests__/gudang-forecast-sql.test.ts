import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
const db = new PGlite();
const id = (n: number) => `40000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [owner, barista, kopi, susu, o1, o2, k1, k2, finance] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(id);
const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as Record<string, unknown>[];
const as = (uid: string) => db.exec(`set test.uid='${uid}'`);
const rpc = async (sql: string, p: unknown[] = []) => (await q(`select ${sql} v`, p))[0].v as Record<string, unknown>;
// waktu WIB → timestamptz
const wib = (s: string) => `${s}+07`;

beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`);
  await db.exec(readFileSync(new URL("./fixtures/operasional-baseline.sql", import.meta.url), "utf8"));
  await db.exec(`create schema gudang_internal;
 create table mutasi_stok(id uuid primary key default gen_random_uuid(),mode mode_data default 'asli',outlet_id uuid,bahan_id uuid,jumlah numeric,jenis text,ref_id uuid,keterangan text,created_at timestamptz default now());
 create function punya_peran(peran[]) returns boolean language sql stable set search_path=public as $$select exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id where t.pengguna_id=auth.uid() and u.status='aktif' and t.peran=any($1))$$;
 insert into pengguna(id,nama) values('${owner}','Owner'),('${barista}','Barista'),('${finance}','Finance');
 insert into penugasan(pengguna_id,peran) values('${owner}','owner'),('${barista}','barista'),('${finance}','finance');
 insert into kiriman(id,outlet_id,nomor) values('${k1}','${o1}','K1'),('${k2}','${o2}','K2');
 insert into stok(outlet_id,bahan_id,jumlah) values(null,'${kopi}',700),(null,'${susu}',50),('${o1}','${kopi}',120),('${o2}','${kopi}',30);
 insert into mutasi_stok(outlet_id,bahan_id,jumlah,jenis,ref_id,created_at) values
  (null,'${kopi}',1000,'pembelian',null,'${wib("2026-09-29 10:00")}'),
  (null,'${kopi}',-200,'kiriman_keluar','${k1}','${wib("2026-09-30 23:30")}'),
  (null,'${kopi}',-100,'kiriman_keluar','${k2}','${wib("2026-10-01 00:30")}'),
  (null,'${kopi}',-10,'waste',null,'${wib("2026-10-06 09:00")}'),
  (null,'${kopi}',10,'opname',null,'${wib("2026-10-07 09:00")}'),
  (null,'${susu}',50,'pembelian',null,'${wib("2026-10-08 09:00")}'),
  ('${o1}','${kopi}',-80,'pemakaian',null,'${wib("2026-10-10 12:00")}'),
  ('${o1}','${kopi}',5,'void',null,'${wib("2026-10-10 12:30")}'),
  ('${o2}','${kopi}',-40,'pemakaian',null,'${wib("2026-10-11 12:00")}');`);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261031222742_gudang_pergerakan_forecast.sql", import.meta.url), "utf8"));
  await as(owner);
}, 30000);
afterAll(() => db.close());

it("groups warehouse movements by WIB day/week/month with opening and closing balances", async () => {
  const bulan = await rpc(`public.pergerakan_stok_gudang('2026-10-01','2026-10-31','bulan')`);
  const rows = bulan.periode as { p: string; b: string; masuk: number; keluar: number; waste: number; sesuai: number }[];
  const kopiOkt = rows.find((r) => r.b === kopi)!;
  // kiriman 30 Sep 23:30 WIB masuk September, 1 Okt 00:30 WIB masuk Oktober
  expect(kopiOkt).toMatchObject({ p: "2026-10-01", keluar: 100, waste: 10, sesuai: 10, masuk: 0 });
  const saldo = bulan.saldo as Record<string, [number, number]>;
  expect(saldo[kopi].map(Number)).toEqual([800, 700]);
  expect(saldo[susu].map(Number)).toEqual([0, 50]);
  const minggu = await rpc(`public.pergerakan_stok_gudang('2026-09-28','2026-10-11','minggu')`);
  const mk = (minggu.periode as { p: string; b: string; keluar: number }[]).filter((r) => r.b === kopi).map((r) => [r.p, Number(r.keluar)]);
  expect(mk).toEqual([["2026-09-28", 300], ["2026-10-05", 0]]);
  await expect(q(`select public.pergerakan_stok_gudang('2026-01-01','2026-12-31','hari')`)).rejects.toThrow(/harian/);
  await expect(q(`select public.pergerakan_stok_gudang('2026-10-05','2026-10-01','bulan')`)).rejects.toThrow(/Rentang/);
});

it("returns monthly shipments and POS usage per outlet filter plus stock and buffer", async () => {
  const semua = await rpc(`public.forecast_stok(null, 12)`);
  const b = (semua.bulan as { p: string; b: string; kirim: number; pakai: number }[]).filter((r) => r.b === kopi);
  expect(b.map((r) => [r.p, Number(r.kirim), Number(r.pakai)])).toEqual([["2026-09-01", 200, 0], ["2026-10-01", 100, 115]]);
  expect(Number((semua.stok_outlet as Record<string, number>)[kopi])).toBe(150);
  expect(Number(semua.buffer)).toBe(10);
  const satu = await rpc(`public.forecast_stok($1, 12)`, [o1]);
  const b1 = (satu.bulan as { p: string; b: string; kirim: number; pakai: number }[]).filter((r) => r.b === kopi);
  expect(b1.map((r) => [r.p, Number(r.kirim), Number(r.pakai)])).toEqual([["2026-09-01", 200, 0], ["2026-10-01", 0, 75]]);
  expect(Number((satu.stok_outlet as Record<string, number>)[kopi])).toBe(120);
});

it("lets warehouse managers change the buffer, finance only read, others nothing", async () => {
  await q(`select public.atur_buffer_forecast(15)`);
  expect(Number((await q(`select buffer_forecast b from pengaturan_gudang`))[0].b)).toBe(15);
  await expect(q(`select public.atur_buffer_forecast(250)`)).rejects.toThrow(/Buffer/);
  await as(finance);
  expect(Number((await rpc(`public.forecast_stok(null, 3)`)).buffer)).toBe(15);
  await expect(q(`select public.atur_buffer_forecast(5)`)).rejects.toThrow(/Hanya/);
  await as(barista);
  await expect(q(`select public.forecast_stok(null, 3)`)).rejects.toThrow(/Tidak berwenang/);
  await expect(q(`select public.pergerakan_stok_gudang('2026-10-01','2026-10-31','bulan')`)).rejects.toThrow(/Tidak berwenang/);
  await as(owner);
});
