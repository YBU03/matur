import {it,expect,vi,afterEach} from 'vitest';
import {pakaiFeedbackQrisDinamis} from '../qris-payment-feedback';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('never enables success feedback for static, cash, or offline receipts',()=>{
 expect(pakaiFeedbackQrisDinamis('statis',{metode:'qris'})).toBe(false);
 expect(pakaiFeedbackQrisDinamis(undefined,{metode:'qris'})).toBe(false);
 expect(pakaiFeedbackQrisDinamis('dinamis',{metode:'tunai'})).toBe(false);
 expect(pakaiFeedbackQrisDinamis('dinamis',{metode:'qris',offline:true})).toBe(false);
 expect(pakaiFeedbackQrisDinamis('dinamis',{metode:'qris'})).toBe(true);
 expect(pakaiFeedbackQrisDinamis('dinamis',{metode:'split',bayar:[{metode:'qris',nominal:10000}]})).toBe(true);
});
function audioMock(running=true){
 const start=vi.fn();const memory=new Map<string,string>();
 const c={state:running?'running':'suspended',destination:{},resume:vi.fn(async()=>{c.state='running';}),decodeAudioData:vi.fn(async()=>({})),createBufferSource:()=>({connect:vi.fn(),start,disconnect:vi.fn(),buffer:null,onended:null})};
 vi.stubGlobal('window',{AudioContext:class{constructor(){return c;}}});
 vi.stubGlobal('sessionStorage',{getItem:(k:string)=>memory.get(k),setItem:(k:string,v:string)=>memory.set(k,v)});
 const fetch=vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}));vi.stubGlobal('fetch',fetch);
 return {start,c,fetch,memory};
}
it('plays once for concurrent/repeated confirmation and preloads only once',async()=>{const a=audioMock();const m=await import('../qris-payment-audio');await m.siapkanSuaraQris();expect(await Promise.all([m.suaraQrisSekali('tx1'),m.suaraQrisSekali('tx1')])).toEqual([true,true]);await m.suaraQrisSekali('tx1');expect(a.start).toHaveBeenCalledTimes(1);await m.suaraQrisSekali('tx2');expect(a.start).toHaveBeenCalledTimes(2);expect(a.fetch).toHaveBeenCalledTimes(1);});
it('blocked autoplay never marks played, and explicit user activation can retry',async()=>{const a=audioMock(false);const m=await import('../qris-payment-audio');expect(await m.suaraQrisSekali('blocked')).toBe(false);expect(a.memory.size).toBe(0);await m.siapkanSuaraQris();expect(await m.suaraQrisSekali('blocked')).toBe(true);expect(a.start).toHaveBeenCalledTimes(1);});
it('session dedup prevents replay after component/module remount',async()=>{const a=audioMock();a.memory.set('matoer-qris-paid:old','1');const m=await import('../qris-payment-audio');expect(await m.suaraQrisSekali('old')).toBe(true);expect(a.start).not.toHaveBeenCalled();expect(a.fetch).not.toHaveBeenCalled();});
