import { describe, it, expect } from "vitest";
import { buatPdfRealisasi } from "../belanja-proyek-pdf";
import { ringkasanBelanja, type Belanja } from "../belanja-proyek";

const nota: Belanja = {
  id:"b",proyek_id:"p",tanggal:"2026-10-24",toko:"Toko Contoh - data uji lokal",nomor_nota:"UJI-001",
  penanggung_jawab:"Penanggung Jawab Uji",catatan:"Pesanan dengan DP dan pelunasan terpisah.",nota_path:null,
  total:3250000,nama_pencatat:"Admin Uji",updated_at:"v",batal_at:null,alasan_batal:null,
  items:[{id:"i",belanja_id:"b",item_rab_id:null,nama:"Hiasan teras kanan kiri",kategori:"Interior",satuan:"paket",qty:1,harga_satuan:3250000,jumlah:3250000,urutan:1}],
  pembayaran:[{id:"dp",belanja_id:"b",tanggal:"2026-10-24",jumlah:1491750,sumber:"dana_proyek",metode:"transfer",catatan:"DP",nama_pencatat:"Admin Uji"}],
};
describe("DP dan laporan realisasi",()=>{
  it("DP hanya mengurangi kas sekali; sisa pesanan tetap menjadi tagihan",()=>{
    expect(ringkasanBelanja([nota],0,25000000)).toMatchObject({nota:3250000,dariProyek:1491750,dibayar:1491750,saldo:23508250,tagihan:1758250});
    const lunas={...nota,pembayaran:[...nota.pembayaran,{...nota.pembayaran[0],id:"lunas",jumlah:1758250,tanggal:"2026-10-31"}]};
    expect(ringkasanBelanja([lunas],0,25000000)).toMatchObject({nota:3250000,dariProyek:3250000,saldo:21750000,tagihan:0});
  });
  it("PDF memuat rincian, tanggal DP, semua sumber, pembatalan dan halaman lanjutan",async()=>{
    const data={nama:"Proyek Uji Lokal - bukan data produksi",rab:57111000,realisasiLama:100000,setoran:[{id:"s",tanggal:"2026-10-22",jumlah:25000000,keterangan:"Setoran uji"}],belanja:[nota,
      {...nota,id:"lain",toko:"Pembayaran sumber lain",pembayaran:[{...nota.pembayaran[0],sumber:"talangan_pusat" as const},{...nota.pembayaran[0],id:"mitra",jumlah:100000,sumber:"langsung_mitra" as const}]},
      {...nota,id:"batal",toko:"Nota dibatalkan",pembayaran:[],batal_at:"2026-10-24",alasan_batal:"Pesanan tidak dilanjutkan"},
      {...nota,id:"panjang",total:113750000,toko:"Toko dengan keterangan panjang untuk menguji pemisahan halaman",items:Array.from({length:35},(_,i)=>({...nota.items[0],id:`long-${i}`,nama:`Barang ${i+1} dengan nama panjang untuk pemeriksaan tata letak PDF dan kolom harga`,urutan:i+1})),pembayaran:[],catatan:"Catatan panjang untuk pengujian pembungkusan teks. ".repeat(12)},
    ]};
    const doc=await buatPdfRealisasi(data,new Date("2026-10-24T04:00:00Z"));
    const text=doc.output();
    for(const s of ["Sisa Dana Aktual","Rp 1.491.750","Rp 23.508.250","24 Okt 2026","DP","Talangan pusat","Dibayar langsung mitra","Pesanan tidak dilanjutkan","Halaman 1 /"]) expect(text).toContain(s);
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    if(process.env.QA_PDF_PATH){const {writeFile}=await import("node:fs/promises");await writeFile(process.env.QA_PDF_PATH,Buffer.from(doc.output("arraybuffer")));}
  });
  it("PDF tetap dapat dibuat saat nota dan setoran kosong",async()=>{
    const doc=await buatPdfRealisasi({nama:"Kosong",rab:0,realisasiLama:0,setoran:[],belanja:[]});
    expect(doc.output()).toContain("Belum ada realisasi belanja tercatat.");
  });
});
