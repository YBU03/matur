import {expect,it} from 'vitest';
import {teksLaporanShift,type LaporanShift} from '../pos-alur';
it('report distinguishes initial capital from physical drawer and cash earnings',()=>{
 const r={outlet:'Kominot',kas:{modal:200000,tunai:378000,non_tunai:21000,laci:143000,keluar:0,seharusnya:435000},sesi:{tanggal_shift:'2026-10-26',selisih:0},shifts:[{nama:'Andi',label:'Pagi',aktual:435000,void:0,selisih:0,laporan:{non_tunai_aktual:21000,stok:'Cup 240'}}],pengeluaran:[],kanal:{grabfood:21000},barang_datang:[],sementara:true} as unknown as LaporanShift;
 const text=teksLaporanShift(r);expect(text).toContain('Fisik laci termasuk modal: Rp 435.000');expect(text).toContain('Hasil tunai di luar modal: Rp 235.000');expect(text).toContain('Selisih non tunai: Rp 0');expect(text).toContain('Rekap sementara');expect(text).toContain('Cup 240');
});
it('missing counts stay explicitly uncounted, including noncash',()=>{
 const r={outlet:'Uji',kas:{modal:0,tunai:0,non_tunai:0,laci:0,keluar:0,seharusnya:0},sesi:{tanggal_shift:'2026-10-26',selisih:null},shifts:[],pengeluaran:[],kanal:{},barang_datang:[],sementara:false} as unknown as LaporanShift;
 expect(teksLaporanShift(r)).toContain('Non tunai aktual: Belum diperiksa');expect(teksLaporanShift(r)).toContain('Fisik laci termasuk modal: Belum dihitung');
});
