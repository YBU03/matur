export type Additional={id:string;nama:string;grup:string};
export const extraBerulang=(v:Pick<Additional,'nama'|'grup'>)=>v.grup==='Extra'&&/^extra\s+shoo?t$/i.test(v.nama.trim());
export function namaAdditional<T extends Additional>(list:T[]){const counts=new Map<string,{v:T;n:number}>();for(const v of list){const x=counts.get(v.id);if(x)x.n++;else counts.set(v.id,{v,n:1});}return [...counts.values()].map(({v,n})=>v.nama+(n>1?` ×${n}`:'')).join(', ');}
export function pulihkanAdditional<T extends Additional>(ids:string[],list:T[]){return ids.flatMap(id=>{const v=list.find(v=>v.id===id);return v?[v]:[];});}
