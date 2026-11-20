import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const admin = "a0000000-0000-0000-0000-000000000001";
const mitra = "a0000000-0000-0000-0000-000000000002";
const spv = "a0000000-0000-0000-0000-000000000003";
const inactive = "a0000000-0000-0000-0000-000000000004";
const contact = "a0000000-0000-0000-0000-000000000005";
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table pengguna(id uuid primary key,status text);create table penugasan(pengguna_id uuid,peran text);
    insert into pengguna values('${admin}','aktif'),('${mitra}','aktif'),('${spv}','aktif'),('${inactive}','nonaktif');
    insert into penugasan values('${admin}','admin_pusat'),('${mitra}','mitra'),('${spv}','spv'),('${inactive}','admin_pusat');
    grant usage on schema auth to authenticated,anon;grant select on pengguna to authenticated;
    create function punya_peran(p text[]) returns boolean language sql stable security definer as $$select exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id where t.pengguna_id=auth.uid() and u.status='aktif' and t.peran=any(p))$$;
    create table log_aktivitas(aksi text,entitas text,pengguna_id uuid);
    create function catat_log() returns trigger language plpgsql security definer as $$begin insert into log_aktivitas values(tg_op,tg_table_name,auth.uid());return new;end$$;
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261119042529_support_outlet.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
async function as<T>(user: string, sql: string) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${user}',false)`,
  );
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec("reset role");
  }
}
it("Mitra reads the five active contacts; unrelated roles and inactive users cannot read or write", async () => {
  expect(
    (
      await as<{ nomor: string }>(
        mitra,
        "select nomor from support_outlet order by urutan",
      )
    ).map((r) => r.nomor),
  ).toEqual([
    "6285135990588",
    "6285117189020",
    "6285697865737",
    "6282220172355",
    "6285122637511",
  ]);
  expect(await as(spv, "select * from support_outlet")).toEqual([]);
  expect(await as(inactive, "select * from support_outlet")).toEqual([]);
  expect(
    await as(
      mitra,
      "update support_outlet set nama='Tidak boleh' returning id",
    ),
  ).toEqual([]);
  await expect(
    as(
      mitra,
      "insert into support_outlet(bagian,nama,nomor) values('Uji','Mitra','6285135990588')",
    ),
  ).rejects.toThrow(/row-level security/i);
  await db.exec("set role anon");
  try {
    await expect(db.query("select * from support_outlet")).rejects.toThrow(
      /permission denied/i,
    );
  } finally {
    await db.exec("reset role");
  }
});
it("admin CRUD is audited; inactive/deleted contacts disappear for Mitra; stale edits cannot overwrite", async () => {
  await as(
    admin,
    `insert into support_outlet(id,bagian,nama,nomor,urutan) values('${contact}','Uji','Petugas','6281234567890',60)`,
  );
  const old = (
    await as<{ updated_at: string }>(
      admin,
      `select updated_at::text from support_outlet where id='${contact}'`,
    )
  )[0].updated_at;
  await as(
    admin,
    `update support_outlet set nama='Revisi',aktif=false where id='${contact}'`,
  );
  expect(
    await as(mitra, `select id from support_outlet where id='${contact}'`),
  ).toEqual([]);
  expect(
    await as(
      admin,
      `update support_outlet set nama='Data lama' where id='${contact}' and updated_at='${old}' returning id`,
    ),
  ).toEqual([]);
  await as(admin, `update support_outlet set aktif=true where id='${contact}'`);
  expect(
    (await as(mitra, `select id from support_outlet where id='${contact}'`))
      .length,
  ).toBe(1);
  expect(
    (
      await as(
        admin,
        `update support_outlet set deleted_at=now() where id='${contact}' returning id`,
      )
    ).length,
  ).toBe(1);
  expect(
    await as(mitra, `select id from support_outlet where id='${contact}'`),
  ).toEqual([]);
  await expect(
    as(admin, `delete from support_outlet where id='${contact}'`),
  ).rejects.toThrow(/permission denied/i);
  const logs = await db.query<{ n: number }>(
    `select count(*)::int n from log_aktivitas where pengguna_id='${admin}' and entitas='support_outlet'`,
  );
  expect(logs.rows[0].n).toBeGreaterThanOrEqual(4);
});
it("database refuses malformed destinations even when an admin bypasses the form", async () => {
  await expect(
    as(
      admin,
      "insert into support_outlet(bagian,nama,nomor) values('Uji','Petugas','javascript:evil')",
    ),
  ).rejects.toThrow(/check constraint/i);
});
