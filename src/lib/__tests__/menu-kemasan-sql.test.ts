import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
const db = new PGlite();
const id = (n: number) => `30000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [owner, barista, kopi, gula, kat] = [1, 2, 3, 4, 5].map(id);
const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as Record<string, unknown>[];
const atur = async (p: Record<string, unknown>) => (await q(`select public.atur_varian_menu($1::jsonb) v`, [JSON.stringify(p)]))[0].v as { kemasan: string[]; baru: string[] };
const as = (uid: string) => db.exec(`set test.uid='${uid}'`);
const opsi = [
  { grup: "Gula", nama: "Normal", tambahan_harga: 0 },
  { grup: "Gula", nama: "Less Sugar", tambahan_harga: 0 },
  { grup: "Extra", nama: "Extra Shot", tambahan_harga: 5000 },
];
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`);
  await db.exec(readFileSync(new URL("./fixtures/operasional-baseline.sql", import.meta.url), "utf8"));
  await db.exec(`create table varian(id uuid primary key default gen_random_uuid(),mode mode_data not null default 'asli',menu_id uuid not null references menu,grup text not null,nama text not null,tambahan_harga bigint not null default 0,deleted_at timestamptz);
 create table resep(id uuid primary key default gen_random_uuid(),mode mode_data not null default 'asli',menu_id uuid not null references menu,varian_id uuid references varian,bahan_id uuid not null,takaran numeric(12,3) not null,deleted_at timestamptz);
 create function punya_peran(peran[]) returns boolean language sql stable as $$select exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id where t.pengguna_id=auth.uid() and u.status='aktif' and t.peran=any($1))$$;
 insert into pengguna(id,nama) values('${owner}','Owner'),('${barista}','Barista');
 insert into penugasan(pengguna_id,peran) values('${owner}','owner'),('${barista}','barista');
 insert into menu(id,nama,kategori_id,harga_langsung,harga_ojol,foto_url) values('${kopi}','Kopi Susu','${kat}',18000,22000,'foto.jpg');
 insert into resep(menu_id,bahan_id,takaran) values('${kopi}','${gula}',20);`);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261028133549_menu_kemasan_varian.sql", import.meta.url), "utf8"));
  await as(owner);
}, 30000);
afterAll(() => db.close());

it("creates priced packaging as child menus, copies recipe and syncs sugar/extra options", async () => {
  const r = await atur({
    menu_id: kopi,
    kemasan: [
      { nama: "Cup", harga_langsung: 18000, harga_ojol: 22000 },
      { nama: "Hot", harga_langsung: 17000, harga_ojol: 21000 },
      { nama: "Can", harga_langsung: 25000, harga_ojol: 29000 },
    ],
    opsi,
  });
  expect(r.kemasan).toHaveLength(3);
  const anak = await q(`select nama,kemasan,harga_langsung::int l,harga_ojol::int o,kategori_id,foto_url from menu where induk_id=$1 order by harga_langsung`, [kopi]);
  expect(anak.map((a) => a.nama)).toEqual(["Kopi Susu (Hot)", "Kopi Susu (Cup)", "Kopi Susu (Can)"]);
  expect(anak[2]).toMatchObject({ l: 25000, o: 29000, kategori_id: kat, foto_url: "foto.jpg" });
  // opsi ada di induk + 3 kemasan, resep induk tersalin ke setiap kemasan
  expect((await q(`select count(*)::int n from varian where deleted_at is null`))[0].n).toBe(12);
  expect((await q(`select count(*)::int n from resep where menu_id<>$1`, [kopi]))[0].n).toBe(3);
});

it("keeps variant ids stable, updates prices and removes dropped choices without touching others", async () => {
  const before = await q(`select id from varian where nama='Extra Shot' and deleted_at is null order by id`);
  const kem = await q(`select id,kemasan from menu where induk_id=$1 and deleted_at is null order by kemasan`, [kopi]);
  const cup = kem.find((k) => k.kemasan === "Cup")!.id;
  const hot = kem.find((k) => k.kemasan === "Hot")!.id;
  await atur({
    menu_id: kopi,
    kemasan: [
      { id: cup, nama: "Cup", harga_langsung: 19000, harga_ojol: 23000 },
      { id: hot, nama: "Hot", harga_langsung: 17000, harga_ojol: 21000, aktif: false },
    ],
    opsi: [
      { grup: "Gula", nama: "Normal" },
      { grup: "Extra", nama: "Extra Shot", tambahan_harga: 6000 },
    ],
  });
  const after = await q(`select id from varian where nama='Extra Shot' and deleted_at is null order by id`);
  expect(after).toHaveLength(3);
  for (const v of after) expect(before).toContainEqual(v);
  expect((await q(`select distinct tambahan_harga::int t from varian where nama='Extra Shot' and deleted_at is null`))[0].t).toBe(6000);
  expect((await q(`select count(*)::int n from varian where nama='Less Sugar' and deleted_at is null`))[0].n).toBe(0);
  expect(await q(`select kemasan,aktif,harga_langsung::int l from menu where induk_id=$1 and deleted_at is null order by kemasan`, [kopi])).toEqual([
    { kemasan: "Cup", aktif: true, l: 19000 },
    { kemasan: "Hot", aktif: false, l: 17000 },
  ]);
});

it("renames and soft-deletes packaging together with the parent menu, and restores them", async () => {
  await q(`update menu set nama='Kopi Susu Aren' where id=$1`, [kopi]);
  expect((await q(`select nama from menu where induk_id=$1 and kemasan='Cup' and deleted_at is null`, [kopi]))[0].nama).toBe("Kopi Susu Aren (Cup)");
  await q(`update menu set deleted_at=now() where id=$1`, [kopi]);
  expect((await q(`select count(*)::int n from menu where induk_id=$1 and deleted_at is null`, [kopi]))[0].n).toBe(0);
  await q(`update menu set deleted_at=null where id=$1`, [kopi]);
  expect((await q(`select count(*)::int n from menu where induk_id=$1 and deleted_at is null`, [kopi]))[0].n).toBe(2);
});

it("rejects invalid input, nested packaging, stale ids and non-admin users", async () => {
  const child = (await q(`select id from menu where induk_id=$1 limit 1`, [kopi]))[0].id;
  await expect(atur({ menu_id: kopi, kemasan: [{ nama: "Cup", harga_langsung: -1, harga_ojol: 0 }], opsi: [] })).rejects.toThrow(/rupiah bulat/);
  await expect(atur({ menu_id: kopi, kemasan: [{ nama: "Cup", harga_langsung: 1, harga_ojol: 1 }, { nama: "cup", harga_langsung: 1, harga_ojol: 1 }], opsi: [] })).rejects.toThrow(/tidak boleh sama/);
  await expect(atur({ menu_id: kopi, kemasan: [], opsi: [{ grup: "Topping", nama: "Boba" }] })).rejects.toThrow(/grup/);
  await expect(atur({ menu_id: child, kemasan: [], opsi: [] })).rejects.toThrow(/induk/);
  await expect(atur({ menu_id: kopi, kemasan: [{ id: id(99), nama: "X", harga_langsung: 1, harga_ojol: 1 }], opsi: [] })).rejects.toThrow(/berubah/);
  await as(barista);
  await expect(atur({ menu_id: kopi, kemasan: [], opsi: [] })).rejects.toThrow(/Hanya Owner/);
  await as(owner);
});
