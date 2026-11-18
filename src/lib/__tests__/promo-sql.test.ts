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
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
  (await db.query<T>(sql, p)).rows;
const as = async (uid: string) => {
  await q("select set_config('test.uid',$1,false)", [uid]);
};
const call = async <T = Record<string, unknown>>(fn: string, p: unknown) =>
  (await q<{ v: T }>(`select ${fn}($1::jsonb) v`, [JSON.stringify(p)]))[0].v;
const src = (name: string) =>
  readFileSync(new URL(name, import.meta.url), "utf8");
const config = (extra: Record<string, unknown> = {}) => ({
  nama: "Promo Uji",
  aktif: true,
  mulai: "2026-01-01",
  selesai: "2030-12-31",
  jam_mulai: "00:00",
  jam_selesai: "23:59:59",
  semua_outlet: false,
  outlet_ids: [o],
  aturan: [
    { menu_id: menu, varian_ids: [], jenis: "harga_akhir", nilai: 6000 },
  ],
  kuota: 3,
  per_menu: false,
  bersama: false,
  boleh_manual: false,
  ...extra,
});
const basket = (promo: string, extra: Record<string, unknown> = {}) => ({
  request_id: crypto.randomUUID(),
  promo_id: promo,
  outlet_id: o,
  sesi_id: sesi,
  izin_id: permit,
  device_token: "device",
  pos_token: "token",
  kanal: "langsung",
  diskon: 0,
  items: [{ menu_id: menu, varian_ids: [], qty: 1 }],
  ...extra,
});
const sale = (
  b: Record<string, unknown>,
  quote: string,
  extra: Record<string, unknown> = {},
) => ({
  ...b,
  client_id: crypto.randomUUID(),
  promo_quote: quote,
  metode: "tunai",
  ...extra,
});
let promo: string;
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;create schema matur_internal;create schema pos_kas_internal;
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
  await as(owner);
  promo = await call<string>("simpan_promo", config());
}, 30000);
afterAll(() => db.close());
it("permissions, optimistic edits, private tables and invoker wrapper", async () => {
  await as(cash);
  await expect(call("simpan_promo", config())).rejects.toThrow(/SPV/);
  await as(spv);
  await expect(
    call("simpan_promo", config({ outlet_ids: [other] })),
  ).rejects.toThrow(/SPV/);
  await expect(
    call("simpan_promo", config({ semua_outlet: true })),
  ).rejects.toThrow(/SPV/);
  await as(owner);
  await expect(
    call("simpan_promo", config({ id: promo, versi: 0 })),
  ).rejects.toThrow(/diubah/);
  const [r] = await q(
    "select has_table_privilege('authenticated','promo_internal.promo','select') direct,has_function_privilege('anon','public.pesan_promo(jsonb)','execute') anon,has_function_privilege('authenticated','promo_internal.pakai(jsonb,uuid,bigint)','execute') consume,(select prosecdef from pg_proc where oid='public.simpan_promo(jsonb)'::regprocedure) definer",
  );
  expect(r).toEqual({
    direct: false,
    anon: false,
    consume: false,
    definer: false,
  });
  await as("");
  await expect(call("simpan_promo", config())).rejects.toThrow(/Masuk/);
});
it("reserves capacity idempotently, rejects forged basket/token/outlet and releases it", async () => {
  await as(cash);
  const b = basket(promo);
  const quote = await call("pesan_promo", b);
  expect(quote.diskon).toBe(4000);
  expect(quote.sisa).toEqual({ semua: 2 });
  expect(await call("pesan_promo", b)).toEqual(quote);
  await expect(
    call("pesan_promo", {
      ...b,
      items: [{ menu_id: menu, varian_ids: [], qty: 2 }],
    }),
  ).rejects.toThrow(/ID reservasi/);
  await expect(
    call("pesan_promo", basket(promo, { pos_token: "bad" })),
  ).rejects.toThrow(/Sesi POS/);
  await expect(
    call("pesan_promo", basket(promo, { outlet_id: other })),
  ).rejects.toThrow(/diizinkan/);
  await expect(
    call(
      "pesan_promo",
      basket(promo, { items: [{ menu_id: menu, varian_ids: [], qty: 3 }] }),
    ),
  ).rejects.toThrow(/Kuota/);
  await q("select lepas_promo($1)", [quote.id]);
  await q("select lepas_promo($1)", [quote.id]);
  const full = await call(
    "pesan_promo",
    basket(promo, { items: [{ menu_id: menu, varian_ids: [], qty: 3 }] }),
  );
  expect(full.sisa).toEqual({ semua: 0 });
  await q("select lepas_promo($1)", [full.id]);
});
it("checkout atomically applies approved discount without PIN, retries once, preserves snapshot after config change", async () => {
  await as(cash);
  const b = basket(promo),
    quote = await call("pesan_promo", b);
  const p = sale(b, quote.id as string);
  const paid = await call("matur_internal.buat_transaksi", p);
  expect(paid.total).toBe(6000);
  expect(paid.diskon).toBe(4000);
  await q(
    "update promo_internal.pesanan set sampai_at=now()-interval '1 hour' where id=$1",
    [quote.id],
  );
  expect((await call("matur_internal.buat_transaksi", p)).id).toBe(paid.id);
  await as(owner);
  await call(
    "simpan_promo",
    config({ id: promo, versi: 1, nama: "Nama baru", aktif: false }),
  );
  expect(
    (await q("select promo_snapshot from transaksi where id=$1", [paid.id]))[0]
      .promo_snapshot,
  ).toMatchObject({ nama: "Promo Uji", diskon: 4000 });
  await q("update transaksi set status='void' where id=$1", [paid.id]);
  expect(
    (
      await q("select status from promo_internal.pesanan where id=$1", [
        quote.id,
      ])
    )[0].status,
  ).toBe("lepas");
  await q("update transaksi set status='lunas' where id=$1", [paid.id]);
  expect(
    (
      await q("select status from promo_internal.pesanan where id=$1", [
        quote.id,
      ])
    )[0].status,
  ).toBe("pakai");
});
it("supports percent, per-item amount, variant qualification and frozen catalog prices", async () => {
  for (const [jenis, nilai, diskon] of [
    ["persen", 25, 3000],
    ["potongan", 2500, 2500],
    ["harga_akhir", 7000, 5000],
  ] as const) {
    await as(owner);
    const pid = await call<string>(
      "simpan_promo",
      config({
        kuota: null,
        aturan: [{ menu_id: menu, varian_ids: [variant], jenis, nilai }],
      }),
    );
    await as(cash);
    await expect(call("pesan_promo", basket(pid))).rejects.toThrow(/memenuhi/);
    const b = basket(pid, {
        items: [{ menu_id: menu, varian_ids: [variant], qty: 2 }],
      }),
      quote = await call("pesan_promo", b);
    expect(quote.diskon).toBe(diskon * 2);
    await q("update menu set harga_langsung=99999 where id=$1", [menu]);
    const paid = await call(
      "matur_internal.buat_transaksi",
      sale(b, quote.id as string, {
        _katalog: { menu: { [menu]: { langsung: 1 } } },
      }),
    );
    expect(paid.subtotal).toBe(24000);
    expect(paid.total).toBe(24000 - diskon * 2);
    await q("update menu set harga_langsung=10000 where id=$1", [menu]);
  }
});
it("failed payment rolls back use; manual stacking/approval and offline protection remain enforced", async () => {
  await as(owner);
  const pid = await call<string>(
    "simpan_promo",
    config({ boleh_manual: true, kuota: 1 }),
  );
  await as(cash);
  const b = basket(pid, { diskon: 500 }),
    quote = await call("pesan_promo", b);
  const p = sale(b, quote.id as string, { diterima: 1 });
  await expect(call("matur_internal.buat_transaksi", p)).rejects.toThrow(
    /kurang/,
  );
  expect(
    (
      await q("select status from promo_internal.pesanan where id=$1", [
        quote.id,
      ])
    )[0].status,
  ).toBe("pesan");
  await expect(
    call("matur_internal.buat_transaksi", { ...p, sinkron_offline: true }),
  ).rejects.toThrow(/Reservasi/);
  await expect(
    call("matur_internal.buat_transaksi", { ...p, diskon: 999 }),
  ).rejects.toThrow(/Reservasi/);
  expect(
    (await call("matur_internal.buat_transaksi", { ...p, diterima: 10000 }))
      .total,
  ).toBe(5500);
  await as(owner);
  const another = await call<string>(
    "simpan_promo",
    config({ kuota: null, boleh_manual: true }),
  );
  await as(cash);
  const large = basket(another, { diskon: 1000 }),
    largeQuote = await call("pesan_promo", large);
  await expect(
    call("matur_internal.buat_transaksi", sale(large, largeQuote.id as string)),
  ).rejects.toThrow(/SPV/);
});
it("expiry returns capacity and void restoration cannot overbook the last quota", async () => {
  await as(owner);
  const pid = await call<string>("simpan_promo", config({ kuota: 1 }));
  await as(cash);
  const expired = await call("pesan_promo", basket(pid));
  await q(
    "update promo_internal.pesanan set sampai_at=now()-interval '1 minute' where id=$1",
    [expired.id],
  );
  const b = basket(pid),
    quote = await call("pesan_promo", b),
    paid = await call(
      "matur_internal.buat_transaksi",
      sale(b, quote.id as string),
    );
  await q("update transaksi set status='void' where id=$1", [paid.id]);
  const next = await call("pesan_promo", basket(pid));
  await expect(
    q("update transaksi set status='lunas' where id=$1", [paid.id]),
  ).rejects.toThrow(/Kuota/);
  await q("select lepas_promo($1)", [next.id]);
  await q("update transaksi set status='lunas' where id=$1", [paid.id]);
});
it("finance report and actual authenticated RPC access work without direct private table grants", async () => {
  await db.exec(
    "grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated",
  );
  await as(finance);
  await db.exec("set role authenticated");
  try {
    expect(
      (
        await q<{ v: unknown[] }>(
          "select laporan_promo(null,current_date-1,current_date+1) v",
        )
      )[0].v.length,
    ).toBeGreaterThan(0);
    await expect(q("select * from promo_internal.promo")).rejects.toThrow(
      /permission denied/,
    );
    await expect(call("simpan_promo", config())).rejects.toThrow(/SPV/);
  } finally {
    await db.exec("reset role");
  }
});
it("per-menu quota counts each menu separately; shared versus per-outlet quota works", async () => {
  const menu2 = id(20),
    sesi2 = id(21),
    permit2 = id(22);
  await q(
    "insert into menu(id,nama,harga_langsung,harga_ojol) values($1,'Teh',8000,9000)",
    [menu2],
  );
  await q(
    "insert into penugasan(pengguna_id,peran,outlet_id) values($1,'kasir',$2)",
    [cash, other],
  );
  await q("insert into sesi_kas(id,outlet_id,kasir_id) values($1,$2,$3)", [
    sesi2,
    other,
    cash,
  ]);
  await q(
    "update matur_internal.pos_izin set katalog=jsonb_set(katalog,array['menu',$1],'{\"langsung\":8000,\"ojol\":9000}')",
    [menu2],
  );
  await q(
    "insert into matur_internal.pos_izin(id,sesi_id,perangkat_id,token_hash,katalog) select $1,$2,perangkat_id,token_hash,katalog from matur_internal.pos_izin where id=$3",
    [permit2, sesi2, permit],
  );
  await db.exec(
    `create or replace function pos_kas_internal.perangkat_langsung(uuid,text) returns uuid language sql as $$select case when $1 in ('${o}'::uuid,'${other}'::uuid) and $2='device' and auth.uid()='${cash}'::uuid then '${device}'::uuid end$$`,
  );
  for (const shared of [false, true]) {
    await as(owner);
    const pid = await call<string>(
      "simpan_promo",
      config({
        outlet_ids: [o, other],
        kuota: 1,
        per_menu: true,
        bersama: shared,
        aturan: [
          { menu_id: menu, varian_ids: [], jenis: "potongan", nilai: 1000 },
          { menu_id: menu2, varian_ids: [], jenis: "potongan", nilai: 1000 },
        ],
      }),
    );
    await as(cash);
    const two = await call(
      "pesan_promo",
      basket(pid, {
        items: [
          { menu_id: menu, varian_ids: [], qty: 1 },
          { menu_id: menu2, varian_ids: [], qty: 1 },
        ],
      }),
    );
    expect(two.sisa).toEqual({ [menu]: 0, [menu2]: 0 });
    const elsewhere = basket(pid, {
      outlet_id: other,
      sesi_id: sesi2,
      izin_id: permit2,
    });
    if (shared)
      await expect(call("pesan_promo", elsewhere)).rejects.toThrow(/Kuota/);
    else expect((await call("pesan_promo", elsewhere)).diskon).toBe(1000);
  }
});
it("rejects expired/disabled promos, unapproved manual stacking, and invalid quantities", async () => {
  await as(owner);
  const disabled = await call<string>("simpan_promo", config({ aktif: false })),
    expired = await call<string>(
      "simpan_promo",
      config({ mulai: "2020-01-01", selesai: "2020-01-02" }),
    ),
    pid = await call<string>("simpan_promo", config());
  await as(cash);
  for (const p of [disabled, expired])
    await expect(call("pesan_promo", basket(p))).rejects.toThrow(/tidak aktif/);
  await expect(
    call("pesan_promo", basket(pid, { diskon: 100 })),
  ).rejects.toThrow(/digabung/);
  await expect(
    call(
      "pesan_promo",
      basket(pid, { items: [{ menu_id: menu, varian_ids: [], qty: 0 }] }),
    ),
  ).rejects.toThrow(/Jumlah/);
});
it("ordinary checkout stays unchanged and reservation owner is enforced", async () => {
  await as(cash);
  const p = sale(basket(promo), "");
  delete (p as Record<string, unknown>).promo_quote;
  expect((await call("matur_internal.buat_transaksi", p)).total).toBe(10000);
  await as(owner);
  const pid = await call<string>("simpan_promo", config());
  await as(cash);
  const b = basket(pid),
    quote = await call("pesan_promo", b);
  await as(spv);
  await expect(
    call("matur_internal.buat_transaksi", sale(b, quote.id as string)),
  ).rejects.toThrow(/Reservasi/);
  await q("select lepas_promo($1)", [quote.id]);
  expect(
    (
      await q("select status from promo_internal.pesanan where id=$1", [
        quote.id,
      ])
    )[0].status,
  ).toBe("pesan");
});
