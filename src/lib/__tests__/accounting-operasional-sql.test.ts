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
 alter table sesi_kas add column modal_laci bigint default 200000,add column setoran bigint,add column seharusnya bigint,add column selisih bigint,add column fisik_akhir bigint,add column kas_seharusnya bigint,add column pending_offline int default 0;

 create unique index stok_lokasi on stok(mode,outlet_id,bahan_id) nulls not distinct;
 create table mutasi_stok(id uuid default gen_random_uuid(),mode mode_data,outlet_id uuid,bahan_id uuid,jumlah numeric,jenis text,ref_id uuid,keterangan text);
 create function punya_peran(peran[]) returns boolean language sql stable as $$select exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id where t.pengguna_id=auth.uid() and u.status='aktif' and t.peran=any($1))$$;
 create function gudang_pusat() returns boolean language sql stable as $$select punya_peran('{owner,admin_pusat,admin_gudang}')$$;
 create function peran_di_outlet(uuid,peran[]) returns boolean language sql stable as $$select exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id where t.pengguna_id=auth.uid() and u.status='aktif' and t.outlet_id=$1 and (t.peran=any($2) or (t.peran='tablet' and $2 && '{kasir,barista}'::peran[])))$$;
 create function boleh_outlet(uuid) returns boolean language sql stable as $$select punya_peran('{owner,admin_pusat,finance}') or peran_di_outlet($1,'{kasir,barista,spv}')$$;
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
  await db.exec(
    "alter table titipan_masuk add column jenis text default 'masuk';update kategori_biaya set nama='Bahan Baku',grup='hpp';",
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261030033115_accounting_aktual_belanja_titipan.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261030033420_accounting_belanja_delete_guard.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());

it("purchase money is recorded once; barista confirms stock separately, including shortage", async () => {
  await as(tablet);
  const p = expense(120, { items: [{ bahan_id: bahan, qty: 5 }] });
  const receipt = await call("catat_belanja_bahan", p);
  expect(await call("catat_belanja_bahan", p)).toBe(receipt);
  expect(
    (await query("select jumlah from stok where bahan_id=$1", [bahan]))[0]
      .jumlah,
  ).toBe("10.000");
  await expect(
    call("catat_belanja_bahan", { ...p, items: [{ bahan_id: bahan, qty: 6 }] }),
  ).rejects.toThrow("rincian berbeda");
  await as(barista);
  const r = {
    id: receipt,
    items: [{ bahan_id: bahan, qty: 4 }],
    catatan: "Satu rusak",
  };
  await expect(
    call("terima_belanja_bahan", { ...r, catatan: "" }),
  ).rejects.toThrow("Catat alasan");
  await call("terima_belanja_bahan", r);
  await call("terima_belanja_bahan", r);
  expect(
    (await query("select jumlah from stok where bahan_id=$1", [bahan]))[0]
      .jumlah,
  ).toBe("14.000");
  expect((await query("select count(*)::int n from biaya_outlet"))[0].n).toBe(
    1,
  );
  await expect(db.exec("update biaya_outlet set jumlah=1")).rejects.toThrow(
    "dilindungi",
  );
  await expect(db.exec("delete from biaya_outlet")).rejects.toThrow(
    "dilindungi",
  );
  await expect(
    call("terima_belanja_bahan", {
      ...r,
      items: [{ bahan_id: bahan, qty: 5 }],
    }),
  ).rejects.toThrow("hasil berbeda");
});
it("rejects invalid/duplicate purchased materials and rolls back expense", async () => {
  await as(tablet);
  for (const qty of [0, -1, "NaN", 1.1234])
    await expect(
      call(
        "catat_belanja_bahan",
        expense(121, { items: [{ bahan_id: bahan, qty }] }),
      ),
    ).rejects.toThrow("tidak valid");
  await expect(
    call(
      "catat_belanja_bahan",
      expense(122, {
        items: [
          { bahan_id: bahan, qty: 1 },
          { bahan_id: bahan, qty: 1 },
        ],
      }),
    ),
  ).rejects.toThrow("berulang");
  expect((await query("select count(*)::int n from biaya_outlet"))[0].n).toBe(
    1,
  );
});
it("accounting revises closed physical cash, net deposit and difference; optimistic concurrency + audit", async () => {
  await db.exec(
    `update sesi_kas set ditutup_at=now(),fisik_akhir=300000,kas_seharusnya=350000,setoran=100000,seharusnya=150000,selisih=-50000 where id='${sesi}'`,
  );
  const p = {
    sesi_id: sesi,
    sebelum: 300000,
    aktual: 340000,
    alasan: "Hitung ulang fisik",
  };
  await as(barista);
  await expect(call("revisi_aktual_kas", p)).rejects.toThrow(
    "Hanya Accounting",
  );
  await as(finance);
  await call("revisi_aktual_kas", p);
  expect(
    (await query("select setoran,selisih,fisik_akhir from sesi_kas"))[0],
  ).toMatchObject({ setoran: 140000, selisih: -10000, fisik_akhir: 340000 });
  expect(
    (await query("select lama,baru,nama from revisi_aktual_kas"))[0],
  ).toMatchObject({ lama: 300000, baru: 340000, nama: "Finance" });
  await expect(call("revisi_aktual_kas", p)).rejects.toThrow("sudah berubah");
  await db.exec("update sesi_kas set pending_offline=1");
  await expect(
    call("revisi_aktual_kas", { ...p, sebelum: 340000 }),
  ).rejects.toThrow("offline");
});
it("daily/weekly consignment includes opening stock and negative movements, excludes simulation", async () => {
  await as(finance);
  const m = id(150);
  await db.exec(
    `insert into menu(id,nama,titipan,harga_titip,produsen) values('${m}','Dessert',true,5000,'Produsen');insert into titipan_masuk(outlet_id,menu_id,tanggal,qty) values('${outlet}','${m}','2026-10-01',10),('${outlet}','${m}','2026-10-26',5),('${outlet}','${m}','2026-10-27',-2);insert into produk_keluar(outlet_id,tanggal,jenis,items,mode) values('${outlet}','2026-10-27','promo','[{"menu_id":"${m}","qty":3}]','asli'),('${outlet}','2026-10-27','promo','[{"menu_id":"${m}","qty":99}]','simulasi');`,
  );
  const rows = (
    await query(
      "select rekap_titipan_rentang($1,'2026-10-26','2026-11-01') v",
      [outlet],
    )
  )[0].v as Record<string, unknown>[];
  expect(rows[0]).toMatchObject({
    awal: 10,
    masuk: 5,
    keluar: 2,
    terjual: 3,
    sisa: 10,
    tagihan: 15000,
  });
  await as(barista);
  await expect(
    query("select rekap_titipan_rentang($1,'2026-10-26','2026-11-01')", [
      other,
    ]),
  ).rejects.toThrow("Tidak diizinkan");
  expect(
    (
      await query(
        "select has_function_privilege('anon','public.revisi_aktual_kas(jsonb)','execute') v",
      )
    )[0].v,
  ).toBe(false);
});
it("rejects receipt over quantity and unrelated outlet; zero received has no stock movement", async () => {
  await as(tablet);
  await db.exec(`update sesi_kas set ditutup_at=null,pending_offline=0`);
  const receipt = await call(
    "catat_belanja_bahan",
    expense(160, { items: [{ bahan_id: bahan, qty: 2 }] }),
  );
  const p = {
    id: receipt,
    items: [{ bahan_id: bahan, qty: 3 }],
    catatan: "Pengecekan",
  };
  await expect(call("terima_belanja_bahan", p)).rejects.toThrow(
    "Jumlah diterima",
  );
  await as(finance);
  await expect(call("terima_belanja_bahan", p)).rejects.toThrow(
    "petugas outlet",
  );
  await as(tablet);
  await call("terima_belanja_bahan", {
    ...p,
    items: [{ bahan_id: bahan, qty: 0 }],
    catatan: "Seluruh barang rusak",
  });
  expect(
    (
      await query("select count(*)::int n from mutasi_stok where ref_id=$1", [
        receipt,
      ])
    )[0].n,
  ).toBe(0);
});
it("consignment sale boundaries use WIB and ignore void; legacy cash revision does not deduct modal", async () => {
  await as(finance);
  const m = id(150);
  const trx = id(170);
  await db.exec(
    `insert into transaksi(id,outlet_id,sesi_kas_id,nomor,kanal,subtotal,total,created_at) values('${trx}','${outlet}','${sesi}',1,'langsung',5000,5000,'2026-10-25T17:00:00Z');insert into item_transaksi(transaksi_id,menu_id,nama,qty,harga) values('${trx}','${m}','Dessert',1,5000);`,
  );
  const rows = (
    await query(
      "select rekap_titipan_rentang($1,'2026-10-26','2026-10-26') v",
      [outlet],
    )
  )[0].v as Record<string, unknown>[];
  expect(rows[0]).toMatchObject({
    awal: 10,
    masuk: 5,
    terjual: 1,
    sisa: 14,
    tagihan: 5000,
  });
  await db.exec(
    `update transaksi set status='void' where id='${trx}';update sesi_kas set pos_tim=false,ditutup_at=now(),setoran=100000,seharusnya=120000,pending_offline=0`,
  );
  await call("revisi_aktual_kas", {
    sesi_id: sesi,
    sebelum: 100000,
    aktual: 0,
    alasan: "Setoran salah hitung",
  });
  expect(
    (await query("select setoran,selisih from sesi_kas"))[0],
  ).toMatchObject({ setoran: 0, selisih: -120000 });
});

it("unrelated expenses retain ordinary edit, soft delete and hard delete behavior", async () => {
  await as(finance);
  const bid = await call(
    "catat_pengeluaran_pos",
    expense(180, { sumber: "pusat" }),
  );
  await query(
    "update biaya_outlet set jumlah=5000,deleted_at=now() where id=$1",
    [bid],
  );
  await query("delete from biaya_outlet where id=$1", [bid]);
  expect(
    (
      await query("select count(*)::int n from biaya_outlet where id=$1", [bid])
    )[0].n,
  ).toBe(0);
});
