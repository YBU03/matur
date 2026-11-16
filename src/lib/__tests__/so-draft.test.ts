import { expect,it } from 'vitest';
import { bacaSoDraft,konflikSo } from '../so-draft';
it('reports only changed ingredients and preserves physical counts including zero',()=>{
 const rows=[{bahan_id:'kopi',qty_sistem:20,qty_fisik:15},{bahan_id:'susu',qty_sistem:8,qty_fisik:0}];
 expect(konflikSo(rows,{kopi:18,susu:8})).toEqual([{...rows[0],qty_terbaru:18}]);expect(rows[1].qty_fisik).toBe(0);
});
it('draft parser refuses another outlet and obsolete formats',()=>{
 expect(bacaSoDraft({version:1},'outlet')).toBeNull();
 expect(bacaSoDraft({version:2,outletId:'other'},'outlet')).toBeNull();
});
it('accepts a recoverable immutable attempt, rejects corrupted input without crashing',()=>{
 const d={version:2,id:'00000000-0000-4000-8000-000000000001',outletId:'outlet',tanggal:'2026-11-16',scope:'mandiri',updatedAt:100,isi:{kopi:{kemasan:'0',eceran:''}},sistem:{kopi:10},catatan:'SO',jenis:'rutin',attempt:{requestId:'00000000-0000-4000-8000-000000000002',tanggal:'2026-11-16',catatan:'[Opname] SO',items:[{bahan_id:'kopi',qty_fisik:0,qty_sistem:10}]}};
 expect(bacaSoDraft(d,'outlet')).toEqual(d);
 expect(bacaSoDraft({...d,isi:{kopi:{kemasan:5}}},'outlet')).toBeNull();
 expect(bacaSoDraft({...d,attempt:{...d.attempt,tanggal:'2026-11-15'}},'outlet')).toBeNull();
});
