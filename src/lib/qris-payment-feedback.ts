/** Hanya receipt server yang sudah berhasil, pada QRIS Dinamis, boleh memicu feedback. */
export function pakaiFeedbackQrisDinamis(mode:string|undefined, receipt:{metode:string;offline?:boolean;bayar?:{metode:string;nominal:number}[]}) {
 return mode==='dinamis'&&!receipt.offline&&(receipt.metode==='qris'||!!receipt.bayar?.some(p=>p.metode==='qris'&&p.nominal>0));
}
