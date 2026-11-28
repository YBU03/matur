import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, it, expect, vi } from 'vitest';
import { LaporanHubLinks } from '@/components/laporan-hub-links';
const api=vi.hoisted(()=>({session:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/session',()=>({getSession:api.session}));
vi.mock('@/lib/supabase/server',()=>({supabaseServer:async()=>{
 const q={select:()=>q,eq:()=>q,ilike:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>({data:{nomor:'085111111111',nama:'Akunting'},error:null})};
 return{from:()=>q,rpc:api.rpc};
}}));
const laporan={id:'report-1',outlet_id:'outlet-1',nama_outlet:'Outlet Satu',periode:'2026-11-01',outlet:null};
const html=async()=>renderToStaticMarkup(await LaporanHubLinks({laporan}));
beforeEach(()=>{vi.clearAllMocks();api.rpc.mockResolvedValue({data:[{id:'m',nama:'Mitra Outlet Satu',no_hp:'085222222222'}],error:null});});
it('owner/admin/finance get report-scoped contacts while existing accounting support remains available',async()=>{
 for(const role of ['owner','admin_pusat','finance']){
  api.session.mockResolvedValue({active:{role}});const out=await html();expect(api.rpc).toHaveBeenLastCalledWith('kontak_mitra_laporan',{l:'report-1'});expect(out).toContain('Mitra Outlet Satu');expect(out).toContain('Hubungi Akunting via WhatsApp');expect(out.includes('Kelola data mitra')).toBe(role!=='finance');
 }
});
it('partners/area managers/marketing and unauthenticated sessions never load or serialize partner contact numbers',async()=>{
 for(const role of ['mitra','manajer_area','marketing',null]){
  api.rpc.mockClear();api.session.mockResolvedValue(role?{active:{role}}:null);const out=await html();expect(api.rpc).not.toHaveBeenCalled();expect(out).not.toContain('Mitra Outlet Satu');expect(out).not.toContain('085222222222');expect(out).toContain('Hubungi Akunting via WhatsApp');
 }
});
it('RPC errors show load failure without pretending contacts are absent',async()=>{
 api.session.mockResolvedValue({active:{role:'finance'}});api.rpc.mockResolvedValue({data:null,error:{message:'unavailable'}});const out=await html();expect(out).toContain('Kontak mitra belum dapat dimuat');expect(out).not.toContain('Belum ada mitra yang terhubung');
});
