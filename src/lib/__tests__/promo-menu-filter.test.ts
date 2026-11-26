// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PromoMenuFilter } from "@/components/promo-menu-filter";
import { saringMenuPromo, type MenuPromo } from "../promo-menu";
const menus: MenuPromo[] = [
  { id: '1', nama: 'Cappucino', kategori_id: 'coffee', penyajian: 'ice', jenis_kemasan: 'Cup' },
  { id: '2', nama: 'Hot Cappucino', kategori_id: 'coffee', penyajian: 'hot', jenis_kemasan: 'Cup' },
  { id: '3', nama: 'Cappucino Can', kategori_id: 'coffee', jenis_kemasan: 'Can' },
  { id: '4', nama: 'Chocolate', kategori_id: 'non', penyajian: 'ice', jenis_kemasan: 'Cup' },
];
it('selects Coffee Series independently from Ice/Hot and package, without treating unknown as Ice', () => {
  const f={kategori:'coffee',penyajian:'',kemasan:'',cari:''};
  expect(saringMenuPromo(menus,f).map(m=>m.id)).toEqual(['1','2','3']);
  expect(saringMenuPromo(menus,{...f,penyajian:'ice',kemasan:'Cup'}).map(m=>m.id)).toEqual(['1']);
  expect(saringMenuPromo(menus,{...f,penyajian:'kosong'}).map(m=>m.id)).toEqual(['3']);
  expect(saringMenuPromo(menus,{...f,cari:'HOT'}).map(m=>m.id)).toEqual(['2']);
});
it('previews category menus, adds only missing IDs, and never mutates an existing promo selection', async () => {
  (globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const add=vi.fn(), selected=['1','4'];
  await act(async()=>root.render(createElement(PromoMenuFilter, {menus, kategori:[{id:"coffee",nama:"Coffee Series"},{id:"snack",nama:"Snack"}], terpilih:selected, onTambah:add})));
  const select=host.querySelector('select')!;
  await act(async()=>{select.value='coffee';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.querySelector('[aria-label="Pratinjau menu sesuai filter"]')?.textContent).toContain('Hot Cappucino');
  expect(host.querySelector('[aria-label="Pratinjau menu sesuai filter"]')?.textContent).not.toContain('Chocolate');
  await act(async()=>host.querySelector('button')!.click());
  expect(add).toHaveBeenCalledWith(['2','3']);expect(selected).toEqual(['1','4']);
  await act(async()=>{select.value='snack';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.textContent).toContain('Tidak ada menu sesuai filter');
  expect(host.querySelector('button')!.disabled).toBe(true);
  await act(async()=>root.unmount());host.remove();
});
