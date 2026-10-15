import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const uid = "00000000-0000-0000-0000-000000000002",
  o = "00000000-0000-0000-0000-000000000001",
  b = "00000000-0000-0000-0000-000000000003";
const base = readFileSync(
  new URL("./fixtures/operasional-baseline.sql", import.meta.url),
  "utf8",
);
const sql = readFileSync(
  new URL(
    "../../../supabase/migrations/20261015044602_operasional_setoran_penggajian.sql",
    import.meta.url,
  ),
  "utf8",
);
const q = async <T = Record<string, unknown>>(s: string, p: unknown[] = []) =>
  (await db.query<T>(s, p)).rows;
let shipment: string, item: string, loan: string, payroll: string;
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select '${uid}'::uuid$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;`);
  await db.exec(base);
  await db.exec(`create function punya_peran(peran[]) returns boolean language sql stable as $$select current_setting('app.role',true)=any($1::text[])$$;
 create function gudang_pusat() returns boolean language sql stable as $$select punya_peran('{owner,admin_pusat,admin_gudang}')$$;
 create function peran_di_outlet(uuid,peran[]) returns boolean language sql stable as $$select $1='${o}' and punya_peran($2)$$;
 create function boleh_outlet(uuid) returns boolean language sql stable as $$select true$$;
 create function kelola_gaji() returns boolean language sql stable as $$select punya_peran('{owner,hrd}')$$;
 create function geser_stok(mode_data,uuid,uuid,numeric,text,uuid,text) returns void language plpgsql as $$begin
 if exists(select 1 from stok where outlet_id is not distinct from $2 and bahan_id=$3) then update stok set jumlah=jumlah+$4 where outlet_id is not distinct from $2 and bahan_id=$3;
 else insert into stok(mode,outlet_id,bahan_id,jumlah) values($1,$2,$3,$4);end if;end$$;
 set app.role='owner';
 insert into outlet(id,nama) values('${o}','Outlet Uji');
 insert into pengguna(id,nama) values('${uid}','Penerima Uji');
 insert into penugasan(pengguna_id,peran,outlet_id) values('${uid}','barista','${o}');
 insert into bahan(id,nama,satuan_beli,satuan_pakai) values('${b}','Beans','kg','kg');
 insert into kategori_biaya(nama,urutan,grup) values('Biaya Gaji',1,'beban');`);
  await db.exec(sql);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261015044846_operasional_rpc_permissions.sql",import.meta.url),"utf8"));
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261015044809_operasional_indexes.sql",import.meta.url),"utf8"));
}, 30000);
afterAll(() => db.close());
describe("operasional migration on PostgreSQL", () => {
  it("records good stock only, rejects missing lines and requires damage photo", async () => {
    shipment = (
      await q<{ id: string }>(
        "insert into kiriman(outlet_id,status,total,nomor) values($1,'dikirim',100000,'K-UJI') returning id",
        [o],
      )
    )[0].id;
    item = (
      await q<{ id: string }>(
        "insert into item_kiriman(kiriman_id,bahan_id,nama,qty,harga) values($1,$2,'Beans',10,10000) returning id",
        [shipment, b],
      )
    )[0].id;
    await expect(
      q("select periksa_kiriman($1,gen_random_uuid(),'[]','Belum datang','')", [
        shipment,
      ]),
    ).rejects.toThrow("seluruh");
    await expect(
      q("select periksa_kiriman($1,gen_random_uuid(),$2,'Ada rusak','')", [
        shipment,
        JSON.stringify([{ id: item, baik: 7, rusak: 1, salah: 0 }]),
      ]),
    ).rejects.toThrow("Foto wajib");
    await q(
      "insert into storage.objects(bucket_id,name) values('operasional-bukti',$1)",
      [`kiriman/${o}/${uid}/foto.jpg`],
    );
    const cid = (await q<{ id: string }>("select gen_random_uuid() id"))[0].id;
    const args = [
      shipment,
      cid,
      JSON.stringify([{ id: item, baik: 7, rusak: 1, salah: 0 }]),
      "Dua belum datang",
      `kiriman/${o}/${uid}/foto.jpg`,
    ];
    await q("select periksa_kiriman($1,$2,$3,$4,$5)", args);
    await q("select periksa_kiriman($1,$2,$3,$4,$5)", args);
    expect(
      Number(
        (
          await q<{ jumlah: number }>(
            "select jumlah from stok where outlet_id=$1",
            [o],
          )
        )[0].jumlah,
      ),
    ).toBe(7);
    expect(await q("select id from penerimaan_kiriman")).toHaveLength(1);
    expect(await q("select id from stok where outlet_id is null")).toHaveLength(
      0,
    );
    await expect(q("select batal_kiriman($1)", [shipment])).rejects.toThrow(
      "sudah diperiksa",
    );
    await expect(
      q("select periksa_kiriman($1,gen_random_uuid(),$2,'Terlalu banyak','')", [
        shipment,
        JSON.stringify([{ id: item, baik: 3, rusak: 0, salah: 0 }]),
      ]),
    ).rejects.toThrow("melebihi");
  });
  it("settles only physically returned damage and prepares follow-up quantities", async () => {
    await q(
      "select selesaikan_selisih_kiriman($1,'susulan',$2,'Satu rusak sudah kembali, dua belum datang diganti')",
      [shipment, JSON.stringify([{ id: item, qty: 1 }])],
    );
    expect(
      Number(
        (
          await q<{ jumlah: number }>(
            "select jumlah from stok where outlet_id is null",
          )
        )[0].jumlah,
      ),
    ).toBe(1);
    expect(
      Number(
        (
          await q<{ total: number }>("select total from kiriman where id=$1", [
            shipment,
          ])
        )[0].total,
      ),
    ).toBe(70000);
    expect(
      Number(
        (
          await q<{ qty: number }>(
            "select i.qty from item_kiriman i join kiriman k on k.id=i.kiriman_id where k.kiriman_induk_id=$1",
            [shipment],
          )
        )[0].qty,
      ),
    ).toBe(3);
    await expect(
      q("select selesaikan_selisih_kiriman($1,'koreksi','[]','Coba ulang')", [
        shipment,
      ]),
    ).rejects.toThrow("Tidak ada selisih");
  });
  it("reconciles cash only and reserves pending allocations idempotently", async () => {
    const tx = (
      await q<{ id: string }>(
        "insert into transaksi(outlet_id,sesi_kas_id,nomor,kanal,subtotal,total,created_at) values($1,gen_random_uuid(),1,'langsung',150000,150000,'2026-01-05T02:00Z') returning id",
        [o],
      )
    )[0].id;
    await q(
      "insert into pembayaran(transaksi_id,metode,nominal) values($1,'tunai',100000),($1,'qris',50000)",
      [tx],
    );
    await q(
      "insert into biaya_outlet(outlet_id,kategori_id,tanggal,jumlah,sumber) select $1,id,'2026-01-05',10000,'laci' from kategori_biaya limit 1",
      [o],
    );
    await q(
      "select koreksi_rekonsiliasi($1,'2026-01-05',20000,0,'Modal besok ditahan')",
      [o],
    );
    const cid = (await q<{ id: string }>("select gen_random_uuid() id"))[0].id;
    const path = `setoran/${o}/${uid}/foto.jpg`;
    await q(
      "insert into storage.objects(bucket_id,name) values('operasional-bukti',$1)",
      [path],
    );
    const data = {
      client_id: cid,
      outlet_id: o,
      cara: "tunai",
      waktu: "2026-01-05T03:00Z",
      pengambil: "Petugas Uji",
      penanggung_jawab: "PIC Uji",
      tujuan: "Gudang pusat",
      bukti_path: path,
      rincian: [{ tanggal: "2026-01-05", jumlah: 40000 }],
    };
    await q("select buat_setoran($1)", [JSON.stringify(data)]);
    await q("select buat_setoran($1)", [JSON.stringify(data)]);
    const recap = (
      await q<{ r: { sisa: number; menunggu: number; qris: number }[] }>(
        "select rekap_setoran($1,'2026-01-05','2026-01-05') r",
        [o],
      )
    )[0].r[0];
    expect(recap).toMatchObject({ sisa: 30000, menunggu: 40000, qris: 50000 });
    await expect(
      q("select buat_setoran($1)", [
        JSON.stringify({
          ...data,
          client_id: (await q<{ id: string }>("select gen_random_uuid() id"))[0]
            .id,
        }),
      ]),
    ).rejects.toThrow("melebihi sisa");
    const sid = (await q<{ id: string }>("select id from setoran_omzet"))[0].id;
    await q("select verifikasi_setoran($1,true,'Sesuai POS dan bukti')", [sid]);
    expect(await q("select id from transaksi")).toHaveLength(1);
  });
  it("rejects wrong outlet and missing proof", async () => {
    await db.exec("set app.role='barista'");
    await expect(
      q("select rekap_setoran(gen_random_uuid(),'2026-01-05','2026-01-05')"),
    ).rejects.toThrow("Tidak diizinkan");
    await expect(
      q("select buat_setoran($1)", [
        JSON.stringify({
          outlet_id: o,
          client_id: (await q<{ id: string }>("select gen_random_uuid() id"))[0]
            .id,
          cara: "transfer",
          tujuan: "Bank 1234",
          penanggung_jawab: "PIC Uji",
          waktu: "2026-01-05T03:00Z",
          rincian: [{ tanggal: "2026-01-05", jumlah: 1000 }],
        }),
      ]),
    ).rejects.toThrow("bukti");
    await expect(
      q("select koreksi_rekonsiliasi($1,'2026-01-05',0,10000,'Tidak boleh')", [
        o,
      ]),
    ).rejects.toThrow("Hanya Akunting");
    await db.exec("set app.role='owner'");
  });
  it("reserves installments once, includes withheld loans in expense, and locks final slips", async () => {
    loan = (
      await q<{ id: string }>(
        "select catat_kasbon($1,$2,'2026-01-01',300000,100000,'Sudah dicairkan tunai') id",
        [o, uid],
      )
    )[0].id;
    payroll = (
      await q<{ id: string }>(
        "insert into penggajian(outlet_id,periode) values($1,'2026-01-01') returning id",
        [o],
      )
    )[0].id;
    const rows = [
      {
        pengguna_id: uid,
        nama: "Staf Uji",
        pendapatan: [{ nama: "Gaji pokok", jumlah: 1000000 }],
        potongan: [],
        hitungan_jam: { menit_lembur: 120, belum_lengkap: 0 },
      },
    ];
    await q("select simpan_draft_gaji($1,$2)", [payroll, JSON.stringify(rows)]);
    await q("select simpan_draft_gaji($1,$2)", [payroll, JSON.stringify(rows)]);
    expect(await q("select * from kasbon_potongan")).toHaveLength(1);
    const slip = (
      await q<{ id: string; total: number }>("select id,total from slip_gaji")
    )[0];
    expect(Number(slip.total)).toBe(900000);
    await expect(
      q("select finalkan_penggajian($1)", [payroll]),
    ).rejects.toThrow("setujui");
    await q("select setujui_jam_gaji($1)", [slip.id]);
    await q("select finalkan_penggajian($1)", [payroll]);
    expect(
      Number(
        (
          await q<{ jumlah: number }>(
            "select jumlah from biaya_outlet where id=(select biaya_id from penggajian where id=$1)",
            [payroll],
          )
        )[0].jumlah,
      ),
    ).toBe(1000000);
    await expect(
      q("select ubah_manual_slip($1,'[]','[]')", [slip.id]),
    ).rejects.toThrow("bukan draft");
    await q("select buka_penggajian($1)", [payroll]);
    await q(
      'select ubah_manual_slip($1,\'[{"nama":"Bonus","jumlah":50000}]\',\'[]\')',
      [slip.id],
    );
    expect(
      Number(
        (await q<{ total: number }>("select total from slip_gaji"))[0].total,
      ),
    ).toBe(950000);
    expect(
      Number(
        (
          await q<{ jumlah: number }>(
            "select jumlah from kasbon_potongan where kasbon_id=$1",
            [loan],
          )
        )[0].jumlah,
      ),
    ).toBe(100000);
  });
  it("cannot finalize incomplete attendance or mutate final through Data API", async () => {
    expect(
      (
        await q<{ priv: boolean }>(
          "select has_table_privilege('authenticated','slip_gaji','UPDATE') priv",
        )
      )[0].priv,
    ).toBe(false);
    const rows = [
      {
        pengguna_id: uid,
        nama: "Staf",
        pendapatan: [{ nama: "Gaji", jumlah: 1000000 }],
        potongan: [],
        hitungan_jam: { belum_lengkap: 1, menit_lembur: 0 },
      },
    ];
    await q("select simpan_draft_gaji($1,$2)", [payroll, JSON.stringify(rows)]);
    await expect(
      q("select finalkan_penggajian($1)", [payroll]),
    ).rejects.toThrow("Lengkapi");
  });
  it("records zero take-home salary without violating positive expense and prevents duplicate loan creation", async () => {
    const cid = (await q<{ id: string }>("select gen_random_uuid() id"))[0].id;
    await q(
      "select catat_kasbon($1,$2,'2026-02-01',500000,100000,'Bukti pencairan kedua',$3)",
      [o, uid, cid],
    );
    await q(
      "select catat_kasbon($1,$2,'2026-02-01',500000,100000,'Bukti pencairan kedua',$3)",
      [o, uid, cid],
    );
    expect(await q("select id from kasbon_staf")).toHaveLength(2);
    const g = (
      await q<{ id: string }>(
        "insert into penggajian(outlet_id,periode) values($1,'2026-02-01') returning id",
        [o],
      )
    )[0].id;
    await q("select simpan_draft_gaji($1,$2)", [
      g,
      JSON.stringify([
        {
          pengguna_id: uid,
          nama: "Staf",
          pendapatan: [{ nama: "Gaji", jumlah: 100000 }],
          potongan: [],
          hitungan_jam: { menit_lembur: 0, belum_lengkap: 0 },
        },
      ]),
    ]);
    expect(
      Number(
        (
          await q<{ total: number }>(
            "select total from slip_gaji where penggajian_id=$1",
            [g],
          )
        )[0].total,
      ),
    ).toBe(0);
    await q("select finalkan_penggajian($1)", [g]);
    expect(
      Number(
        (
          await q<{ jumlah: number }>(
            "select jumlah from biaya_outlet where id=(select biaya_id from penggajian where id=$1)",
            [g],
          )
        )[0].jumlah,
      ),
    ).toBe(100000);
    await q("select finalkan_penggajian($1)", [g]);
    expect(
      await q(
        "select id from biaya_outlet where id=(select biaya_id from penggajian where id=$1)",
        [g],
      ),
    ).toHaveLength(1);
  });
  it("lets HRD record opname and rejects duplicate material lines", async () => {
    await db.exec("set app.role='hrd'");
    await q("select simpan_opname($1,'2026-01-10',$2,'Hitung fisik')", [
      o,
      JSON.stringify([{ bahan_id: b, qty_fisik: 5 }]),
    ]);
    expect(
      Number(
        (
          await q<{ jumlah: number }>(
            "select jumlah from stok where outlet_id=$1",
            [o],
          )
        )[0].jumlah,
      ),
    ).toBe(5);
    await expect(
      q("select simpan_opname($1,'2026-01-10',$2,'Duplikat')", [
        o,
        JSON.stringify([
          { bahan_id: b, qty_fisik: 5 },
          { bahan_id: b, qty_fisik: 5 },
        ]),
      ]),
    ).rejects.toThrow("berulang");
    await db.exec("set app.role='owner'");
  });
  it("tracks dessert damage and rejects returns beyond unsold stock", async () => {
    const menu = (
      await q<{ id: string }>(
        "insert into menu(nama,titipan,harga_titip) values('Dessert Uji',true,10000) returning id",
      )
    )[0].id;
    await q(
      "insert into titipan_masuk(outlet_id,menu_id,tanggal,qty,jenis) values($1,$2,'2026-01-01',10,'masuk')",
      [o, menu],
    );
    await q(
      "insert into titipan_masuk(outlet_id,menu_id,tanggal,qty,jenis,catatan) values($1,$2,'2026-01-02',-2,'rusak','Kemasan rusak')",
      [o, menu],
    );
    await expect(
      q(
        "insert into titipan_masuk(outlet_id,menu_id,tanggal,qty,jenis,catatan) values($1,$2,'2026-01-02',-9,'retur','Dikembalikan')",
        [o, menu],
      ),
    ).rejects.toThrow("melebihi sisa");
    expect(
      Number(
        (
          await q<{ qty: number }>(
            "select sum(qty) qty from titipan_masuk where menu_id=$1",
            [menu],
          )
        )[0].qty,
      ),
    ).toBe(8);
  });
});
