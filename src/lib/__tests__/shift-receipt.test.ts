import { it, expect } from "vitest";
import { barisAkhirShift } from "../shift-receipt";
import { barisTeks } from "../struk-pdf";
import type { LaporanShift } from "../pos-alur";
const report: LaporanShift = { outlet:'Outlet Uji',kas:{modal:100000,tunai:210000,non_tunai:940000,laci:30500,keluar:0,seharusnya:279500},sesi:{tanggal_shift:'2026-11-12',ditutup_at:'2026-11-12T16:34:14Z',fisik_akhir:279500,selisih:0},shifts:[],pengeluaran:[{keterangan:'Es batu',jumlah:30500}],kanal:{langsung:1135000,grabfood:15000},pembayaran:{qris:925000,grabfood:15000},barang_datang:[],sementara:false};
it('prints reconciled cash, actual physical cash and distinct noncash breakdown without double counting channels',()=>{
 const lines=barisTeks(barisAkhirShift(report),48).map(x=>x.teks).join('\n');
 expect(lines).toContain('279.500');expect(lines).toContain('QRIS');expect(lines).toContain('925.000');expect(lines).toContain('GRABFOOD');expect(lines).not.toContain('1.135.000');expect(lines).toContain('Es batu');
 expect(lines).toMatch(/Selisih\s+0/);
});
it('never labels unknown actual cash as zero and clearly marks provisional report',()=>{
 const lines=barisTeks(barisAkhirShift({...report,sementara:true,sesi:{...report.sesi,fisik_akhir:null,selisih:null}}),32).map(x=>x.teks).join('\n');
 expect(lines).toContain('Belum dihitung');expect(lines).toContain('REKAP SEMENTARA');expect(lines).toContain('sinkronisasi');
});
