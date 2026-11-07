import { describe, it, expect } from "vitest";
import { hitungAcuanBulanan, geserBulan } from "../simulasi-acuan";
const outlets=[{id:"a",nama:"A"},{id:"b",nama:"B"},{id:"c",nama:"Tanpa laporan"}];
const data=[{outletId:"a",periode:"2026-09",omzet:100,hpp:40,beban:10},{outletId:"a",periode:"2026-10",omzet:300,hpp:90,beban:30},{outletId:"b",periode:"2026-10",omzet:600,hpp:300,beban:60}];
describe("acuan simulasi",()=>{
 it("memilih satu outlet satu bulan",()=>expect(hitungAcuanBulanan(data,outlets,{outletId:"a",dari:"2026-10",sampai:"2026-10"})).toMatchObject({jumlah:1,omzet:300,hpp:30,beban:30,kosong:0}));
 it("semua outlet memakai rata-rata outlet-bulan dan HPP tertimbang",()=>expect(hitungAcuanBulanan(data,outlets,{outletId:"semua",dari:"2026-09",sampai:"2026-10"})).toMatchObject({jumlah:3,outlet:2,omzet:333,hpp:43,beban:33,kosong:3}));
 it("bulan tanpa laporan bukan penjualan nol",()=>expect(hitungAcuanBulanan(data,outlets,{outletId:"a",dari:"2026-08",sampai:"2026-10"})).toMatchObject({jumlah:2,omzet:200,hpp:32.5,beban:20,kosong:1}));
 it("rentang melewati tahun benar",()=>{expect(geserBulan("2026-01",-2)).toBe("2025-11");expect(geserBulan("2026-12",1)).toBe("2027-01");});
 it("menolak bulan terbalik dan tidak valid",()=>{for(const p of [{dari:"2026-11",sampai:"2026-10"},{dari:"",sampai:"2026-10"},{dari:"2026-13",sampai:"2027-01"}])expect(hitungAcuanBulanan(data,outlets,{outletId:"a",...p}).error).toBeTruthy();});
 it("outlet kosong atau tidak dikenal tidak menghasilkan angka nol palsu",()=>{for(const outletId of ["c","asing"])expect(hitungAcuanBulanan(data,outlets,{outletId,dari:"2026-10",sampai:"2026-10"}).error).toBeTruthy();});
});
