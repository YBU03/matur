import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { ringkasGudang, type GudangLaporan } from "../gudang-laporan";
const db = new PGlite();
const id = (n: number) =>
  `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  staff = id(2),
  b = id(3),
  b2 = id(4),
  o = id(5);
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
  (await db.query<T>(sql, p)).rows;
const call = async <T = Record<string, unknown>>(fn: string, args: unknown[]) =>
  (
    await q<{ v: T }>(
      `select ${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) v`,
      args,
    )
  )[0].v;
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select current_setting('test.uid')::uuid$$;`,
  );
  await db.exec(
    readFileSync(
      new URL("./fixtures/operasional-baseline.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(`create function punya_peran(peran[]) returns boolean language sql stable as $$select exists(select 1 from penugasan where pengguna_id=auth.uid() and peran=any($1))$$;create function gudang_pusat() returns boolean language sql stable as $$select punya_peran('{owner,admin_pusat,admin_gudang}')$$;
 create table mutasi_stok(id uuid primary key default gen_random_uuid(),mode mode_data default 'asli',outlet_id uuid,bahan_id uuid,jumlah numeric,jenis text,ref_id uuid,keterangan text,dibuat_oleh uuid default auth.uid(),created_at timestamptz default now());
 create table penerimaan_kiriman(id uuid primary key default gen_random_uuid(),kiriman_id uuid,waktu timestamptz default now(),items jsonb);
 insert into pengguna(id,nama) values('${owner}','Owner uji'),('${staff}','Barista uji');insert into penugasan(pengguna_id,peran) values('${owner}','owner'),('${staff}','barista');
 insert into outlet(id,nama,kepemilikan) values('${o}','Outlet uji','Pusat');insert into bahan(id,nama,satuan_beli,satuan_pakai,konversi,harga_beli,harga_pokok,harga_jual_gudang) values('${b}','Kopi','pack','g',10,1000,100,1500),('${b2}','Gula','pack','g',10,500,50,800);
 insert into stok(bahan_id,jumlah) values('${b}',100),('${b2}',100);set test.uid='${owner}';`);
  const base = readFileSync(
    new URL("../../../supabase/migrations/0028_kiriman.sql", import.meta.url),
    "utf8",
  );
  for (const name of ["geser_stok", "kirim_kiriman"]) {
    const s = base.slice(base.indexOf("create or replace function " + name));
    await db.exec(s.slice(0, s.indexOf("end $$;") + 7));
  }
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261027050833_gudang_harga_opname_laba_dokumen.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261027051746_gudang_hpp_privat.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `alter table kiriman add column pemeriksaan_status text not null default 'belum';create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261027075325_gudang_pengaturan_dokumen_penyesuaian.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261027120000_gudang_judul_ttd.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
it("edits sale prices with stale-write protection and prevents staff access", async () => {
  await call("atur_harga_jual_gudang", [b, 1600, 1500]);
  await expect(call("atur_harga_jual_gudang", [b, 1700, 1500])).rejects.toThrow(
    /berubah/,
  );
  await q("select set_config('test.uid',$1,false)", [staff]);
  await expect(call("atur_harga_jual_gudang", [b, 1700, 1600])).rejects.toThrow(
    /Hanya admin/,
  );
  await q("select set_config('test.uid',$1,false)", [owner]);
});
it("freezes shipment HPP at dispatch and counts only accepted receipts without repricing history", async () => {
  const [k] = await q<{ id: string }>(
    "insert into kiriman(outlet_id) values($1) returning id",
    [o],
  );
  const [i] = await q<{ id: string }>(
    "insert into item_kiriman(kiriman_id,bahan_id,nama,konversi,qty,harga) values($1,$2,'Kopi',10,2,1600) returning id",
    [k.id, b],
  );
  await call("atur_pemeriksa_kiriman", [k.id, "Pemeriksa Uji"]);
  await call("kirim_kiriman", [k.id]);
  expect(
    Number(
      (
        await q(
          "select jumlah from stok where bahan_id=$1 and outlet_id is null",
          [b],
        )
      )[0].jumlah,
    ),
  ).toBe(80);
  expect(
    Number(
      (
        await q(
          "select hpp as hpp_gudang from gudang_internal.hpp_kiriman where item_id=$1",
          [i.id],
        )
      )[0].hpp_gudang,
    ),
  ).toBe(1000);
  await q(
    "update bahan set harga_pokok=200,harga_jual_gudang=3000 where id=$1",
    [b],
  );
  await q("insert into penerimaan_kiriman(kiriman_id,items) values($1,$2)", [
    k.id,
    JSON.stringify([{ id: i.id, baik: 1, rusak: 0, salah: 0 }]),
  ]);
  const d = await call<GudangLaporan>("laporan_laba_gudang", [
    "2000-01-01",
    "2000-01-02",
    null,
    null,
  ]);
  expect(d.rows).toHaveLength(0);
  const today = (
    await q<{ v: string }>(
      "select (now() at time zone 'Asia/Jakarta')::date::text v",
    )
  )[0].v;
  const data = await call<GudangLaporan>("laporan_laba_gudang", [
    today,
    today,
    null,
    null,
  ]);
  const r = ringkasGudang(data);
  expect(r.penjualan).toBe(1600);
  expect(r.hpp).toBe(1000);
  expect(r.labaKotor).toBe(600);
  expect(r.pusat).toBe(1600);
  await expect(
    call("atur_pemeriksa_kiriman", [k.id, "Ubah setelah kirim"]),
  ).rejects.toThrow(/sebelum/);
});
it("draft opname skips blanks, rejects movements after snapshot and finalizes once with an audited delta", async () => {
  const today = (await q<{ v: string }>("select current_date::text v"))[0].v;
  const req = crypto.randomUUID();
  const oid = await call<string>("proses_opname_gudang", [
    { aksi: "buat", request_id: req, tanggal: today },
  ]);
  expect(
    await call("proses_opname_gudang", [
      { aksi: "buat", request_id: req, tanggal: today },
    ]),
  ).toBe(oid);
  await call("proses_opname_gudang", [
    {
      aksi: "simpan",
      id: oid,
      versi: 0,
      items: [{ bahan_id: b, fisik: 78, alasan: "Hitungan fisik kurang" }],
    },
  ]);
  await db.exec("set role authenticated");
  await call("proses_opname_gudang", [{ aksi: "final", id: oid, versi: 1 }]);
  await call("proses_opname_gudang", [{ aksi: "final", id: oid, versi: 1 }]);
  await db.exec("reset role");
  expect(
    Number(
      (
        await q(
          "select jumlah from stok where bahan_id=$1 and outlet_id is null",
          [b],
        )
      )[0].jumlah,
    ),
  ).toBe(78);
  expect(
    Number(
      (
        await q(
          "select jumlah from stok where bahan_id=$1 and outlet_id is null",
          [b2],
        )
      )[0].jumlah,
    ),
  ).toBe(100);
  expect(
    await q("select * from mutasi_stok where ref_id=$1", [oid]),
  ).toHaveLength(1);
  const next = await call<string>("proses_opname_gudang", [
    { aksi: "buat", request_id: crypto.randomUUID(), tanggal: today },
  ]);
  await call("proses_opname_gudang", [
    {
      aksi: "simpan",
      id: next,
      versi: 0,
      items: [{ bahan_id: b, fisik: 75, alasan: "Selisih fisik" }],
    },
  ]);
  await q("select geser_stok('asli',null,$1,1,'pembelian',null,'uji')", [b]);
  await expect(
    call("proses_opname_gudang", [{ aksi: "final", id: next, versi: 1 }]),
  ).rejects.toThrow(/bergerak/);
  expect(
    (await q("select status from opname_gudang where id=$1", [next]))[0].status,
  ).toBe("draft");
});
it("separates warehouse costs from stock purchases and denies cashier/anonymous writes", async () => {
  const today = (await q<{ v: string }>("select current_date::text v"))[0].v;
  const p = {
    request_id: crypto.randomUUID(),
    tanggal: today,
    jumlah: 100,
    keterangan: "Ongkos kirim uji",
  };
  const bid = await call("proses_biaya_gudang", [p]);
  expect(await call("proses_biaya_gudang", [p])).toBe(bid);
  const d = await call<GudangLaporan>("laporan_laba_gudang", [
    today,
    today,
    null,
    null,
  ]);
  expect(ringkasGudang(d).biaya).toBe(100);
  expect(ringkasGudang(d).penyesuaian).toBe(-400);
  await call("proses_biaya_gudang", [
    { aksi: "batal", id: bid, alasan: "Biaya ganda" },
  ]);
  expect(
    (
      await call<GudangLaporan>("laporan_laba_gudang", [
        today,
        today,
        null,
        null,
      ])
    ).biaya,
  ).toHaveLength(0);
  await q("select set_config('test.uid',$1,false)", [staff]);
  await expect(
    call("proses_opname_gudang", [
      { aksi: "buat", request_id: crypto.randomUUID(), tanggal: today },
    ]),
  ).rejects.toThrow(/Hanya admin/);
  await expect(
    call("laporan_laba_gudang", [today, today, null, null]),
  ).rejects.toThrow(/berwenang/);
  await q("select set_config('test.uid',$1,false)", [owner]);
  expect(
    (
      await q(
        "select has_function_privilege('anon','public.proses_opname_gudang(jsonb)','execute') ok",
      )
    )[0].ok,
  ).toBe(false);
});

it("keeps shipment cost snapshots private from outlet accounts", async () => {
  expect(
    (
      await q<{ v: boolean }>(
        "select has_table_privilege('authenticated','gudang_internal.hpp_kiriman','SELECT') v",
      )
    )[0].v,
  ).toBe(false);
  expect(
    await q(
      "select column_name from information_schema.columns where table_schema='public' and table_name='item_kiriman' and column_name='hpp_gudang'",
    ),
  ).toHaveLength(0);
});

it("protects shared document settings and rejects stale edits and unknown logos", async () => {
  await q("select set_config('test.uid',$1,false)", [owner]);
  await expect(
    call("atur_dokumen_gudang", [
      "Alamat perusahaan yang valid",
      "logo/00000000-0000-0000-0000-000000000000.png",
      0,
    ]),
  ).rejects.toThrow(/Logo/);
  await call("atur_dokumen_gudang", [
    "Jl. Raya Pengalusan No.6, Pengalusan, Purbalingga",
    null,
    0,
  ]);
  await expect(
    call("atur_dokumen_gudang", ["Alamat perusahaan lainnya", null, 0]),
  ).rejects.toThrow(/berubah/);
  await q("select set_config('test.uid',$1,false)", [staff]);
  await expect(
    call("atur_dokumen_gudang", ["Alamat tidak sah", null, 1]),
  ).rejects.toThrow(/Hanya admin/);
  await q("set role authenticated");
  await expect(
    q("update pengaturan_dokumen_gudang set alamat='Tidak sah'"),
  ).rejects.toThrow(/permission denied/);
  await q("reset role");
  await q("select set_config('test.uid',$1,false)", [owner]);
});
it("saves custom signature box titles atomically with the document settings", async () => {
  const [g] = await q<{ versi: number; judul_ttd: string[] }>(
    "select versi,judul_ttd from pengaturan_dokumen_gudang",
  );
  expect(g.judul_ttd).toEqual(["Dibuat oleh", "Diperiksa oleh", "Dikirim oleh", "Diterima oleh"]);
  await expect(
    call("atur_dokumen_gudang_ttd", ["Alamat perusahaan yang valid", null, g.versi, ["a", "b", "c"]]),
  ).rejects.toThrow(/4 isian/);
  await expect(
    call("atur_dokumen_gudang_ttd", ["Alamat perusahaan yang valid", null, g.versi, ["x".repeat(41), "", "", ""]]),
  ).rejects.toThrow(/40 karakter/);
  await call("atur_dokumen_gudang_ttd", ["Alamat perusahaan yang valid", null, g.versi, [" Hormat kami ", "", "Mengetahui", "Penerima"]]);
  const [h] = await q<{ versi: number; judul_ttd: string[]; alamat: string }>(
    "select versi,judul_ttd,alamat from pengaturan_dokumen_gudang",
  );
  expect(h).toEqual({ versi: g.versi + 1, judul_ttd: ["Hormat kami", "", "Mengetahui", "Penerima"], alamat: "Alamat perusahaan yang valid" });
  await expect(
    call("atur_dokumen_gudang_ttd", ["Alamat perusahaan yang valid", null, g.versi, ["a", "b", "c", "d"]]),
  ).rejects.toThrow(/berubah/);
  await q("select set_config('test.uid',$1,false)", [staff]);
  await expect(
    call("atur_dokumen_gudang_ttd", ["Alamat perusahaan yang valid", null, h.versi, ["a", "b", "c", "d"]]),
  ).rejects.toThrow(/Hanya admin/);
  await q("select set_config('test.uid',$1,false)", [owner]);
});

it("saves signed invoice adjustments once, audits corrections and adds them once to reports", async () => {
  const [k] = await q<{ id: string }>(
    "insert into kiriman(outlet_id) values($1) returning id",
    [o],
  );
  await expect(
    call("atur_penyesuaian_invoice", [k.id, 100, "Pembulatan", 0]),
  ).rejects.toThrow(/pemeriksaan/);
  await q(
    "insert into item_kiriman(kiriman_id,bahan_id,nama,konversi,qty,harga,qty_diterima) values($1,$2,'Kopi',10,2,1600,2)",
    [k.id, b],
  );
  await q(
    "update kiriman set status='diterima',pemeriksaan_status='selesai',diterima_at=now() where id=$1",
    [k.id],
  );
  await expect(
    call("atur_penyesuaian_invoice", [k.id, -3201, "Potongan", 0]),
  ).rejects.toThrow(/negatif/);
  await expect(
    call("atur_penyesuaian_invoice", [k.id, 100, "", 0]),
  ).rejects.toThrow(/valid/);
  await call("atur_penyesuaian_invoice", [k.id, -200, "Potongan", 0]);
  await expect(
    call("atur_penyesuaian_invoice", [k.id, -200, "Potongan", 0]),
  ).rejects.toThrow(/berubah/);
  await call("atur_penyesuaian_invoice", [k.id, 100, "Pembulatan", 1]);
  const today = (
    await q<{ v: string }>(
      "select (now() at time zone 'Asia/Jakarta')::date::text v",
    )
  )[0].v;
  const d = await call<GudangLaporan>("laporan_laba_gudang", [
    today,
    today,
    o,
    null,
  ]);
  expect(d.invoice?.filter((x) => x.id === k.id)).toHaveLength(1);
  expect(Number(d.invoice?.find((x) => x.id === k.id)?.nilai)).toBe(100);
  expect(
    (await call<GudangLaporan>("laporan_laba_gudang", [today, today, o, b]))
      .invoice,
  ).toEqual([]);
  await q("select set_config('test.uid',$1,false)", [staff]);
  await expect(
    call("atur_penyesuaian_invoice", [k.id, 500, "Tidak berwenang", 2]),
  ).rejects.toThrow(/Hanya admin/);
  await q("select set_config('test.uid',$1,false)", [owner]);
});
