"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./confirm-edit";
import { periksaKas, koreksiKas } from "@/lib/rekonsiliasi-kas-actions";
import { masalahBiaya, type PemeriksaanKas, type BiayaKas, type KoreksiKas, type PratinjauKas } from "@/lib/rekonsiliasi-kas";
import { formatRupiah as rp } from "@/lib/format";
export function RekonsiliasiKas({ sesiId }: { sesiId: string }) {
 const router = useRouter();
 const [buka, setBuka] = useState(false), [data, setData] = useState<PemeriksaanKas>();
 const [pesan, setPesan] = useState("");
 const [pending, start] = useTransition();
 const [edit, setEdit] = useState<{ b: BiayaKas; p: KoreksiKas }>();
 const [preview, setPreview] = useState<PratinjauKas>();
 const muat = () => start(async () => { try { const r = await periksaKas(sesiId); setPesan(r.error ?? ""); setData(r.data); } catch { setPesan("Gagal memuat. Coba buka kembali."); } });
 const ubah = (d: Partial<KoreksiKas>) => { setEdit(x => x && ({ ...x, p: { ...x.p, ...d } })); setPreview(undefined); setPesan(""); };
 return <>
  <button type="button" className="rounded border border-sky-300 px-2 py-1 text-xs font-semibold text-sky-800" onClick={() => { setBuka(true); muat(); }}>Periksa & rekonsiliasi kas</button>
  {buka && <Modal title="Periksa & rekonsiliasi kas" scrollable onClose={() => !pending && setBuka(false)}>
   {pesan && <p role="alert" className="rounded bg-amber-50 p-2 text-sm text-amber-900">{pesan}</p>}
   {!data && pending && <p>Memuat rincian kas…</p>}
   {data && <div className="space-y-3 text-sm">
    <p className="text-stone-600">Shift {data.tanggal}. Koreksi pengeluaran memperbarui kas seharusnya; uang fisik/setoran aktual tetap. Tanggal yang dipilih adalah tanggal operasional shift.</p>
    <dl className="grid grid-cols-2 gap-2 rounded bg-stone-50 p-3">
     <dt>Penjualan tunai shift</dt><dd>{rp(data.hitung.tunai)}</dd>
     <dt>Pengeluaran terhubung</dt><dd>− {rp(data.hitung.laci)}</dd>
     <dt>Penyerahan uang</dt><dd>− {rp(data.hitung.keluar)}</dd>
     <dt>Setoran seharusnya, hitung kini</dt><dd>{rp(data.hitung.seharusnya - data.sesi.modal_laci)}</dd>
     <dt>Setoran seharusnya tersimpan</dt><dd>{rp(data.sesi.seharusnya ?? 0)}</dd>
     <dt>Setoran aktual, di luar modal</dt><dd>{data.sesi.setoran === null ? "Belum dihitung" : rp(data.sesi.setoran)}</dd>
     <dt>Modal tetap di laci</dt><dd>{rp(data.sesi.modal_laci)}</dd>
     <dt>Selisih tersimpan</dt><dd>{data.sesi.selisih === null ? "Belum dihitung" : data.sesi.selisih === 0 ? "Sesuai · Selisih Rp0" : rp(data.sesi.selisih)}</dd>
    </dl>
    {data.sesi.setoran !== null && <p className={`rounded p-2 text-xs ${data.sesi.setoran === data.hitung.seharusnya - data.sesi.modal_laci ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>
     {data.sesi.setoran === data.hitung.seharusnya - data.sesi.modal_laci ? "Setoran aktual sesuai hasil hitung rincian saat ini." : `Setoran aktual ${data.sesi.setoran > data.hitung.seharusnya - data.sesi.modal_laci ? "lebih" : "kurang"} ${rp(Math.abs(data.sesi.setoran - (data.hitung.seharusnya - data.sesi.modal_laci)))} dibanding hasil hitung rincian saat ini. Periksa pengeluaran dan bukti setoran; koreksi hanya data yang keliru.`}
    </p>}
    {data.biaya.some((b, i, all) => all.some((x,j) => i!==j && x.tanggal===b.tanggal && x.jumlah===b.jumlah && (x.keterangan??"").trim().toLowerCase()===(b.keterangan??"").trim().toLowerCase())) && <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">Ada pengeluaran dengan tanggal, nominal, dan nama yang sama. Belum tentu duplikat. Cocokkan nota; edit atau hapus catatan yang salah melalui daftar pengeluaran Catatan Harian.</p>}
    <h3 className="font-semibold">Pengeluaran tanggal ini & yang terhubung ke shift</h3>
    <p className="text-xs text-stone-500">Peringatan menunjukkan hubungan tanggal/shift yang perlu diperiksa, bukan bukti uang hilang. Pilih Perbaiki untuk melihat dampaknya sebelum menyimpan.</p>
    {!data.biaya.length && <p>Tidak ada pengeluaran.</p>}
    {data.biaya.map(b => <div key={b.id} className={`rounded border p-2 ${masalahBiaya(b) ? "border-amber-400 bg-amber-50" : "border-stone-200"}`}>
     <b>{b.keterangan || "Pengeluaran"} · {rp(b.jumlah)}</b>
     <p className="text-xs">Tanggal {b.tanggal} · sumber {b.sumber} · shift {b.tanggal_shift ?? "belum terhubung"}</p>
     {masalahBiaya(b) && <p className="text-xs font-semibold text-amber-900">⚠ {masalahBiaya(b)}</p>}
     <button type="button" disabled={pending} className="mt-1 rounded border px-2 py-1 text-xs font-semibold" onClick={() => { setEdit({ b, p: { id: b.id, tanggal: b.tanggal, jumlah: b.jumlah, sumber: b.sumber, sesi_id: b.sesi_kas_id, sidik_biaya: b.sidik } }); setPreview(undefined); setPesan(""); }}>Perbaiki pengeluaran</button>
    </div>)}
    {edit && <div className="space-y-2 rounded border-2 border-sky-300 p-3">
     <h3 className="font-bold">Perbaiki: {edit.b.keterangan}</h3>
     {edit.b.dilindungi && <p className="text-xs text-amber-800">Pembelian terkait stok: tanggal dan nominal dilindungi. Hubungan shift dan sumber dana dapat diperbaiki; koreksi barang/nominal melalui koreksi persediaan terpisah.</p>}
     <label className="block">Tanggal operasional<input aria-label="Tanggal pengeluaran" type="date" value={edit.p.tanggal} disabled={pending || edit.b.dilindungi} onChange={e => ubah({ tanggal: e.target.value, sesi_id: null })} className="block w-full rounded border p-2" /></label>
     <label className="block">Nominal<input type="number" min="1" step="1" value={edit.p.jumlah} disabled={pending || edit.b.dilindungi} onChange={e => ubah({ jumlah: Number(e.target.value) })} className="block w-full rounded border p-2" /></label>
     <label className="block">Sumber dana<select value={edit.p.sumber} disabled={pending} onChange={e => ubah({ sumber: e.target.value, sesi_id: null })} className="block w-full rounded border p-2"><option value="laci">Laci outlet</option><option value="pusat">Pusat</option></select></label>
     {edit.p.sumber === "laci" && <label className="block">Shift tujuan<select value={edit.p.sesi_id ?? ""} disabled={pending} onChange={e => ubah({ sesi_id: e.target.value || null })} className="block w-full rounded border p-2"><option value="">Pilih shift yang benar</option>{data.pilihan.filter(s => s.tanggal === edit.p.tanggal || s.tanggal_terkait?.includes(edit.p.tanggal)).map(s => <option key={s.id} value={s.id}>{s.tanggal} · {s.nama ?? "Kas outlet"} · {s.ditutup_at ? "ditutup" : "masih buka"} · {new Date(s.dibuka_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</option>)}</select></label>}
     <label className="block">Alasan koreksi<textarea maxLength={500} value={edit.p.alasan ?? ""} disabled={pending} onChange={e => ubah({ alasan: e.target.value })} className="block w-full rounded border p-2" /></label>
     <button type="button" disabled={pending} className="rounded border border-sky-400 px-3 py-2" onClick={() => start(async () => { try { const r = await koreksiKas(edit.p); setPesan(r.error ?? ""); setPreview(r.data); } catch { setPesan("Gagal memuat pratinjau. Coba lagi."); } })}>Lihat perhitungan sebelum–sesudah</button>
     {preview && <div className="rounded bg-sky-50 p-2"><p className="font-semibold">Dampak koreksi pada seluruh shift terkait</p>{preview.sesudah.map(x => { const old = preview.sebelum.find(y => y.id === x.id); return <p key={x.id} className="py-1 text-xs">{x.tanggal}: seharusnya {rp(old?.seharusnya ?? 0)} → {rp(x.seharusnya)}; selisih {old?.selisih == null ? "belum dihitung" : rp(old.selisih)} → {x.selisih === null ? "belum dihitung" : x.selisih === 0 ? "Sesuai · Rp0" : rp(x.selisih)}</p>; })}
      <button type="button" disabled={pending || (edit.p.alasan?.trim().length ?? 0) < 3} className="mt-2 rounded bg-kopi-900 px-3 py-2 text-white disabled:opacity-50" onClick={() => start(async () => { try { const r = await koreksiKas({ ...edit.p, sidik: preview.sidik, simpan: true }); if (r.error) { setPesan(r.error); setPreview(undefined); } else { setEdit(undefined); setPreview(undefined); const fresh = await periksaKas(sesiId); setData(fresh.data); setPesan(fresh.error ?? "Koreksi tersimpan dan kas dihitung ulang."); router.refresh(); } } catch { setPesan("Koneksi terputus. Muat ulang untuk memeriksa hasil sebelum mencoba kembali."); setPreview(undefined); } })}>Simpan koreksi & hitung ulang</button>
     </div>}
     <button type="button" disabled={pending} onClick={() => { setEdit(undefined); setPreview(undefined); }} className="ml-2 rounded border px-3 py-2">Batal perbaikan</button>
    </div>}
    {data.penyerahan.length > 0 && <details><summary>Rincian penyerahan uang ({data.penyerahan.length})</summary>{data.penyerahan.map((p,i) => <p key={i}>{rp(p.jumlah)} · {String(p.data.catatan ?? p.data.keterangan ?? "Penyerahan tercatat")}</p>)}</details>}
    <details><summary>Riwayat rekonsiliasi ({data.riwayat.length})</summary>{data.riwayat.map((r,i) => <p key={i} className="py-1 text-xs">{new Date(r.waktu).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} · {r.nama ?? "Akunting"} · {r.alasan}</p>)}</details>
   </div>}
   {pending && <p role="status">Memproses…</p>}
  </Modal>}
 </>;
}
