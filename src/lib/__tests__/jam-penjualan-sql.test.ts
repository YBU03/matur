import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
const db = new PGlite();
const o = "00000000-0000-0000-0000-000000000001";
const o2 = "00000000-0000-0000-0000-000000000002";
const hidden = "00000000-0000-0000-0000-000000000003";
beforeAll(async () => {
  await db.exec(`create role authenticated;create role anon;create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
    create type mode_data as enum('asli','simulasi');
    create table outlet(id uuid primary key,tampil_dashboard_pos boolean);
    create table transaksi(outlet_id uuid,created_at timestamptz,status text,mode mode_data,sumber_penjualan text);
    create function tgl_op(p timestamptz) returns date language sql as $$select ((p at time zone 'Asia/Jakarta') - case when p >= '2026-11-02T00:00:00+07'::timestamptz then interval '3 hours' else interval '0' end)::date$$;
    create function awal_op(p date) returns timestamptz language sql as $$select (p::timestamp + case when p >= '2026-11-02' then interval '3 hours' else interval '0' end) at time zone 'Asia/Jakarta'$$;
    insert into outlet values('${o}',true),('${o2}',true),('${hidden}',false);
    insert into transaksi values
      ('${o}','2026-10-31T12:00:00+07','lunas','asli',null),
      ('${o}','2026-11-01T00:10:00+07','lunas','asli',null),
      ('${o}','2026-11-01T12:00:00+07','lunas','asli','pdf'),
      ('${o}','2026-11-02T10:00:00+07','lunas','asli',null),
      ('${o}','2026-11-03T01:00:00+07','lunas','asli',null),
      ('${o}','2026-11-08T10:00:00+07','lunas','asli',null),
      ('${o}','2026-11-08T10:00:00+07','void','asli',null),
      ('${o}','2026-11-08T10:00:00+07','lunas','simulasi',null),
      ('${o2}','2026-11-02T10:00:00+07','lunas','asli',null),
      ('${hidden}','2026-11-02T10:00:00+07','lunas','asli',null);
    alter table transaksi enable row level security;
    create policy baca on transaksi to authenticated using(outlet_id <> '${o2}'::uuid);
    grant usage on schema public,auth to authenticated,anon;
    grant select on transaksi,outlet to authenticated;`);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261109034501_jam_penjualan_tanggal.sql",import.meta.url),"utf8"));
  await db.exec(`set role authenticated;select set_config('app.uid','${o}',false);`);
},30000);
afterAll(() => db.close());
async function rpc(outlet: string | null, dari="2026-11-01", sampai="2026-11-09") {
 return (await db.query<{v:{cells:{tgl:string;jam:number;trx:number}[];tanpa_jam:number}}>("select jam_penjualan_tanggal($1,$2,$3,'asli') v",[outlet,dari,sampai])).rows[0].v;
}
it("memisahkan tanggal, mempertahankan hari operasional, dan tidak menebak jam impor",async()=>{
 const d=await rpc(o);
 expect(d.tanpa_jam).toBe(1);
 expect(d.cells).toEqual([{tgl:"2026-11-01",jam:0,trx:1},{tgl:"2026-11-02",jam:1,trx:1},{tgl:"2026-11-02",jam:10,trx:1},{tgl:"2026-11-08",jam:10,trx:1}]);
});
it("menghormati RLS dan visibilitas outlet serta batas tanggal",async()=>{
 expect((await rpc(o2)).cells).toEqual([]);
 expect((await rpc(null)).cells.reduce((s,c)=>s+c.trx,0)).toBe(4);
 expect((await rpc(hidden)).cells).toHaveLength(1);
 expect((await rpc(o,"2026-11-08","2026-11-09")).cells).toEqual([{tgl:"2026-11-08",jam:10,trx:1}]);
});
it("menolak pemanggilan anonim",async()=>{
 await db.exec('set role anon');
 await expect(rpc(o)).rejects.toThrow(/permission denied/);
 await db.exec('reset role');
});
