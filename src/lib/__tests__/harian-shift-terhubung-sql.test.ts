import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
const db = new PGlite();
const id = (n: number) =>
  `50000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const q = async (sql: string, args: unknown[] = []) =>
  (await db.query<Record<string, any>>(sql, args)).rows; // eslint-disable-line @typescript-eslint/no-explicit-any
const as = async (role: string) =>
  db.exec(
    `reset role;set test.uid='${id(1)}';set test.peran='${role}';set role authenticated`,
  );
const file = (name: string) =>
  readFileSync(
    new URL(`../../../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  );
const correction = async (p: object) =>
  (
    await q("select koreksi_rekonsiliasi_kas($1::jsonb) v", [JSON.stringify(p)])
  )[0].v;
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema matur_internal;grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function punya_peran(text[]) returns boolean language sql stable as $$select current_setting('test.peran',true)=any($1)$$;
 create function boleh_outlet(uuid) returns boolean language sql stable set search_path=public as $$select auth.uid() is not null and ($1='${id(90)}' or punya_peran('{owner,finance}'))$$;
 create type mode_data as enum('asli','simulasi');
 create function tgl_op(timestamptz) returns date language sql immutable as $$select (($1 at time zone 'Asia/Jakarta')-interval '3 hours')::date$$;
 create function awal_op(date) returns timestamptz language sql immutable as $$select ($1+time '03:00') at time zone 'Asia/Jakarta'$$;
 create table pengguna(id uuid primary key,nama text);
 create table outlet(id uuid primary key);
 create table sesi_kas(id uuid primary key,outlet_id uuid,mode mode_data default 'asli',tanggal_shift date,dibuka_at timestamptz default now(),ditutup_at timestamptz default now(),nama_kasir text,pos_tim boolean default true,modal_laci bigint default 200000,setoran bigint,seharusnya bigint,selisih bigint,fisik_akhir bigint,kas_seharusnya bigint,pending_offline int default 0);
 create table transaksi(id uuid primary key,outlet_id uuid,mode mode_data default 'asli',status text default 'lunas',kanal text default 'langsung',nomor int default 1,created_at timestamptz default '2026-11-11T05:00:00Z',sesi_kas_id uuid,subtotal bigint default 10000,total bigint default 10000,diskon bigint default 0);
 create table pembayaran(id uuid primary key,transaksi_id uuid,metode text,nominal bigint);
 create table menu(id uuid primary key,nama text);
 create table item_transaksi(id uuid primary key,transaksi_id uuid,menu_id uuid,qty int);
 create table biaya_outlet(id uuid primary key,outlet_id uuid,mode mode_data default 'asli',tanggal date,jumlah bigint,sumber text,keterangan text,sesi_kas_id uuid,kategori_id uuid,deleted_at timestamptz,created_at timestamptz default now());
 create table belanja_bahan_outlet(biaya_id uuid);
 create table pos_kas_keluar(sesi_id uuid,jumlah bigint);
 create table log_aktivitas(id uuid default gen_random_uuid(),pengguna_id uuid,aksi text,entitas text,entitas_id text,nilai_lama jsonb,nilai_baru jsonb,waktu timestamptz default now());
 create function tempel_sesi_biaya() returns trigger language plpgsql as $$begin return new;end$$;
 create trigger tempel_sesi_biaya before insert on biaya_outlet for each row execute function tempel_sesi_biaya();
 create function matur_internal.kas_ringkas(uuid) returns jsonb language sql stable set search_path=public as $$select jsonb_build_object('tunai',(select coalesce(sum(p.nominal),0) from transaksi t join pembayaran p on p.transaksi_id=t.id where t.sesi_kas_id=s.id and t.status='lunas' and p.metode='tunai'),'laci',(select coalesce(sum(jumlah),0) from biaya_outlet where sesi_kas_id=s.id and sumber='laci' and deleted_at is null),'keluar',(select coalesce(sum(jumlah),0) from pos_kas_keluar where sesi_id=s.id),'seharusnya',s.modal_laci+(select coalesce(sum(p.nominal),0) from transaksi t join pembayaran p on p.transaksi_id=t.id where t.sesi_kas_id=s.id and t.status='lunas' and p.metode='tunai')-(select coalesce(sum(jumlah),0) from biaya_outlet where sesi_kas_id=s.id and sumber='laci' and deleted_at is null)-(select coalesce(sum(jumlah),0) from pos_kas_keluar where sesi_id=s.id)) from sesi_kas s where s.id=$1$$;
 insert into pengguna values('${id(1)}','Akunting uji');insert into outlet values('${id(90)}'),('${id(91)}');
 insert into sesi_kas(id,outlet_id,tanggal_shift,setoran,seharusnya,selisih,fisik_akhir,kas_seharusnya) values('${id(10)}','${id(90)}','2026-11-11',599000,589000,10000,799000,789000),('${id(11)}','${id(90)}','2026-11-07',1093000,1129000,-36000,1293000,1329000);
 insert into transaksi(id,outlet_id,sesi_kas_id) values('${id(20)}','${id(90)}','${id(10)}'),('${id(21)}','${id(90)}','${id(11)}');
 insert into pembayaran values('${id(30)}','${id(20)}','tunai',657000),('${id(31)}','${id(21)}','tunai',1204000);
 insert into biaya_outlet(id,outlet_id,tanggal,jumlah,sumber,sesi_kas_id,keterangan) values('${id(40)}','${id(90)}','2026-11-07',10000,'laci','${id(10)}','Zoda'),('${id(41)}','${id(90)}','2026-11-11',58000,'laci','${id(10)}','Biaya benar'),('${id(42)}','${id(90)}','2026-11-07',75000,'laci','${id(11)}','Biaya benar'),('${id(43)}','${id(90)}','2026-11-07',26000,'laci',null,'Belum terhubung');
 grant select on transaksi,pembayaran,item_transaksi,menu,sesi_kas,biaya_outlet to authenticated;
 `);
  await db.exec(file("20261106223711_rekap_harian_diskon_bersih.sql"));
  const old = file("20261105090000_akunting_perbaikan_harian.sql");
  const start = old.indexOf("create or replace function public.rincian_harian");
  await db.exec(old.slice(start, old.indexOf("$$;", start) + 3));
  const guard = file("20261030033115_accounting_aktual_belanja_titipan.sql");
  const gs = guard.indexOf(
    "create function operasional_outlet_internal.jaga_belanja()",
  );
  await db.exec(
    "create schema operasional_outlet_internal;" +
      guard.slice(gs, guard.indexOf("-- Rentang", gs)),
  );
  await db.exec(
    file("20261117073411_rekonsiliasi_kas_verifikasi_transaksi.sql"),
  );
  await db.exec(file("20261117074053_rekonsiliasi_riwayat_waktu.sql"));
  await as("finance");
}, 30000);
afterAll(() => db.close());

beforeAll(async () => {
  await db.exec(`reset role;
 alter table biaya_outlet alter column id set default gen_random_uuid();
 alter table biaya_outlet add column request_id uuid, add column dibuat_oleh uuid;
 alter table outlet add column deleted_at timestamptz,add column mode mode_data default 'asli';
 create table kategori_biaya(id uuid primary key,nama text);
 insert into kategori_biaya values('${id(99)}','Es Kristal');
 create function peran_di_outlet(uuid,text[]) returns boolean language sql stable as $$select public.boleh_outlet($1) and public.punya_peran($2)$$;
 update transaksi set created_at='2026-11-07T05:00:00Z' where id='${id(21)}';
 `);
  await db.exec(file("20261120064609_harian_shift_terhubung.sql"));
  await as("finance");
}, 30000);

it("activity date follows actual sales, not the empty overnight opening date; actual amounts unchanged", async () => {
  await db.exec(`reset role;insert into sesi_kas(id,outlet_id,tanggal_shift,dibuka_at,ditutup_at,setoran,seharusnya,selisih) values('${id(100)}','${id(90)}','2026-11-18','2026-11-18T23:47+07','2026-11-19T23:47+07',795000,795000,0);
 insert into transaksi(id,outlet_id,sesi_kas_id,created_at) values('${id(101)}','${id(90)}','${id(100)}','2026-11-19T07:06+07');
 insert into pembayaran values('${id(102)}','${id(101)}','tunai',795000);set role authenticated`);
  const sessions = (
    await q("select sesi_catatan_harian($1,'2026-11-19','2026-11-20') v", [
      id(90),
    ])
  )[0].v;
  expect(sessions.find((s: { id: string }) => s.id === id(100))).toMatchObject({
    tanggal_catatan: "2026-11-19",
    tanggal_shift: "2026-11-18",
    setoran: 795000,
  });
  const days = (await q("select rekap_harian($1,'2026-11-01') v", [id(90)]))[0]
    .v;
  expect(
    days.find((d: { tanggal: string }) => d.tanggal === "2026-11-19").setoran,
  ).toBe(795000);
  expect(
    days.find((d: { tanggal: string }) => d.tanggal === "2026-11-18").setoran,
  ).toBeNull();
});
it("unlinked daily costs appear in inspection and can attach to a prior-night shift through audited preview", async () => {
  await db.exec(
    `reset role;select set_config('matur.biaya_final','1',false);insert into biaya_outlet(id,outlet_id,tanggal,jumlah,sumber,keterangan) values('${id(103)}','${id(90)}','2026-11-19',60000,'laci','Plastik dan es batu');select set_config('matur.biaya_final','',false);set role authenticated`,
  );
  const info = (await q("select periksa_rekonsiliasi_kas($1) v", [id(100)]))[0]
    .v;
  const b = info.biaya.find((b: { id: string }) => b.id === id(103));
  expect(b).toBeTruthy();
  const p = {
    id: b.id,
    tanggal: b.tanggal,
    jumlah: b.jumlah,
    sumber: b.sumber,
    sesi_id: id(100),
    sidik_biaya: b.sidik,
  };
  const preview = await correction(p);
  expect(preview.sesudah[0]).toMatchObject({
    setoran: 795000,
    seharusnya: 735000,
    selisih: 60000,
  });
  await correction({
    ...p,
    sidik: preview.sidik,
    simpan: true,
    alasan: "Hubungkan sesuai tanggal aktivitas penjualan",
  });
  expect(
    (
      await q("select setoran,seharusnya from sesi_kas where id=$1", [id(100)])
    )[0],
  ).toEqual({ setoran: 795000, seharusnya: 735000 });
});
it("creating expense on closed matching shift is atomic/idempotent and preserves actual", async () => {
  const p = {
    outlet_id: id(90),
    kategori_id: id(99),
    jumlah: 1000,
    sumber: "laci",
    tanggal: "2026-11-19",
    sesi_id: id(100),
    request_id: id(104),
    keterangan: "Tambahan",
    alasan: "Nota susulan",
  };
  const call = async (p: object) =>
    (
      await q(
        "select operasional_outlet_internal.catat_pengeluaran_pos($1::jsonb) v",
        [JSON.stringify(p)],
      )
    )[0].v;
  // Internal function remains callable only through the existing wrapper in production.
  await db.exec(
    "reset role;grant usage on schema operasional_outlet_internal to authenticated;grant execute on function operasional_outlet_internal.catat_pengeluaran_pos(jsonb) to authenticated;set role authenticated",
  );
  const first = await call(p);
  expect(await call(p)).toBe(first);
  expect(
    (
      await q("select setoran,seharusnya from sesi_kas where id=$1", [id(100)])
    )[0],
  ).toEqual({ setoran: 795000, seharusnya: 734000 });
  await expect(call({ ...p, jumlah: 2000 })).rejects.toThrow(/berbeda/);
  await expect(
    call({ ...p, request_id: id(105), sesi_id: id(11) }),
  ).rejects.toThrow(/sesuai/);
  await expect(call({ ...p, request_id: id(106), alasan: "" })).rejects.toThrow(
    /alasan/,
  );
  await as("barista");
  await expect(call({ ...p, request_id: id(107) })).rejects.toThrow(/ditutup/);
  await as("finance");
});
it("source pusat never reduces cash; access is scoped and anonymous denied", async () => {
  const p = {
    outlet_id: id(90),
    kategori_id: id(99),
    jumlah: 507000,
    sumber: "pusat",
    tanggal: "2026-11-19",
    request_id: id(108),
    keterangan: "Pusat",
  };
  await q(
    "select operasional_outlet_internal.catat_pengeluaran_pos($1::jsonb)",
    [JSON.stringify(p)],
  );
  expect(
    (await q("select seharusnya from sesi_kas where id=$1", [id(100)]))[0]
      .seharusnya,
  ).toBe(734000);
  await as("spv");
  await expect(
    q("select sesi_catatan_harian($1,'2026-11-19','2026-11-20')", [id(91)]),
  ).rejects.toThrow(/diizinkan/);
  await db.exec("reset role;set role anon");
  await expect(
    q("select sesi_catatan_harian($1,'2026-11-19','2026-11-20')", [id(90)]),
  ).rejects.toThrow(/permission denied/);
});
it("wrong legacy expense dates remain flagged; multi-day activity is visible without duplicate settlement", async () => {
  await as("finance");
  const wrong = (
    await q("select periksa_rekonsiliasi_kas($1) v", [id(10)])
  )[0].v.biaya.find((b: { id: string }) => b.id === id(40));
  expect(wrong.tanggal_sesuai).toBe(false);
  await db.exec(`reset role;insert into sesi_kas(id,outlet_id,tanggal_shift,dibuka_at,ditutup_at,setoran) values('${id(110)}','${id(90)}','2026-10-31','2026-10-31T23:45+07','2026-11-02T01:00+07',10000);
 insert into transaksi(id,outlet_id,sesi_kas_id,created_at) values('${id(111)}','${id(90)}','${id(110)}','2026-10-31T23:50+07'),('${id(112)}','${id(90)}','${id(110)}','2026-11-01T08:00+07');set role authenticated`);
  const nov = (
    await q("select sesi_catatan_harian($1,'2026-11-01','2026-12-01') v", [
      id(90),
    ])
  )[0].v;
  expect(
    nov.find((s: { id: string }) => s.id === id(110)).tanggal_terkait,
  ).toEqual(["2026-10-31", "2026-11-01"]);
  const october = (
    await q("select rekap_harian($1,'2026-10-01') v", [id(90)])
  )[0].v;
  const november = (
    await q("select rekap_harian($1,'2026-11-01') v", [id(90)])
  )[0].v;
  expect(
    october.find((d: { tanggal: string }) => d.tanggal === "2026-10-31")
      .setoran,
  ).toBeNull();
  expect(
    november.find((d: { tanggal: string }) => d.tanggal === "2026-11-01")
      .setoran,
  ).toBe(10000);
});
it("empty reopened cash is available today; multiple matching sessions require an explicit choice", async () => {
  await as("finance");
  await db.exec(
    `reset role;insert into sesi_kas(id,outlet_id,tanggal_shift,dibuka_at,ditutup_at) values('${id(120)}','${id(90)}',current_date-1,now()-interval '1 day',null),('${id(121)}','${id(90)}',current_date-1,now()-interval '1 day',null);set role authenticated`,
  );
  expect(
    (
      await q(
        "select rekonsiliasi_internal.cocok_sesi($1,public.tgl_op(now())) v",
        [id(120)],
      )
    )[0].v,
  ).toBe(true);
  const d = (await q("select public.tgl_op(now())::text d"))[0].d;
  const p = {
    outlet_id: id(90),
    kategori_id: id(99),
    jumlah: 1000,
    sumber: "laci",
    tanggal: d,
    request_id: id(122),
    keterangan: "Hari ini",
  };
  await expect(
    q("select operasional_outlet_internal.catat_pengeluaran_pos($1::jsonb)", [
      JSON.stringify(p),
    ]),
  ).rejects.toThrow(/Pilih shift/);
  await q(
    "select operasional_outlet_internal.catat_pengeluaran_pos($1::jsonb)",
    [JSON.stringify({ ...p, sesi_id: id(120) })],
  );
  expect(
    (
      await q("select sesi_kas_id from biaya_outlet where request_id=$1", [
        id(122),
      ])
    )[0].sesi_kas_id,
  ).toBe(id(120));
});
