import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const id = (n: number) =>
  `72000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const q = async (sql: string, p: unknown[] = []) =>
  (await db.query<Record<string, any>>(sql, p)).rows; // eslint-disable-line @typescript-eslint/no-explicit-any
const file = (n: string) => readFileSync(new URL(n, import.meta.url), "utf8");
const raw = async (p: object) =>
  (
    await q("select simpan_koreksi_penjualan($1::jsonb) v", [JSON.stringify(p)])
  )[0].v;
const sent = new Map<string, object>();
const invoke = async (p: Record<string, unknown>) => {
  const key = JSON.stringify(p);
  if (sent.has(key)) return raw(sent.get(key)!);
  const v = await raw({ ...p, pratinjau: true });
  const final = { ...p, sidik_preview: v.sidik_preview };
  sent.set(key, final);
  return raw(final);
};
const request = (more: object = {}) => ({
  request_id: crypto.randomUUID(),
  aksi: "tambah",
  outlet_id: id(2),
  sesi_id: id(3),
  tanggal: "2026-11-17",
  jam: "21:10",
  jam_pasti: false,
  kanal: "langsung",
  metode: "tunai",
  diskon: 0,
  alasan: "Penjualan saat server down",
  items: [{ menu_id: id(4), qty: 1, harga: 28000, varian_ids: [] }],
  ...more,
});
const details = async (tid: string) =>
  (await q("select rincian_koreksi_penjualan($1) v", [tid]))[0].v;
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;create schema storage;create schema matur_internal;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function extensions.digest(text,text) returns bytea language sql immutable as $$select decode(md5($1),'hex')$$;
 set check_function_bodies=off;`);
  await db.exec(file("./fixtures/pos-team-baseline.sql"));
  await db.exec(`set check_function_bodies=on;
 create schema rekonsiliasi_internal;
 create function public.tgl_op(timestamptz) returns date language sql immutable as $$select ($1 at time zone 'Asia/Jakarta'-interval '3 hours')::date$$;
 create function matur_internal.jumlah_varian(uuid,uuid[]) returns int language sql immutable as $$select count(*)::int from unnest($2) x where x=$1$$;
 alter table sesi_kas add column tanggal_shift date,add column pending_offline int default 0,add column kas_seharusnya bigint;
 alter table transaksi drop constraint transaksi_status_check;
 alter table transaksi add column operator_nama text,add column sumber_penjualan jsonb,add column promo_snapshot jsonb,add column dihapus_at timestamptz,add column dihapus_oleh uuid,add column dihapus_alasan text,add column status_sebelum text;
 create table pos_perangkat(outlet_id uuid,antrean_jumlah int);
 create function rekonsiliasi_internal.sidik_transaksi(uuid) returns text language sql stable security definer set search_path='' as $$select md5((to_jsonb(t)||jsonb_build_object('items',(select jsonb_agg(to_jsonb(i) order by i.id) from public.item_transaksi i where i.transaksi_id=t.id),'bayar',(select jsonb_agg(to_jsonb(b) order by b.id) from public.pembayaran b where b.transaksi_id=t.id)))::text) from public.transaksi t where t.id=$1$$;
 create function matur_internal.kas_ringkas(uuid) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('seharusnya',s.modal_laci+coalesce((select sum(b.nominal) from public.transaksi t join public.pembayaran b on b.transaksi_id=t.id where t.sesi_kas_id=s.id and t.status='lunas' and b.metode='tunai'),0)) from public.sesi_kas s where s.id=$1$$;
 insert into pengguna(id,nama) values('${id(1)}','Akunting');insert into penugasan(pengguna_id,peran) values('${id(1)}','finance');
 insert into outlet(id,nama) values('${id(2)}','Kominot Uji');
 insert into sesi_kas(id,outlet_id,kasir_id,tanggal_shift,ditutup_at,modal_laci,setoran,seharusnya,kas_seharusnya,selisih) values('${id(3)}','${id(2)}','${id(1)}','2026-11-17',now(),200000,50000,0,200000,50000);
 insert into menu(id,nama,harga_langsung,harga_ojol) values('${id(4)}','Butterscotch',28000,28000),('${id(5)}','Chocolate',22000,22000);
 insert into bahan(id,nama,satuan_beli,satuan_pakai,harga_pokok) values('${id(6)}','Bahan uji','ml','ml',100);
 insert into resep(menu_id,bahan_id,takaran) values('${id(4)}','${id(6)}',10),('${id(5)}','${id(6)}',20);
 insert into stok(mode,outlet_id,bahan_id,jumlah) values('asli','${id(2)}','${id(6)}',1000);
 `);
  await db.exec(
    file(
      "../../../supabase/migrations/20261118075431_koreksi_penjualan_akunting.sql",
    ),
  );
  await db.exec(
    `grant usage on schema auth to authenticated;set test.uid='${id(1)}';set role authenticated`,
  );
}, 30000);
afterAll(() => db.close());
it("adds cash and QRIS with frozen lines/HPP, recalculates cash without rewriting actual, retries once", async () => {
  const p = request({
    items: [
      { menu_id: id(4), qty: 1, harga: 28000, varian_ids: [] },
      { menu_id: id(5), qty: 1, harga: 22000, varian_ids: [] },
    ],
  });
  const r = await invoke(p);
  expect(r.total).toBe(50000);
  expect((await invoke(p)).id).toBe(r.id);
  const d = await details(r.id);
  expect(d.transaksi.hpp_teoritis).toBe(3000);
  expect(d.transaksi.koreksi_penjualan.jam_pasti).toBe(false);
  await db.exec("reset role");
  expect(
    (await q("select setoran,seharusnya,selisih from sesi_kas"))[0],
  ).toMatchObject({ setoran: 50000, seharusnya: 50000, selisih: 0 });
  expect((await q("select jumlah from stok"))[0].jumlah).toBe("970.000");
  await db.exec("set role authenticated");
  await expect(invoke({ ...p, alasan: "Berbeda" })).rejects.toThrow(/berbeda/);
  const qr = await invoke(request({ metode: "qris" }));
  expect(qr.total).toBe(28000);
});
it("edits price and qty; stale screen rejected; HPP old retained; delete and restore repeat stays balanced", async () => {
  const a = await invoke(request());
  let d = await details(a.id);
  await db.exec(
    `reset role;update bahan set harga_pokok=200;set role authenticated`,
  );
  const edit = request({
    aksi: "edit",
    id: a.id,
    sidik: d.sidik,
    items: d.items.map((i: {qty: number; harga: number}) => ({ ...i, qty: 2, harga: 25000 })),
  });
  await invoke(edit);
  await expect(
    invoke({ ...edit, request_id: crypto.randomUUID() }),
  ).rejects.toThrow(/berubah/);
  d = await details(a.id);
  expect(d.transaksi.total).toBe(50000);
  expect(d.transaksi.hpp_teoritis).toBe(2000);
  await db.exec("reset role");
  const stock = (await q("select jumlah from stok"))[0].jumlah;
  await db.exec("set role authenticated");
  for (let i = 0; i < 2; i++) {
    d = await details(a.id);
    await invoke(request({ aksi: "hapus", id: a.id, sidik: d.sidik }));
    d = await details(a.id);
    expect(d.transaksi.status).toBe("dihapus");
    await invoke(request({ aksi: "pulihkan", id: a.id, sidik: d.sidik }));
  }
  await db.exec("reset role");
  expect((await q("select jumlah from stok"))[0].jumlah).toBe(stock);
  await db.exec("set role authenticated");
});
it("historical sales after physical SO leave current stock intact and record why", async () => {
  await db.exec(
    `reset role;insert into opname(id,outlet_id,tanggal) values('${id(10)}','${id(2)}','2026-11-18');insert into item_opname(opname_id,bahan_id,qty_sistem,qty_fisik,harga_unit,nilai) values('${id(10)}','${id(6)}',900,900,100,0);`,
  );
  const stock = (await q("select jumlah from stok"))[0].jumlah;
  await db.exec("set role authenticated");
  const r = await invoke(request());
  expect(r.stok_dilewati_so).toEqual([id(6)]);
  const d = await details(r.id);
  await invoke(request({ aksi: "hapus", id: r.id, sidik: d.sidik }));
  await db.exec("reset role");
  expect((await q("select jumlah from stok"))[0].jumlah).toBe(stock);
  await db.exec("set role authenticated");
});
it("rejects unprivileged, cross-outlet, pending offline, wrong date, invalid quantities and promo edits atomically", async () => {
  await expect(invoke(request({ tanggal: "2026-11-16" }))).rejects.toThrow(
    /Tanggal/,
  );
  await expect(
    invoke(request({ items: [{ menu_id: id(4), qty: 0, harga: 28000 }] })),
  ).rejects.toThrow(/Jumlah/);
  await db.exec(
    `reset role;update sesi_kas set pending_offline=1;set role authenticated`,
  );
  await expect(invoke(request())).rejects.toThrow(/offline/);
  await db.exec(
    `reset role;update sesi_kas set pending_offline=0;insert into pos_perangkat values('${id(2)}',1);set role authenticated`,
  );
  await expect(invoke(request())).rejects.toThrow(/antrean offline/);
  await db.exec(`reset role;delete from pos_perangkat;set role authenticated`);
  const r = await invoke(request());
  await db.exec(
    `reset role;update transaksi set promo_snapshot='{}' where id='${r.id}';set role authenticated`,
  );
  const d = await details(r.id);
  await expect(
    invoke(request({ aksi: "edit", id: r.id, sidik: d.sidik })),
  ).rejects.toThrow(/promo/);
  await db.exec(
    `reset role;update penugasan set peran='barista';set role authenticated`,
  );
  await expect(invoke(request())).rejects.toThrow(/Hanya/);
  await db.exec("reset role;set role anon");
  await expect(invoke(request())).rejects.toThrow(/permission denied/);
  await db.exec(
    `reset role;update penugasan set peran='finance';set role authenticated`,
  );
});

it("preview rolls back every write; changed cash invalidates preview, cross-outlet denied", async () => {
  const p = request();
  await db.exec("reset role");
  const before = (await q("select count(*) n from transaksi"))[0].n;
  await db.exec("set role authenticated");
  const v = await raw({ ...p, pratinjau: true });
  expect(v.pratinjau).toBe(true);
  await db.exec("reset role");
  expect((await q("select count(*) n from transaksi"))[0].n).toBe(before);
  await db.exec("set role authenticated");
  await db.exec(
    "reset role;update sesi_kas set setoran=setoran+1;set role authenticated",
  );
  await expect(raw({ ...p, sidik_preview: v.sidik_preview })).rejects.toThrow(
    /pratinjau/,
  );
  await expect(invoke(request({ outlet_id: id(99) }))).rejects.toThrow(
    /Outlet/,
  );
});
