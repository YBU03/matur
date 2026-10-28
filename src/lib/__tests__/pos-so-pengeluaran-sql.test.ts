import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
const db = new PGlite();
const id = (n: number) =>
  `20000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [owner, barista, tablet, finance, outlet, other, bahan, sesi, kategori] =
  Array.from({ length: 9 }, (_, i) => id(i + 1));
const query = async (sql: string, p: unknown[] = []) =>
  (await db.query(sql, p)).rows as Record<string, unknown>[];
const call = async (fn: string, p: Record<string, unknown>) =>
  (await query(`select public.${fn}($1::jsonb) v`, [JSON.stringify(p)]))[0].v;
const as = async (uid: string) => db.exec(`set test.uid='${uid}'`);
const so = (n: number, extra: Record<string, unknown> = {}) => ({
  request_id: id(n),
  outlet_id: outlet,
  tanggal: new Date().toISOString().slice(0, 10),
  catatan: "SO uji",
  items: [{ bahan_id: bahan, qty_fisik: 8, qty_sistem: 10 }],
  ...extra,
});
const expense = (n: number, extra: Record<string, unknown> = {}) => ({
  request_id: id(n),
  outlet_id: outlet,
  kategori_id: kategori,
  jumlah: 10000,
  sumber: "laci",
  keterangan: "Marketing uji",
  ...extra,
});
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema matur_internal;grant usage on schema matur_internal to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`,
  );
  await db.exec(
    readFileSync(
      new URL("./fixtures/operasional-baseline.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(`alter type peran add value 'tablet';`);
  await db.exec(`create table sesi_kas(id uuid primary key,outlet_id uuid,mode mode_data default 'asli',pos_tim boolean default true,ditutup_at timestamptz,dibuka_at timestamptz default now());
 create unique index stok_lokasi on stok(mode,outlet_id,bahan_id) nulls not distinct;
 create table mutasi_stok(id uuid default gen_random_uuid(),mode mode_data,outlet_id uuid,bahan_id uuid,jumlah numeric,jenis text,ref_id uuid,keterangan text);
 create function punya_peran(peran[]) returns boolean language sql stable as $$select exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id where t.pengguna_id=auth.uid() and u.status='aktif' and t.peran=any($1))$$;
 create function gudang_pusat() returns boolean language sql stable as $$select punya_peran('{owner,admin_pusat,admin_gudang}')$$;
 create function peran_di_outlet(uuid,peran[]) returns boolean language sql stable as $$select exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id where t.pengguna_id=auth.uid() and u.status='aktif' and t.outlet_id=$1 and (t.peran=any($2) or (t.peran='tablet' and $2 && '{kasir,barista}'::peran[])))$$;
 insert into pengguna(id,nama) values('${owner}','Owner'),('${barista}','Barista'),('${tablet}','Tablet'),('${finance}','Finance');
 insert into penugasan(pengguna_id,peran,outlet_id) values('${owner}','owner',null),('${finance}','finance',null),('${barista}','barista','${outlet}'),('${tablet}','tablet','${outlet}');
 insert into outlet(id,nama) values('${outlet}','Outlet uji'),('${other}','Outlet lain');
 insert into bahan(id,nama,satuan_beli,satuan_pakai,konversi,harga_beli,harga_jual_gudang) values('${bahan}','Kopi','pack','gram',10,1000,1500);
 insert into stok(outlet_id,bahan_id,jumlah) values('${outlet}','${bahan}',10);
 insert into sesi_kas(id,outlet_id) values('${sesi}','${outlet}');
 insert into kategori_biaya(id,nama,urutan,harian) values('${kategori}','Biaya Marketing',1,true);`);
  const base = readFileSync(
    new URL("../../../supabase/migrations/0028_kiriman.sql", import.meta.url),
    "utf8",
  );
  const f = base.slice(base.indexOf("create or replace function geser_stok"));
  await db.exec(f.slice(0, f.indexOf("end $$;") + 7));
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261028035708_pos_additional_so_pengeluaran.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
it("barista records physical SO, prices and movements once; retry returns same id", async () => {
  await as(barista);
  const p = so(20);
  const first = await call("simpan_opname_terukur", p);
  expect(await call("simpan_opname_terukur", p)).toBe(first);
  expect(
    (await query(`select jumlah from stok where outlet_id=$1`, [outlet]))[0]
      .jumlah,
  ).toBe("8.000");
  expect(
    (await query(`select total_nilai from opname where id=$1`, [first]))[0]
      .total_nilai,
  ).toBe(1200);
  expect(
    (
      await query(`select count(*)::int n from mutasi_stok where ref_id=$1`, [
        first,
      ])
    )[0].n,
  ).toBe(1);
});
it("partial SO includes untouched inventory in accounting snapshot", async () => {
  await as(barista);
  await db.exec(
    `insert into bahan(id,nama,satuan_beli,satuan_pakai,konversi,harga_beli,harga_jual_gudang) values('${id(90)}','Gula','pack','g',10,500,1000);insert into stok(outlet_id,bahan_id,jumlah) values('${outlet}','${id(90)}',5);`,
  );
  const oid = await call(
    "simpan_opname_terukur",
    so(91, { items: [{ bahan_id: bahan, qty_fisik: 8, qty_sistem: 8 }] }),
  );
  expect(
    (await query("select total_nilai from opname where id=$1", [oid]))[0]
      .total_nilai,
  ).toBe(1700);
});
it("rejects stale SO without changing stock", async () => {
  await as(barista);
  await expect(call("simpan_opname_terukur", so(21))).rejects.toThrow(
    "Stok berubah",
  );
});
it("rejects cross outlet, negative/invalid counts, future dates and duplicate materials", async () => {
  await as(barista);
  await expect(
    call("simpan_opname_terukur", so(22, { outlet_id: other })),
  ).rejects.toThrow("Tidak berwenang");
  for (const qty of [-1, "NaN", 1.23456])
    await expect(
      call(
        "simpan_opname_terukur",
        so(23, { items: [{ bahan_id: bahan, qty_fisik: qty, qty_sistem: 8 }] }),
      ),
    ).rejects.toThrow("tidak valid");
  await expect(
    call("simpan_opname_terukur", so(24, { tanggal: "2099-01-01" })),
  ).rejects.toThrow("Tanggal");
  await expect(
    call(
      "simpan_opname_terukur",
      so(25, {
        items: [
          { bahan_id: bahan, qty_fisik: 8, qty_sistem: 8 },
          { bahan_id: bahan, qty_fisik: 8, qty_sistem: 8 },
        ],
      }),
    ),
  ).rejects.toThrow("berulang");
});
it("tablet records expense with correct cash session once, center never reduces drawer", async () => {
  await as(tablet);
  const p = expense(30);
  const first = await call("catat_pengeluaran_pos", p);
  expect(await call("catat_pengeluaran_pos", p)).toBe(first);
  expect(
    (
      await query(`select sesi_kas_id from biaya_outlet where id=$1`, [first])
    )[0].sesi_kas_id,
  ).toBe(sesi);
  const center = await call(
    "catat_pengeluaran_pos",
    expense(31, { sumber: "pusat" }),
  );
  expect(
    (
      await query(`select sesi_kas_id from biaya_outlet where id=$1`, [center])
    )[0].sesi_kas_id,
  ).toBe(null);
  await expect(
    call("catat_pengeluaran_pos", { ...p, jumlah: 999 }),
  ).rejects.toThrow("isi berbeda");
});
it("expense validates role, amount, category and session; closed sessions are preserved", async () => {
  await as(tablet);
  await expect(
    call("catat_pengeluaran_pos", expense(32, { outlet_id: other })),
  ).rejects.toThrow("tidak berwenang");
  for (const jumlah of [0, -1, 1.5, "NaN", 1000000000001])
    await expect(
      call("catat_pengeluaran_pos", expense(33, { jumlah })),
    ).rejects.toThrow();
  await expect(
    call("catat_pengeluaran_pos", expense(34, { kategori_id: id(99) })),
  ).rejects.toThrow("kategori");
  await db.exec(`update sesi_kas set ditutup_at=now() where id='${sesi}'`);
  await expect(
    call("catat_pengeluaran_pos", expense(35, { sesi_id: sesi })),
  ).rejects.toThrow("Kas sudah ditutup");
});
it("finance may record center payments; inactive users and anonymous cannot write", async () => {
  await as(finance);
  await call("catat_pengeluaran_pos", expense(36, { sumber: "pusat" }));
  await db.exec(`update pengguna set status='nonaktif' where id='${barista}'`);
  await as(barista);
  await expect(call("simpan_opname_terukur", so(37))).rejects.toThrow(
    "Tidak berwenang",
  );
  await as("");
  await expect(call("catat_pengeluaran_pos", expense(38))).rejects.toThrow(
    "tidak berwenang",
  );
  expect(
    (
      await query(
        `select has_function_privilege('anon','public.catat_pengeluaran_pos(jsonb)','execute') v`,
      )
    )[0].v,
  ).toBe(false);
});
