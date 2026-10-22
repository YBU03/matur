import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
const db = new PGlite();
const p = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const a = "00000000-0000-4000-8000-000000000011";
const b = "00000000-0000-4000-8000-000000000012";
const c = "00000000-0000-4000-8000-000000000013";
const foreign = "00000000-0000-4000-8000-000000000014";
const gone = "00000000-0000-4000-8000-000000000015";
const source = readFileSync(new URL("../../../supabase/migrations/20261022025316_timeline_urutan_atomik.sql", import.meta.url), "utf8");
const call = (ids: string[], base: Record<string, number>) => db.query("select simpan_urutan_timeline($1,$2::uuid[],$3::jsonb)", [p, ids, JSON.stringify(base)]);
const base = { [a]: 1, [b]: 2, [c]: 3 };
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select '${a}'::uuid$$;
    create function admin_proyek() returns boolean language sql stable as $$select current_setting('app.role',true) in ('owner','admin_pusat')$$;
    create table proyek(id uuid primary key,deleted_at timestamptz);
    create table jadwal_proyek(id uuid primary key,proyek_id uuid references proyek(id),urutan integer,judul text,tgl_rencana date,deleted_at timestamptz);
    insert into proyek(id) values('${p}'),('${other}');
    insert into jadwal_proyek values('${a}','${p}',1,'A','2026-10-01',null),('${b}','${p}',2,'B','2026-10-02',null),('${c}','${p}',3,'C',null,null),('${foreign}','${other}',1,'Foreign',null,null),('${gone}','${p}',4,'Deleted',null,now());
    set app.role='owner';`);
  await db.exec(source);
});
afterAll(() => db.close());
describe("simpan urutan timeline atomik", () => {
  it("membatasi EXECUTE untuk pengguna terautentikasi", async () => {
    const r = await db.query<{ anon: boolean; signed: boolean }>("select has_function_privilege('anon','simpan_urutan_timeline(uuid,uuid[],jsonb)','EXECUTE') anon,has_function_privilege('authenticated','simpan_urutan_timeline(uuid,uuid[],jsonb)','EXECUTE') signed");
    expect(r.rows[0]).toEqual({ anon: false, signed: true });
  });
  it("menolak peran selain pengelola proyek", async () => {
    await db.exec("set app.role='mitra'");
    await expect(call([c,b,a],base)).rejects.toThrow(/Hanya Owner/);
    await db.exec("set app.role='owner'");
  });
  it("menolak duplikat, baris hilang, lintas proyek, baris dihapus dan data usang", async () => {
    for (const ids of [[a,a,c],[a,b],[a,b,foreign],[a,b,gone]]) await expect(call(ids,base)).rejects.toThrow();
    await expect(call([c,b,a],{ ...base,[b]: 99 })).rejects.toThrow(/telah berubah/);
    expect((await db.query<{ urutan: number }>("select urutan from jadwal_proyek where id=$1",[a])).rows[0].urutan).toBe(1);
  });
  it("rollback seluruh susunan bila satu baris gagal", async () => {
    await db.exec(`create function gagalkan() returns trigger language plpgsql as $$begin if new.id='${b}' then raise exception 'uji gagal';end if;return new;end$$;
      create trigger uji_gagal before update on jadwal_proyek for each row execute function gagalkan();`);
    await expect(call([c,a,b],base)).rejects.toThrow(/uji gagal/);
    expect((await db.query("select id,urutan from jadwal_proyek where proyek_id=$1 and deleted_at is null order by urutan",[p])).rows).toEqual([{id:a,urutan:1},{id:b,urutan:2},{id:c,urutan:3}]);
    await db.exec("drop trigger uji_gagal on jadwal_proyek");
  });
  it("Admin Pusat menyimpan 1..n tanpa mengubah tanggal, judul, atau proyek lain", async () => {
    await db.exec("set app.role='admin_pusat'");
    await call([c,a,b],base);
    expect((await db.query("select id,urutan,judul,tgl_rencana::text from jadwal_proyek where proyek_id=$1 and deleted_at is null order by urutan",[p])).rows).toEqual([
      {id:c,urutan:1,judul:'C',tgl_rencana:null},{id:a,urutan:2,judul:'A',tgl_rencana:'2026-10-01'},{id:b,urutan:3,judul:'B',tgl_rencana:'2026-10-02'}]);
    expect((await db.query<{urutan:number}>("select urutan from jadwal_proyek where id=$1",[foreign])).rows[0].urutan).toBe(1);
    await expect(call([b,a,c],base)).rejects.toThrow(/telah berubah/);
  });
});
