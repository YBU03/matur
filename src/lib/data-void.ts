export type VoidItem={nama:string;qty:number;harga:number};
export type VoidRow={id:string;nomor:number;outlet_id:string;outlet:string;created_at:string;void_at:string|null;total:number;subtotal:number;diskon:number;pelaku:string;kategori:string;alasan:string|null;items:VoidItem[]};
export const VOID_ROLES=["owner","admin_pusat","finance","hrd","admin_gudang","manajer_area","spv","kasir","barista","tablet"];
export function rekapVoid(rows:VoidRow[]){
 const alasan=new Map<string,{nama:string;transaksi:number;nominal:number}>(),menu=new Map<string,{nama:string;qty:number;nominal:number}>();
 let nominal=0,qty=0;
 for(const r of rows){nominal+=Number(r.total);const key=r.kategori||"Tidak dicatat";const a=alasan.get(key)??{nama:key,transaksi:0,nominal:0};a.transaksi++;a.nominal+=Number(r.total);alasan.set(key,a);
 for(const i of r.items){qty+=Number(i.qty);const m=menu.get(i.nama)??{nama:i.nama,qty:0,nominal:0};m.qty+=Number(i.qty);m.nominal+=Number(i.qty)*Number(i.harga);menu.set(i.nama,m);}}
 return {transaksi:rows.length,nominal,qty,alasan:[...alasan.values()].sort((a,b)=>b.nominal-a.nominal),menu:[...menu.values()].sort((a,b)=>b.qty-a.qty)};
}
export function tanggalJakarta(d=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
export function rentangVoid(periode:string,dari?:string,sampai?:string,now=new Date()){
 const today=tanggalJakarta(now);const day=(offset:number)=>new Date(Date.parse(today+"T12:00:00+07:00")+offset*86400000).toISOString().slice(0,10);
 const start=periode==="kemarin"?day(-1):periode==="7hari"?day(-6):periode==="kustom"?dari:today;
 const end=periode==="kemarin"?day(-1):periode==="kustom"?sampai:today;
 if(!start||!end||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||new Date(start).toISOString().slice(0,10)!==start||new Date(end).toISOString().slice(0,10)!==end||end<start||(Date.parse(end)-Date.parse(start))/86400000>366)throw Error("Pilih tanggal valid, maksimal 367 hari.");
 return {dari:start,sampai:end};
}
export const waktuVoid=(v:string|null)=>v?new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"Tidak tercatat";
