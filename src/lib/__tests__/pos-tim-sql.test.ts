import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const id = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  andi = id(2),
  budi = id(3),
  o = id(4),
  shift = id(5),
  menu = id(6),
  bahan = id(7);
const device = "d".repeat(64),
  token = "t".repeat(64);
const q = async <T = Record<string, unknown>>(s: string, p: unknown[] = []) =>
  (await db.query<T>(s, p)).rows;
const as = async (uid: string) => {
  await q("select set_config('app.uid',$1,false)", [uid]);
};
const call = async <T = Record<string, unknown>>(
  name: string,
  args: unknown[],
) =>
  (
    await q<{ v: T }>(
      `select ${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) v`,
      args,
    )
  )[0].v;
let sid: string, permit: string;
beforeAll(async () => {
  // Crypto/Vault doubles test access and workflow only; real crypto is verified separately on Supabase.
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;create schema storage;create schema vault;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text,encrypted_password text,email_confirmed_at timestamptz,email_change text,email_change_token_new text,updated_at timestamptz);
create table auth.identities(user_id uuid,provider text,identity_data jsonb,updated_at timestamptz);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
create function extensions.digest(text,text) returns bytea language sql immutable as $$select decode(md5($1),'hex')$$;
create function extensions.gen_salt(text) returns text language sql as $$select 'salt'::text$$;
create function extensions.crypt(text,text) returns text language sql immutable as $$select 'test:'||md5($1)$$;
create table vault.decrypted_secrets(id uuid primary key default gen_random_uuid(),decrypted_secret text,name text);
create function vault.create_secret(text,text default null,text default null) returns uuid language sql as $$insert into vault.decrypted_secrets(decrypted_secret,name) values($1,$2) returning id$$;
create function vault.update_secret(uuid,text) returns void language sql as $$update vault.decrypted_secrets set decrypted_secret=$2 where id=$1$$;`);
  await db.exec("set check_function_bodies=off");
  await db.exec(
    readFileSync(
      new URL("./fixtures/pos-team-baseline.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec("set check_function_bodies=on");
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261015083400_karyawan_pos_tim.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(readFileSync(new URL('../../../supabase/migrations/20261015083632_pos_tim_akses_indeks.sql',import.meta.url),'utf8'));
  await q("insert into outlet(id,nama) values($1,'Outlet Uji')", [o]);
  for (const [uid, nama, role] of [
    [owner, "Admin Uji", "owner"],
    [andi, "Andi Uji", "kasir"],
    [budi, "Budi Uji", "barista"],
  ]) {
    await q("insert into pengguna(id,nama,email) values($1,$2,$3)", [
      uid,
      nama,
      `${nama.replaceAll(" ", "")}@example.test`,
    ]);
    await q(
      "insert into auth.users(id,encrypted_password) values($1,'password-asli')",
      [uid],
    );
    await q(
      "insert into penugasan(pengguna_id,peran,outlet_id) values($1,$2,$3)",
      [uid, role, role === "owner" ? null : o],
    );
  }
  await as(owner);
  await call("atur_pos_pin", [andi, "andi", "1234"]);
  await call("atur_pos_pin", [budi, "budi", "4321"]);
  await q(
    "insert into shift_outlet(id,outlet_id,nama,jam_mulai,jam_selesai) values($1,$2,'Shift Uji',(now() at time zone 'Asia/Jakarta')::time-interval '20 minutes',(now() at time zone 'Asia/Jakarta')::time+interval '6 hours')",
    [shift, o],
  );
  // Stable same-day fixture independent of the test runner's clock, including midnight.
  await q(
    "insert into jadwal_shift(outlet_id,pengguna_id,shift_id,tanggal,status) select $1,x,$2,(now() at time zone 'Asia/Jakarta'-interval '20 minutes')::date,'terbit' from unnest($3::uuid[]) x",
    [o, shift, [andi, budi]],
  );
  await q(
    "insert into bahan(id,nama,satuan_beli,satuan_pakai,harga_pokok) values($1,'Beans','kg','kg',1000)",
    [bahan],
  );
  await q(
    "insert into menu(id,nama,harga_langsung,harga_ojol) values($1,'Kopi',10000,12000)",
    [menu],
  );
  await q("insert into resep(menu_id,bahan_id,takaran) values($1,$2,1)", [
    menu,
    bahan,
  ]);
  await q("insert into stok(outlet_id,bahan_id,jumlah) values($1,$2,100)", [
    o,
    bahan,
  ]);
}, 30000);
afterAll(() => db.close());
it("keeps PIN independent, restricts reveal, and audits administrative access", async () => {
  expect(await call("lihat_pos_pin", [andi])).toBe("1234");
  expect(
    (
      await q("select encrypted_password from auth.users where id=$1", [andi])
    )[0].encrypted_password,
  ).toBe("password-asli");
  await as(andi);
  await expect(call("lihat_pos_pin", [budi])).rejects.toThrow("admin");
  await expect(call("atur_pos_pin", [andi, "andi", "5555"])).rejects.toThrow(
    "HRD",
  );
});
it("requires fresh photo and GPS, records notes, and retries attendance idempotently", async () => {
  for (const uid of [andi, budi]) {
    await as(uid);
    const foto = `${uid}/masuk.jpg`,
      client = crypto.randomUUID();
    await q(
      "insert into storage.objects(bucket_id,name) values('absensi',$1)",
      [foto],
    );
    await expect(
      call("absen_karyawan", [
        o,
        "masuk",
        foto,
        null,
        null,
        10,
        "Catatan masuk",
        client,
      ]),
    ).rejects.toThrow("Lokasi");
    const a = await call("absen_karyawan", [
      o,
      "masuk",
      foto,
      -7.3,
      109.4,
      10,
      "Catatan masuk",
      client,
    ]);
    expect(a.status).toBe("telat");
    expect(
      await call("absen_karyawan", [
        o,
        "masuk",
        foto,
        -7.3,
        109.4,
        10,
        "Catatan masuk",
        client,
      ]),
    ).toEqual(a);
    expect(
      (
        await q("select masuk_catatan from absensi where pengguna_id=$1", [uid])
      )[0].masuk_catatan,
    ).toBe("Catatan masuk");
  }
});
it("requires tablet approval and explicit PIN before opening one shared team session", async () => {
  await as(andi);
  await expect(
    call("buka_pos_tim", [
      o,
      device,
      "andi",
      "1234",
      100000,
      [andi, budi],
      token,
    ]),
  ).rejects.toThrow("Tablet");
  const d = await call<string>("minta_tablet_pos", [o, "Tablet Uji", device]);
  await as(owner);
  await call("atur_tablet_pos", [d, true, "Tablet outlet sudah diperiksa"]);
  await as(andi);
  expect((await call("status_pos_tim", [o, device, token, false])).boleh).toBe(
    false,
  );
  expect(
    (
      await call("buka_pos_tim", [
        o,
        device,
        "andi",
        "0000",
        100000,
        [andi, budi],
        token,
      ])
    ).error,
  ).toBeTruthy();
  const opened = await call("buka_pos_tim", [
    o,
    device,
    "andi",
    "1234",
    100000,
    [andi, budi],
    token,
  ]);
  sid = opened.sesi_id as string;
  permit = opened.izin_id as string;
  expect((await call("status_pos_tim", [o, device, token, false])).boleh).toBe(
    true,
  );
  expect(
    (await q("select * from pos_tim_anggota where sesi_id=$1", [sid])).length,
  ).toBe(2);
});
const payload = () => ({
  client_id: crypto.randomUUID(),
  outlet_id: o,
  sesi_id: sid,
  izin_id: permit,
  device_token: device,
  pos_token: token,
  waktu_asli: new Date().toISOString(),
  kanal: "langsung",
  tipe: "dine_in",
  metode: "tunai",
  diterima: 20000,
  diskon: 0,
  items: [{ menu_id: menu, varian_ids: [], qty: 1, catatan: "" }],
});
it("records a sale exactly once, rejects mismatched retries, and deducts stock once", async () => {
  const p = payload();
  const r = await call("buat_transaksi", [p]);
  expect(r.total).toBe(10000);
  expect((await call("buat_transaksi", [p])).ulang).toBe(true);
  await expect(
    call("buat_transaksi", [{ ...p, diterima: 30000 }]),
  ).rejects.toThrow("data lain");
  expect(
    Number(
      (await q("select jumlah from stok where bahan_id=$1", [bahan]))[0].jumlah,
    ),
  ).toBe(99);
});
it("lets the team continue when the original opener clocks out", async () => {
  await as(andi);
  const foto = `${andi}/pulang.jpg`;
  await q("insert into storage.objects(bucket_id,name) values('absensi',$1)", [
    foto,
  ]);
  await call("absen_karyawan", [
    o,
    "pulang",
    foto,
    -7.3,
    109.4,
    10,
    "Pulang dulu",
    crypto.randomUUID(),
  ]);
  expect((await call("status_pos_tim", [o, device, token, true])).boleh).toBe(
    true,
  );
  expect((await call("buat_transaksi", [payload()])).total).toBe(10000);
});
it("revokes a cashier permit when access is removed, independently of clock out", async () => {
  await q("delete from penugasan where pengguna_id=$1 and peran='kasir'", [
    andi,
  ]);
  await as(budi);
  expect((await call("status_pos_tim", [o, device, token, true])).boleh).toBe(
    false,
  );
  await expect(call("buat_transaksi", [payload()])).rejects.toThrow("dicabut");
  await q(
    "insert into penugasan(pengguna_id,peran,outlet_id) values($1,'kasir',$2)",
    [andi, o],
  );
  await as(andi);
});
it("guards offline time, payment modes, immutable recipe costs, and quoted prices", async () => {
  await expect(
    call("buat_transaksi", [
      {
        ...payload(),
        waktu_asli: "2000-01-01T00:00:00Z",
        sinkron_offline: true,
      },
    ]),
  ).rejects.toThrow("Waktu");
  await expect(
    call("buat_transaksi", [
      { ...payload(), metode: "qris", sinkron_offline: true },
    ]),
  ).rejects.toThrow("tunai");
  await q("update bahan set harga_pokok=2000 where id=$1", [bahan]);
  await expect(
    call("buat_transaksi", [{ ...payload(), sinkron_offline: true }]),
  ).rejects.toThrow("Resep/HPP");
  await q("update bahan set harga_pokok=1000 where id=$1", [bahan]);
  await q("update menu set harga_langsung=15000 where id=$1", [menu]);
  const p = { ...payload(), sinkron_offline: true };
  expect((await call("buat_transaksi", [p])).total).toBe(10000);
  await q("update menu set harga_langsung=10000 where id=$1", [menu]);
});
it("deducts physical remittances once even when finance rejects and proof is corrected", async () => {
  await as(budi);
  const foto = `setoran/${o}/${budi}/foto.jpg`;
  await q(
    "insert into storage.objects(bucket_id,name) values('operasional-bukti',$1)",
    [foto],
  );
  const p = {
    client_id: crypto.randomUUID(),
    outlet_id: o,
    sesi_kas_id: sid,
    cara: "tunai",
    waktu: new Date().toISOString(),
    pengambil: "Petugas Uji",
    penanggung_jawab: "Budi Uji",
    tujuan: "Pusat",
    bukti_path: foto,
    catatan: "Diambil petugas",
    rincian: [
      {
        tanggal: (
          await q<{ d: string }>(
            "select to_char(now() at time zone 'Asia/Jakarta','YYYY-MM-DD') d",
          )
        )[0].d,
        jumlah: 10000,
      },
    ],
  };
  const r = await call<string>("buat_setoran", [p]);
  expect(await call("buat_setoran", [p])).toBe(r);
  await q("update setoran_omzet set status='ditolak' where id=$1", [r]);
  expect(Number((await call("ringkasan_kas_tim", [sid])).keluar)).toBe(10000);
  await call("buat_setoran", [
    {
      ...p,
      client_id: crypto.randomUUID(),
      sesi_kas_id: undefined,
      pengganti_id: r,
    },
  ]);
  expect(
    (await q("select * from pos_kas_keluar where sesi_id=$1", [sid])).length,
  ).toBe(1);
  await as(andi);
});
it("closes provisionally with pending IDs, then reconciles the original cash transaction", async () => {
  const p = { ...payload(), sinkron_offline: true };
  const r = await call("tutup_pos_tim", [
    sid,
    device,
    "andi",
    "1234",
    130000,
    "Termasuk satu penjualan tertunda",
    [p.client_id],
  ]);
  expect(r.pending).toBe(1);
  await expect(
    call("buat_transaksi", [{ ...payload(), sinkron_offline: true }]),
  ).rejects.toThrow("antrean");
  expect((await call("buat_transaksi", [p])).total).toBe(10000);
  const s = (
    await q(
      "select pending_offline,rekap_status,selisih,fisik_akhir from sesi_kas where id=$1",
      [sid],
    )
  )[0];
  expect(s.rekap_status).toBe("final");
  expect(Number(s.selisih)).toBe(0);
  expect(Number(s.fisik_akhir)).toBe(130000);
});
it("prevents direct authenticated cash/session writes and private PIN reads", async () => {
  for (const table of [
    "sesi_kas",
    "transaksi",
    "item_transaksi",
    "pembayaran",
    "absensi",
  ])
    expect(
      (
        await q(
          "select has_table_privilege('authenticated',$1,'insert') allowed",
          [table],
        )
      )[0].allowed,
    ).toBe(false);
  expect(
    (
      await q(
        "select has_schema_privilege('authenticated','matur_internal','usage') allowed",
      )
    )[0].allowed,
  ).toBe(false);
  await expect(
    q("delete from storage.objects where name=$1", [`${andi}/masuk.jpg`]),
  ).rejects.toThrow();
});
