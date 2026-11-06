import { describe,it,expect } from "vitest";
import { kolomHarianRuma,totalPenjualanHarian,keteranganHarian } from "../tabel-harian-format";
import { nilaiHari } from "../harian";
const names=['Es Kristal','Bahan Baku','Biaya Galon','Biaya Sewa','Biaya Listrik','Biaya Internet/Wifi','Biaya Air/PDAM','Biaya Maintenance','Biaya Gaji','Biaya Perlengkapan','Biaya Pemeliharaan Lingkungan','Biaya lain lain','Reimburse','Sedekah','Biaya Distribusi','Biaya Marketing'];
const categories=names.map((nama,i)=>({id:`k${i}`,nama,urutan:100-i}));
describe('format 26 kolom harian',()=>{
 it('memakai urutan yang disepakati dan menampilkan kolom kosong',()=>{
  const cols=kolomHarianRuma(categories);
  expect(['Tanggal',...cols.slice(0,25).map(c=>c.label)]).toEqual(['Tanggal','Keterangan','Tunai','Non Tunai','Go food','Grabfood','Tiktok Go','Ruma App','Shopee Food','Discount','Es Kristal','Bahan Baku','Biaya Galon','Sewa Outlet','Listrik','Internet','Air','Maintenance','B. Gaji','Biaya Perlengkapan','Biaya Pemeliharaan Lingkungan','Lain Lain','Reimburse','Sedekah','Distribusi','Marketing']);
  expect(cols.slice(0,25).every(c=>c.ada)).toBe(true);
  expect(cols[25].key).toBe('total_jual');
 });
 it('menjaga ID kategori dan menyimpan kolom tambahan untuk Atur Kolom',()=>{
  const cols=kolomHarianRuma([...categories,{id:'extra',nama:'Biaya Admin Transfer',urutan:0}]);
  expect(cols.find(c=>c.label==='Sewa Outlet')?.key).toBe('k3');
  expect(cols.find(c=>c.key==='extra')?.ada).toBe(false);
  expect(cols.find(c=>c.key==='tumbler')?.ada).toBe(false);
  expect(cols.filter(c=>c.key==='k3')).toHaveLength(1);
 });
 it('total menyertakan kanal tersembunyi dan mengurangi diskon sekali',()=>{
  const nilai=nilaiHari({tanggal:'2026-11-06',tunai:100000,non_tunai:50000,tumbler:10000,diskon:5000},[]);
  expect(totalPenjualanHarian(nilai)).toBe(155000);
 });
 it('keterangan memakai data asli, bukan membuat nama shift palsu',()=>{
  expect(keteranganHarian(0,[],categories)).toBe('');
  expect(keteranganHarian(2,[{kategori_id:'k0',keterangan:'Es batu 4'},{kategori_id:'k1',keterangan:null}],categories)).toBe('2 shift · Es batu 4 · Bahan Baku');
 });
});
