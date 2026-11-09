// Dipanggil hanya pada jalur QRIS Dinamis. Tidak menyentuh audio/checkout statis.
let context:AudioContext|null=null;
let buffer:Promise<AudioBuffer>|null=null;
const played=new Set<string>();
const inflight=new Map<string,Promise<boolean>>();
function audioContext(){
 if(!context){const C=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!C)throw Error('Audio tidak didukung');context=new C();}
 return context;
}
function load(c:AudioContext){
 if(!buffer)buffer=fetch('/audio/pembayaran-diterima.wav').then(r=>{if(!r.ok)throw Error('Suara belum tersedia');return r.arrayBuffer();}).then(b=>c.decodeAudioData(b)).catch(e=>{buffer=null;throw e;});
 return buffer;
}
/** Resume terjadi langsung dari klik Bayar, sebelum menunggu pembayaran/server. */
export async function siapkanSuaraQris(){const c=audioContext();const resume=c.resume();await Promise.all([resume,load(c)]);}
function sudah(id:string){try{return played.has(id)||sessionStorage.getItem('matoer-qris-paid:'+id)==='1';}catch{return played.has(id);}}
export function suaraQrisSekali(id:string):Promise<boolean>{
 if(sudah(id))return Promise.resolve(true);
 const current=inflight.get(id);if(current)return current;
 const task=(async()=>{try{const c=audioContext();const b=await load(c);if(c.state!=='running')return false;if(sudah(id))return true;const source=c.createBufferSource();source.buffer=b;source.connect(c.destination);source.start();played.add(id);try{sessionStorage.setItem('matoer-qris-paid:'+id,'1');}catch{/* dedup memori tetap berlaku */}source.onended=()=>source.disconnect();return true;}catch{return false;}})();
 inflight.set(id,task);void task.finally(()=>inflight.delete(id));return task;
}
