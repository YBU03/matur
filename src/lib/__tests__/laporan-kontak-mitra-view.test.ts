// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { LaporanKontakMitra } from '@/components/laporan-kontak-mitra';
const laporan={id:'report-uhb',nama_outlet:'Ruma Kopi UHB',periode:'2026-11-01'};
const one={id:'1',nama:'Mitra Satu',no_hp:'0858-7954-2888'};
const two={id:'2',nama:'Mitra Dua',no_hp:'+62 812-3456-7890'};
let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async(kontak=[one],bisaKelola=false,error=false)=>act(async()=>root.render(createElement(LaporanKontakMitra,{kontak,laporan,bisaKelola,error})));
it('single partner opens correct WA and complete report message without sending or changing status',async()=>{
 await render();const a=host.querySelector('a')!;const url=new URL(a.href);expect(url.pathname).toBe('/6285879542888');const text=url.searchParams.get('text')!;expect(text).toContain('Mitra Satu');expect(text).toContain('Ruma Kopi UHB');expect(text).toContain('November 2026');expect(text).toContain('https://matoer.id/laporan/report-uhb');expect(a.target).toBe('_blank');expect(host.textContent).toContain('Tidak mengubah status');expect(host.querySelector('a[href="/master/mitra"]')).toBeNull();
});
it('requires recipient selection for multiple partners and follows updated phone data',async()=>{
 await render([one,two]);expect(host.querySelector('a[href^="https://wa.me/"]')).toBeNull();const s=host.querySelector('select')!;await act(async()=>{s.value='2';s.dispatchEvent(new Event('change',{bubbles:true}));});expect(host.querySelector('a')?.href).toContain('wa.me/6281234567890');expect(new URL(host.querySelector('a')!.href).searchParams.get('text')).toContain('Mitra Dua');
 await render([one,{...two,no_hp:'081299998888'}]);expect(host.querySelector('a')?.href).toContain('wa.me/6281299998888');await render([one]);expect(host.querySelector('a')?.href).toContain('wa.me/6285879542888');
});
it('no/invalid phone never makes a WA link; master settings are management-only',async()=>{
 await render([{...one,no_hp:''}],true);expect(host.textContent).toContain('Nomor mitra belum diisi');expect(host.querySelector('a[href^="https://wa.me/"]')).toBeNull();expect(host.querySelector('a[href="/master/mitra"]')).not.toBeNull();
 await render([{...one,no_hp:'javascript:alert(1)'}]);expect(host.textContent).toContain('belum valid');expect(host.querySelector('a')).toBeNull();
});
it('distinguishes missing relationships from failed loading',async()=>{
 await render([]);expect(host.textContent).toContain('Belum ada mitra yang terhubung');await render([],false,true);expect(host.querySelector('[role="alert"]')?.textContent).toContain('belum dapat dimuat');expect(host.textContent).not.toContain('Belum ada mitra yang terhubung');
});
