import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const owner = "10000000-0000-0000-0000-000000000001",
  mitra = "10000000-0000-0000-0000-000000000002",
  other = "10000000-0000-0000-0000-000000000003",
  report = "20000000-0000-0000-0000-000000000001",
  outlet = "30000000-0000-0000-0000-000000000001";
let hid: Record<string, unknown>;
let payment: string;
let meeting: string;
const user = async (id: string) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
};
const command = (p: Record<string, unknown>) =>
  db.query<{ r: { id: string; ok: string } }>(
    "select public.kelola_laporan_lanjut($1::jsonb) r",
    [
      JSON.stringify({
        request_id: randomUUID(),
        laporan_id: report,
        alasan: "Catatan valid untuk pengujian",
        ...p,
      }),
    ],
  );
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table pengguna(id uuid primary key,nama text,status text,peran text,outlet_id uuid);
 create table penugasan(pengguna_id uuid,peran text,outlet_id uuid);
 create function punya_peran(p text[]) returns boolean language sql stable security definer as $$select exists(select 1 from public.pengguna where id=auth.uid() and status='aktif' and peran=any(p))$$;
 create function peran_di_outlet(o uuid,p text[]) returns boolean language sql stable security definer as $$select exists(select 1 from public.pengguna where id=auth.uid() and status='aktif' and peran=any(p) and outlet_id=o)$$;
 create function boleh_outlet(o uuid) returns boolean language sql stable as $$select true$$;
 create table laporan_bulanan(id uuid primary key,outlet_id uuid,mode text default 'asli',deleted_at timestamptz,mitra_disetujui boolean default true,mitra_buka_at timestamptz default now(),transfer jsonb,bagi_hasil jsonb);
 create table notifikasi(pengguna_id uuid,judul text,isi text,tautan text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 insert into pengguna values('${owner}','Finance','aktif','finance',null),('${mitra}','Mitra A','aktif','mitra','${outlet}'),('${other}','Mitra B','aktif','mitra',gen_random_uuid());
 insert into penugasan select id,peran,outlet_id from pengguna;
 insert into laporan_bulanan(id,outlet_id,transfer,bagi_hasil) values('${report}','${outlet}','[{"atas_nama":"Mitra A","keterangan":"Bagi hasil","jumlah":100,"bank":"BSI","no_rekening":"123"}]','[{"nama":"Mitra A","persen":10,"jumlah":100},{"nama":"Pengelola","persen":90,"jumlah":900}]');
 `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261124030348_laporan_pembayaran_meeting.sql",
      "utf8",
    ),
  );
  await db.exec(readFileSync('supabase/migrations/20261124031150_pembayaran_jaga_hak_berubah.sql','utf8'));
  await db.exec(
    "grant usage on schema public,auth,storage to authenticated;grant select on laporan_bulanan to authenticated;grant select,insert on storage.objects to authenticated;",
  );
  await user(owner);
  hid = (
    await db.query<{ h: Record<string, unknown>[] }>(
      `select public.hak_pembayaran_laporan('${report}') h`,
    )
  ).rows[0].h.find((x) => x.key === "transfer:1")!;
}, 30000);
afterAll(async () => {
  await db.close();
});
it("creates partial payment with retry idempotency and no direct writes", async () => {
  const p = {
    aksi: "bayar",
    request_id: randomUUID(),
    penerima_key: hid.key,
    hak_snapshot: hid,
    jumlah: 10,
    tanggal: "2026-01-01",
    metode: "tunai",
  };
  const r = await command(p);
  payment = r.rows[0].r.id;
  expect((await command(p)).rows[0].r.id).toBe(payment);
  expect(
    (await db.query("select * from public.laporan_bayar")).rows,
  ).toHaveLength(1);
  await expect(
    db.exec("insert into public.laporan_bayar(id) values(gen_random_uuid())"),
  ).rejects.toThrow("permission denied");
});
it("rejects overpayment and missing transfer evidence", async () => {
  await expect(
    command({
      aksi: "bayar",
      penerima_key: hid.key,
      hak_snapshot: hid,
      jumlah: 95,
      tanggal: "2026-01-01",
      metode: "tunai",
    }),
  ).rejects.toThrow("melebihi");
  await expect(
    command({
      aksi: "bayar",
      penerima_key: hid.key,
      hak_snapshot: hid,
      jumlah: 20,
      tanggal: "2026-01-01",
      metode: "transfer",
    }),
  ).rejects.toThrow("Bukti transfer");
});
it("corrects with expected version, preserves history and rejects stale revision", async () => {
  await command({
    aksi: "bayar",
    id: payment,
    versi: 1,
    penerima_key: hid.key,
    hak_snapshot: hid,
    jumlah: 20,
    tanggal: "2026-01-02",
    metode: "tunai",
  });
  await expect(
    command({ aksi: "batal_bayar", id: payment, versi: 1 }),
  ).rejects.toThrow("berubah");
  const h = await db.query<{
    sebelum: { jumlah: number };
    sesudah: { jumlah: number };
  }>(
    "select sebelum,sesudah from public.laporan_bayar_riwayat where sebelum is not null",
  );
  expect(h.rows[0].sebelum.jumlah).toBe(10);
  expect(h.rows[0].sesudah.jumlah).toBe(20);
});
it("protects report access and payment mutation from partner", async () => {
  await user(mitra);
  await expect(
    command({ aksi: "batal_bayar", id: payment, versi: 2 }),
  ).rejects.toThrow("Pembayaran hanya");
  await user(other);
  expect(
    (await db.query("select * from public.laporan_bayar")).rows,
  ).toHaveLength(0);
  await expect(command({ aksi: "meeting" })).rejects.toThrow(
    "tidak dapat diakses",
  );
  await user(owner);
});
it("cancels a recorded payment without changing source entitlement", async () => {
  await command({ aksi: "batal_bayar", id: payment, versi: 2 });
  expect(
    (
      await db.query<{ status: string }>(
        "select status from public.laporan_bayar",
      )
    ).rows[0].status,
  ).toBe("batal");
  expect(
    (
      await db.query<{ h: unknown }>(
        `select public.hak_pembayaran_laporan('${report}') h`,
      )
    ).rows[0].h,
  ).toContainEqual(hid);
});
it("partner proposes meeting, retry emits no duplicate notification, proposer cannot self-approve", async () => {
  await user(mitra);
  const p = {
    aksi: "meeting",
    request_id: randomUUID(),
    judul: "Bahas laporan",
    agenda: "Penjelasan biaya bulanan",
    jenis: "online",
    waktu: new Date(Date.now() + 86400000).toISOString(),
    durasi: 60,
    lokasi: "https://meet.example.com/test",
    peserta: [owner, mitra],
  };
  const r = await command(p);
  meeting = r.rows[0].r.id;
  await command(p);
  expect(
    (await db.query("select * from public.laporan_meeting")).rows,
  ).toHaveLength(1);
  await expect(
    command({ aksi: "setuju", id: meeting, versi: 1 }),
  ).rejects.toThrow("pihak penerima");
});
it("finance accepts and partner can view only authorized meetings/history", async () => {
  await user(owner);
  await command({ aksi: "setuju", id: meeting, versi: 1 });
  expect(
    (
      await db.query<{ status: string }>(
        "select status from public.laporan_meeting",
      )
    ).rows[0].status,
  ).toBe("terjadwal");
  await user(other);
  expect(
    (await db.query("select * from public.laporan_meeting")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.laporan_meeting_riwayat")).rows,
  ).toHaveLength(0);
  await user(mitra);
  expect(
    (await db.query("select * from public.laporan_meeting_riwayat")).rows,
  ).toHaveLength(2);
  await user(owner);
});
it("requires scheduled elapsed meeting for notes and preserves completed history", async () => {
  await expect(
    command({
      aksi: "notulen",
      id: meeting,
      versi: 2,
      notulen: "Pembahasan selesai",
      tindak_lanjut: "Cek biaya",
    }),
  ).rejects.toThrow("setelah waktu");
  await db.exec(
    `reset role;update public.laporan_meeting set waktu=now()-interval '1 hour' where id='${meeting}';set role authenticated;`,
  );
  await command({
    aksi: "notulen",
    id: meeting,
    versi: 2,
    notulen: "Pembahasan selesai",
    tindak_lanjut: "Akunting kirim rincian biaya",
  });
  await expect(
    command({ aksi: "batal_meeting", id: meeting, versi: 3 }),
  ).rejects.toThrow("tidak dapat diubah");
});
it("creates bounded monthly invitations without self-approval", async () => {
  const r = await command({
    aksi: "meeting",
    judul: "Meeting bulanan",
    agenda: "Pembahasan rutin",
    jenis: "tatap_muka",
    waktu: new Date(Date.now() + 86400000).toISOString(),
    durasi: 60,
    lokasi: "Outlet",
    peserta: [owner, mitra],
    ulang: 3,
  });
  expect(r.rows[0].r.id).toBeTruthy();
  expect(
    (await db.query("select * from public.laporan_meeting")).rows,
  ).toHaveLength(4);
});
it("evidence stays private to authorized report users", async () => {
  await db.exec(
    `reset role;insert into storage.objects values('laporan-bukti-bayar','${report}/${owner}/receipt.pdf');set role authenticated;`,
  );
  const path = `${report}/${owner}/receipt.pdf`;
  await command({
    aksi: "bayar",
    penerima_key: hid.key,
    hak_snapshot: hid,
    jumlah: 50,
    tanggal: "2026-01-01",
    metode: "transfer",
    bukti: path,
  });
  await user(mitra);
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(
    1,
  );
  await user(other);
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(
    0,
  );
});
it("supports explicit small settlement rounding while preserving original entitlement", async () => {
  await user(owner);
  await command({
    aksi: "bayar",
    penerima_key: hid.key,
    hak_snapshot: hid,
    jumlah: 50.333,
    pembulatan: 0.333,
    tanggal: "2026-01-01",
    metode: "tunai",
  });
  const r = await db.query<{ actual: string; allocated: string }>(
    "select sum(jumlah)::text actual,sum(jumlah-pembulatan)::text allocated from public.laporan_bayar where status='tercatat'",
  );
  expect(Number(r.rows[0].actual)).toBe(100.333);
  expect(Number(r.rows[0].allocated)).toBe(100);
  await expect(
    command({
      aksi: "bayar",
      penerima_key: hid.key,
      hak_snapshot: hid,
      jumlah: 1,
      pembulatan: 0.9,
      tanggal: "2026-01-01",
      metode: "tunai",
    }),
  ).rejects.toThrow("Total pembulatan");
});
it("an uninvited partner of the same outlet cannot view or modify a private meeting", async () => {
  const uninvited = "10000000-0000-0000-0000-000000000004";
  await db.exec(
    `reset role;insert into pengguna values('${uninvited}','Mitra lain','aktif','mitra','${outlet}');insert into penugasan values('${uninvited}','mitra','${outlet}');`,
  );
  await user(uninvited);
  expect(
    (await db.query("select * from public.laporan_meeting")).rows,
  ).toHaveLength(0);
  await expect(
    command({ aksi: "batal_meeting", id: meeting, versi: 3 }),
  ).rejects.toThrow("tidak dapat diakses");
});

it('a revised entitlement cannot silently consume earlier payments for the old source',async()=>{
 await user(owner);await db.exec(`reset role;update laporan_bulanan set transfer=jsonb_set(transfer,'{0,jumlah}','110') where id='${report}';set role authenticated;`);
 const newer={...hid,jumlah:110};await expect(command({aksi:'bayar',penerima_key:hid.key,hak_snapshot:newer,jumlah:1,tanggal:'2026-01-01',metode:'tunai'})).rejects.toThrow('Rekonsiliasi catatan');
});
