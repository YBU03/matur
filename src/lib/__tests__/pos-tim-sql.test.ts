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
let device = "d".repeat(64),
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
let lateHistory: ReturnType<typeof payload>;
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
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261015083632_pos_tim_akses_indeks.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec("alter type peran add value 'tablet'");
  await db.exec(
    "alter table auth.users add column instance_id uuid,add column aud text,add column role text,add column raw_app_meta_data jsonb,add column raw_user_meta_data jsonb,add column created_at timestamptz,add column confirmation_token text,add column recovery_token text;alter table auth.identities add column id uuid,add column provider_id text,add column last_sign_in_at timestamptz,add column created_at timestamptz;",
  );
  for (const name of [
    "0057_pos_tablet.sql",
    "0058_masuk_pos_kode_pin.sql",
    "20261016021040_pos_pindah_perangkat.sql",
    "20261016021744_pos_pindah_rekonsiliasi.sql",
    "20261016023648_pos_reset_akses.sql",
  ])
    await db.exec(
      readFileSync(
        new URL("../../../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  await q("insert into outlet(id,nama) values($1,'Outlet Uji')", [o]);
  for (const [uid, nama, role] of [
    [owner, "Admin Uji", "owner"],
    [andi, "Andi Uji", "kasir"],
    [budi, "Budi Uji", "barista"],
    [id(8), "Admin Pusat Uji", "admin_pusat"],
    [id(9), "HRD Uji", "hrd"],
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
      [uid, role, ["owner", "hrd", "admin_pusat"].includes(role) ? null : o],
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
it("lets Admin Pusat inspect the human login and device without revealing PINs", async () => {
  await as(andi);
  const r = await call("masuk_pos_tablet", [
    "andi",
    "1234",
    o,
    device,
    "p".repeat(32),
  ]);
  expect(r.error).toBeUndefined();
  await as(id(8));
  const panel = await call<{
    perangkat_admin: boolean;
    staf: unknown[];
    devices: { login_nama: string; id: string }[];
  }>("panel_pos_admin", []);
  expect(panel.perangkat_admin).toBe(true);
  expect(panel.staf).toEqual([]);
  expect(panel.devices.some((d) => d.login_nama === "Andi Uji")).toBe(true);
  await expect(call("lihat_pos_pin", [andi])).rejects.toThrow("admin");
  await as(andi);
});
it("moves one open cash session safely and preserves historical offline sales", async () => {
  const originalDevice = device,
    old = payload();
  const target = "e".repeat(64);
  await as(budi);
  await expect(
    call("minta_pindah_pos", [
      sid,
      target,
      "Tablet kedua",
      "Browser uji",
      "Ganti perangkat untuk uji",
    ]),
  ).rejects.toThrow("admin");
  await as(id(8));
  const request = await call("minta_pindah_pos", [
    sid,
    target,
    "Tablet kedua",
    "Browser uji",
    "Ganti perangkat untuk uji",
  ]);
  await expect(
    call("selesaikan_pindah_pos", [request.id, target, true]),
  ).rejects.toThrow("Tunggu");
  await as(andi);
  await expect(
    call("buka_pos_tim", [o, originalDevice, "andi", "1234", 0, [], token]),
  ).rejects.toThrow("dipindahkan");
  await expect(call("buat_transaksi", [payload()])).rejects.toThrow(
    /dikunci|terkunci/,
  );
  const sourceAccount = (
    await q<{ akun_id: string }>(
      "select akun_id from pos_perangkat where id=(select perangkat_id from sesi_kas where id=$1)",
      [sid],
    )
  )[0].akun_id;
  await as(sourceAccount);
  // The old client first freezes its UI, uploads its queue, then reports empty.
  await call("lapor_perangkat_pos", [
    originalDevice,
    [old.client_id],
    false,
    "Browser asal",
  ]);
  expect(
    (await call("buat_transaksi", [{ ...old, sinkron_offline: true }])).total,
  ).toBe(10000);
  await call("lapor_perangkat_pos", [originalDevice, [], true, "Browser asal"]);
  await as(id(9));
  await expect(
    call("selesaikan_pindah_pos", [request.id, "x".repeat(64), false]),
  ).rejects.toThrow("tujuan");
  await call("selesaikan_pindah_pos", [request.id, target, false]);
  const sesi = (
    await q("select modal_laci,ditutup_at,kasir_id from sesi_kas where id=$1", [
      sid,
    ])
  )[0];
  expect(Number(sesi.modal_laci)).toBe(100000);
  expect(sesi.ditutup_at).toBeNull();
  expect(sesi.kasir_id).toBe(andi);
  await as(andi);
  await expect(call("buat_transaksi", [payload()])).rejects.toThrow("tablet");
  await as(sourceAccount);
  // Lost acknowledgement can replay the historic ID from the old device without duplicating stock.
  expect(
    (await call("buat_transaksi", [{ ...old, sinkron_offline: true }])).ulang,
  ).toBe(true);
  await q(
    "insert into penugasan(pengguna_id,peran,outlet_id) values($1,'kasir',$2)",
    [budi, o],
  );
  await as(budi);
  device = target;
  token = "z".repeat(64);
  const opened = await call("buka_pos_tim", [
    o,
    device,
    "budi",
    "4321",
    0,
    [],
    token,
  ]);
  permit = opened.izin_id as string;
  expect(opened.sesi_id).toBe(sid);
});
it("requires explicit acknowledgement when the old device is unreachable, then syncs its history", async () => {
  const old = payload(),
    source = device,
    target = "f".repeat(64);
  await as(id(8));
  const req = await call("minta_pindah_pos", [
    sid,
    target,
    "Tablet ketiga",
    "Browser baru",
    "Perangkat lama tidak terhubung",
  ]);
  await q(
    "update matur_internal.pos_pindah set aman_at=now()-interval '1 second' where id=$1",
    [req.id],
  );
  await expect(
    call("selesaikan_pindah_pos", [req.id, target, false]),
  ).rejects.toThrow("Konfirmasi");
  // The fixture advances the lease boundary; real clients always wait for the server deadline.
  await q("update matur_internal.pos_pindah set aman_at=now() where id=$1", [
    req.id,
  ]);
  await call("selesaikan_pindah_pos", [req.id, target, true]);
  await as(budi);
  lateHistory = old;
  await expect(
    call("buat_transaksi", [{ ...payload(), device_token: source }]),
  ).rejects.toThrow("tablet");
  device = target;
  token = "q".repeat(64);
  const opened = await call("buka_pos_tim", [
    o,
    device,
    "budi",
    "4321",
    0,
    [],
    token,
  ]);
  permit = opened.izin_id as string;
  expect(opened.sesi_id).toBe(sid);
});
it("can cancel an unfinished handover without closing the cash shift or changing staff credentials", async () => {
  await as(id(9));
  const req = await call("minta_pindah_pos", [
    sid,
    "g".repeat(64),
    "Tablet batal",
    "Browser uji",
    "Uji pembatalan pindah perangkat",
  ]);
  await call("batal_pindah_pos", [
    req.id,
    "Perangkat asal ternyata dapat dipakai",
  ]);
  await expect(
    call("selesaikan_pindah_pos", [req.id, "g".repeat(64), true]),
  ).rejects.toThrow("dibatalkan");
  await as(budi);
  const opened = await call("buka_pos_tim", [
    o,
    device,
    "budi",
    "4321",
    0,
    [],
    token,
  ]);
  permit = opened.izin_id as string;
  expect(opened.sesi_id).toBe(sid);
  await as(id(8));
  const panel = await call<{ pindah: { batal_at: string | null }[] }>(
    "panel_pos_admin",
    [],
  );
  expect(panel.pindah.some((r) => !!r.batal_at)).toBe(true);
  await as(budi);
});
it("resets stale device locks without closing the cash shift or changing its modal", async () => {
  await as(id(8));
  await expect(
    call("reset_akses_pos", [o, "Reset akses uji coba"]),
  ).rejects.toThrow("offline");
  const saved = await q<{ id: string; sampai_at: string }>(
    "select id,sampai_at from matur_internal.pos_izin where sesi_id=$1",
    [sid],
  );
  await q(
    "update matur_internal.pos_izin set sampai_at=now()-interval '1 second' where sesi_id=$1",
    [sid],
  );
  const r = await call("reset_akses_pos", [
    null,
    "Reset semua akses untuk uji coba",
  ]);
  expect(r.sesi_tim).toBe(1);
  expect(
    (await q("select perangkat_id from sesi_kas where id=$1", [sid]))[0]
      .perangkat_id,
  ).toBeNull();
  for (const iz of saved)
    await q("update matur_internal.pos_izin set sampai_at=$1 where id=$2", [
      iz.sampai_at,
      iz.id,
    ]);
  await as(budi);
  const opened = await call("buka_pos_tim", [
    o,
    device,
    "budi",
    "4321",
    0,
    [],
    token,
  ]);
  permit = opened.izin_id as string;
  expect(opened.sesi_id).toBe(sid);
  expect(
    Number(
      (await q("select modal_laci from sesi_kas where id=$1", [sid]))[0]
        .modal_laci,
    ),
  ).toBe(100000);
});
it("closes provisionally with pending IDs, then reconciles the original cash transaction", async () => {
  const p = { ...payload(), sinkron_offline: true };
  const r = await call("tutup_pos_tim", [
    sid,
    device,
    "andi",
    "1234",
    150000,
    "Termasuk satu penjualan tertunda",
    [p.client_id],
  ]);
  expect(r.pending).toBe(1);
  await expect(
    call("buat_transaksi", [{ ...payload(), sinkron_offline: true }]),
  ).rejects.toThrow("antrean");
  expect((await call("buat_transaksi", [p])).total).toBe(10000);
  expect((await call("ringkasan_kas_tim", [sid])).rekap_status).toBe(
    "sementara",
  );
  expect(
    (await call("buat_transaksi", [{ ...lateHistory, sinkron_offline: true }]))
      .total,
  ).toBe(10000);
  expect((await call("ringkasan_kas_tim", [sid])).rekap_status).toBe(
    "sementara",
  );
  await call("lapor_perangkat_pos", [
    "e".repeat(64),
    [],
    true,
    "Browser asal kembali terhubung",
  ]);
  const s = (
    await q(
      "select pending_offline,rekap_status,selisih,fisik_akhir from sesi_kas where id=$1",
      [sid],
    )
  )[0];
  expect(s.rekap_status).toBe("final");
  expect(Number(s.selisih)).toBe(0);
  expect(Number(s.fisik_akhir)).toBe(150000);
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

it("outlet credentials and daily PIC handovers preserve one drawer across S1/S2/S3", async () => {
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261016031138_pos_outlet_kas_harian.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261016032328_pos_outlet_login_indeks.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261016032634_pos_outlet_tutup_jalur_lama.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await as(owner);
  await call("atur_akses_pos_outlet", [
    o,
    "outlet-uji",
    "password-outlet-uji",
    true,
  ]);
  await expect(
    call("buka_pos_tim", [o, device, "andi", "1234", 0, [andi], token]),
  ).rejects.toThrow(/akun POS outlet/);
  await as(budi);
  await expect(
    call("atur_akses_pos_outlet", [o, "hacked", "password-outlet-uji", true]),
  ).rejects.toThrow();
  const bad = await call("masuk_pos_outlet", [
    "outlet-uji",
    "salah",
    "x".repeat(64),
    "z".repeat(40),
  ]);
  expect(bad.error).toBeTruthy();
  const login = await call("masuk_pos_outlet", [
    "outlet-uji",
    "password-outlet-uji",
    "x".repeat(64),
    "z".repeat(40),
  ]);
  expect(login.email).toBeTruthy();
  await as(owner);
  const panel = await call<{ outlets: unknown[] }>("panel_pos_admin", []);
  expect(panel.outlets.length).toBeGreaterThan(0);
  const [tablet] = await q("select id from pengguna where email=$1", [
    login.email,
  ]);
  await as(tablet.id as string);
  await q("update pengguna set status='aktif' where id=any($1::uuid[])", [
    [andi, budi],
  ]);
  await q(
    "update absensi set pulang_at=null where pengguna_id=any($1::uuid[])",
    [[andi, budi]],
  );
  await q(
    "insert into penugasan(pengguna_id,peran,outlet_id) values($1,'barista',$2) on conflict do nothing",
    [budi, o],
  );
  const opened = await call("pilih_pic_pos_outlet", [
    o,
    "x".repeat(64),
    andi,
    200000,
    null,
    "",
    "1".repeat(64),
  ]);
  const daily = opened.sesi_id;
  expect(
    (await call("status_pos_tim", [o, "x".repeat(64), "1".repeat(64), false]))
      .boleh,
  ).toBe(true);
  await expect(
    call("pilih_pic_pos_outlet", [
      o,
      "x".repeat(64),
      budi,
      null,
      null,
      "",
      "2".repeat(64),
    ]),
  ).rejects.toThrow(/fisik/);
  for (const [i, pic] of [
    [2, budi],
    [3, andi],
  ] as const) {
    const sh = id(100 + i);
    await q(
      "insert into shift_outlet(id,outlet_id,nama,jam_mulai,jam_selesai) select $1,$2,$3,jam_mulai,jam_selesai from shift_outlet where id=$4",
      [sh, o, "S" + i, shift],
    );
    await q(
      "update jadwal_shift set shift_id=$1 where pengguna_id=$2 and outlet_id=$3",
      [sh, pic, o],
    );
    const r = await call("pilih_pic_pos_outlet", [
      o,
      "x".repeat(64),
      pic,
      null,
      200000,
      "Diterima lengkap",
      String(i).repeat(64),
    ]);
    expect(r.sesi_id).toBe(daily);
    const st = await call<{ boleh: boolean; operator: { kasir: boolean } }>(
      "status_pos_tim",
      [o, "x".repeat(64), String(i).repeat(64), false],
    );
    expect(st.boleh).toBe(true);
    expect(st.operator.kasir).toBe(true);
    if (i === 2) {
      await db.exec("begin");
      try {
        const sale = await call("buat_transaksi", [
          {
            ...payload(),
            client_id: crypto.randomUUID(),
            sesi_id: daily,
            izin_id: r.izin_id,
            device_token: "x".repeat(64),
            pos_token: "2".repeat(64),
            waktu_asli: new Date().toISOString(),
          },
        ]);
        expect(sale.id).toBeTruthy();
        expect(
          (
            await q("select operator_id from transaksi where id=$1", [sale.id])
          )[0].operator_id,
        ).toBe(budi);
      } finally {
        await db.exec("rollback");
      }
    }
  }
  expect(
    Number(
      (await q("select modal_laci from sesi_kas where id=$1", [daily]))[0]
        .modal_laci,
    ),
  ).toBe(200000);
  expect(
    (await q("select * from pos_serah_terima where sesi_id=$1", [daily]))
      .length,
  ).toBe(3);
  const other = await call("masuk_pos_outlet", [
    "outlet-uji",
    "password-outlet-uji",
    "y".repeat(64),
    "z".repeat(40),
  ]);
  const [otherUser] = await q("select id from pengguna where email=$1", [
    other.email,
  ]);
  await as(otherUser.id as string);
  await expect(
    call("pilih_pic_pos_outlet", [
      o,
      "y".repeat(64),
      andi,
      999,
      null,
      "",
      "4".repeat(64),
    ]),
  ).rejects.toThrow(/perangkat lain/);
  await as(owner);
  await call("atur_akses_pos_outlet", [o, "outlet-uji", "", false]);
  await as(tablet.id as string);
  expect(
    (await call("status_pos_tim", [o, "x".repeat(64), "3".repeat(64), false]))
      .boleh,
  ).toBe(false);
  await expect(
    call("pilih_pic_pos_outlet", [
      o,
      "x".repeat(64),
      andi,
      null,
      null,
      "",
      "5".repeat(64),
    ]),
  ).rejects.toThrow(/dinonaktifkan/);
  await as(owner);
  await call("atur_akses_pos_outlet", [o, "outlet-uji", "", true]);
  await call("masuk_pos_outlet", [
    "outlet-uji",
    "password-outlet-uji",
    "x".repeat(64),
    "z".repeat(40),
  ]);
  await as(tablet.id as string);
  await call("pilih_pic_pos_outlet", [
    o,
    "x".repeat(64),
    andi,
    null,
    null,
    "",
    "6".repeat(64),
  ]);
  await call("tutup_kas_outlet", [
    daily,
    "x".repeat(64),
    "",
    "6".repeat(64),
    200000,
    "Tutup hari ini",
    [],
  ]);
  expect(
    (await q("select ditutup_at from sesi_kas where id=$1", [daily]))[0]
      .ditutup_at,
  ).toBeTruthy();
  await expect(
    call("pilih_pic_pos_outlet", [
      o,
      "x".repeat(64),
      andi,
      200000,
      null,
      "",
      "7".repeat(64),
    ]),
  ).rejects.toThrow(/sudah ditutup/);
});
it("scopes outlet credentials and device administration at the database boundary", async () => {
  const hrd = id(110),
    outside = id(111);
  await as(owner);
  await q("insert into auth.users(id,email) values($1,'hrd-scope@test.id')", [
    hrd,
  ]);
  await q(
    "insert into pengguna(id,nama,email,status) values($1,'HRD Terbatas','hrd-scope@test.id','aktif')",
    [hrd],
  );
  await q(
    "insert into penugasan(pengguna_id,peran,outlet_id) values($1,'hrd',$2)",
    [hrd, o],
  );
  await q("insert into outlet(id,nama) values($1,'Outlet Lain')", [outside]);
  await as(hrd);
  const rows = await call<{ id: string }[]>("panel_akses_pos_outlet", []);
  expect(rows.map((x) => x.id)).toEqual([o]);
  await expect(
    call("atur_akses_pos_outlet", [
      outside,
      "outlet-lain",
      "password-outlet-lain",
      true,
    ]),
  ).rejects.toThrow(/berwenang/);
  await expect(
    call("reset_akses_pos", [null, "Reset semua perangkat"]),
  ).rejects.toThrow(/kewenangan/);
  const panel = await call<{ outlets: { id: string }[] }>(
    "panel_pos_admin",
    [],
  );
  expect(panel.outlets.every((x) => x.id === o)).toBe(true);
  for (const sig of [
    "pilih_pic_pos_outlet(uuid,text,uuid,bigint,bigint,text,text)",
    "atur_akses_pos_outlet(uuid,text,text,boolean)",
    "tutup_kas_outlet(uuid,text,text,text,bigint,text,uuid[])",
    "masuk_pos_tablet(text,text,uuid,text,text)",
  ]) {
    expect(
      (
        await q("select has_function_privilege('anon',$1,'execute') ok", [sig])
      )[0].ok,
    ).toBe(false);
  }
  expect(
    (
      await q(
        "select has_table_privilege('authenticated','matur_internal.pos_outlet_akses','select') ok",
      )
    )[0].ok,
  ).toBe(false);
});
it("adds, edits and deletes outlet access without deleting financial history or restoring stale credentials", async () => {
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261016060649_pos_outlet_kelola_akses.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const outside = id(111);
  await as(owner);
  const version = async (outlet: string) =>
    (
      await q<{ v: string }>(
        "select diubah_at::text v from matur_internal.pos_outlet_akses where outlet_id=$1",
        [outlet],
      )
    )[0].v;
  const totals = async () =>
    q(
      "select (select count(*) from transaksi) tx,(select count(*) from sesi_kas) kas,(select count(*) from pos_serah_terima) serah,(select sum(modal_laci) from sesi_kas) modal",
    );
  await call("simpan_akses_pos_outlet", [
    outside,
    "outlet-baru",
    "password-baru-123",
    true,
    true,
    null,
  ]);
  await expect(
    call("simpan_akses_pos_outlet", [
      outside,
      "outlet-baru",
      "password-baru-123",
      true,
      true,
      null,
    ]),
  ).rejects.toThrow(/sudah memiliki/);
  const v1 = await version(outside);
  const hash = (
    await q(
      "select password_hash from matur_internal.pos_outlet_akses where outlet_id=$1",
      [outside],
    )
  )[0].password_hash;
  await call("simpan_akses_pos_outlet", [
    outside,
    "outlet-edit",
    "",
    true,
    false,
    v1,
  ]);
  expect(
    (
      await q(
        "select password_hash from matur_internal.pos_outlet_akses where outlet_id=$1",
        [outside],
      )
    )[0].password_hash,
  ).toBe(hash);
  await expect(
    call("simpan_akses_pos_outlet", [
      outside,
      "stale-edit",
      "",
      true,
      false,
      v1,
    ]),
  ).rejects.toThrow(/sudah berubah/);
  await expect(call("hapus_akses_pos_outlet", [outside, v1])).rejects.toThrow(
    /sudah berubah/,
  );
  await as(id(110));
  await expect(
    call("hapus_akses_pos_outlet", [outside, await version(outside)]),
  ).rejects.toThrow(/berwenang/);
  await as(budi);
  await expect(
    call("hapus_akses_pos_outlet", [o, await version(o)]),
  ).rejects.toThrow(/berwenang/);
  await as(owner);
  const counts = await totals();
  const original = (
    await q<{ username: string }>(
      "select username from matur_internal.pos_outlet_akses where outlet_id=$1",
      [o],
    )
  )[0].username;
  await call("hapus_akses_pos_outlet", [o, await version(o)]);
  expect(await totals()).toEqual(counts);
  expect(
    (
      await q(
        "select count(*) n from matur_internal.pos_izin i join pos_perangkat p on p.id=i.perangkat_id where p.outlet_id=$1 and i.ditarik_at is null",
        [o],
      )
    )[0].n,
  ).toBe(0);
  const login = await call("masuk_pos_outlet", [
    original,
    "password-outlet-uji",
    "x".repeat(64),
    "z".repeat(40),
  ]);
  expect(login.error).toBeTruthy();
  const panel = await call<{ id: string; username: string | null }[]>(
    "panel_akses_pos_outlet",
    [],
  );
  expect(panel.find((x) => x.id === o)?.username).toBeNull();
  await expect(
    call("atur_akses_pos_outlet", [o, original, "", true]),
  ).rejects.toThrow(/Password/);
  await expect(
    call("simpan_akses_pos_outlet", [o, original, "", true, true, null]),
  ).rejects.toThrow(/Password/);
  await expect(
    call("simpan_akses_pos_outlet", [
      o,
      original,
      "password-outlet-uji",
      true,
      false,
      await version(o),
    ]),
  ).rejects.toThrow(/dihapus/);
  await call("simpan_akses_pos_outlet", [
    outside,
    original,
    "",
    true,
    false,
    await version(outside),
  ]);
  await call("simpan_akses_pos_outlet", [
    o,
    "outlet-kembali",
    "password-baru-kembali",
    true,
    true,
    null,
  ]);
  expect(
    (
      await q(
        "select deleted_at,aktif from matur_internal.pos_outlet_akses where outlet_id=$1",
        [o],
      )
    )[0],
  ).toEqual({ deleted_at: null, aktif: true });
  await expect(
    call("simpan_akses_pos_outlet", [
      o,
      original,
      "",
      true,
      false,
      await version(o),
    ]),
  ).rejects.toThrow(/dipakai outlet lain/);
  expect(await totals()).toEqual(counts);
  for (const sig of [
    "hapus_akses_pos_outlet(uuid,timestamptz)",
    "simpan_akses_pos_outlet(uuid,text,text,boolean,boolean,timestamptz)",
  ]) {
    expect(
      (
        await q("select has_function_privilege('anon',$1,'execute') ok", [sig])
      )[0].ok,
    ).toBe(false);
  }
});

it("HRD authorizes the same closed daily drawer, retains history, revokes leases and requires a fresh PIC handover", async()=>{
 // Schema additions already deployed by automatic-close migration.
 await db.exec("alter table sesi_kas add column if not exists tutup_otomatis boolean default false,add column if not exists dihitung_at timestamptz,add column if not exists dihitung_oleh uuid");
 await db.exec("create schema pos_training_internal");
 const scope=readFileSync(new URL('../../../supabase/migrations/20261026033059_pos_testing_hrd_outlet.sql',import.meta.url),'utf8').split('create function matur_internal.panel_testing_outlet')[0].replaceAll('matur_internal.admin_testing_outlet','pos_training_internal.admin_testing_outlet');
 await db.exec(scope);
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026034322_pos_lanjutkan_kas_admin.sql',import.meta.url),'utf8'));
 const safeCall: typeof call = async(name,args)=>{await db.exec('savepoint request');try{const result=await call(name,args);await db.exec('release savepoint request');return result as never;}catch(e){await db.exec('rollback to savepoint request;release savepoint request');throw e;}};
 await db.exec('begin');
 try {
  await as(owner);
  const [daily]=await q<{id:string}>("select id from sesi_kas where kas_harian and outlet_id=$1 order by dibuka_at desc limit 1",[o]);
  await q("update sesi_kas set ditutup_at=now(),fisik_akhir=200000,setoran=0,selisih=0,rekap_status='final',pending_offline=0 where id=$1",[daily.id]);
  await q('delete from matur_internal.pos_pending where sesi_id=$1',[daily.id]);
  await q('update matur_internal.pos_pindah set selesai_at=now() where sesi_id=$1 and selesai_at is null',[daily.id]);
  const v=(await q<{v:string}>('select ditutup_at::text v from sesi_kas where id=$1',[daily.id]))[0].v;
  await as(budi);await expect(safeCall('izinkan_lanjut_kas_pos',[daily.id,v,'Kas terlanjur ditutup'])).rejects.toThrow(/berwenang/);
  await as(id(9));
  await expect(safeCall('izinkan_lanjut_kas_pos',[daily.id,v,'x'])).rejects.toThrow(/alasan/);
  await expect(safeCall('izinkan_lanjut_kas_pos',[daily.id,'2000-01-01','Kas terlanjur ditutup'])).rejects.toThrow(/berubah/);
  await q('update sesi_kas set pending_offline=1 where id=$1',[daily.id]);await expect(safeCall('izinkan_lanjut_kas_pos',[daily.id,v,'Kas terlanjur ditutup'])).rejects.toThrow(/sinkronisasi/);
  await q('update sesi_kas set pending_offline=0 where id=$1',[daily.id]);
  await q("update pengguna set status='nonaktif' where id=$1",[id(9)]);
  await expect(safeCall('izinkan_lanjut_kas_pos',[daily.id,v,'Kas terlanjur ditutup'])).rejects.toThrow(/berwenang/);
  await q("update pengguna set status='aktif' where id=$1",[id(9)]);
  await q('update penugasan set outlet_id=$1 where pengguna_id=$2',[id(9999),id(9)]);
  await expect(safeCall('izinkan_lanjut_kas_pos',[daily.id,v,'Kas terlanjur ditutup'])).rejects.toThrow(/berwenang/);
  await q('update penugasan set outlet_id=null where pengguna_id=$1',[id(9)]);
  await q('update sesi_kas set tanggal_shift=tanggal_shift-1 where id=$1',[daily.id]);
  await expect(safeCall('izinkan_lanjut_kas_pos',[daily.id,v,'Kas terlanjur ditutup'])).rejects.toThrow(/jam shift/);
  await q('update sesi_kas set tanggal_shift=tanggal_shift+1 where id=$1',[daily.id]);
  await q("insert into laporan_bulanan(id,outlet_id,periode,nama_outlet,tgl_terbit) select $1,outlet_id,date_trunc('month',tanggal_shift)::date,'Uji',current_date from sesi_kas where id=$2",[id(8888),daily.id]);
  await expect(safeCall('izinkan_lanjut_kas_pos',[daily.id,v,'Kas terlanjur ditutup'])).rejects.toThrow(/diterbitkan/);
  await q('delete from laporan_bulanan where id=$1',[id(8888)]);
  await db.exec('set local role authenticated');
  expect((await safeCall<{kas:unknown[]}>('panel_lanjut_kas_pos',[])).kas.length).toBeGreaterThan(0);
  await db.exec('reset role');
  const before=(await q('select count(*) n from transaksi'))[0].n;
  await safeCall('izinkan_lanjut_kas_pos',[daily.id,v,'Kas terlanjur ditutup']);
  await safeCall('izinkan_lanjut_kas_pos',[daily.id,v,'Kas terlanjur ditutup']);
  expect((await q('select modal_laci,ditutup_at,fisik_akhir from sesi_kas where id=$1',[daily.id]))[0]).toEqual({modal_laci:200000,ditutup_at:null,fisik_akhir:null});
  expect((await q('select * from pos_kas_internal.riwayat_lanjut where sesi_id=$1',[daily.id]))).toHaveLength(1);
  expect((await q<{penutupan:{fisik_akhir:number}}>('select penutupan from pos_kas_internal.riwayat_lanjut where sesi_id=$1',[daily.id]))[0].penutupan.fisik_akhir).toBe(200000);
  expect((await q('select * from matur_internal.pos_izin where sesi_id=$1 and ditarik_at is null',[daily.id]))).toHaveLength(0);
  expect((await q('select count(*) n from transaksi'))[0].n).toBe(before);
  const login=await safeCall('masuk_pos_outlet',['outlet-kembali','password-baru-kembali','x'.repeat(64),'z'.repeat(40)]);
  const [tablet]=await q<{id:string}>('select id from pengguna where email=$1',[login.email]);await as(tablet.id);
  await q('update absensi set pulang_at=null where pengguna_id=$1',[andi]);
  await expect(safeCall('pilih_pic_pos_outlet',[o,'x'.repeat(64),andi,null,null,'','7'.repeat(64)])).rejects.toThrow(/fisik/);
  const r=await safeCall('pilih_pic_pos_outlet',[o,'x'.repeat(64),andi,null,200000,'Terima kembali','7'.repeat(64)]);expect(r.sesi_id).toBe(daily.id);
  expect((await safeCall('status_pos_tim',[o,'x'.repeat(64),'7'.repeat(64),false])).boleh).toBe(true);
  expect(Number((await q('select modal_laci from sesi_kas where id=$1',[daily.id]))[0].modal_laci)).toBe(200000);
 }finally{await db.exec('rollback');}
});

it("temporary presentation exposes full POS to outlet staff without clock-in, expires and leaves other outlets protected",async()=>{
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026040452_pos_presentasi_sementara.sql',import.meta.url),'utf8'));
 const safeCall:typeof call=async(name,args)=>{await db.exec('savepoint request');try{const r=await call(name,args);await db.exec('release savepoint request');return r as never;}catch(e){await db.exec('rollback to savepoint request;release savepoint request');throw e;}};
 await db.exec('begin');
 try{
  await as(id(9));await safeCall('atur_presentasi_pos',[o,30,'Presentasi outlet uji']);
  await expect(safeCall('atur_presentasi_pos',[o,121,'Durasi terlalu panjang'])).rejects.toThrow(/durasi/);
  await as(budi);await expect(safeCall('atur_presentasi_pos',[o,30,'Bukan kewenangan staf'])).rejects.toThrow(/berwenang/);
  await as(owner);const [daily]=await q<{id:string}>('select id from sesi_kas where outlet_id=$1 and kas_harian order by dibuka_at desc limit 1',[o]);
  await q("update sesi_kas set ditutup_at=null,pending_offline=0 where id=$1",[daily.id]);
  await q('update pos_serah_terima set selesai_at=now() where sesi_id=$1',[daily.id]);
  await q('update absensi set pulang_at=now() where outlet_id=$1',[o]);
  const login=await safeCall('masuk_pos_outlet',['outlet-kembali','password-baru-kembali','x'.repeat(64),'z'.repeat(40)]);
  const [tablet]=await q<{id:string}>('select id from pengguna where email=$1',[login.email]);await as(tablet.id);
  const st=await safeCall<{presentasi:boolean;roster:{id:string}[]}>('status_pos_tim',[o,'x'.repeat(64),'',false]);expect(st.presentasi).toBe(true);expect(st.roster.some(x=>x.id===andi)).toBe(true);
  const r=await safeCall('pilih_pic_pos_outlet',[o,'x'.repeat(64),andi,null,200000,'Uang diperiksa','8'.repeat(64)]);expect(r.sesi_id).toBe(daily.id);
  expect((await safeCall('status_pos_tim',[o,'x'.repeat(64),'8'.repeat(64),false])).boleh).toBe(true);
  const sale=await safeCall('buat_transaksi',[{...payload(),client_id:crypto.randomUUID(),sesi_id:daily.id,izin_id:r.izin_id,device_token:'x'.repeat(64),pos_token:'8'.repeat(64),waktu_asli:new Date().toISOString()}]);expect(sale.id).toBeTruthy();
  expect((await q('select count(*) n from absensi where outlet_id=$1 and pulang_at is null',[o]))[0].n).toBe(0);
  expect((await q('select modal_laci from sesi_kas where id=$1',[daily.id]))[0].modal_laci).toBe(200000);
  expect((await q('select pos_kas_internal.presentasi_aktif($1) ok',[id(9999)]))[0].ok).toBe(false);
  await as(id(9));await safeCall('atur_presentasi_pos',[o,0,'Presentasi sudah selesai']);await as(tablet.id);
  expect((await safeCall('status_pos_tim',[o,'x'.repeat(64),'8'.repeat(64),false])).boleh).toBe(false);
  await expect(safeCall('buat_transaksi',[{...payload(),client_id:crypto.randomUUID(),sesi_id:daily.id,izin_id:r.izin_id,device_token:'x'.repeat(64),pos_token:'8'.repeat(64),waktu_asli:new Date().toISOString()}])).rejects.toThrow(/bertugas/);
 }finally{await db.exec('rollback');}
});

it("direct outlet POS needs no shifts/PIC, supports multiple devices and continues after closing cash",async()=>{
 await db.exec('create table matur_internal.pos_testing(outlet_id uuid,aktif boolean,diubah_at timestamptz)');
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026042921_pos_login_langsung.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026043618_pos_katalog_izin_tetap.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026044320_pos_antrean_login_baru.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026044502_pos_antrean_lintas_kas.sql',import.meta.url),'utf8'));
 const safeCall:typeof call=async(name,args)=>{await db.exec('savepoint request');try{const r=await call(name,args);await db.exec('release savepoint request');return r as never;}catch(e){await db.exec('rollback to savepoint request;release savepoint request');throw e;}};
 await db.exec('begin');
 try{
  await as(owner);await q('update absensi set pulang_at=now()');await q("update jadwal_shift set status='draft'");
  const devices=[];
  for(let i=0;i<12;i++){const secret=String(i).padStart(64,'d');const login=await safeCall('masuk_pos_outlet',['outlet-kembali','password-baru-kembali',secret,'z'.repeat(40)]);expect(login.error).toBeUndefined();const [tablet]=await q<{id:string}>('select id from pengguna where email=$1',[login.email]);devices.push({uid:tablet.id,secret});}
  const one=devices[0],two=devices[1];await as(one.uid);
  const st=await safeCall<{langsung:boolean;boleh:boolean;sesi:{id:string;modal:number};izin:{id:string};server_at:string}>('status_pos_tim',[o,one.secret,'',false]);expect(st.boleh).toBe(true);expect(st.langsung).toBe(true);
  await expect(safeCall('status_pos_tim',[id(9999),one.secret,'',false])).rejects.toThrow(/Masuk kembali/);
  await expect(safeCall('status_pos_tim',[o,two.secret,'',false])).rejects.toThrow(/Masuk kembali/);
  await as(two.uid);const other=await safeCall<typeof st>('status_pos_tim',[o,two.secret,'',false]);expect(other.sesi.id).toBe(st.sesi.id);
  await safeCall('atur_modal_pos',[st.sesi.id,two.secret,123000]);
  const draft=await safeCall('draft_pos_tim',[{aksi:'simpan',outlet_id:o,sesi_id:st.sesi.id,device_token:two.secret,pos_token:two.secret,kanal:'langsung',tipe:'dine_in',label:'Meja uji',items:[{menu_id:menu,qty:1}],total:10000,diskon:0}]);expect(draft).toBeTruthy();
  await as(one.uid);const packet={...payload(),client_id:crypto.randomUUID(),sesi_id:st.sesi.id,izin_id:st.izin.id,device_token:one.secret,pos_token:one.secret,waktu_asli:st.server_at};
  await expect(safeCall('buat_transaksi',[{...packet,pos_token:'token-salah'}])).rejects.toThrow(/identitas/);
  const receipt=await safeCall('buat_transaksi',[packet]);expect(receipt.id).toBeTruthy();expect((await safeCall('buat_transaksi',[packet])).id).toBe(receipt.id);
  const pending=crypto.randomUUID();await as(two.uid);await safeCall('tutup_kas_outlet',[st.sesi.id,two.secret,'','',123000,'Uji tutup kas',[pending]]);
  const next=await safeCall<typeof st>('status_pos_tim',[o,two.secret,'',false]);expect(next.boleh).toBe(true);expect(next.sesi.id).not.toBe(st.sesi.id);expect(next.sesi.modal).toBe(0);
  await as(one.uid);const historical=await safeCall('buat_transaksi',[{...packet,client_id:pending,sinkron_offline:true,pos_token:'cookie-login-sudah-berganti'}]);expect(historical.id).toBeTruthy();
  expect((await q('select pending_offline from sesi_kas where id=$1',[st.sesi.id]))[0].pending_offline).toBe(0);
  expect((await q('select modal_laci from sesi_kas where id=$1',[st.sesi.id]))[0].modal_laci).toBe(123000);
  const latePacket={...packet,client_id:crypto.randomUUID(),sinkron_offline:true,waktu_asli:new Date(Date.parse(st.server_at)+2000).toISOString()};
  const late=await safeCall('buat_transaksi',[latePacket]);expect((await q('select sesi_kas_id from transaksi where id=$1',[late.id]))[0].sesi_kas_id).toBe(next.sesi.id);
  expect((await safeCall('buat_transaksi',[latePacket])).id).toBe(late.id);
  await expect(safeCall('buat_transaksi',[{...latePacket,sesi_id:next.sesi.id}])).rejects.toThrow(/ID transaksi/);
  const after=await safeCall<typeof st>('status_pos_tim',[o,one.secret,'',false]);expect(after.sesi.id).toBe(next.sesi.id);
  expect((await q('select * from transaksi where id=$1',[receipt.id]))).toHaveLength(1);
  expect((await q('select count(*) n from absensi where pulang_at is null'))[0].n).toBe(0);
  const immutable=(await q('select katalog from matur_internal.pos_izin where id=$1',[after.izin.id]))[0].katalog;
  await q('update menu set harga_langsung=harga_langsung+1000 where id=$1',[menu]);
  const repriced=await safeCall<typeof st>('status_pos_tim',[o,one.secret,'',true]);expect(repriced.izin.id).not.toBe(after.izin.id);
  expect((await q('select katalog from matur_internal.pos_izin where id=$1',[after.izin.id]))[0].katalog).toEqual(immutable);
  await as(andi);await expect(safeCall('status_pos_tim',[o,one.secret,'',false])).rejects.toThrow(/Masuk kembali/);
  await as('');await expect(safeCall('status_pos_tim',[o,one.secret,'',false])).rejects.toThrow(/Masuk kembali/);
  expect((await q("select has_function_privilege('anon','public.buat_transaksi(jsonb)','execute') ok"))[0].ok).toBe(false);
 }finally{await db.exec('rollback');}
});

it('optional outlet shift preserves free mode, carries actual cash once, keeps discrepancies separate and closes idempotently',async()=>{
 await db.exec('create table if not exists public.profil_karyawan(pengguna_id uuid primary key,foto_path text)');
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026070831_pos_alur_shift_opsional.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026071016_pos_alur_shift_rpc_invoker.sql',import.meta.url),'utf8'));
 const safeCall:typeof call=async(name,args)=>{await db.exec('savepoint request');try{const r=await call(name,args);await db.exec('release savepoint request');return r as never;}catch(e){await db.exec('rollback to savepoint request;release savepoint request');throw e;}};
 await db.exec('begin');
 try{
  await as(owner);await q('update sesi_kas set ditutup_at=now() where outlet_id=$1 and ditutup_at is null',[o]);
  await q("update jadwal_shift set status='draft' where outlet_id=$1",[o]);
  const secret='N'.repeat(64);const login=await safeCall('masuk_pos_outlet',['outlet-kembali','password-baru-kembali',secret,'z'.repeat(40)]);
  const [tablet]=await q<{id:string}>('select id from pengguna where email=$1',[login.email]);await as(tablet.id);
  type Status={alur_shift?:boolean;boleh:boolean;sesi:{id:string};izin:{id:string};pilihan:{id:string;terjadwal:boolean}[];shift_aktif:{id:string;awal:number;seharusnya:number;selisih:number}};
  const status=()=>safeCall<Status>('status_pos_tim',[o,secret,'',false]);
  const free=await status();expect(free.boleh).toBe(true);expect(free.alur_shift).toBeUndefined();
  await expect(safeCall('atur_alur_shift_pos',[o,true,'1234',0])).rejects.toThrow(/berwenang/);
  await as(owner);await expect(safeCall('atur_alur_shift_pos',[o,true,'',0])).rejects.toThrow(/PIN/);
  await safeCall('atur_alur_shift_pos',[o,true,'1234',0]);
  await expect(safeCall('atur_alur_shift_pos',[o,false,'',0])).rejects.toThrow(/berubah/);
  await as(tablet.id);expect((await status()).alur_shift).toBeUndefined(); // no interruption of existing drawer
  await safeCall('tutup_kas_outlet',[free.sesi.id,secret,'','',0,'Kas bebas selesai',[]]);
  // now() is transaction-stable in this fixture; emulate the next HTTP transaction opening.
  await q("update pos_kas_internal.aturan_shift set diubah_at=now()-interval '1 second' where outlet_id=$1",[o]);
  const locked=await status();expect(locked.alur_shift).toBe(true);expect(locked.boleh).toBe(false);expect(locked.pilihan.some(p=>p.id===andi&&!p.terjadwal)).toBe(true);
  const request=crypto.randomUUID();const start={request_id:request,aksi:'mulai',shift_id:null,pic_id:andi,pin:'9999',modal:200000};
  const run=(p:Record<string,unknown>)=>safeCall('proses_alur_shift_pos',[o,secret,'',p]);
  expect((await run(start)).error).toMatch(/PIN/);
  await expect(run({...start,pin:'1234'})).rejects.toThrow(/alasan/);
  await run({...start,pin:'1234',alasan:'Pengganti jadwal'});await run({...start,pin:'1234',alasan:'Pengganti jadwal'});
  const first=await status();expect(first.boleh).toBe(true);expect(first.shift_aktif.awal).toBe(200000);
  await expect(run({...start,pin:'1234',modal:300000,alasan:'Pengganti jadwal'})).rejects.toThrow(/data lain/);
  await safeCall('proses_alur_shift_pos',[o,secret,'token-setelah-retry',{...start,pin:'1234',alasan:'Pengganti jadwal'}]);
  expect((await safeCall<Status>('status_pos_tim',[o,secret,'token-setelah-retry',false])).boleh).toBe(true);
  await run({...start,pin:'1234',alasan:'Pengganti jadwal'});
  const secret2='M'.repeat(64);const login2=await safeCall('masuk_pos_outlet',['outlet-kembali','password-baru-kembali',secret2,'z'.repeat(40)]);const [tablet2]=await q<{id:string}>('select id from pengguna where email=$1',[login2.email]);await as(tablet2.id);
  const onSecond=await safeCall<Status>('status_pos_tim',[o,secret2,'',false]);expect(onSecond.boleh).toBe(false);expect(onSecond.shift_aktif.id).toBe(first.shift_aktif.id);
  await safeCall('proses_alur_shift_pos',[o,secret2,'token-perangkat-kedua',{aksi:'lanjut',request_id:crypto.randomUUID(),shift_id:first.shift_aktif.id,pin:'1234'}]);
  expect((await safeCall<Status>('status_pos_tim',[o,secret2,'token-perangkat-kedua',false])).boleh).toBe(true);
  await as(tablet.id);expect((await status()).boleh).toBe(true);

  await expect(safeCall('atur_modal_pos',[first.sesi.id,secret,300000])).rejects.toThrow(/sudah dicatat/);
  await expect(safeCall('tutup_kas_outlet',[first.sesi.id,secret,'','',0,'Bypass',[]])).rejects.toThrow(/Serah Terima/);
  await q("update pos_kas_internal.shift_baru set mulai_at=now()-interval '1 second' where id=$1",[first.shift_aktif.id]);
  const salePacket={...payload(),client_id:crypto.randomUUID(),sesi_id:first.sesi.id,izin_id:first.izin.id,device_token:secret,pos_token:secret};
  const sale=await safeCall('buat_transaksi',[salePacket]);
  expect((await q('select operator_id from transaksi where id=$1',[sale.id]))[0].operator_id).toBe(andi);
  await q("update transaksi set created_at=now()-interval '500 milliseconds' where id=$1",[sale.id]);
  const hand={request_id:crypto.randomUUID(),aksi:'serah',shift_id:first.shift_aktif.id,pic_id:budi,pin:'1234',aktual:205000,catatan:'Kurang lima ribu',alasan:'Petugas pengganti'};
  await run(hand);await run(hand);
  const second=await status();expect(second.sesi.id).toBe(first.sesi.id);expect(second.shift_aktif.awal).toBe(205000);expect(second.shift_aktif.seharusnya).toBe(205000);
  expect((await q('select modal_laci from sesi_kas where id=$1',[first.sesi.id]))[0].modal_laci).toBe(200000);
  const old=(await safeCall<{shifts:{selisih:number}[]}>('laporan_alur_shift_pos',[o,secret,first.sesi.id])).shifts;expect(old[0].selisih).toBe(-5000);expect(old).toHaveLength(2);
  await q('update pos_kas_internal.shift_baru set selesai_at=now() where id=$1',[first.shift_aktif.id]);
  await q('update pos_kas_internal.shift_baru set mulai_at=now() where id=$1',[second.shift_aktif.id]);
  const pendingSale=await safeCall('buat_transaksi',[{...salePacket,client_id:crypto.randomUUID(),sinkron_offline:true,waktu_asli:(await q<{v:string}>("select (now()-interval '250 milliseconds')::text v"))[0].v}]);
  expect((await q('select operator_id from transaksi where id=$1',[pendingSale.id]))[0].operator_id).toBe(andi);
  const secondSale=await safeCall('buat_transaksi',[{...salePacket,client_id:crypto.randomUUID()}]);
  expect((await q('select operator_id from transaksi where id=$1',[secondSale.id]))[0].operator_id).toBe(budi);
  const updated=await status();expect(updated.shift_aktif.seharusnya).toBe(215000);
  await expect(run({...hand,request_id:crypto.randomUUID()})).rejects.toThrow(/berubah/);
  await run({request_id:crypto.randomUUID(),aksi:'draft',shift_id:second.shift_aktif.id,laporan:{stok:'Cup 240',order:'Matcha'}});
  const close={request_id:crypto.randomUUID(),aksi:'tutup',shift_id:second.shift_aktif.id,aktual:215000,catatan:'Selesai hari ini',pending:[],laporan:{stok:'Cup 240',order:'Matcha'}};
  await run(close);await run(close);
  const report=await safeCall<{shifts:{awal:number;selisih:number;laporan:{stok:string}}[];sesi:{selisih:number}}> ('laporan_alur_shift_pos',[o,secret,first.sesi.id]);
  expect(report.shifts[1].selisih).toBe(0);expect(report.sesi.selisih).toBe(-15000);expect(report.shifts[1].laporan.stok).toBe('Cup 240');
  expect((await q('select count(*) n from pos_kas_internal.shift_baru where sesi_id=$1',[first.sesi.id]))[0].n).toBe(2);
  const next=await status();expect(next.sesi.id).not.toBe(first.sesi.id);expect(next.boleh).toBe(false);
  await as(owner);await safeCall('atur_alur_shift_pos',[o,false,'',1]);await as(tablet.id);expect((await status()).boleh).toBe(true);
  for(const sig of ['public.proses_alur_shift_pos(uuid,text,text,jsonb)','public.atur_alur_shift_pos(uuid,boolean,text,integer)','public.laporan_alur_shift_pos(uuid,text,uuid)'])expect((await q("select has_function_privilege('anon',$1,'execute') ok",[sig]))[0].ok).toBe(false);
 }finally{await db.exec('rollback');}
});

it('shift settings are limited to active HRD/warehouse assignments and PIN attempts expire without admin intervention',async()=>{
 const safeCall:typeof call=async(name,args)=>{await db.exec('savepoint request');try{const r=await call(name,args);await db.exec('release savepoint request');return r as never;}catch(e){await db.exec('rollback to savepoint request;release savepoint request');throw e;}};
 await db.exec('begin');
 try{
  const gudang=id(77001);await as(owner);
  await q("insert into pengguna(id,nama,status) values($1,'Admin gudang fixture','aktif')",[gudang]);
  await q("insert into penugasan(pengguna_id,peran,outlet_id) values($1,'admin_gudang',$2)",[gudang,o]);
  await as(gudang);await safeCall('atur_alur_shift_pos',[o,false,'1234',0]);
  await expect(safeCall('atur_alur_shift_pos',[id(9999),true,'1234',0])).rejects.toThrow(/berwenang/);
  const panel=await safeCall<{id:string}[]>('panel_alur_shift_pos',[]);expect(panel.map(p=>p.id)).toEqual([o]);
  await as(id(9));await safeCall('atur_alur_shift_pos',[o,false,'',1]);
  await as(owner);await q('update sesi_kas set ditutup_at=now() where outlet_id=$1 and ditutup_at is null',[o]);
  await safeCall('atur_alur_shift_pos',[o,true,'1234',2]);await q("update pos_kas_internal.aturan_shift set diubah_at=now()-interval '1 second' where outlet_id=$1",[o]);
  const secret='Q'.repeat(64);const login=await safeCall('masuk_pos_outlet',['outlet-kembali','password-baru-kembali',secret,'z'.repeat(40)]);const [tablet]=await q<{id:string}>('select id from pengguna where email=$1',[login.email]);await as(tablet.id);
  await safeCall('status_pos_tim',[o,secret,'',false]);
  const p={aksi:'mulai',request_id:crypto.randomUUID(),modal:0,pic_id:andi,alasan:'Pengganti uji',pin:'9999'};
  for(let i=0;i<8;i++)expect((await safeCall('proses_alur_shift_pos',[o,secret,'',p])).error).toMatch(/tidak sesuai/);
  expect((await safeCall('proses_alur_shift_pos',[o,secret,'',{...p,pin:'1234'}])).error).toMatch(/satu menit/);
  await q("update pos_kas_internal.pin_percobaan set sejak=now()-interval '2 minutes'");
  expect((await safeCall('proses_alur_shift_pos',[o,secret,'',{...p,pin:'1234'}])).ok).toBe(true);
 }finally{await db.exec('rollback');}
});

it('outlet shift PIN is kept encrypted for authorized admins, logged when viewed, and forgotten when changed',async()=>{
 const safeCall:typeof call=async(name,args)=>{await db.exec('savepoint request');try{const r=await call(name,args);await db.exec('release savepoint request');return r as never;}catch(e){await db.exec('rollback to savepoint request;release savepoint request');throw e;}};
 await db.exec('create or replace view vault.secrets as select * from vault.decrypted_secrets');
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261026150000_pos_pin_shift_terenkripsi.sql',import.meta.url),'utf8'));
 await db.exec('begin');
 try{
  await as(owner);
  const v=(await q<{versi:number}>('select coalesce((select versi from pos_kas_internal.aturan_shift where outlet_id=$1),0) versi',[o]))[0].versi;
  // PIN lama (hanya hash, belum ada salinan): perlu dimasukkan sekali
  await q("insert into pos_kas_internal.aturan_shift(outlet_id) values($1) on conflict do nothing",[o]);
  await q("update pos_kas_internal.aturan_shift set pin_hash=extensions.crypt('2468','x'),pin_secret_id=null where outlet_id=$1",[o]);
  expect(await safeCall('lihat_pin_alur_shift',[o])).toEqual({belum_tersimpan:true});
  expect((await safeCall<{error?:string}>('simpan_pin_alur_shift_lama',[o,'1111'])).error).toMatch(/tidak cocok/);
  expect(await safeCall('simpan_pin_alur_shift_lama',[o,'2468'])).toEqual({ok:true});
  expect(await safeCall('lihat_pin_alur_shift',[o])).toEqual({pin:'2468'});
  expect((await q("select count(*)::int n from log_aktivitas where aksi='lihat_pin_alur_shift' and entitas_id=$1",[o]))[0].n).toBeGreaterThan(0);
  // ganti PIN lewat pengaturan: salinan ikut diperbarui, salinan lama dihapus
  const lama=(await q<{s:string}>('select pin_secret_id s from pos_kas_internal.aturan_shift where outlet_id=$1',[o]))[0].s;
  const versi=(await q<{versi:number}>('select versi from pos_kas_internal.aturan_shift where outlet_id=$1',[o]))[0].versi;
  await safeCall('atur_alur_shift_pos',[o,false,'97531',versi]);
  expect(await safeCall('lihat_pin_alur_shift',[o])).toEqual({pin:'97531'});
  expect((await q('select count(*)::int n from vault.decrypted_secrets where id=$1',[lama]))[0].n).toBe(0);
  // tanpa kewenangan: ditolak; anon tidak punya akses
  await as(andi);
  await expect(safeCall('lihat_pin_alur_shift',[o])).rejects.toThrow(/berwenang/);
  await expect(safeCall('simpan_pin_alur_shift_lama',[o,'97531'])).rejects.toThrow(/berwenang/);
  for(const sig of ['public.lihat_pin_alur_shift(uuid)','public.simpan_pin_alur_shift_lama(uuid,text)'])expect((await q("select has_function_privilege('anon',$1,'execute') ok",[sig]))[0].ok).toBe(false);
  expect(v).toBeGreaterThanOrEqual(0);
 }finally{await db.exec('rollback');}
});

it('early PIN check for the start-shift wizard uses the device-bound verifier and its attempt limit',async()=>{
 const safeCall:typeof call=async(name,args)=>{await db.exec('savepoint request');try{const r=await call(name,args);await db.exec('release savepoint request');return r as never;}catch(e){await db.exec('rollback to savepoint request;release savepoint request');throw e;}};
 await db.exec(readFileSync(new URL('../../../supabase/migrations/20261027090000_pos_cek_pin_alur_shift.sql',import.meta.url),'utf8'));
 await db.exec('begin');
 try{
  await as(owner);await q('update sesi_kas set ditutup_at=now() where outlet_id=$1 and ditutup_at is null',[o]);
  const v=(await q<{versi:number}>('select coalesce((select versi from pos_kas_internal.aturan_shift where outlet_id=$1),0) versi',[o]))[0].versi;
  await safeCall('atur_alur_shift_pos',[o,true,'1234',v]);
  const secret='C'.repeat(64);const login=await safeCall('masuk_pos_outlet',['outlet-kembali','password-baru-kembali',secret,'z'.repeat(40)]);
  const [tablet]=await q<{id:string}>('select id from pengguna where email=$1',[login.email]);await as(tablet.id);
  await safeCall('status_pos_tim',[o,secret,'',false]);
  expect(await safeCall('cek_pin_alur_shift',[o,secret,'12'])).toEqual({error:'PIN outlet terdiri dari 4–6 angka'});
  expect((await safeCall<{error:string}>('cek_pin_alur_shift',[o,secret,'9999'])).error).toMatch(/tidak sesuai/);
  expect(await safeCall('cek_pin_alur_shift',[o,secret,'1234'])).toEqual({ok:true});
  await expect(safeCall('cek_pin_alur_shift',[o,'perangkat-lain','1234'])).rejects.toThrow(/perangkat/);
  for(let i=0;i<8;i++)await safeCall('cek_pin_alur_shift',[o,secret,'0000']);
  expect((await safeCall<{error:string}>('cek_pin_alur_shift',[o,secret,'1234'])).error).toMatch(/satu menit/);
  expect((await q("select has_function_privilege('anon','public.cek_pin_alur_shift(uuid,text,text)','execute') ok"))[0].ok).toBe(false);
 }finally{await db.exec('rollback');}
});
