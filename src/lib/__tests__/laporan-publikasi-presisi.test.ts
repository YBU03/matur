import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (p: string) => readFileSync(`supabase/migrations/${p}`, 'utf8');
it('publication preserves decimal values and archive, defaults missing detail, and replaces one month on revision', async () => {
 const db = new PGlite();
 try {
 await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create function punya_peran(text[]) returns boolean language sql as $$select true$$;
 create type mode_data as enum ('asli','simulasi'); create table outlet(id uuid primary key);`);
 const core = read('0019_laporan_bulanan.sql');
 await db.exec(core.slice(0,core.indexOf('alter table laporan_bulanan enable')));
 await db.exec(`alter table laporan_bulanan add column laba_bersih bigint, add column tagihan_titipan bigint default 0, add column rincian_titipan jsonb not null default '[]', add column mitra_disetujui boolean, add column mitra_buka_at timestamptz;
 create table laporan_internal(outlet_id uuid,periode date,updated_at timestamptz,buka_at timestamptz,snapshot jsonb);`);
 const original = read('20261103032218_laporan_internal_jadwal_mitra.sql');
 await db.exec(original.slice(original.indexOf('create function public.setujui_laporan_mitra'),original.indexOf('revoke all on function public.setujui_laporan_mitra')));
 await db.exec(read('20261121035228_laporan_resmi_presisi_sumber.sql'));
 const o='00000000-0000-0000-0000-000000000002';
 await db.query('insert into outlet values($1)',[o]);
 const snapshot={nama_outlet:'Uji',karyawan:[],modal_awal:200000,persediaan_awal:12.125,pembelian:20.25,persediaan_akhir:1.003,pendapatan:[],diskon:0,persen_sedekah:2.5,sedekah:1.125,beban:[],bagi_hasil:[],transfer:[],laba_bersih:28073805.81,tagihan_titipan:0,sumber_excel:{sha256:'exact',lembar:[]}};
 await db.query(`insert into laporan_internal values($1,'2026-10-01','2026-11-19','2026-11-19',$2)`,[o,JSON.stringify(snapshot)]);
 await db.query(`select setujui_laporan_mitra($1,'2026-10-01','2026-11-19',false)`,[o]);
 const query=()=>db.query<{laba_bersih:string;persediaan_awal:string;sumber_excel:unknown;rincian_titipan:unknown}>(`select laba_bersih,persediaan_awal,sumber_excel,rincian_titipan from laporan_bulanan`);
 expect((await query()).rows[0]).toEqual({laba_bersih:'28073805.81',persediaan_awal:'12.125',sumber_excel:snapshot.sumber_excel,rincian_titipan:[]});
 await expect(db.query(`select setujui_laporan_mitra($1,'2026-10-01','2026-11-18',true)`,[o])).rejects.toThrow('Draft berubah');
 await expect(db.query(`select setujui_laporan_mitra($1,'2026-10-01','2026-11-19',false)`,[o])).rejects.toThrow('Laporan resmi sudah ada');
 await db.query(`update laporan_internal set snapshot=jsonb_set(snapshot,'{sumber_excel}','{"sha256":"revision"}')`);
 await db.query(`select setujui_laporan_mitra($1,'2026-10-01','2026-11-19',true)`,[o]);
 expect((await query()).rows).toHaveLength(1);
 expect((await query()).rows[0].sumber_excel).toEqual({sha256:'revision'});
 } finally {await db.close();}
},30000);
