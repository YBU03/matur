import {it,expect} from "vitest";
import {rekapVoid,rentangVoid,type VoidRow} from "../data-void";
it('counts each transaction net once and preserves gross item recap',()=>{
 const base={id:'a',nomor:1,outlet_id:'o',outlet:'Uji',created_at:'2026-11-15T15:00:00Z',void_at:'2026-11-16T02:00:00Z',total:25000,subtotal:30000,diskon:5000,pelaku:'Uji',kategori:'Salah input',alasan:'Catatan',items:[{nama:'Kopi',qty:2,harga:15000}]} satisfies VoidRow;
 const r=rekapVoid([base,{...base,id:'b',total:10000,subtotal:10000,diskon:0,items:[{nama:'Kopi',qty:1,harga:10000}]}]);
 expect(r.transaksi).toBe(2);expect(r.qty).toBe(3);expect(r.nominal).toBe(35000);expect(r.menu).toEqual([{nama:'Kopi',qty:3,nominal:40000}]);expect(r.alasan[0]).toEqual({nama:'Salah input',transaksi:2,nominal:35000});
});
it('uses Jakarta calendar including UTC boundary, custom range and invalid ranges',()=>{
 const now=new Date('2026-11-15T18:00:00Z');
 expect(rentangVoid('hariini',undefined,undefined,now)).toEqual({dari:'2026-11-16',sampai:'2026-11-16'});
 expect(rentangVoid('kemarin',undefined,undefined,now)).toEqual({dari:'2026-11-15',sampai:'2026-11-15'});
 expect(rentangVoid('7hari',undefined,undefined,now)).toEqual({dari:'2026-11-10',sampai:'2026-11-16'});
 expect(()=>rentangVoid('kustom','2026-11-16','2026-11-15')).toThrow();expect(()=>rentangVoid('kustom','2020-01-01','2026-11-16')).toThrow();
});
