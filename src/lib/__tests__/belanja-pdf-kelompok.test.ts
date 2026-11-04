import { expect, it } from "vitest";
import { kelompokNotaPdf, kelompokPembayaranPdf } from "../belanja-pdf-kelompok";
import { ringkasanBelanja, terbayar, type Belanja } from "../belanja-proyek";
import { buatPdfRealisasi } from "../belanja-proyek-pdf";
const nota = (id: string, total = 10000): Belanja => ({
 id,proyek_id:"p",tanggal:"2026-11-03",toko:"Toko Contoh",nomor_nota:"N-1",penanggung_jawab:"Putra dan Wahyu",catatan:null,nota_path:null,total,nama_pencatat:"Admin",updated_at:"v",batal_at:null,alasan_batal:null,
 items:[{id:"i-"+id,belanja_id:id,item_rab_id:"r-"+id,nama:"Barang "+id,kategori:"Material",satuan:"buah",qty:1,harga_satuan:total,jumlah:total,urutan:1}],
 pembayaran:[{id:"b-"+id,belanja_id:id,tanggal:"2026-11-03",jumlah:total,sumber:"dana_proyek",metode:"transfer",catatan:"Lunas",nama_pencatat:"Admin"}],
});
it("combines same receipt including whitespace and blank invoice numbers without changing financial totals or input",()=>{
 const asli=[nota("a"),{...nota("b",25000),toko:" Toko  Contoh ",penanggung_jawab:"Putra & Wahyu"}, {...nota("c"),nomor_nota:null},{...nota("d"),nomor_nota:""}];
 const snapshot=JSON.stringify(asli);const groups=kelompokNotaPdf(asli);
 expect(groups).toHaveLength(2);expect(groups[0].nota.total).toBe(35000);expect(groups[0].nota.penanggung_jawab).toBe("Putra dan Wahyu");expect(groups[0].nota.items.map(i=>i.item_rab_id)).toEqual(["r-a","r-b"]);
 expect(groups[1].jumlahCatatan).toBe(2);
 expect(ringkasanBelanja(groups.map(g=>g.nota),0,25000000)).toEqual(ringkasanBelanja(asli,0,25000000));
 expect(JSON.stringify(asli)).toBe(snapshot);
});
it("keeps different dates, projects, invoice numbers, DP-only values and cancelled records separate",()=>{
 const asli=[nota("a"),{...nota("b"),tanggal:"2026-11-04"},{...nota("c"),proyek_id:"other"},{...nota("d"),nomor_nota:"N-2"},{...nota("e"),nota_dp:true},{...nota("f"),batal_at:"2026-11-04",alasan_batal:"Salah input"}];
 expect(kelompokNotaPdf(asli)).toHaveLength(6);
});
it("summarizes same-day payments but preserves sources, dates, corrections and distinct same-value payments",()=>{
 const b=nota("a");const payments=[b.pembayaran[0],{...b.pembayaran[0],id:"dua"},{...b.pembayaran[0],id:"dp",tanggal:"2026-10-30",catatan:"DP"},{...b.pembayaran[0],id:"talangan",sumber:"talangan_pusat" as const},{...b.pembayaran[0],id:"koreksi",batal_at:"2026-11-04",alasan_batal:"Salah",nama_pembatal:"Admin"}];
 const groups=kelompokPembayaranPdf(payments);expect(groups).toHaveLength(4);expect(groups.find(p=>p.tanggal==="2026-11-03"&&p.sumber==="dana_proyek"&&!p.batal_at)?.jumlah).toBe(20000);
 expect(terbayar({pembayaran:groups})).toBe(terbayar({pembayaran:payments}));expect(groups.some(p=>p.batal_at&&p.alasan_batal==="Salah")).toBe(true);
});
it("prints one receipt section with subtotal and all original items; optional real-data PDF preserves amounts",async()=>{
 const belanja=Array.from({length:12},(_,i)=>nota(String(i)));
 const doc=await buatPdfRealisasi({nama:"Uji Pengelompokan",rab:120000,realisasiLama:0,setoran:[],belanja});const text=doc.output();
 expect(text.match(/1\. Toko Contoh/g)).toHaveLength(1);expect(text).not.toContain("2. Toko Contoh");expect(text).toContain("Subtotal nota");expect(text).toContain("Rp 120.000");
 for(let i=0;i<12;i++)expect(text).toContain("Barang "+i);
 if(process.env.QA_REALISASI_DATA&&process.env.QA_GROUPED_PDF_PATH){
  const fs=await import("node:fs/promises");const data=JSON.parse(await fs.readFile(process.env.QA_REALISASI_DATA,"utf8"));
  const groups=kelompokNotaPdf(data.belanja);const original=ringkasanBelanja(data.belanja,data.realisasiLama,data.setoran.reduce((s:number,x:{jumlah:number})=>s+Number(x.jumlah),0));
  const grouped=ringkasanBelanja(groups.map(g=>g.nota),data.realisasiLama,data.setoran.reduce((s:number,x:{jumlah:number})=>s+Number(x.jumlah),0));
  for(const k of ["nota","dibayar","dariProyek","saldo","tagihan","talangan","mitra"] as const)expect(grouped[k]).toBe(original[k]);
  const actual=await buatPdfRealisasi(data,new Date("2026-11-04T03:00:00Z"));await fs.writeFile(process.env.QA_GROUPED_PDF_PATH,Buffer.from(actual.output("arraybuffer")));
  console.log(`PDF QA: ${data.belanja.length} catatan -> ${groups.length} kelompok; ${actual.getNumberOfPages()} halaman; seluruh nilai dana sama`);
 }
});
