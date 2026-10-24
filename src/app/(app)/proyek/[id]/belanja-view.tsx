"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah as rp, formatTanggal } from "@/lib/format";
import { hariIni } from "@/lib/jadwal/waktu";
import { RingkasanDana } from "./ringkasan-dana";
import { BelanjaPdf } from "./belanja-pdf";
import { totalEstimasiRab } from "@/lib/rab-total";
import type { Setoran } from "@/lib/proyek";
import type { ItemRab } from "@/lib/proyek";
import { SUMBER_BELANJA, barangDariRab, terapkanPilihanRab, jumlahBarang, ringkasanBelanja, statusBelanja, terbayar, type Belanja, type BelanjaInput, type BarangInput, type SumberBelanja } from "@/lib/belanja-proyek";
import { simpanBelanja, catatBayarBelanja, hapusBelanja, koreksiBayarBelanja } from "@/lib/belanja-proyek-actions";

const input = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:bg-stone-100";
const btn = "rounded-lg border border-matur-300 px-3 py-2 text-sm font-semibold disabled:opacity-40";
const utama = `${btn} bg-kopi-900 text-white`;
const baru = (): BarangInput => ({ item_rab_id: null, nama: "", kategori: "Lainnya", satuan: "", qty: "1", harga_satuan: "" });
function Sumber({ value, onChange }: { value: SumberBelanja; onChange: (v: SumberBelanja) => void }) {
  return <label className="block text-sm">Sumber dana<select className={input} value={value} onChange={(e) => onChange(e.target.value as SumberBelanja)}>{Object.entries(SUMBER_BELANJA).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>;
}
function FormNota({ proyekId, rab, nota, onClose }: { proyekId: string; rab: ItemRab[]; nota: Belanja | null; onClose: () => void }) {
  const router = useRouter();
  const [id] = useState(() => nota?.id ?? crypto.randomUUID());
  const [payId] = useState(() => crypto.randomUUID());
  const [items, setItems] = useState<BarangInput[]>(() => nota ? nota.items.map((i) => ({ item_rab_id: i.item_rab_id, nama: i.nama, kategori: i.kategori, satuan: i.satuan ?? "", qty: String(i.qty), harga_satuan: String(i.harga_satuan) })) : [baru()]);
  const [tanggal, setTanggal] = useState(nota?.tanggal ?? hariIni());
  const [toko, setToko] = useState(nota?.toko ?? "");
  const [nomor, setNomor] = useState(nota?.nomor_nota ?? "");
  const [pj, setPj] = useState(nota?.penanggung_jawab ?? "");
  const [catatan, setCatatan] = useState(nota?.catatan ?? "");
  const [notaDp, setNotaDp] = useState(nota?.nota_dp ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [picker, setPicker] = useState(false);
  const [cari, setCari] = useState("");
  const [pilihan, setPilihan] = useState<string[]>([]);
  const [modeBayar, setModeBayar] = useState<"belum" | "dp" | "lunas">("dp");
  const [nominal, setNominal] = useState("");
  const [tglBayar, setTglBayar] = useState(nota?.tanggal ?? hariIni());
  const [sumber, setSumber] = useState<SumberBelanja>("dana_proyek");
  const [metode, setMetode] = useState("tunai");
  const [cek, setCek] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const total = items.reduce((s,i) => s + (jumlahBarang(i.qty,i.harga_satuan) || 0), 0);
  const bayar = modeBayar !== "belum";
  const nominalBayar = modeBayar === "lunas" ? total : Number(nominal) || 0;
  const dibayarLama = nota ? terbayar(nota) : 0;
  const statusEdit = !dibayarLama ? "belum" : notaDp || dibayarLama < total ? "dp" : "lunas";
  const sisaTagihan = total - (nota ? dibayarLama : bayar ? nominalBayar : 0);
  const edit = (n: number, field: keyof BarangInput, value: string) => setItems(items.map((i,k) => k === n ? { ...i, [field]: value } : i));
  const payload: BelanjaInput = { nota_dp: notaDp, tanggal, toko, nomor_nota: nomor, penanggung_jawab: pj, catatan, nota_path: nota?.nota_path ?? null, items, ...(!nota && bayar ? { pembayaran: { id: payId, tanggal: tglBayar, jumlah: String(nominalBayar), sumber, metode, catatan: notaDp || nominalBayar < total ? "DP / pembayaran sebagian" : "Pembayaran lunas" } } : {}) };
  const kirim = () => start(async () => {
    const f = new FormData(); if (file) f.set("nota",file);
    try {
      const r = await simpanBelanja(proyekId,id,nota?.updated_at ?? null,payload,f);
      if (r.error) { setErr(r.error); setCek(false); return; }
      onClose(); router.refresh();
    } catch { setErr("Nota belum tersimpan. Coba lagi."); setCek(false); }
  });
  return <Modal title={nota ? "Edit realisasi belanja" : "Tambah realisasi belanja"}>
    {cek ? <div className="space-y-3 text-sm">
      <p>Periksa nota <b>{toko}</b> tanggal {formatTanggal(tanggal)} sebelum disimpan.</p>
      {nota && <p>Total sebelumnya: <b>{rp(nota.total)}</b></p>}
      <ul className="max-h-52 space-y-2 overflow-y-auto">{items.map((i,k) => <li key={k} className="flex justify-between gap-3 border-b pb-1"><span>{i.nama} · {i.qty} {i.satuan}</span><b>{rp(jumlahBarang(i.qty,i.harga_satuan))}</b></li>)}</ul>
      <p className="text-lg font-bold">{notaDp ? "Nilai nota DP" : "Total pesanan"} {rp(total)}</p>{notaDp && <p className="text-amber-800">Ini hanya nilai DP. Sisa harga pesanan belum diketahui.</p>}
      <p>Penanggung jawab: {pj}</p>
      <p>Status pembayaran: <b>{nota ? statusEdit === "belum" ? "Belum Dibayar" : statusEdit === "dp" ? "DP" : "Lunas" : bayar ? modeBayar === "lunas" ? "Lunas" : "DP" : "Belum Dibayar"}</b></p>
      {nota && <p>Pembayaran lama dipertahankan: <b>{rp(dibayarLama)}</b>. Tidak dicatat ulang.</p>}
      {bayar && !nota && <p>Sudah dibayar {rp(nominalBayar)} · {SUMBER_BELANJA[sumber]} · {metode} · {formatTanggal(tglBayar)}</p>}
      <p>{notaDp ? "Sisa pelunasan pesanan belum diketahui." : <>Sisa tagihan: <b>{rp(sisaTagihan)}</b></>}</p>
      {file && <p>Bukti nota: {file.name}</p>}
      <div className="flex justify-end gap-2"><button disabled={pending} type="button" onClick={() => setCek(false)} className={btn}>Periksa lagi</button><button disabled={pending} type="button" onClick={kirim} className={utama}>{pending ? "Menyimpan…" : "Konfirmasi simpan"}</button></div>
    </div> : <form onSubmit={(e) => { e.preventDefault(); setErr(""); if (!items.length || total <= 0) { setErr("Isi barang dan harga aktualnya."); return; } if (nota && total < dibayarLama) { setErr("Total pesanan tidak boleh kurang dari pembayaran yang sudah tercatat. Koreksi pembayaran dari riwayat bila pencatatannya keliru."); return; } if (!nota && bayar && (!Number.isSafeInteger(nominalBayar) || nominalBayar <= 0 || nominalBayar > total || (modeBayar === "dp" && !notaDp && nominalBayar >= total))) { setErr("Isi nominal DP lebih dari nol dan lebih kecil dari total pesanan. Jika dibayar penuh, pilih Lunas."); return; } if (file && file.size>5*1024*1024) { setErr("Bukti nota maksimal 5 MB."); return; } setCek(true); }}>
      <fieldset disabled={pending} className="max-h-[65vh] space-y-4 overflow-y-auto px-0.5 pb-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Tanggal nota<input required type="date" className={input} value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></label>
          <label className="text-sm">Toko / penerima<input required maxLength={200} className={input} value={toko} onChange={(e) => setToko(e.target.value)} /></label>
          <label className="text-sm">Nomor nota (opsional)<input maxLength={100} className={input} value={nomor} onChange={(e) => setNomor(e.target.value)} /></label>
          <label className="text-sm">Penanggung jawab belanja<input required maxLength={200} className={input} value={pj} onChange={(e) => setPj(e.target.value)} /></label>
        </div>
        <div className="rounded-xl bg-matur-50 p-3 text-sm">
          <p>Pilih barang RAB: jumlah dan harga otomatis terisi. Sesuaikan jika jumlah pembelian atau harga penjual berbeda. DP diisi terpisah di bawah total pesanan; anggaran RAB tetap.</p>
          <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => setPicker(!picker)} className={btn}>Pilih barang RAB</button><button type="button" disabled={items.length>=200} onClick={() => setItems([...items,baru()])} className={btn}>+ Barang manual</button></div>
          {picker && <div className="mt-3 space-y-2">
            <label className="block">Cari barang RAB<input className={input} value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Nama atau kategori material…" /></label>
            <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg bg-white p-2">{rab.filter((r) => `${r.nama} ${r.kategori}`.toLowerCase().includes(cari.toLowerCase())).map((r) => <label key={r.id} className="flex items-start gap-2"><input type="checkbox" checked={pilihan.includes(r.id)} onChange={(e) => setPilihan(e.target.checked ? [...pilihan,r.id] : pilihan.filter((id) => id!==r.id))} className="mt-1" /><span>{r.nama}<small className="block text-stone-500">{r.kategori} · {r.qty} {r.satuan ?? "unit"} · Total RAB {rp(r.harga_estimasi)}</small></span></label>)}{rab.length===0 && <p>Belum ada RAB. Gunakan input manual.</p>}</div>
            <button type="button" disabled={!pilihan.length} className={utama} onClick={() => {
              const terpilih = rab.filter((r) => pilihan.includes(r.id)).map(barangDariRab);
              const gabungan = terapkanPilihanRab(items,terpilih);
              if (gabungan.length>200) { setErr("Maksimal 200 barang per nota."); return; }
              setItems(gabungan); setPilihan([]); setPicker(false);
            }}>Tambahkan {pilihan.length} pilihan</button>
          </div>}
        </div>
        <ol className="space-y-3">{items.map((i,k) => <li key={k} className="rounded-xl border border-stone-200 p-3">
          <div className="mb-2 flex justify-between gap-2 text-xs"><b>Barang {k+1} · {i.item_rab_id ? "Dari RAB" : "Manual / di luar RAB"}</b><button type="button" aria-label={`Hapus barang ${k+1}`} onClick={() => setItems(items.filter((_,n) => n!==k))} className="text-red-600">Hapus</button></div>
          <label className="block text-sm">Nama barang<input required maxLength={200} className={input} disabled={!!i.item_rab_id} value={i.nama} onChange={(e) => edit(k,"nama",e.target.value)} /></label>
          {!i.item_rab_id && <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-sm">Kategori<input maxLength={100} className={input} value={i.kategori} onChange={(e) => edit(k,"kategori",e.target.value)} /></label><label className="text-sm">Satuan<input maxLength={40} placeholder="sak, unit, jasa…" className={input} value={i.satuan} onChange={(e) => edit(k,"satuan",e.target.value)} /></label></div>}
          <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-sm">Jumlah {i.satuan && `(${i.satuan})`}<input required type="number" min="0.001" max="1000000" step="0.001" className={input} value={i.qty} onChange={(e) => edit(k,"qty",e.target.value)} /></label><label className="text-sm">Harga aktual / satuan<input required type="number" min="0" max="1000000000000" step="1" className={input} value={i.harga_satuan} onChange={(e) => edit(k,"harga_satuan",e.target.value)} /></label></div>
          {i.item_rab_id && rab.some(r=>r.id===i.item_rab_id) && <button type="button" className={`${btn} mt-2`} onClick={()=>{
            const r=rab.find(r=>r.id===i.item_rab_id)!;
            setItems(items.map((item,n)=>n===k?barangDariRab(r):item));
            if (items.length===1) setNotaDp(false);
          }}>Gunakan jumlah &amp; harga RAB</button>}
          <p className="mt-2 text-right text-sm font-bold">{rp(jumlahBarang(i.qty,i.harga_satuan) || 0)}</p>
        </li>)}</ol>
        <details className="rounded-xl bg-amber-50 p-3 text-xs" open={nota?.nota_dp || undefined}><summary className="cursor-pointer font-semibold">Jika harga penuh pesanan belum diketahui</summary><label className="mt-2 flex items-start gap-2"><input type="checkbox" className="mt-1" checked={notaDp} onChange={e=>{setNotaDp(e.target.checked);if(e.target.checked&&modeBayar==="lunas")setModeBayar("dp");}}/><span>Nota ini hanya berisi nilai DP. Setelah harga penuh diketahui, edit harga barang dan matikan pilihan ini.</span></label></details>
        <div className="rounded-xl border border-matur-200 bg-matur-50 p-3">
          <p className="text-sm text-stone-600">{notaDp ? "Nilai nota DP (harga penuh belum diketahui)" : "Total Harga Pesanan"}</p>
          <p className="mt-1 text-xl font-bold">{rp(total)}</p>
          <p className="mt-1 text-xs text-stone-500">{notaDp ? "Nilai di atas hanya nominal nota DP. Lengkapi harga penuh pesanan sebelum mencatat pelunasan." : "Harga barang di atas adalah harga penuh pesanan. Jangan menggantinya dengan nominal DP. Harga satuan turunan RAB dibulatkan ke rupiah; periksa sebelum menyimpan."}</p>
        </div>
        {nota && <div className="space-y-3 rounded-xl border p-3">
          <label className="block text-sm font-semibold">Status pembayaran<select disabled className={input} value={statusEdit}><option value="belum">Belum Dibayar</option><option value="dp">DP</option><option value="lunas">Lunas</option></select></label>
          <p className="text-sm">Sudah dibayar: <b>{rp(dibayarLama)}</b></p>
          <p className="text-sm">{notaDp?"Sisa pelunasan pesanan belum diketahui.":<>Sisa tagihan: <b>{rp(sisaTagihan)}</b></>}</p>
          {nota.pembayaran.filter(p=>!p.batal_at).map(p=><p key={p.id} className="text-xs text-stone-600">{formatTanggal(p.tanggal)} · {rp(p.jumlah)} · {p.metode} · {SUMBER_BELANJA[p.sumber]}</p>)}
          <p className="text-xs text-stone-500">Pembayaran lama tidak dicatat ulang. Status mengikuti total pesanan dan pembayaran tercatat. Untuk pembayaran berikutnya atau koreksi, gunakan kontrol pembayaran pada kartu nota.</p>
        </div>}
        {!nota && <div className="space-y-3 rounded-xl border p-3">
          <label className="block text-sm font-semibold">Status pembayaran<select className={input} value={modeBayar} onChange={e=>setModeBayar(e.target.value as "belum"|"dp"|"lunas")}><option value="belum">Belum Dibayar</option><option value="dp">DP</option><option value="lunas" disabled={notaDp}>Lunas</option></select></label>
          {!bayar && <p className="text-xs text-stone-500">Tidak ada pembayaran yang dicatat. Dana proyek tidak berkurang.</p>}
          {bayar && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{modeBayar==="lunas"?"Nominal lunas (otomatis)":"Nominal DP yang sudah dibayar"}<input required type="number" min="1" max={modeBayar==="dp"&&!notaDp?Math.max(0,total-1):total} step="1" readOnly={modeBayar==="lunas"} value={modeBayar==="lunas"?total:nominal} onChange={e=>setNominal(e.target.value)} className={input}/></label><label className="text-sm">Tanggal pembayaran<input required type="date" min={tanggal} value={tglBayar} onChange={e=>setTglBayar(e.target.value)} className={input}/></label><Sumber value={sumber} onChange={setSumber}/><label className="text-sm">Metode<select className={input} value={metode} onChange={e=>setMetode(e.target.value)}><option value="tunai">Tunai</option><option value="transfer">Transfer</option></select></label></div>}
          <div className="rounded-lg bg-stone-50 p-3 text-sm"><p>Sudah dibayar: <b>{rp(bayar?nominalBayar:0)}</b></p><p>{notaDp?"Sisa pelunasan pesanan belum diketahui.":<>Sisa tagihan: <b>{rp(sisaTagihan)}</b></>}</p>{bayar&&<p className="mt-1 text-xs text-stone-500">{sumber==="dana_proyek"?`Dana proyek berkurang ${rp(nominalBayar)} setelah penyimpanan berhasil.`:"Pembayaran dari sumber ini tidak mengurangi saldo dana proyek."}</p>}</div>
        </div>}
        <label className="block text-sm">Foto / PDF nota (opsional, maksimal 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={input} onChange={e=>setFile(e.target.files?.[0]??null)}/>{file&&<small className="block">Dipilih: {file.name}</small>}{nota?.nota_path&&<small>Bukti sebelumnya tetap dipakai jika tidak memilih file baru.</small>}</label>
        <label className="block text-sm">Catatan<textarea maxLength={2000} className={input} value={catatan} onChange={e=>setCatatan(e.target.value)}/></label>
        {nota && <p className="text-xs text-stone-500">Pembayaran yang sudah tercatat tetap dipertahankan. Total nota tidak boleh kurang dari {rp(terbayar(nota))}.</p>}
      </fieldset>
      {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><button disabled={pending} type="button" className={btn} onClick={onClose}>Batal</button><button disabled={pending} className={utama}>Periksa & simpan</button></div>
    </form>}
  </Modal>;
}
function FormBayar({ proyekId, nota, onClose }: { proyekId: string; nota: Belanja; onClose: () => void }) {
  const router=useRouter(); const [id]=useState(() => crypto.randomUUID());
  const [jumlah,setJumlah]=useState(String(nota.total-terbayar(nota))); const [tanggal,setTanggal]=useState(hariIni());
  const [sumber,setSumber]=useState<SumberBelanja>("dana_proyek"); const [metode,setMetode]=useState("transfer");const [catatan,setCatatan]=useState(nota.nota_dp ? "DP sudah dibayar" : "");
  const [err,setErr]=useState("");const [pending,start]=useTransition();
  return <Modal title={`Sudah Dibayar · ${nota.toko}`}><form onSubmit={(e) => {e.preventDefault(); start(async()=>{try {const r=await catatBayarBelanja(proyekId,nota.id,nota.updated_at,{id,jumlah,tanggal,sumber,metode,catatan});if(r.error)setErr(r.error);else{onClose();router.refresh();}}catch{setErr("Pembayaran belum tersimpan. Coba lagi.");}});}}>
    <p className="mb-3 text-sm">Konfirmasi uang yang sudah keluar. Nominal nota yang belum dibayar <b>{rp(nota.total-terbayar(nota))}</b>. Untuk DP, isi hanya nominal DP.</p>
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Tanggal pembayaran<input required type="date" min={nota.tanggal} className={input} value={tanggal} onChange={(e)=>setTanggal(e.target.value)}/></label><label className="text-sm">Nominal sudah dibayar<input required type="number" min="1" max={nota.total-terbayar(nota)} step="1" className={input} value={jumlah} onChange={(e)=>setJumlah(e.target.value)}/></label><Sumber value={sumber} onChange={setSumber}/><label className="text-sm">Metode<select className={input} value={metode} onChange={(e)=>setMetode(e.target.value)}><option value="tunai">Tunai</option><option value="transfer">Transfer</option></select></label><label className="text-sm sm:col-span-2">Catatan / referensi transfer<input maxLength={1000} className={input} value={catatan} onChange={(e)=>setCatatan(e.target.value)}/></label></fieldset>
    <p className="mt-3 rounded-xl bg-matur-50 p-3 text-sm">{sumber==="dana_proyek" ? <>Sisa Dana Aktual akan berkurang <b>{rp(Number(jumlah)||0)}</b>.</> : "Pembayaran dari sumber ini tidak mengurangi saldo dana proyek."} Status dan sisa tagihan diperbarui setelah penyimpanan berhasil.</p>
    {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
    <div className="mt-4 flex justify-end gap-2"><button disabled={pending} type="button" className={btn} onClick={onClose}>Batal</button><button disabled={pending} className={utama}>{pending?"Menyimpan…":"Konfirmasi Sudah Dibayar"}</button></div>
  </form></Modal>;
}
function KoreksiBayar({ proyekId, nota, pembayaranId, onClose }: { proyekId: string; nota: Belanja; pembayaranId: string | null; onClose: () => void }) {
  const router=useRouter();const [alasan,setAlasan]=useState("");const [err,setErr]=useState("");const [pending,start]=useTransition();
  const jumlah=pembayaranId ? Number(nota.pembayaran.find(p=>p.id===pembayaranId)?.jumlah??0) : terbayar(nota);
  return <Modal title={pembayaranId ? "Koreksi pembayaran" : "Ubah ke Belum Dibayar"}><form onSubmit={e=>{e.preventDefault();start(async()=>{try{const r=await koreksiBayarBelanja(proyekId,nota.id,pembayaranId,nota.updated_at,alasan);if(r.error)setErr(r.error);else{onClose();router.refresh();}}catch{setErr("Koreksi belum tersimpan. Coba lagi.");}});}}>
    <p className="text-sm">Koreksi pencatatan {rp(jumlah)} pada nota <b>{nota.toko}</b>. {pembayaranId ? "Pembayaran ini" : "Seluruh pembayaran aktif"} tidak lagi dihitung; saldo dan tagihan akan dihitung ulang. Ini bukan pengembalian uang. Gunakan hanya jika pencatatannya keliru.</p>
    <p className="mt-2 text-sm">Riwayat pembayaran tetap tersimpan bersama alasan koreksi.</p>
    <label className="mt-3 block text-sm">Alasan koreksi<textarea required minLength={5} maxLength={1000} disabled={pending} className={input} value={alasan} onChange={e=>setAlasan(e.target.value)}/></label>
    {err&&<p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
    <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={pending} className={btn} onClick={onClose}>Batal</button><button disabled={pending||alasan.trim().length<5} className={utama}>{pending?"Menyimpan…":"Konfirmasi koreksi"}</button></div>
  </form></Modal>;
}
export function BelanjaProyekView({ proyekId, namaProyek, rab, belanja, danaMasuk, setoran, admin }: { proyekId: string; namaProyek: string; rab: ItemRab[]; belanja: Belanja[]; danaMasuk: number; setoran: Setoran[]; admin: boolean }) {
  const router=useRouter(); const [form,setForm]=useState<Belanja | "baru" | null>(null);const [bayar,setBayar]=useState<Belanja|null>(null);const [batal,setBatal]=useState<Belanja|null>(null);
  const [alasan,setAlasan]=useState("");const [konfirmasi,setKonfirmasi]=useState("");const [akuiHapus,setAkuiHapus]=useState(false);const [err,setErr]=useState("");const [pending,start]=useTransition();
  const [koreksi,setKoreksi]=useState<{nota:Belanja;pembayaranId:string|null}|null>(null);
  const [q,setQ]=useState("");const [status,setStatus]=useState("");const [dari,setDari]=useState("");const [sampai,setSampai]=useState("");
  const lama=rab.reduce((s,r)=>s+Number(r.harga_realisasi??0),0);const ringkas=ringkasanBelanja(belanja,lama,danaMasuk);
  const tampil=belanja.filter((b)=>(status==="semua" || (status ? statusBelanja(b)===status : !b.batal_at))&&(!dari||b.tanggal>=dari)&&(!sampai||b.tanggal<=sampai)&&`${b.toko} ${b.nomor_nota??""} ${b.penanggung_jawab} ${b.items.map(i=>i.nama).join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Realisasi Belanja</h2><p className="text-sm text-stone-500">Satu nota, banyak barang. Pilih RAB atau tulis manual.</p></div><div className="flex flex-wrap gap-2"><BelanjaPdf data={{nama:namaProyek,rab:totalEstimasiRab(rab),realisasiLama:lama,setoran,belanja}} />{admin&&<button className={utama} onClick={()=>setForm("baru")}>+ Tambah Belanja</button>}</div></div>
    <RingkasanDana rab={totalEstimasiRab(rab)} danaMasuk={danaMasuk} ringkas={ringkas} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Total nilai pesanan",ringkas.nota],["Sudah dibayar (semua sumber)",ringkas.dibayar],["Sisa tagihan nota",ringkas.tagihan],["Talangan pusat",ringkas.talangan],["Dibayar langsung mitra",ringkas.mitra],["Realisasi lama",lama]].map(([label,value])=><div key={label} className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-xs text-stone-500">{label}</p><p className={`mt-1 break-words font-bold ${Number(value)<0?"text-red-600":""}`}>{rp(Number(value))}</p></div>)}</div>
    <p className="text-xs text-stone-500">Ringkasan dan PDF mencakup seluruh proyek, tidak mengikuti filter nota. Sisa Dana Aktual = dana masuk mitra − DP dan pelunasan dari dana proyek. Talangan pusat dan pembayaran langsung mitra tidak mengurangi saldo ini; pelunasan talangan belum dicatat di sini.</p>
    {ringkas.dpBelumFinal>0&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ada {ringkas.dpBelumFinal} nota yang hanya berisi DP. Total pesanan dan sisa pelunasan belum lengkap; sisa tagihan di atas hanya untuk nilai nota yang sudah dicatat.</p>}
    {lama>0&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ada realisasi lama {rp(lama)} yang belum memiliki rincian pembayaran. Saldo tercatat belum memperhitungkan pembayaran lama tersebut. Jangan masukkan ulang belanja yang sama sebagai nota baru sebelum dicocokkan.</p>}
    <div className="grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Cari nota / barang<input className={input} value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Toko, barang, penanggung jawab…"/></label><label className="text-sm">Status<select className={input} value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">Nota aktif</option><option value="semua">Semua nota dan arsip</option>{["Belum dibayar","Dibayar Sebagian (DP)","Lunas","Dibatalkan"].map(s=><option key={s} value={s}>{s==="Dibatalkan"?"Dihapus / Dibatalkan":s}</option>)}</select></label><label className="text-sm">Dari tanggal<input type="date" className={input} value={dari} onChange={(e)=>setDari(e.target.value)}/></label><label className="text-sm">Sampai tanggal<input type="date" className={input} min={dari} value={sampai} onChange={(e)=>setSampai(e.target.value)}/></label></div>
    {!tampil.length&&<p className="rounded-xl border border-dashed p-6 text-center text-stone-500">{belanja.length?"Tidak ada nota sesuai filter.":"Belum ada belanja tercatat. Tambahkan nota pertama dari RAB atau input manual."}</p>}
    {tampil.map(b=><article key={b.id} className={`rounded-2xl border bg-white p-4 ${b.batal_at?"border-stone-200 opacity-75":"border-matur-200"}`}>
      <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{b.toko}</h3><p className="text-xs text-stone-500">{formatTanggal(b.tanggal)}{b.nomor_nota&&` · Nota ${b.nomor_nota}`}</p></div><div className="text-right"><p className="font-bold">{rp(b.total)}</p><span className={`rounded-full px-2 py-1 text-xs ${statusBelanja(b)==="Lunas"?"bg-green-100 text-green-800":b.batal_at?"bg-stone-100 text-stone-600":"bg-amber-100 text-amber-800"}`}>{statusBelanja(b)}</span></div></div>
      {b.nota_dp&&<p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Nilai nota ini hanya DP. Total pesanan dan sisa pelunasan belum dikonfirmasi; belum dianggap lunas. Lengkapi total pesanan sebelum mencatat pelunasan berikutnya.</p>}
      <p className="mt-3 text-sm">Penanggung jawab: <b>{b.penanggung_jawab}</b></p><p className="text-xs text-stone-500">Dicatat oleh {b.nama_pencatat}</p>
      {b.catatan&&<p className="mt-2 whitespace-pre-wrap break-words text-sm">{b.catatan}</p>}
      {b.nota_url&&<a href={b.nota_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-matur-700 underline">Lihat bukti nota</a>}
      {b.nota_path&&!b.nota_url&&<p className="mt-2 text-xs text-amber-800">Bukti belum dapat dibuka. Muat ulang halaman untuk mencoba lagi.</p>}
      <details className="mt-3 rounded-xl bg-stone-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Rincian {b.items.length} barang</summary><ul className="mt-2 divide-y text-sm">{b.items.map(i=><li key={i.id} className="flex justify-between gap-3 py-2"><div className="min-w-0"><p className="break-words font-medium">{i.nama}</p><p className="text-xs text-stone-500">{i.item_rab_id?"Dari RAB":"Manual / di luar RAB"} · {i.kategori}</p><p className="text-xs">{i.qty} {i.satuan} × {rp(i.harga_satuan)}</p></div><b className="shrink-0">{rp(i.jumlah)}</b></li>)}</ul></details>
      <details className="mt-2 rounded-xl bg-stone-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Pembayaran {rp(terbayar(b))} · Sisa nota {rp(b.total-terbayar(b))}</summary><ul className="mt-2 divide-y text-sm">{b.pembayaran.map(p=><li key={p.id} className={`py-2 ${p.batal_at?"text-stone-500":""}`}><p className={`font-semibold ${p.batal_at?"line-through":""}`}>{formatTanggal(p.tanggal)} · {rp(p.jumlah)}</p><p>{SUMBER_BELANJA[p.sumber]} · {p.metode}</p><p className="text-xs text-stone-500">Dicatat {p.nama_pencatat}{p.catatan&&` · ${p.catatan}`}</p>{p.batal_at?<p className="mt-1 text-xs text-red-700">Dikoreksi {formatTanggal(p.batal_at,true)} · {p.nama_pembatal}: {p.alasan_batal}</p>:admin&&!b.batal_at&&<button type="button" className="mt-1 text-xs font-semibold text-red-700 underline" onClick={()=>setKoreksi({nota:b,pembayaranId:p.id})}>Koreksi pembayaran ini</button>}</li>)}</ul>{!b.pembayaran.length&&<p className="mt-2 text-xs text-stone-500">Belum ada pembayaran.</p>}</details>
      {b.batal_at&&<p className="mt-3 text-sm text-red-700">Dibatalkan: {b.alasan_batal}</p>}
      {admin&&!b.batal_at&&<div className="mt-3 flex flex-wrap gap-2"><button className={btn} onClick={()=>setForm(b)}>Edit nota</button>{terbayar(b)<b.total&&<button className={utama} onClick={()=>setBayar(b)}>{terbayar(b)>0?"+ Pembayaran berikutnya":"Sudah Dibayar"}</button>}{terbayar(b)>0&&<button type="button" className={btn} onClick={()=>setKoreksi({nota:b,pembayaranId:null})}>Ubah ke Belum Dibayar</button>}<button type="button" className={`${btn} text-red-600`} onClick={()=>{setBatal(b);setAlasan("");setKonfirmasi("");setAkuiHapus(false);setErr("");}}>Hapus nota</button></div>}
    </article>)}
    {form&&<FormNota key={form==="baru"?"baru":form.id} proyekId={proyekId} rab={rab} nota={form==="baru"?null:form} onClose={()=>setForm(null)}/>}
    {koreksi&&<KoreksiBayar proyekId={proyekId} nota={koreksi.nota} pembayaranId={koreksi.pembayaranId} onClose={()=>setKoreksi(null)}/>}
    {bayar&&<FormBayar proyekId={proyekId} nota={bayar} onClose={()=>setBayar(null)}/>}
    {batal&&<Modal title={`Hapus nota · ${batal.toko}`}>
      <p className="text-sm">Nota dihapus dari daftar aktif dan perhitungan. Riwayat nota, bukti dan pembayaran tetap ada di arsip. Gunakan untuk pencatatan yang salah, bukan untuk menyembunyikan belanja yang benar-benar terjadi.</p>
      {terbayar(batal)>0&&<div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><p>Pembayaran tercatat {rp(terbayar(batal))} akan dikoreksi. Sisa Dana Aktual tercatat bertambah <b>{rp(batal.pembayaran.filter(p=>!p.batal_at&&p.sumber==="dana_proyek").reduce((s,p)=>s+p.jumlah,0))}</b>.</p><p className="mt-1 font-semibold">Uang yang sudah ditransfer tidak otomatis kembali. Ini hanya koreksi pencatatan.</p><label className="mt-2 flex items-start gap-2"><input type="checkbox" disabled={pending} checked={akuiHapus} onChange={e=>setAkuiHapus(e.target.checked)}/><span>Saya memahami dampak koreksi pembayaran dan saldo tersebut.</span></label></div>}
      <label className="mt-3 block text-sm">Alasan hapus<textarea disabled={pending} className={input} value={alasan} onChange={e=>setAlasan(e.target.value)} maxLength={988}/></label>
      <label className="mt-3 block text-sm">Ketik HAPUS<input disabled={pending} className={input} value={konfirmasi} onChange={e=>setKonfirmasi(e.target.value)}/></label>
      {err&&<p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><button disabled={pending} className={btn} onClick={()=>setBatal(null)}>Batal</button><button disabled={pending||alasan.trim().length<5||konfirmasi!=="HAPUS"||(terbayar(batal)>0&&!akuiHapus)} className={`${utama} bg-red-700`} onClick={()=>start(async()=>{try{const r=await hapusBelanja(proyekId,batal.id,batal.updated_at,alasan,akuiHapus);if(r.error)setErr(r.error);else{setBatal(null);router.refresh();}}catch{setErr("Nota belum dihapus. Coba lagi.");}})}>{pending?"Memproses…":"Konfirmasi hapus"}</button></div>
    </Modal>}

  </section>;
}
