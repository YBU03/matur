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
    src("../../../supabase/migrations/20261118142331_promo_slot_hari_kuota.sql"),
  );
  await db.exec(
    src("../../../supabase/migrations/20261118234109_promo_mitra.sql"),
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
it("full office subsidy accepts zero customer payment, creates one receivable and preserves stock/HPP workflow", async () => {
  await as(owner);
  const pid = await call<string>(
    "simpan_promo",
    config({
      subsidi: true,
      nama_subsidi: "Subsidi Opening",
      kuota: 2,
      aturan: [{ menu_id: menu, varian_ids: [], jenis: "gratis", nilai: 100 }],
    }),
  );
  await as(cash);
  const b = basket(pid),
    quote = await call("pesan_promo", b);
  expect(quote).toMatchObject({
    diskon: 10000,
    subsidi: true,
    nama_subsidi: "Subsidi Opening",
  });
  const p = sale(b, quote.id as string),
    paid = await call("matur_internal.buat_transaksi", p);
  expect(paid.total).toBe(0);
  expect((await call("matur_internal.buat_transaksi", p)).id).toBe(paid.id);
  const [t] = await q(
    "select * from promo_internal.tagihan where transaksi_id=$1",
    [paid.id],
  );
  expect(t).toMatchObject({
    nama: "Subsidi Opening",
    nominal: 10000,
    nominal_awal: 10000,
  });
  expect(
    (
      await q("select count(*)::int n from pembayaran where transaksi_id=$1", [
        paid.id,
      ])
    )[0].n,
  ).toBe(0);
  const q2 = await call("pesan_promo", basket(pid));
  await expect(
    call(
      "matur_internal.buat_transaksi",
      sale(b, q2.id as string, { diterima: 10000 }),
    ),
  ).rejects.toThrow(/tidak menerima/);
  await q("select lepas_promo($1)", [q2.id]);
  await as(owner);
  await expect(
    call(
      "simpan_promo",
      config({
        aturan: [
          { menu_id: menu, varian_ids: [], jenis: "gratis", nilai: 100 },
        ],
      }),
    ),
  ).rejects.toThrow(/harus memakai subsidi/);
});
it("partial subsidy can be renamed and corrected by Accounting with version and reason; sale stays frozen", async () => {
  await as(owner);
  const pid = await call<string>(
    "simpan_promo",
    config({ subsidi: true, nama_subsidi: "Subsidi Kantor", kuota: null }),
  );
  await as(cash);
  const b = basket(pid),
    quote = await call("pesan_promo", b);
  const paid = await call(
    "matur_internal.buat_transaksi",
    sale(b, quote.id as string),
  );
  expect(paid.total).toBe(6000);
  const [t] = await q(
    "select * from promo_internal.tagihan where transaksi_id=$1",
    [paid.id],
  );
  await expect(
    call("edit_tagihan_subsidi", {
      id: t.id,
      versi: 1,
      nama: "Marketing",
      nominal: 4500,
      alasan: "Revisi",
    }),
  ).rejects.toThrow(/Accounting/);
  await as(finance);
  await expect(
    call("edit_tagihan_subsidi", {
      id: t.id,
      versi: 1,
      nama: "Marketing",
      nominal: 4500,
      alasan: "",
    }),
  ).rejects.toThrow(/alasan/);
  await call("edit_tagihan_subsidi", {
    id: t.id,
    versi: 1,
    nama: "Marketing",
    nominal: 4500,
    alasan: "Revisi perjanjian",
    catatan: "Subsidi pusat",
  });
  await expect(
    call("edit_tagihan_subsidi", {
      id: t.id,
      versi: 1,
      nama: "X",
      nominal: 5000,
      alasan: "Lama",
    }),
  ).rejects.toThrow(/berubah/);
  expect(
    (
      await q("select total,promo_snapshot from transaksi where id=$1", [
        paid.id,
      ])
    )[0],
  ).toMatchObject({
    total: 6000,
    promo_snapshot: { nama_subsidi: "Subsidi Kantor", diskon: 4000 },
  });
});
it("settlement is idempotent, validates proof/amount, can be corrected and handles paid void with refund", async () => {
  await as(owner);
  const pid = await call<string>(
    "simpan_promo",
    config({ subsidi: true, kuota: null }),
  );
  await as(cash);
  const b = basket(pid),
    quote = await call("pesan_promo", b),
    paid = await call(
      "matur_internal.buat_transaksi",
      sale(b, quote.id as string),
    );
  const [t] = await q(
    "select * from promo_internal.tagihan where transaksi_id=$1",
    [paid.id],
  );
  await as(finance);
  const file = `${finance}/bukti.pdf`;
  await q(
    "insert into storage.objects(bucket_id,name) values('subsidi-bukti',$1)",
    [file],
  );
  const pay = {
    request_id: crypto.randomUUID(),
    id: t.id,
    versi: 1,
    tanggal: new Date().toISOString().slice(0, 10),
    jumlah: 2000,
    bukti: file,
    catatan: "Transfer kantor",
  };
  await expect(
    call("bayar_tagihan_subsidi", { ...pay, bukti: "wrong/proof.pdf" }),
  ).rejects.toThrow(/bukti/);
  const entry = await call<string>("bayar_tagihan_subsidi", pay);
  expect(await call("bayar_tagihan_subsidi", pay)).toBe(entry);
  await expect(
    call("bayar_tagihan_subsidi", {
      ...pay,
      request_id: crypto.randomUUID(),
      versi: 2,
      jumlah: 3000,
    }),
  ).rejects.toThrow(/melebihi/);
  await expect(
    call("edit_tagihan_subsidi", {
      id: t.id,
      versi: 2,
      nama: "Subsidi",
      nominal: 1000,
      alasan: "Turunkan",
    }),
  ).rejects.toThrow(/di bawah/);
  await call("batal_bayar_subsidi", {
    id: entry,
    versi: 2,
    alasan: "Salah nominal",
  });
  await call("bayar_tagihan_subsidi", {
    ...pay,
    request_id: crypto.randomUUID(),
    versi: 3,
    jumlah: 4000,
  });
  await q("update transaksi set status='void' where id=$1", [paid.id]);
  const rows = (
    await q<{ v: { id: string; target: number; terbayar: number }[] }>(
      "select laporan_subsidi(null,current_date-1,current_date+1) v",
    )
  )[0].v;
  expect(rows.find((x) => x.id === t.id)).toMatchObject({
    target: 0,
    terbayar: 4000,
  });
  await call("bayar_tagihan_subsidi", {
    ...pay,
    request_id: crypto.randomUUID(),
    versi: 4,
    jumlah: -4000,
    catatan: "Pengembalian transaksi void",
  });
  expect(
    (
      await q(
        "select coalesce(sum(jumlah),0)::int n from promo_internal.pelunasan where tagihan_id=$1 and batal_at is null",
        [t.id],
      )
    )[0].n,
  ).toBe(0);
  expect(
    (await q("select total from transaksi where id=$1", [paid.id]))[0].total,
  ).toBe(6000);
  await as(cash);
  await expect(
    q("select laporan_subsidi(null,current_date,current_date)"),
  ).rejects.toThrow(/Accounting/);
});
it("marketing report reconciles ordinary discounts and subsidies once and preserves zero-payment sale costs", async () => {
  await as(owner);
  const rows = (
    await q<{
      v: {
        id: string;
        status: string;
        diskon: number;
        subsidi: number;
        total: number;
        subtotal: number;
      }[];
    }>("select laporan_marketing_diskon(null,current_date-1,current_date+1) v")
  )[0].v;
  expect(rows.some((r) => r.subsidi > 0 && r.total === 0)).toBe(true);
  expect(rows.some((r) => r.subsidi === 0 && r.diskon > 0)).toBe(true);
  for (const r of rows) {
    expect(Number(r.subtotal) - Number(r.diskon)).toBe(Number(r.total));
    expect(Number(r.subsidi)).toBeLessThanOrEqual(Number(r.diskon));
  }
  const ingredient = id(30);
  await q(
    "insert into bahan(id,nama,satuan_beli,satuan_pakai,harga_pokok) values($1,'Beans','kg','kg',2000)",
    [ingredient],
  );
  await q("insert into resep(menu_id,bahan_id,takaran) values($1,$2,1)", [
    menu,
    ingredient,
  ]);
  await q("insert into stok(outlet_id,bahan_id,jumlah) values($1,$2,10)", [
    o,
    ingredient,
  ]);
  const pid = await call<string>(
    "simpan_promo",
    config({
      subsidi: true,
      kuota: null,
      aturan: [{ menu_id: menu, varian_ids: [], jenis: "gratis", nilai: 100 }],
    }),
  );
  await as(cash);
  const b = basket(pid),
    quote = await call("pesan_promo", b),
    paid = await call(
      "matur_internal.buat_transaksi",
      sale(b, quote.id as string),
    );
  expect(
    (await q("select hpp_teoritis from transaksi where id=$1", [paid.id]))[0]
      .hpp_teoritis,
  ).toBe(2000);
  expect(
    Number(
      (
        await q("select jumlah from stok where outlet_id=$1 and bahan_id=$2", [
          o,
          ingredient,
        ])
      )[0].jumlah,
    ),
  ).toBe(9);
  await expect(
    q("select laporan_marketing_diskon(null,current_date,current_date)"),
  ).rejects.toThrow(/Accounting/);
});
it("transaction voucher applies Rp15000 once for one/many menus or quantities, yielding 48000 → 33000", async () => {
  const capp = id(40),
    caramel = id(41);
  await q(
    "insert into menu(id,nama,harga_langsung,harga_ojol) values($1,'Cappucino voucher',20000,20000),($2,'Caramel voucher',28000,28000)",
    [capp, caramel],
  );
  await q(
    "update matur_internal.pos_izin set katalog=jsonb_set(jsonb_set(katalog,array['menu',$1],'{\"langsung\":20000,\"ojol\":20000}'),array['menu',$2],'{\"langsung\":28000,\"ojol\":28000}') where id=$3",
    [capp, caramel, permit],
  );
  await as(owner);
  const pid = await call<string>(
    "simpan_promo",
    config({
      cakupan: "transaksi",
      nilai_voucher: 15000,
      minimum_belanja: 15001,
      kuota: null,
      per_menu: true,
      aturan: [capp, caramel].map((menu_id) => ({
        menu_id,
        varian_ids: [],
        jenis: "potongan",
        nilai: 15000,
      })),
    }),
  );
  expect(
    (await q("select per_menu from promo_internal.promo where id=$1", [pid]))[0]
      .per_menu,
  ).toBe(false);
  await as(cash);
  for (const [items, expected] of [
    [[{ menu_id: capp, varian_ids: [], qty: 1 }], 5000],
    [[{ menu_id: caramel, varian_ids: [], qty: 1 }], 13000],
    [
      [
        { menu_id: capp, varian_ids: [], qty: 1 },
        { menu_id: caramel, varian_ids: [], qty: 1 },
      ],
      33000,
    ],
    [[{ menu_id: capp, varian_ids: [], qty: 2 }], 25000],
    [
      [
        { menu_id: capp, varian_ids: [], qty: 2 },
        { menu_id: caramel, varian_ids: [], qty: 1 },
      ],
      53000,
    ],
  ] as const) {
    const b = basket(pid, { items });
    const quote = await call("pesan_promo", b);
    expect(quote.diskon).toBe(15000);
    expect(quote.cakupan).toBe("transaksi");
    expect(await call("pesan_promo", b)).toEqual(quote);
    const p = sale(b, quote.id as string);
    const paid = await call("matur_internal.buat_transaksi", p);
    expect(paid.total).toBe(expected);
    expect(paid.diskon).toBe(15000);
    expect((await call("matur_internal.buat_transaksi", p)).id).toBe(paid.id);
    expect(
      (
        await q("select promo_snapshot from transaksi where id=$1", [paid.id])
      )[0].promo_snapshot,
    ).toMatchObject({ cakupan: "transaksi", nilai_voucher: 15000 });
  }
});
it("voucher checks minimum on eligible menus and caps discount without leaking it to ineligible items", async () => {
  await as(owner);
  const pid = await call<string>(
    "simpan_promo",
    config({
      cakupan: "transaksi",
      nilai_voucher: 15000,
      minimum_belanja: 15001,
      kuota: null,
    }),
  );
  await as(cash);
  await expect(call("pesan_promo", basket(pid))).rejects.toThrow(
    /Minimum belanja/,
  );
  await expect(
    call(
      "pesan_promo",
      basket(pid, {
        items: [
          { menu_id: menu, varian_ids: [], qty: 1 },
          { menu_id: id(41), varian_ids: [], qty: 1 },
        ],
      }),
    ),
  ).rejects.toThrow(/Minimum belanja/);
  await as(owner);
  const capped = await call<string>(
    "simpan_promo",
    config({
      cakupan: "transaksi",
      nilai_voucher: 15000,
      minimum_belanja: 0,
      kuota: null,
    }),
  );
  await as(cash);
  const q2 = await call(
    "pesan_promo",
    basket(capped, {
      items: [
        { menu_id: menu, varian_ids: [], qty: 1 },
        { menu_id: id(41), varian_ids: [], qty: 1 },
      ],
    }),
  );
  expect(q2.diskon).toBe(10000);
  await q("select lepas_promo($1)", [q2.id]);
  await expect(call("pesan_promo", basket(capped))).rejects.toThrow(
    /lebih dari nol/,
  );
  await expect(
    call(
      "pesan_promo",
      basket(capped, { items: [{ menu_id: id(41), varian_ids: [], qty: 1 }] }),
    ),
  ).rejects.toThrow(/memenuhi/);
});
it("voucher quota counts one transaction, not cups; void returns one use and scope changes revoke old reservations", async () => {
  await as(owner);
  const pid = await call<string>(
    "simpan_promo",
    config({
      cakupan: "transaksi",
      nilai_voucher: 15000,
      minimum_belanja: 0,
      kuota: 1,
    }),
  );
  await as(cash);
  const b = basket(pid, { items: [{ menu_id: menu, varian_ids: [], qty: 3 }] }),
    quote = await call("pesan_promo", b);
  expect(quote.sisa).toEqual({ semua: 0 });
  await expect(
    call(
      "pesan_promo",
      basket(pid, { items: [{ menu_id: menu, varian_ids: [], qty: 2 }] }),
    ),
  ).rejects.toThrow(/Kuota/);
  const paid = await call(
    "matur_internal.buat_transaksi",
    sale(b, quote.id as string),
  );
  expect(paid.total).toBe(15000);
  await q("update transaksi set status='void' where id=$1", [paid.id]);
  const next = await call(
    "pesan_promo",
    basket(pid, { items: [{ menu_id: menu, varian_ids: [], qty: 2 }] }),
  );
  await q("select lepas_promo($1)", [next.id]);
  await as(owner);
  const old = await call<string>("simpan_promo", config({ kuota: null }));
  await as(cash);
  const before = basket(old),
    lease = await call("pesan_promo", before);
  await as(owner);
  await call(
    "simpan_promo",
    config({
      id: old,
      versi: 1,
      cakupan: "transaksi",
      nilai_voucher: 5000,
      kuota: null,
    }),
  );
  await as(cash);
  await expect(
    call("matur_internal.buat_transaksi", sale(before, lease.id as string)),
  ).rejects.toThrow(/berakhir/);
  expect((await call("pesan_promo", basket(old))).diskon).toBe(5000);
});

it("slot jam bebas, lewat tengah malam dan hari tertentu menentukan berlakunya promo", async () => {
  await as(owner);
  const pid = await call<string>(
    "simpan_promo",
    config({
      mulai: "2026-11-16",
      selesai: "2026-11-30",
      slot: [{ mulai: "15:00", selesai: "17:00" }, { mulai: "07:00", selesai: "10:00" }, { mulai: "21:00", selesai: "01:00" }],
      hari: [1, 2, 3, 4, 5],
      kuota: null,
    }),
  );
  const row = (await q<{ slot: unknown; hari: number[] }>("select slot, hari from promo_internal.promo where id=$1", [pid]))[0];
  expect(row.slot).toEqual([{ mulai: "07:00:00", selesai: "10:00:00" }, { mulai: "15:00:00", selesai: "17:00:00" }, { mulai: "21:00:00", selesai: "01:00:00" }]);
  expect(row.hari).toEqual([1, 2, 3, 4, 5]);
  const akhir = async (t: string) =>
    (await q<{ v: string | null }>("select to_char(promo_internal.akhir_slot(r,$2::timestamptz) at time zone 'Asia/Jakarta','YYYY-MM-DD HH24:MI') v from promo_internal.promo r where id=$1", [pid, t]))[0].v;
  expect(await akhir("2026-11-18 08:00+07")).toBe("2026-11-18 10:00"); // Rabu pagi
  expect(await akhir("2026-11-18 12:00+07")).toBeNull(); // di luar slot
  expect(await akhir("2026-11-18 16:59+07")).toBe("2026-11-18 17:00");
  expect(await akhir("2026-11-18 23:30+07")).toBe("2026-11-19 01:00"); // lewat tengah malam
  expect(await akhir("2026-11-19 00:30+07")).toBe("2026-11-19 01:00");
  expect(await akhir("2026-11-21 08:00+07")).toBeNull(); // Sabtu
  expect(await akhir("2026-11-21 00:30+07")).toBe("2026-11-21 01:00"); // sisa slot Jumat malam
  expect(await akhir("2026-11-22 00:30+07")).toBeNull(); // Sabtu malam tidak dipilih
  expect(await akhir("2026-12-01 08:00+07")).toBeNull(); // lewat periode
  await expect(call("simpan_promo", config({ slot: [{ mulai: "07:00", selesai: "07:00" }] }))).rejects.toThrow(/Jam promo/);
  await expect(call("simpan_promo", config({ hari: [] }))).rejects.toThrow(/hari/);
  // Promo lama/klien lama tanpa slot tetap 1 slot dari jam & setiap hari.
  const lama = await call<string>("simpan_promo", config({ jam_mulai: "06:00", jam_selesai: "09:00:00", kuota: null }));
  expect((await q("select slot, hari from promo_internal.promo where id=$1", [lama]))[0]).toEqual({ slot: [{ mulai: "06:00:00", selesai: "09:00:00" }], hari: [1, 2, 3, 4, 5, 6, 7] });
});

it("kasir menerima sisa kuota & akhir slot, laporan mencatat jam kuota habis", async () => {
  await as(owner);
  const pid = await call<string>("simpan_promo", config({ nama: "Kuota Laporan", kuota: 2 }));
  await as(cash);
  const list = (await q<{ v: { id: string; sisa_kuota: Record<string, number>; berakhir_at: string }[] }>("select daftar_promo($1,false) v", [o]))[0].v;
  const ini = list.find((x) => x.id === pid)!;
  expect(ini.sisa_kuota).toEqual({ semua: 2 });
  expect(ini.berakhir_at).toBeTruthy();
  const b = basket(pid, { items: [{ menu_id: menu, varian_ids: [], qty: 2 }] }),
    quote = await call("pesan_promo", b);
  await call("matur_internal.buat_transaksi", sale(b, quote.id as string));
  const after = (await q<{ v: { id: string; sisa_kuota: Record<string, number> }[] }>("select daftar_promo($1,false) v", [o]))[0].v;
  expect(after.find((x) => x.id === pid)!.sisa_kuota).toEqual({ semua: 0 });
  await as(owner);
  const lap = (await q<{ v: { promo: string; kuota: number; terpakai: number; habis_at: string | null }[] }>("select laporan_kuota_promo(null,current_date-1,current_date+1) v"))[0].v;
  const baris = lap.find((x) => x.promo === "Kuota Laporan")!;
  expect(baris).toMatchObject({ kuota: 2, terpakai: 2 });
  expect(baris.habis_at).toBeTruthy();
});

it("Mitra hanya melihat promo aktif outletnya sendiri, beserta kuota & pemakaian", async () => {
  const mitra = id(90);
  await q("insert into pengguna(id,nama,email) values($1,'Mitra','mitra@test')", [mitra]);
  await q("insert into penugasan(pengguna_id,peran,outlet_id) values($1,'mitra',$2)", [mitra, o]);
  await as(owner);
  const aktif = await call<string>("simpan_promo", config({ nama: "Campaign Mitra", kuota: 5 }));
  await call<string>("simpan_promo", config({ nama: "Draft Nonaktif", aktif: false }));
  await call<string>("simpan_promo", config({ nama: "Outlet Lain", outlet_ids: [other] }));
  await as(cash);
  const b = basket(aktif, { items: [{ menu_id: menu, varian_ids: [], qty: 2 }] }), quote = await call("pesan_promo", b);
  await call("matur_internal.buat_transaksi", sale(b, quote.id as string));
  await as(mitra);
  const v = (await q<{ v: { promo: { id: string; nama: string; sisa_kuota: Record<string, number>; aturan: { menu_nama: string }[]; diubah_oleh?: string }[]; pemakaian: { promo: string; transaksi: number; potongan: number }[]; kuota: { promo: string; terpakai: number }[] } }>("select promo_mitra($1,current_date-1,current_date+1) v", [o]))[0].v;
  const nama = v.promo.map((p) => p.nama);
  expect(nama).toContain("Campaign Mitra");
  expect(nama).not.toContain("Draft Nonaktif");
  expect(nama).not.toContain("Outlet Lain");
  const c = v.promo.find((p) => p.id === aktif)!;
  expect(c.sisa_kuota).toEqual({ semua: 3 });
  expect(c.aturan[0].menu_nama).toBe("Kopi");
  expect(c.diubah_oleh).toBeUndefined();
  expect(v.pemakaian.find((p) => p.promo === "Campaign Mitra")).toMatchObject({ transaksi: 1, potongan: 8000 });
  expect(v.kuota.find((k) => k.promo === "Campaign Mitra")).toMatchObject({ terpakai: 2 });
  await expect(q("select promo_mitra($1,current_date,current_date)", [other])).rejects.toThrow(/diizinkan/);
});

it("kuota terakhir tetap sah untuk reservasinya; penjualan normal berikutnya tidak terhalang", async () => {
  await as(owner);
  const pid = await call<string>("simpan_promo", config({ nama: "Normal sesudah kuota", kuota: 1 }));
  await as(cash);
  const b = basket(pid);
  const reserved = await call<{ id: string; sisa: Record<string, number> }>("pesan_promo", b);
  expect(reserved.sisa).toEqual({ semua: 0 });
  await expect(call("pesan_promo", basket(pid))).rejects.toThrow(/Kuota promo tidak cukup/);
  const discounted = await call<{ total: number }>("matur_internal.buat_transaksi", sale(b, reserved.id));
  expect(discounted.total).toBe(6000);
  const normal = sale(b, reserved.id);
  delete (normal as Record<string, unknown>).promo_quote;
  const regular = await call<{ total: number }>("matur_internal.buat_transaksi", normal);
  expect(regular.total).toBe(10000);
});
