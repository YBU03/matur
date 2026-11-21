import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const owner = "00000000-0000-0000-0000-000000000001",
  spvA = "00000000-0000-0000-0000-000000000002",
  spvB = "00000000-0000-0000-0000-000000000003",
  mitra = "00000000-0000-0000-0000-000000000004";
const a = "10000000-0000-0000-0000-000000000001",
  b = "10000000-0000-0000-0000-000000000002",
  x = "20000000-0000-0000-0000-000000000001",
  y = "20000000-0000-0000-0000-000000000002";
const id = () => crypto.randomUUID();
const command = (p: Record<string, unknown>) =>
  db.query<{ r: { id: string; ok: string } }>(
    "select public.kelola_stok_outlet($1::jsonb) r",
    [JSON.stringify({ outlet_id: a, alasan: "Uji terukur", ...p })],
  );
const user = (u: string) =>
  db.query("select set_config('request.jwt.claim.sub',$1,false)", [u]);
const stock = async (o: string, bahan = x) =>
  Number(
    (
      await db.query<{ jumlah: string }>(
        "select jumlah from stok where outlet_id=$1 and bahan_id=$2",
        [o, bahan],
      )
    ).rows[0]?.jumlah ?? 0,
  );
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 create type mode_data as enum('asli','simulasi');
 create table pengguna(id uuid primary key,nama text,status text,peran text,outlet_id uuid);
 create table outlet(id uuid primary key,nama text,mode mode_data default 'asli',deleted_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function punya_peran(p text[]) returns boolean language sql stable as $$select exists(select 1 from public.pengguna where id=auth.uid() and peran=any(p))$$;
 create function boleh_outlet(o uuid) returns boolean language sql stable as $$select exists(select 1 from public.pengguna where id=auth.uid() and (peran in('owner','finance','hrd') or outlet_id=o))$$;
 create function peran_di_outlet(o uuid,p text[]) returns boolean language sql stable as $$select exists(select 1 from public.pengguna where id=auth.uid() and peran=any(p) and outlet_id=o)$$;
 create function catat_log() returns trigger language plpgsql as $$begin return new;end$$;
 create function tgl_op(t timestamptz) returns date language sql stable as $$select (t at time zone 'Asia/Jakarta'-interval '3 hour')::date$$;
 create function awal_op(d date) returns timestamptz language sql stable as $$select (d::timestamp+interval '3 hour') at time zone 'Asia/Jakarta'$$;
 create table bahan(id uuid primary key,nama text,mode mode_data default 'asli',deleted_at timestamptz,satuan_pakai text default 'g',satuan_beli text default 'kg',konversi numeric default 1000,harga_jual_gudang bigint default 25000,stok_min numeric default 10);
 create table stok(id uuid primary key default gen_random_uuid(),mode mode_data default 'asli',outlet_id uuid,bahan_id uuid,jumlah numeric(14,3) default 0,updated_at timestamptz default now(),unique nulls not distinct(mode,outlet_id,bahan_id));
 create table mutasi_stok(id uuid primary key default gen_random_uuid(),mode mode_data default 'asli',outlet_id uuid,bahan_id uuid,jumlah numeric,jenis text,ref_id uuid,keterangan text,dibuat_oleh uuid default auth.uid(),created_at timestamptz default now());
 create table log_aktivitas(pengguna_id uuid,aksi text,entitas text,entitas_id text,nilai_baru jsonb);
 create table kiriman(id uuid primary key default gen_random_uuid(),outlet_id uuid,tanggal date,catatan text,pengirim text,total bigint,status text default 'draft');
 create table item_kiriman(kiriman_id uuid,bahan_id uuid,nama text,satuan text,konversi numeric,qty numeric,harga bigint);
 insert into outlet(id,nama) values('${a}','Outlet A'),('${b}','Outlet B');
 insert into pengguna values('${owner}','Owner','aktif','owner',null),('${spvA}','SPV A','aktif','spv','${a}'),('${spvB}','SPV B','aktif','spv','${b}'),('${mitra}','Mitra','aktif','mitra','${a}');
 insert into bahan(id,nama) values('${x}','Kopi'),('${y}','Gula');
 insert into stok(outlet_id,bahan_id,jumlah) values('${a}','${x}',100),('${b}','${x}',20),('${a}','${y}',50);`);
  const kiriman = readFileSync("supabase/migrations/0028_kiriman.sql", "utf8");
  await db.exec(
    kiriman.slice(
      kiriman.indexOf("create or replace function geser_stok"),
      kiriman.indexOf("revoke execute on function geser_stok"),
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261121042939_kelola_stok_outlet.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261121043047_stok_outlet_akses_efisien.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261121043434_stok_outlet_kategori_mutasi.sql",
      "utf8",
    ),
  );
  await db.exec(
    "grant usage on schema public,auth,storage to authenticated;grant select on pengguna,outlet,bahan,stok to authenticated;",
  );
  await user(owner);
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("outlet thresholds are separate and inactive preserves stock/history", async () => {
  await command({
    aksi: "setelan",
    bahan_id: x,
    minimum: 25,
    aktif: false,
    request_id: id(),
  });
  expect(await stock(a)).toBe(100);
  expect(
    (
      await db.query(
        "select minimum::text,aktif from setelan_stok_outlet where outlet_id=$1",
        [a],
      )
    ).rows[0],
  ).toEqual({ minimum: "25", aktif: false });
  await expect(
    command({
      aksi: "restock",
      items: [{ bahan_id: x, jumlah: 5 }],
      request_id: id(),
    }),
  ).rejects.toThrow("Aktifkan");
  await command({
    aksi: "setelan",
    bahan_id: x,
    minimum: 25,
    aktif: true,
    request_id: id(),
  });
});
it("stock correction is guarded, idempotent and logged; changed payload cannot reuse request", async () => {
  const req = id();
  const p = {
    aksi: "koreksi",
    bahan_id: x,
    jumlah: 110,
    stok_sebelum: 100,
    request_id: req,
  };
  await command(p);
  await command(p);
  expect(await stock(a)).toBe(110);
  await expect(command({ ...p, jumlah: 120 })).rejects.toThrow("isi berbeda");
  await expect(command({ ...p, request_id: id() })).rejects.toThrow(
    "Stok berubah",
  );
  expect(
    (
      await db.query(
        "select count(*)::int n from mutasi_stok where ref_id=$1",
        [req],
      )
    ).rows[0],
  ).toEqual({ n: 1 });
});
it("waste cannot exceed stock; exact subtraction once and valid photos must belong to actor and outlet", async () => {
  await expect(
    command({
      aksi: "waste",
      bahan_id: x,
      jumlah: 111,
      stok_sebelum: 110,
      request_id: id(),
    }),
  ).rejects.toThrow("melebihi");
  await expect(
    command({
      aksi: "waste",
      bahan_id: x,
      jumlah: 1,
      stok_sebelum: 110,
      foto: `${b}/${owner}/${id()}.jpg`,
      request_id: id(),
    }),
  ).rejects.toThrow("foto");
  const req = id();
  await command({
    aksi: "waste",
    bahan_id: x,
    jumlah: 3,
    stok_sebelum: 110,
    request_id: req,
  });
  expect(await stock(a)).toBe(107);
});
it("restock uses one existing shipping draft and does not increment outlet inventory", async () => {
  const req = id();
  const items = [
    { bahan_id: x, jumlah: 2000 },
    { bahan_id: y, jumlah: 500 },
  ];
  await command({ aksi: "restock", items, request_id: req });
  const pid = id();
  const r = await command({ aksi: "proses_restock", id: req, request_id: pid });
  await command({ aksi: "proses_restock", id: req, request_id: pid });
  const k = r.rows[0].r.id;
  expect(
    (await db.query("select count(*)::int n from kiriman where id=$1", [k]))
      .rows[0],
  ).toEqual({ n: 1 });
  expect(
    (
      await db.query<{ qty: string }>(
        "select qty::text from item_kiriman where kiriman_id=$1 order by bahan_id",
        [k],
      )
    ).rows.map((r) => Number(r.qty)),
  ).toEqual([2, 0.5]);
  expect(await stock(a)).toBe(107);
});
it("transfers move both outlets only after receipt and cannot be applied twice", async () => {
  const req = id();
  await command({
    aksi: "transfer",
    tujuan: b,
    items: [{ bahan_id: x, jumlah: 7 }],
    request_id: req,
  });
  expect(await stock(a)).toBe(107);
  expect(await stock(b)).toBe(20);
  await user(spvA);
  await expect(
    command({ aksi: "terima_transfer", id: req, request_id: id() }),
  ).rejects.toThrow("outlet tujuan");
  await user(spvB);
  const receipt = id();
  await command({ aksi: "terima_transfer", id: req, request_id: receipt });
  await command({ aksi: "terima_transfer", id: req, request_id: receipt });
  expect(await stock(a)).toBe(100);
  expect(await stock(b)).toBe(27);
  await expect(
    command({ aksi: "batal_transfer", id: req, request_id: id() }),
  ).rejects.toThrow("diselesaikan");
  await user(owner);
});
it("shortage cancels the entire transfer receipt; no item partially moves", async () => {
  const req = id();
  await command({
    aksi: "transfer",
    tujuan: b,
    items: [
      { bahan_id: x, jumlah: 2 },
      { bahan_id: y, jumlah: 1000 },
    ],
    request_id: req,
  });
  await expect(
    command({ aksi: "terima_transfer", id: req, request_id: id() }),
  ).rejects.toThrow("tidak cukup");
  expect(await stock(a)).toBe(100);
  expect(await stock(b)).toBe(27);
  await command({ aksi: "batal_transfer", id: req, request_id: id() });
});
it("staff scope, finance/mitra and anonymous restrictions hold at RPC and table level", async () => {
  await user(spvA);
  await expect(
    command({
      aksi: "setelan",
      outlet_id: b,
      bahan_id: x,
      minimum: 1,
      request_id: id(),
    }),
  ).rejects.toThrow("Tidak diizinkan");
  await db.exec("set role authenticated");
  expect(
    (
      await db.query<{ outlet_id: string }>(
        "select outlet_id from setelan_stok_outlet",
      )
    ).rows.every((r) => r.outlet_id === a),
  ).toBe(true);
  await expect(
    db.query("delete from setelan_stok_outlet where outlet_id=$1", [a]),
  ).rejects.toThrow();
  await db.exec("reset role");
  await user(mitra);
  await expect(
    command({
      aksi: "koreksi",
      bahan_id: x,
      jumlah: 0,
      stok_sebelum: 100,
      request_id: id(),
    }),
  ).rejects.toThrow("Tidak diizinkan");
  await user("");
  await expect(
    command({ aksi: "setelan", bahan_id: x, minimum: 1, request_id: id() }),
  ).rejects.toThrow("login");
  await user(owner);
});
it("report balances by material/outlet, separates theoretical usage, void, waste and SO; pagination has no overlap", async () => {
  const day = (await db.query<{ d: string }>("select tgl_op(now())::text d"))
    .rows[0].d;
  await db.query("select geser_stok('asli',$1,$2,-12,'pemakaian',null,'POS')", [
    a,
    x,
  ]);
  await db.query("select geser_stok('asli',$1,$2,2,'void',null,'void')", [
    a,
    x,
  ]);
  await db.query("select geser_stok('asli',$1,$2,4,'opname',null,'SO')", [
    a,
    x,
  ]);
  const r = (
    await db.query<{
      r: {
        ringkasan: Record<string, unknown>[];
        riwayat: { id: string }[];
        lanjut: boolean;
      };
    }>("select laporan_stok_outlet($1,$2,$2) r", [a, day])
  ).rows[0].r;
  const z = r.ringkasan.find((s) => s.bahan_id === x)!;
  expect(Number(z.pakai)).toBe(12);
  expect(Number(z.kembali)).toBe(2);
  expect(Number(z.waste)).toBe(3);
  expect(Number(z.so)).toBe(4);
  const net =
    Number(z.awal) +
    Number(z.masuk) -
    Number(z.pakai) +
    Number(z.kembali) -
    Number(z.waste) -
    Number(z.marketing) +
    Number(z.so) +
    Number(z.koreksi) -
    Number(z.keluar_lain);
  expect(net).toBe(Number(z.akhir));
  expect(Number(z.akhir)).toBe(await stock(a));
  await expect(
    db.query("select laporan_stok_outlet($1,$2,$3)", [a, "2000-01-01", day]),
  ).rejects.toThrow("366");
  await user(spvA);
  await expect(
    db.query("select laporan_stok_outlet($1,$2,$2)", [b, day]),
  ).rejects.toThrow("Tidak diizinkan");
  await user(owner);
});
it("new outlets appear automatically, inactive accounts cannot manage, and settings audit is readable", async () => {
  const c = "10000000-0000-0000-0000-000000000003";
  await db.query("insert into outlet(id,nama) values($1,'Outlet Baru')", [c]);
  expect(
    (
      await db.query<{ r: { id: string }[] }>("select tujuan_stok_outlet() r")
    ).rows[0].r.some((o) => o.id === c),
  ).toBe(true);
  await command({
    aksi: "setelan",
    outlet_id: c,
    bahan_id: x,
    minimum: 3,
    request_id: id(),
  });
  await db.query("update pengguna set status='nonaktif' where id=$1", [spvA]);
  await user(spvA);
  await expect(
    command({ aksi: "setelan", bahan_id: x, minimum: 2, request_id: id() }),
  ).rejects.toThrow("login");
  await user(owner);
  await db.query("update pengguna set status='aktif' where id=$1", [spvA]);
  const day = (await db.query<{ d: string }>("select tgl_op(now())::text d"))
    .rows[0].d;
  const r = (
    await db.query<{ r: { setelan: { minimum: number }[] } }>(
      "select laporan_stok_outlet($1,$2,$2) r",
      [c, day],
    )
  ).rows[0].r;
  expect(r.setelan[0].minimum).toBe(3);
});
it("keyset history pagination returns every record exactly once and freezes newer events for export", async () => {
  await db.query(
    "insert into mutasi_stok(outlet_id,bahan_id,jumlah,jenis,keterangan) select $1,$2,0,'koreksi','Uji halaman' from generate_series(1,505)",
    [a, y],
  );
  const day = (await db.query<{ d: string }>("select tgl_op(now())::text d"))
    .rows[0].d;
  type Page = {
    riwayat: { id: string; created_at: string }[];
    dibaca_at: string;
    lanjut: boolean;
  };
  const first = (
    await db.query<{ r: Page }>("select laporan_stok_outlet($1,$2,$2,$3) r", [
      a,
      day,
      y,
    ])
  ).rows[0].r;
  expect(first.lanjut).toBe(true);
  expect(first.riwayat.length).toBe(500);
  const last = first.riwayat.at(-1)!;
  const next = (
    await db.query<{ r: Page }>(
      "select laporan_stok_outlet($1,$2,$2,$3,$4,$5,$6) r",
      [a, day, y, last.created_at, last.id, first.dibaca_at],
    )
  ).rows[0].r;
  expect(next.lanjut).toBe(false);
  expect(next.riwayat.length).toBe(5);
  expect(
    new Set([...first.riwayat, ...next.riwayat].map((r) => r.id)).size,
  ).toBe(505);
  await db.query(
    "insert into mutasi_stok(outlet_id,bahan_id,jumlah,jenis,created_at) values($1,$2,0,'koreksi',now()+interval '1 second')",
    [a, y],
  );
  const frozen = (
    await db.query<{ r: Page }>(
      "select laporan_stok_outlet($1,$2,$2,$3,$4,$5,$6) r",
      [a, day, y, last.created_at, last.id, first.dibaca_at],
    )
  ).rows[0].r;
  expect(frozen.riwayat.map((r) => r.id)).toEqual(
    next.riwayat.map((r) => r.id),
  );
});

it("opposite-sign historical reversals stay in a single category without double counting", async () => {
  const day = (await db.query<{ d: string }>("select tgl_op(now())::text d"))
    .rows[0].d;
  for (const [jenis, jumlah] of [
    ["pemakaian", 3],
    ["waste", 1],
    ["marketing", 2],
    ["void", -1],
  ] as const)
    await db.query(
      "select geser_stok('asli',$1,$2,$3,$4,null,'Pembalikan lama')",
      [b, x, jumlah, jenis],
    );
  const r = (
    await db.query<{ r: { ringkasan: Record<string, unknown>[] } }>(
      "select laporan_stok_outlet($1,$2,$2,$3) r",
      [b, day, x],
    )
  ).rows[0].r.ringkasan[0];
  expect(Number(r.masuk)).toBe(7);
  expect(Number(r.keluar_lain)).toBe(0);
  expect(
    Number(r.awal) +
      Number(r.masuk) -
      Number(r.pakai) +
      Number(r.kembali) -
      Number(r.waste) -
      Number(r.marketing) +
      Number(r.so) +
      Number(r.koreksi) -
      Number(r.keluar_lain),
  ).toBe(Number(r.akhir));
});
