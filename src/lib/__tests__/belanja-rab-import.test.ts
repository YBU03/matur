import { it,expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseWorkbook } from '../rab-excel';
it('round-trip Excel tidak memasukkan realisasi nota lagi ke realisasi lama',async()=>{
 const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Rincian Keperluan');
 ws.addRow(['Kelompok','Nama Barang','Jumlah','Harga Satuan','Total Estimasi','Realisasi','Realisasi Lama (untuk impor)']);
 ws.addRow(['Material','Semen',1,5000,5000,12000,2000]);
 const result=await parseWorkbook(await wb.xlsx.writeBuffer() as ArrayBuffer);
 expect(result.rows[0]).toMatchObject({nama:'Semen',harga_realisasi:2000,harga_estimasi:5000});
 expect(result.notes.join(' ')).toMatch(/tidak dihitung dua kali/);
});
