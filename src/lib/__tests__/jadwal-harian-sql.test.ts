import { hitungJamGaji } from "../gaji";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const id = (n: number) =>
  `30000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [owner, staf, rekan, o, other, shift, spv] = Array.from(
  { length: 7 },
  (_, i) => id(i + 1),
);
const q = async (sql: string, p: unknown[] = []) =>
  (await db.query(sql, p)).rows as Record<string, unknown>[];
const call = async (p: Record<string, unknown>) =>
  (
    await q("select public.kelola_jadwal_harian($1::jsonb) v", [
      JSON.stringify({ outlet_id: o, ...p }),
    ])
  )[0].v as string;
const add = (d: string, uid = staf, more: Record<string, unknown> = {}) =>
  call({
    aksi: "tambah",
    shift_id: shift,
    pengguna_id: uid,
    tanggal: d,
    terbit: true,
    ...more,
  });
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`,
  );
  await db.exec(
    readFileSync(
      new URL("./fixtures/operasional-baseline.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(`create function kelola_sdm(uuid) returns boolean language sql stable as $$select exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id where t.pengguna_id=auth.uid() and u.status='aktif' and (t.peran in ('owner','hrd') or (t.peran='spv' and t.outlet_id=$1)))$$;
 create table shift_outlet(id uuid primary key default gen_random_uuid(),outlet_id uuid references outlet(id),nama text,jam_mulai time,jam_selesai time,min_orang int,urutan int,aktif boolean);
 create table jadwal_shift(id uuid primary key default gen_random_uuid(),outlet_id uuid references outlet(id),shift_id uuid references shift_outlet(id),pengguna_id uuid references pengguna(id),tanggal date,status text,dibuat_oleh uuid,unique(shift_id,pengguna_id,tanggal));
 create table absensi(id uuid primary key default gen_random_uuid(),jadwal_id uuid references jadwal_shift(id) on delete set null,outlet_id uuid,pengguna_id uuid,tanggal date);
 create table pengajuan_izin(id uuid primary key default gen_random_uuid(),outlet_id uuid,pengguna_id uuid,jenis text,tanggal date,alasan text,status text,diputus_oleh uuid,diputus_at timestamptz);
 insert into pengguna(id,nama) values('${owner}','Owner'),('${staf}','Indah'),('${rekan}','Nosa'),('${spv}','Supervisor');
 insert into outlet(id,nama) values('${o}','Outlet uji'),('${other}','Outlet lain');
 insert into penugasan(pengguna_id,peran,outlet_id) values('${owner}','owner',null),('${staf}','barista','${o}'),('${rekan}','kasir','${o}'),('${spv}','spv','${o}');
 insert into shift_outlet(id,outlet_id,nama,jam_mulai,jam_selesai,min_orang,urutan,aktif) values('${shift}','${o}','Pagi','08:00','16:00',1,1,true);
 set test.uid='${owner}';`);
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20261029030916_jadwal_editor_harian.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
it("edits person/date/custom hours without changing other days or template", async () => {
  const j = await add("2026-11-01");
  const later = await add("2026-11-02");
  await call({
    aksi: "simpan",
    id: j,
    versi: 1,
    shift_id: shift,
    pengguna_id: rekan,
    tanggal: "2026-11-03",
    khusus: true,
    mulai: "22:00",
    selesai: "04:00",
  });
  const row = (
    await q(
      "select j.tanggal::text,j.pengguna_id,s.jam_mulai::text,s.jam_selesai::text,s.aktif,s.induk_shift_id from jadwal_shift j join shift_outlet s on s.id=j.shift_id where j.id=$1",
      [j],
    )
  )[0];
  expect(row).toMatchObject({
    tanggal: "2026-11-03",
    pengguna_id: rekan,
    jam_mulai: "22:00:00",
    jam_selesai: "04:00:00",
    aktif: false,
    induk_shift_id: shift,
  });
  expect(
    (await q("select shift_id from jadwal_shift where id=$1", [later]))[0]
      .shift_id,
  ).toBe(shift);
  expect(
    (
      await q("select jam_mulai::text from shift_outlet where id=$1", [shift])
    )[0].jam_mulai,
  ).toBe("08:00:00");
  await expect(call({ aksi: "hapus", id: j, versi: 1 })).rejects.toThrow(
    "sudah berubah",
  );
});
it("records explicit leave and releases all unworked shifts together", async () => {
  await add("2026-11-04");
  await call({
    aksi: "tandai",
    pengguna_id: staf,
    tanggal: "2026-11-04",
    jenis: "libur",
  });
  expect(
    (
      await q(
        `select count(*)::int n from jadwal_shift where tanggal='2026-11-04'`,
      )
    )[0].n,
  ).toBe(0);
  expect(
    (await q(`select status from pengajuan_izin where tanggal='2026-11-04'`))[0]
      .status,
  ).toBe("disetujui");
});
it("moves leave atomically and records target day as explicit leave", async () => {
  await call({
    aksi: "tandai",
    pengguna_id: staf,
    tanggal: "2026-11-05",
    jenis: "libur",
  });
  const j = await add("2026-11-06");
  await call({
    aksi: "libur_pindah",
    pengguna_id: staf,
    tanggal: "2026-11-05",
    id: j,
    versi: 1,
  });
  expect(
    (
      await q(
        `select tanggal::text from jadwal_shift where pengguna_id=$1 and tanggal in ('2026-11-05','2026-11-06')`,
        [staf],
      )
    )[0].tanggal,
  ).toBe("2026-11-05");
  expect(
    (await q(`select status from pengajuan_izin where tanggal='2026-11-06'`))[0]
      .status,
  ).toBe("disetujui");
});
it("failed transfer rolls back leave cancellation and newly created schedule", async () => {
  await call({
    aksi: "tandai",
    pengguna_id: staf,
    tanggal: "2026-11-07",
    jenis: "libur",
  });
  const j = await add("2026-11-08");
  await db.exec(
    `insert into absensi(jadwal_id,outlet_id,pengguna_id,tanggal) values('${j}','${o}','${staf}','2026-11-08')`,
  );
  await expect(
    call({
      aksi: "libur_pindah",
      pengguna_id: staf,
      tanggal: "2026-11-07",
      id: j,
      versi: 1,
    }),
  ).rejects.toThrow("absensi");
  expect(
    (await q(`select status from pengajuan_izin where tanggal='2026-11-07'`))[0]
      .status,
  ).toBe("disetujui");
  expect(
    (
      await q(
        `select count(*)::int n from jadwal_shift where tanggal='2026-11-07'`,
      )
    )[0].n,
  ).toBe(0);
});
it("exchanges days off and preserves custom hours for replacement staff", async () => {
  await call({
    aksi: "tandai",
    pengguna_id: staf,
    tanggal: "2026-11-09",
    jenis: "libur",
  });
  const j = await add("2026-11-09", rekan, {
    khusus: true,
    mulai: "09:00",
    selesai: "15:00",
  });
  await call({
    aksi: "libur_ganti",
    pengguna_id: staf,
    tanggal: "2026-11-09",
    id: j,
    versi: 1,
  });
  expect(
    (
      await q(
        `select j.pengguna_id,s.jam_mulai::text from jadwal_shift j join shift_outlet s on s.id=j.shift_id where j.tanggal='2026-11-09'`,
      )
    )[0],
  ).toMatchObject({ pengguna_id: staf, jam_mulai: "09:00:00" });
  expect(
    (
      await q(
        `select pengguna_id from pengajuan_izin where tanggal='2026-11-09' and status='disetujui'`,
      )
    )[0].pengguna_id,
  ).toBe(rekan);
});
it("protects attendance references even for direct legacy deletes and template edits", async () => {
  const j = await add("2026-11-10");
  await db.exec(
    `insert into absensi(jadwal_id,outlet_id,pengguna_id,tanggal) values('${j}','${o}','${staf}','2026-11-10')`,
  );
  await expect(call({ aksi: "hapus", id: j, versi: 1 })).rejects.toThrow(
    "absensi",
  );
  await expect(
    db.exec(`delete from jadwal_shift where id='${j}'`),
  ).rejects.toThrow("absensi");
  await expect(
    db.exec(`update shift_outlet set jam_mulai='07:00' where id='${shift}'`),
  ).rejects.toThrow("absensi");
  expect(
    (await q("select jadwal_id from absensi where jadwal_id=$1", [j]))[0]
      .jadwal_id,
  ).toBe(j);
});
it("payroll reads the custom overnight shift end instead of template hours", async () => {
  const row = (
    await q(
      `select s.id,s.nama,s.jam_mulai::text,s.jam_selesai::text,j.id jadwal_id from jadwal_shift j join shift_outlet s on s.id=j.shift_id where j.tanggal='2026-11-03'`,
    )
  )[0];
  const shiftData = {
    id: String(row.id),
    nama: String(row.nama),
    jam_mulai: String(row.jam_mulai),
    jam_selesai: String(row.jam_selesai),
  };
  const result = hitungJamGaji(
    {
      gaji_pokok: 2600000,
      tunjangan: 0,
      uang_makan: 0,
      potongan_telat: 0,
      potongan_alpa: 0,
    },
    [
      {
        pengguna_id: rekan,
        tanggal: "2026-11-03",
        status: "tepat",
        menitKerja: 480,
        shift: shiftData,
        absen: {
          id: "a",
          pengguna_id: rekan,
          jadwal_id: String(row.jadwal_id),
          tanggal: "2026-11-03",
          masuk_at: "2026-11-03T22:00:00+07:00",
          pulang_at: "2026-11-04T06:00:00+07:00",
          status: "tepat",
          telat_menit: 0,
        },
      },
    ],
  );
  expect(result.menit_kerja).toBe(480);
  expect(result.menit_lembur).toBe(120);
});
it("validates active staff, approved leave, duplicate base shift and role scope", async () => {
  await call({
    aksi: "tandai",
    pengguna_id: staf,
    tanggal: "2026-11-11",
    jenis: "sakit",
  });
  await expect(add("2026-11-11")).rejects.toThrow("libur/izin/sakit");
  await add("2026-11-12", staf, {
    khusus: true,
    mulai: "09:00",
    selesai: "16:00",
  });
  await expect(add("2026-11-12")).rejects.toThrow("sudah terdaftar");
  await db.exec(`set test.uid='${spv}'`);
  await expect(
    call({
      aksi: "tambah",
      outlet_id: other,
      pengguna_id: staf,
      shift_id: shift,
      tanggal: "2026-11-14",
    }),
  ).rejects.toThrow("Hanya");
  await db.exec(`set test.uid='${staf}'`);
  await expect(add("2026-11-14")).rejects.toThrow("Hanya");
  await db.exec(`set test.uid=''`);
  await expect(add("2026-11-14")).rejects.toThrow("Hanya");
  expect(
    (
      await q(
        `select has_function_privilege('anon','public.kelola_jadwal_harian(jsonb)','execute') v`,
      )
    )[0].v,
  ).toBe(false);
});
