export type AutoPrintResult={status:'sent'|'dialog'|'failed'|'duplicate';error?:string};
const attempts=new Map<string,Promise<AutoPrintResult>>();
/** Percobaan tidak diulang otomatis setelah gagal/timeout: printer mungkin sudah menerima data. */
export function autoPrintSekali(id:string,send:()=>Promise<'sent'|'dialog'>):Promise<AutoPrintResult>{
 const old=attempts.get(id);if(old)return old;
 try{if(sessionStorage.getItem('matoer-auto-print:'+id))return Promise.resolve({status:'duplicate'});}catch{}
 // Tunda send satu microtask supaya StrictMode/re-render berbagi promise yang sama.
 const task=Promise.resolve().then(async():Promise<AutoPrintResult>=>{try{sessionStorage.setItem('matoer-auto-print:'+id,'attempted');}catch{}try{return {status:await send()};}catch(e){return {status:'failed',error:e instanceof Error?e.message:'Printer belum dapat mencetak.'};}});
 attempts.set(id,task);return task;
}
