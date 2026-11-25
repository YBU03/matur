import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const id = (n: number) =>
  `71000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [
  owner,
  cash,
  spv,
  finance,
  o,
  other,
  menu,
  variant,
  sesi,
  permit,
  device,
] = Array.from({ length: 11 }, (_, i) => id(i + 1));
const marketing = id(20),
  guest = id(21),
  staff = id(22),
  admin = id(23),
  candidate = id(24);
const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
  (await db.query<T>(sql, p)).rows;
const as = async (uid: string) => {
  await db.exec("reset role");
  await q("select set_config('test.uid',$1,false)", [uid]);
  await db.exec("set role authenticated");
};
const rpc = async (fn: string) =>
  (await q<{ v: Record<string, unknown> }>(`select ${fn}() v`))[0].v;
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;create schema matur_internal;create schema pos_kas_internal;create schema storage;
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:1]$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function extensions.digest(text,text) returns bytea language sql immutable as $$select decode(md5($1),'hex')$$;
 set check_function_bodies=off;`);
  await db.exec(src("./fixtures/pos-team-baseline.sql"));
  await db.exec(`set check_function_bodies=on;
 create table matur_internal.pos_izin(id uuid primary key,sesi_id uuid,perangkat_id uuid,token_hash text,katalog jsonb,ditarik_at timestamptz,sampai_at timestamptz default now()+interval '24 hours');
 create function pos_kas_internal.perangkat_langsung(uuid,text) returns uuid language sql as $$select case when $1='${o}'::uuid and $2='device' and auth.uid()='${cash}'::uuid then '${device}'::uuid end$$;
 create function public.tgl_op(timestamptz) returns date language sql immutable as $$select ($1 at time zone 'Asia/Jakarta'-interval '3 hours')::date$$;
 create function public.awal_op(date) returns timestamptz language sql immutable as $$select ($1+time '03:00') at time zone 'Asia/Jakarta'$$;
 alter table sesi_kas add column rekap_status text;
 alter table transaksi drop constraint transaksi_status_check;
 insert into outlet(id,nama) values('${o}','Outlet A'),('${other}','Outlet B');
 insert into pengguna(id,nama,email) values('${owner}','Owner','owner@test'),('${cash}','Cash','cash@test'),('${spv}','SPV','spv@test'),('${finance}','Finance','finance@test');
 insert into penugasan(pengguna_id,peran,outlet_id) values('${owner}','owner',null),('${cash}','kasir','${o}'),('${spv}','spv','${o}'),('${finance}','finance',null);
 insert into menu(id,nama,harga_langsung,harga_ojol) values('${menu}','Kopi',10000,12000);
 insert into varian(id,menu_id,grup,nama,tambahan_harga) values('${variant}','${menu}','Extra','Susu',2000);
 insert into sesi_kas(id,outlet_id,kasir_id) values('${sesi}','${o}','${cash}');
 insert into matur_internal.pos_izin(id,sesi_id,perangkat_id,token_hash,katalog) values('${permit}','${sesi}','${device}',encode(extensions.digest('token','sha256'),'hex'),'{"menu":{"${menu}":{"langsung":10000,"ojol":12000}},"varian":{"${variant}":2000}}');
 insert into perusahaan(nama,batas_diskon_persen) values('Ruma Uji',10);`);
  await db.exec(
    src(
      "../../../supabase/migrations/20261110035014_pos_extra_shot_rekap.sql",
    ).split("do $patch$")[0],
  );
  await db.exec(src("./fixtures/promo-checkout-baseline.sql"));
  await db.exec(
    src("../../../supabase/migrations/20261118033002_promo_diskon_pos.sql"),
  );
  await db.exec(
    src("../../../supabase/migrations/20261118040314_promo_subsidi_kantor.sql"),
  );
  await db.exec(
    src(
      "../../../supabase/migrations/20261118064829_voucher_per_transaksi.sql",
    ),
  );
  await db.exec(
    src(
      "../../../supabase/migrations/20261118142331_promo_slot_hari_kuota.sql",
    ),
  );
  await db.exec(
    src("../../../supabase/migrations/20261118234109_promo_mitra.sql"),
  );
  await db.exec(
    src("../../../supabase/migrations/20261120224147_promo_kuota_sebagian.sql"),
  );

  await db.exec(
    `alter type peran add value if not exists 'pemantau_pos';alter type peran add value if not exists 'tablet';`,
  );
  await db.exec(`alter table menu add column kemasan text;alter table outlet add column tampil_dashboard_pos boolean default true;
 create table if not exists barang_titipan(id uuid primary key);create table if not exists isi_titipan(id uuid primary key);create table if not exists produsen_titipan(id uuid primary key);
 insert into pengguna(id,nama,email) values('${marketing}','Marketing','mk@test'),('${guest}','Guest','guest@test'),('${staff}','Petugas','staff@test'),('${admin}','Admin','admin@test'),('${candidate}','Candidate','candidate@test');
 insert into penugasan(pengguna_id,peran,outlet_id) values('${guest}','pemantau_pos','${o}'),('${admin}','admin_pusat',null);
 alter table jadwal_shift enable row level security;alter table karyawan enable row level security;alter table transaksi enable row level security;alter table laporan_bulanan enable row level security;alter table penugasan enable row level security;
 create policy own on penugasan for select using(pengguna_id=auth.uid() or punya_peran('{owner,admin_pusat}'));
 create policy manage on penugasan for all using(punya_peran('{owner}')) with check(punya_peran('{owner}'));
 grant select,insert,delete on penugasan to authenticated;
 grant select on jadwal_shift,karyawan,transaksi,laporan_bulanan to authenticated;
 grant usage on schema auth to authenticated;
 `);
  await db.exec(src("../../../supabase/migrations/0067_pantau_pos.sql"));
  await db.exec(src("./fixtures/marketing-account-baseline.sql"));
  await db.exec(src("./fixtures/marketing-permissions-baseline.sql"));
  for (const tab of [
    "menu",
    "bahan",
    "resep",
    "barang_titipan",
    "isi_titipan",
    "produsen_titipan",
    "supplier",
  ])
    await db.exec(
      `alter table ${tab} enable row level security;create policy baseline_read on ${tab} for select using(true);grant select on ${tab} to authenticated;`,
    );
  await db.exec(
    src("../../../supabase/migrations/20261125044137_marketing_role.sql"),
  );
  await db.exec(
    src("../../../supabase/migrations/20261125044143_marketing_akses.sql"),
  );
  await db.exec(
    src(
      "../../../supabase/migrations/20261125044325_marketing_rpc_invoker.sql",
    ),
  );
  await db.exec(`insert into penugasan(pengguna_id,peran,outlet_id) values('${marketing}','marketing',null);
 insert into shift_outlet(id,outlet_id,nama,jam_mulai,jam_selesai) values('${id(30)}','${o}','Malam','18:00','01:00'),('${id(31)}','${other}','Pagi','08:00','16:00');
 insert into jadwal_shift(id,outlet_id,shift_id,pengguna_id,tanggal,status) values('${id(32)}','${o}','${id(30)}','${staff}',(now() at time zone 'Asia/Jakarta')::date,'terbit'),('${id(33)}','${other}','${id(31)}','${staff}',(now() at time zone 'Asia/Jakarta')::date,'draft'),('${id(34)}','${other}','${id(31)}','${staff}',(now() at time zone 'Asia/Jakarta')::date-1,'terbit');
 insert into karyawan(pengguna_id,outlet_id,nama,jabatan) values('${staff}','${o}','Petugas','Barista');`);
}, 30000);
afterAll(() => db.close());
it("marketing sees all outlets through narrow RPCs, guest remains scoped", async () => {
  await as(marketing);
  expect((await rpc("pantau_pos_periode")).outlet).toHaveLength(2);
  const c = await rpc("katalog_promo_marketing");
  expect(c.outlets).toHaveLength(2);
  expect(c.menus).toHaveLength(1);
  expect(JSON.stringify(c)).not.toMatch(
    /hpp|harga_titip|harga_pokok|rekening|pin_hash/,
  );
  await as(guest);
  expect((await rpc("pantau_pos_periode")).outlet).toHaveLength(1);
  await expect(rpc("katalog_promo_marketing")).rejects.toThrow(/Hanya/);
});
it("only published shifts for today return names, role and hours, never raw staff data", async () => {
  await as(marketing);
  const d = await rpc("jadwal_marketing_hari_ini");
  expect(d.jadwal).toHaveLength(1);
  expect(d.jadwal).toMatchObject([
    { nama: "Petugas", jabatan: "Barista", jam_selesai: "01:00:00" },
  ]);
  expect(JSON.stringify(d)).not.toMatch(
    /email|staff@test|rekening|pin_hash|gaji/,
  );
  for (const tab of [
    "jadwal_shift",
    "karyawan",
    "transaksi",
    "laporan_bulanan",
  ])
    expect(await q(`select * from ${tab}`)).toHaveLength(0);
});
it("does not expose raw menu costs/recipes to marketing, preserves existing owner access", async () => {
  await as(marketing);
  for (const tab of ["menu", "bahan", "resep"])
    expect(await q(`select * from ${tab}`)).toHaveLength(0);
  expect((await q("select boleh_outlet($1) ok", [o]))[0].ok).toBe(false);
  await as(owner);
  expect(await q("select * from menu")).toHaveLength(1);
});
it("marketing manages global promos with version guards while guest cannot", async () => {
  await as(marketing);
  const p = {
    nama: "Marketing Test",
    aktif: false,
    mulai: "2026-01-01",
    selesai: "2030-12-31",
    jam_mulai: "00:00",
    jam_selesai: "23:59:59",
    semua_outlet: true,
    outlet_ids: [],
    aturan: [{ menu_id: menu, varian_ids: [], jenis: "persen", nilai: 10 }],
    kuota: 30,
    per_menu: false,
    bersama: false,
    boleh_manual: false,
  };
  const saved = (
    await q<{ v: string }>("select simpan_promo($1::jsonb) v", [
      JSON.stringify(p),
    ])
  )[0].v;
  expect(
    (await q<{ v: unknown[] }>("select daftar_promo(null,true) v"))[0].v,
  ).toHaveLength(1);
  await expect(
    q("select simpan_promo($1::jsonb)", [
      JSON.stringify({ ...p, id: saved, versi: 0 }),
    ]),
  ).rejects.toThrow(/diubah/);
  expect(
    (await q("select laporan_promo(null,current_date,current_date) v"))[0].v,
  ).toEqual([]);
  await as(guest);
  await expect(
    q("select simpan_promo($1::jsonb)", [JSON.stringify(p)]),
  ).rejects.toThrow();
});
it("inactive marketing accounts cannot read or manage", async () => {
  await db.exec("reset role");
  await q("update pengguna set status='nonaktif' where id=$1", [marketing]);
  await as(marketing);
  await expect(rpc("jadwal_marketing_hari_ini")).rejects.toThrow(/Hanya/);
  await expect(rpc("katalog_promo_marketing")).rejects.toThrow(/Hanya/);
  await expect(q("select daftar_promo(null,true)")).rejects.toThrow(
    /Tidak diizinkan/,
  );
  await db.exec("reset role");
  await q("update pengguna set status='aktif' where id=$1", [marketing]);
});
it("only Owner/Admin can grant marketing; role is global; guest cannot self-escalate", async () => {
  await as(guest);
  await expect(
    q("insert into penugasan(pengguna_id,peran) values($1,'marketing')", [
      guest,
    ]),
  ).rejects.toThrow(/row-level/);
  await as(admin);
  await q("insert into penugasan(pengguna_id,peran) values($1,'marketing')", [
    candidate,
  ]);
  expect(
    (
      await q("select peran from penugasan where pengguna_id=$1", [candidate])
    )[0].peran,
  ).toBe("marketing");
  await expect(
    q("insert into penugasan(pengguna_id,peran) values($1,'marketing')", [
      admin,
    ]),
  ).rejects.toThrow(/row-level/);
  await expect(
    q("insert into penugasan(pengguna_id,peran) values($1,'marketing')", [
      owner,
    ]),
  ).rejects.toThrow(/row-level/);
  await as(owner);
  await expect(
    q(
      "insert into penugasan(pengguna_id,peran,outlet_id) values($1,'marketing',$2)",
      [candidate, o],
    ),
  ).rejects.toThrow(/marketing_semua_outlet/);
});
it("guest and anonymous cannot call the published schedule endpoint", async () => {
  await as(guest);
  await expect(rpc("jadwal_marketing_hari_ini")).rejects.toThrow(/Hanya/);
  await db.exec("reset role;set role anon");
  await expect(rpc("jadwal_marketing_hari_ini")).rejects.toThrow(/permission/);
});
