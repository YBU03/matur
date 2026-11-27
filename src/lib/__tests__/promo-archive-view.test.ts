// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PromoPanel } from '@/app/(app)/promo/panel';
import type { Promo } from '../promo';
const api=vi.hoisted(()=>({arsipPromo:vi.fn(),simpanPromo:vi.fn(),tanya:vi.fn(),refresh:vi.fn()}));
vi.mock('@/lib/promo-actions',()=>({arsipPromo:api.arsipPromo,simpanPromo:api.simpanPromo}));
vi.mock('@/components/dialog-tanya',()=>({tanya:api.tanya}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:api.refresh})}));
const base:Promo={id:'demo',nama:'Simulasi Demo',aktif:false,mulai:'2026-11-20',selesai:'2026-12-31',jam_mulai:'00:00',jam_selesai:'23:59',semua_outlet:false,outlet_ids:['outlet'],aturan:[{menu_id:'kopi',varian_ids:[],jenis:'persen',nilai:20}],kuota:30,per_menu:false,bersama:false,boleh_manual:false,versi:1};
const archived:Promo={...base,id:'archived',nama:'Simulasi lama',versi:2,diarsipkan_at:'2026-11-27T02:00:00Z',diarsipkan_nama:'Admin Demo'};
let host:HTMLDivElement,root:Root;
const props={outlets:[{id:'outlet',nama:'Outlet Demo'}],menus:[],variants:[],laporan:[],bisaEdit:true,spv:false,dari:'2026-11-27',sampai:'2026-11-27',outlet:''};
const render=async(promos:Promo[]=[base,archived],bisaEdit=true)=>act(async()=>root.render(createElement(PromoPanel,{...props,promos,bisaEdit})));
const button=(text:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text))!;
beforeEach(()=>{(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();api.tanya.mockResolvedValue(true);api.arsipPromo.mockResolvedValue({id:'demo'});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('separates archive from all/status counts, and cancellation performs no mutation',async()=>{
 await render();expect(host.querySelectorAll('article')).toHaveLength(1);expect(host.textContent).not.toContain('Simulasi lama');
 api.tanya.mockResolvedValue(false);await act(async()=>button('Hapus/Arsipkan').click());expect(api.arsipPromo).not.toHaveBeenCalled();
 await act(async()=>button('Arsip1').click());expect(host.querySelectorAll('article')).toHaveLength(1);expect(host.textContent).toContain('Simulasi lama');expect(host.textContent).toContain('Admin Demo');expect(button('Hapus/Arsipkan')).toBeUndefined();expect(button('Edit')).toBeUndefined();
});
it('archives using current version only after confirmation, refreshes and preserves reporting rows',async()=>{
 await render();await act(async()=>button('Hapus/Arsipkan').click());
 expect(api.tanya.mock.calls[0][0]).toContain('Riwayat transaksi, diskon dan laporan tetap tersimpan');expect(api.arsipPromo).toHaveBeenCalledWith('demo',1,false);expect(api.refresh).toHaveBeenCalledOnce();expect(api.simpanPromo).not.toHaveBeenCalled();
 await render([{...base,aktif:false,versi:2,diarsipkan_at:'2026-11-27T02:00:00Z'},archived]);expect(host.querySelectorAll('article')).toHaveLength(0);
});
it('restores from archive without activating or saving campaign, and shows server errors',async()=>{
 await render();await act(async()=>button('Arsip1').click());api.arsipPromo.mockResolvedValue({error:'Promo diubah pengguna lain. Muat ulang'});await act(async()=>button('Pulihkan').click());expect(host.querySelector('[role="alert"]')?.textContent).toContain('diubah pengguna lain');expect(api.refresh).not.toHaveBeenCalled();
 api.arsipPromo.mockResolvedValue({id:'archived'});await act(async()=>button('Pulihkan').click());expect(api.arsipPromo).toHaveBeenLastCalledWith('archived',2,true);expect(api.tanya.mock.calls.at(-1)?.[0]).toContain('NONAKTIF');expect(api.simpanPromo).not.toHaveBeenCalled();
});
it('finance can inspect archive but has no mutation buttons',async()=>{
 await render(undefined,false);expect(button('Hapus/Arsipkan')).toBeUndefined();await act(async()=>button('Arsip1').click());expect(host.textContent).toContain('Simulasi lama');expect(button('Pulihkan')).toBeUndefined();
});
