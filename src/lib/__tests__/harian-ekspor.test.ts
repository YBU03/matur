import { describe,it,expect,vi,afterEach } from "vitest";
import ExcelJS from "exceljs";
import { eksporExcel } from "../../app/(app)/catatan-harian/ekspor";

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('ekspor harian dan rekonsiliasi',()=>{
 it('menulis kategori, diskon, kas, dan angka nol tanpa mengarang aktual untuk kas belum tutup',async()=>{
  let blob:Blob|undefined;
  vi.stubGlobal('URL',{createObjectURL:(v:Blob)=>{blob=v;return 'blob:qa';},revokeObjectURL:vi.fn()});
  vi.stubGlobal('document',{createElement:()=>({href:'',download:'',click:vi.fn()})});
  const h={tanggal:'2026-11-06',transaksi:3,shift:1,tunai:100000,non_tunai:50000,gofood:0,grabfood:0,tiktok:0,ruma_app:0,shopeefood:0,tumbler:10000,diskon:5000,seharusnya:65000,setoran:60000,selisih:-5000};
  await eksporExcel('Uji','2026-11',[h,{...h,tanggal:'2026-11-07',setoran:null,seharusnya:null,selisih:null}],[],[{id:'b',tanggal:h.tanggal,kategori_id:'sedekah',jumlah:10000,keterangan:'Sedekah aktual',sumber:'pusat',created_at:'2026-11-06T06:00:00Z',pengguna:null}],[{id:'sedekah',nama:'Sedekah',grup:'lain',urutan:202}],[]);
  expect(blob).toBeDefined();const wb=new ExcelJS.Workbook();await wb.xlsx.load(await blob!.arrayBuffer());const ws=wb.getWorksheet('Transaksi')!;
  expect(ws.getCell('Y6').text).toBe('Sedekah');expect(ws.getCell('W6').text).toBe('Lain Lain');
  expect(ws.getCell('Y8').value).toBe(10000);expect(ws.getCell('E7').value).toBe(60000);
  expect(ws.getCell('AB7').formula).toBe('SUM(D7:J7)-K7');
  expect(ws.getCell('AD7').value).toBe(65000);expect(ws.getCell('AE7').value).toBe(60000);expect(ws.getCell('AF7').value).toBe(-5000);
  expect(ws.getCell('AE9').value).toBeNull();expect(ws.getCell('AF9').value).toBeNull();
 });
});
