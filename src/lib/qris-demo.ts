export const OUTLET_DEMO_ID = 'dc2f5309-5f4a-4bed-9cb8-3f93c8e2d146';
export function qrisDemoAktif(outletId:string|null|undefined,mode:string|null|undefined){return outletId===OUTLET_DEMO_ID&&mode==='dinamis';}
export type DemoOrder={id:string;nomor:number;subtotal:number;diskon:number;total:number;kembalian:number;kanal:string;status:'pending'|'paid'|'cancelled'|'expired';token:string;expires_at:string;created_at:string;paid_at:string|null;lines:{key:string;nama:string;qty:number;total:number}[]};
