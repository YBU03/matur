import {it,expect} from 'vitest';
import {ringkasGudang,type GudangLaporan} from '../gudang-laporan';
it('does not treat missing historical cost as free inventory profit',()=>{
 const d={rows:[{qty:2,harga:1500,hpp_gudang:1000,kepemilikan:'Pusat'},{qty:1,harga:5000,hpp_gudang:null,kepemilikan:'Mitra'}],biaya:[{jumlah:100}],mutasi:[{jumlah:-1,hpp:50}]} as unknown as GudangLaporan;
 expect(ringkasGudang(d)).toMatchObject({penjualan:8000,hpp:2000,labaKotor:1000,laba:850,penjualanBelum:5000,pusat:3000,belum:1});
});
it('preserves signed stock adjustments and flags missing valuations',()=>{const d={rows:[],biaya:[],mutasi:[{jumlah:5,hpp:100},{jumlah:-2,hpp:20},{jumlah:-1,hpp:null}]} as unknown as GudangLaporan;expect(ringkasGudang(d)).toMatchObject({penyesuaian:460,laba:460,belum:1});});
