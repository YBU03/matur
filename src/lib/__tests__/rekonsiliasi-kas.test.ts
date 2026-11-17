import { expect, it } from "vitest";
import { masalahBiaya, alasanTransaksi } from "../rekonsiliasi-kas";
it('explains missing and mismatched shifts separately from valid cash expenses', () => {
 const b={sumber:'laci' as const,sesi_kas_id:null,tanggal_shift:null,tanggal:'2026-11-11'};
 expect(masalahBiaya(b)).toMatch(/Belum terhubung/);
 expect(masalahBiaya({...b,sumber:'pusat'})).toBeNull();
 expect(masalahBiaya({...b,sesi_kas_id:'s',tanggal_shift:'2026-11-07'})).toMatch(/berbeda/);
 expect(masalahBiaya({...b,sesi_kas_id:'s',tanggal_shift:b.tanggal})).toBeNull();
});
it('explains flagged transactions without calling normal QRIS or tumbler wrong',()=>{
 expect(alasanTransaksi('grabfood','qris')).toMatch(/grabfood.*qris/);
 expect(alasanTransaksi('langsung','grabfood')).toMatch(/langsung/);
 expect(alasanTransaksi('langsung','qris')).toBeNull();
 expect(alasanTransaksi('tumbler','qris')).toBeNull();
 expect(alasanTransaksi('grabfood','grabfood')).toBeNull();
});
