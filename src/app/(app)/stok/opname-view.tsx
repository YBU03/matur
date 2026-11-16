"use client";
import { tanya } from "@/components/dialog-tanya";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { useSoDraft } from "@/components/use-so-draft";
import { hariSo, kemarinSo, type SoAttempt } from "@/lib/so-draft";
import { simpanOpname, bacaStokSo } from "@/lib/opname-actions";

export type Bahan = {
  id: string;
  nama: string;
  kategori: string | null;
  satuan_beli: string;
  satuan_pakai: string;
  konversi: number;
  hargaPakai: number;
  sistem: number;
};
type Isi = { kemasan: string; eceran: string };
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });
const num = (v: string | undefined) =>
  !v || v.trim() === "" ? null : Number(v.replace(",", "."));
/** total hitung fisik dalam satuan pakai = kemasan utuh × isi + sisa eceran */
const fisik = (b: Bahan, x?: Isi) => {
  const k = num(x?.kemasan),
    e = num(x?.eceran);
  if (k === null && e === null) return null;
  return (
    Math.round(
      ((k ?? 0) * (b.konversi > 1 ? b.konversi : 1) +
        (b.konversi > 1 ? (e ?? 0) : 0)) *
        1000,
    ) / 1000
  );
};

export function OpnameView({
  outlets,
  outletId,
  bahan,
  riwayat,
  tampilNilai = true,
  embedded=false,
  draftKey,
  sesiKasId,
}: {
  tampilNilai?: boolean;
  embedded?:boolean;
  draftKey?:string;
  sesiKasId?:string;
  outlets: { id: string; nama: string }[];
  outletId: string;
  bahan: Bahan[];
  riwayat: {
    id: string;
    tanggal: string;
    total_nilai: number;
    catatan: string | null;
    created_at: string;
    petugas_nama: string | null;
    item_opname: { bahan_id: string; qty_sistem: number; qty_fisik: number }[];
  }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const belumPernah = riwayat.length === 0;
  const scope = sesiKasId ?? "mandiri";
  const drafts = useSoDraft(draftKey ?? `matoer-so:${outletId}:mandiri`, outletId, scope, Object.fromEntries(bahan.map(b => [b.id,b.sistem])));
  const d = drafts.draft;
  const jenis = d?.jenis ?? (belumPernah ? "awal" : "rutin");
  const setJenis = (value: "awal" | "rutin") => drafts.change(x=>({...x,jenis:value}));
  const isi = d?.isi ?? {};
  const tanggal = d?.tanggal ?? hariSo();
  const catatan = d?.catatan ?? "";
  const snapshot = d?.sistem ?? {};
  const draftStatus = drafts.status;
  const locked = pending || !!d?.attempt || !!d?.completedId;
  const setIsi = (value: Record<string, Isi> | ((old: Record<string, Isi>) => Record<string, Isi>)) => drafts.change(x => ({...x, isi: typeof value === "function" ? value(x.isi) : value}));
  const setCatatan = (value: string) => drafts.change(x => ({...x,catatan:value}));
  const [q, setQ] = useState("");
  const [belum,setBelum]=useState(false);
  const [focused,setFocused]=useState("");
  const [review,setReview]=useState(false);
  const [konflik,setKonflik] = useState<Record<string,number>>({});
  const formRef=useRef<HTMLFieldSetElement>(null);
  const berikutnya=(el:HTMLElement)=>{const list=[...(formRef.current?.querySelectorAll<HTMLInputElement>('input[data-so-input]')??[])];const i=list.indexOf(el as HTMLInputElement);list[i+1]?.focus();list[i+1]?.select();};

  const [busy, setBusy] = useState("");
  const outletNama = outlets.find((o) => o.id === outletId)?.nama ?? "";
  const terisi = bahan.filter((b) => fisik(b, isi[b.id]) !== null);
  const invalid = bahan.some((b) => {
    const v = fisik(b, isi[b.id]);
    return (
      v !== null &&
      (!Number.isFinite(v) ||
        v < 0 ||
        v > 99_999_999_999.999 ||
        Number(isi[b.id]?.kemasan.replace(",", ".")) < 0 ||
        Number(isi[b.id]?.eceran.replace(",", ".")) < 0)
    );
  });
  const nilai = terisi.reduce(
    (s, b) => s + fisik(b, isi[b.id])! * b.hargaPakai,
    0,
  );
  const tampil = bahan.filter(b=>(!belum||fisik(b,isi[b.id])===null||focused===b.id)&&(!q||b.nama.toLowerCase().includes(q.toLowerCase())||(b.kategori??"").toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>(a.kategori??"Lainnya").localeCompare(b.kategori??"Lainnya",'id')||a.nama.localeCompare(b.nama,'id'));
  const set = (id: string, k: keyof Isi, v: string) =>
    (setReview(false),setIsi((lama) => ({
      ...lama,
      [id]: { ...(lama[id] ?? { kemasan: "", eceran: "" }), [k]: v },
    })));

  const template = async () => {
    setBusy("tpl");
    try {
      const { unduhTemplate } = await import("./excel");
      await unduhTemplate(outletNama, bahan);
    } finally {
      setBusy("");
    }
  };
  const impor = async (f: File | undefined) => {
    if (!f) return;
    setBusy("imp");
    setMsg(null);
    try {
      const { bacaTemplate } = await import("./excel");
      const r = await bacaTemplate(await f.arrayBuffer(), bahan);
      setReview(false);
      setIsi({ ...isi, ...r.isi });
      setMsg({
        ok: `${Object.keys(r.isi).length} bahan terisi dari Excel. Periksa lalu simpan.${r.lewat ? ` ${r.lewat} baris tidak dikenali.` : ""}`,
      });
    } catch {
      setMsg({
        error:
          "File tidak bisa dibaca. Pakai template dari tombol “Unduh template”.",
      });
    } finally {
      setBusy("");
    }
  };

  const periksaStok = async () => {
    setMsg(null);
    try {
      const r=await bacaStokSo(outletId);
      if(!r.stok){setMsg({error:r.error});return;}
      const berubah=Object.fromEntries(terisi.filter(b=>Math.abs((r.stok![b.id]??0)-(snapshot[b.id]??b.sistem))>0.0001).map(b=>[b.id,r.stok![b.id]??0]));
      setKonflik(berubah);setReview(false);setBelum(false);setQ("");
      if(!Object.keys(berubah).length) setMsg({ok:"Stok pembanding sesuai. Periksa hitungan lalu simpan SO."});
    } catch {setMsg({error:"Stok terbaru belum dapat dimuat. Draft tetap dipertahankan."});}
  };
  const simpan = async () => {
    if(!d)return;
    if(!d.attempt&&!review){setReview(true);setMsg({ok:"Periksa rincian selisih di bawah, lalu klik Konfirmasi & simpan SO."});return;}
    if(!d.attempt&&!(await tanya(`${tanggal<hariSo()?"Tanggal SO kemarin. Lanjutkan hanya jika hitungan ini baru dilakukan saat tutup shift, bukan hitungan lama. ":""}Simpan SO ${terisi.length} bahan di ${outletNama}? Stok outlet akan disesuaikan dengan hitungan fisik yang telah diperiksa.`)))return;
    start(async()=>{
      const attempt: SoAttempt=d.attempt??{requestId:crypto.randomUUID(),tanggal,catatan:`${jenis==="awal"?"[Stok awal]":"[Opname]"}${sesiKasId?` [Kas:${sesiKasId}]`:""} ${catatan}`.trim(),items:terisi.map(b=>({bahan_id:b.id,qty_fisik:fisik(b,isi[b.id])!,qty_sistem:snapshot[b.id]??b.sistem}))};
      drafts.change(x=>({...x,attempt}));
      try {
        const r=await simpanOpname(outletId,attempt.tanggal,attempt.items,attempt.catatan,attempt.requestId);
        setMsg(r);
        if(r.id){await drafts.complete(r.id);setMsg({ok:`SO berhasil masuk server. Nomor bukti: ${r.id}.`});setReview(false);setKonflik({});router.refresh();}
        else if(r.error){drafts.change(x=>({...x,attempt:undefined}));setReview(false);if(r.konflik){setKonflik(Object.fromEntries(r.konflik.map(x=>[x.bahan_id,x.qty_terbaru])));setBelum(false);setQ("");}}
      } catch {setMsg({error:"Koneksi terputus atau jawaban server belum diterima. Draft tetap ada. Klik Cek / kirim ulang dengan isian yang sama."});}
    });
  };
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{embedded ? "Hitung stok akhir shift" : "Stok & Opname Outlet"}</h1>
        <p className="text-sm text-stone-500">
          Hitung stok fisik. Hasil tersimpan menjadi stok outlet dan persediaan
          di laporan keuangan. Penjualan berikutnya mengurangi stok sesuai
          resep.
        </p>
      </div>
      {outlets.length > 1 && (
        <select
          value={outletId}
          onChange={(e) => router.push(`/stok?outlet=${e.target.value}`)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
      )}
      {belumPernah && (
        <p className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>{outletNama} belum pernah opname.</b> Lakukan <b>stok awal</b>{" "}
          dulu: hitung semua bahan yang ada di outlet sekarang. Setelah itu stok
          berkurang otomatis setiap ada penjualan.
        </p>
      )}

      {draftStatus&&<p role="status" className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800">{draftStatus}</p>}
      <section className="space-y-2 rounded-xl border border-sky-200 bg-white p-3 text-sm">
        <label className="block">Draft / arsip hitungan
          <select aria-label="Draft / arsip hitungan" disabled={locked} value={drafts.archives.some(x=>x.id===d?.id)?d?.id:""} onChange={e=>{const item=drafts.archives.find(x=>x.id===e.target.value);if(item){drafts.open(item);setReview(false);setKonflik({});setMsg(null);}}} className="mt-1 w-full rounded-lg border p-2">
            <option value="">Hitungan baru</option>
            {drafts.archives.map(x=><option key={x.id} value={x.id}>{x.tanggal} · {x.completedId?"Sudah final":"Draft"} · {new Date(x.updatedAt).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})}</option>)}
          </select>
        </label>
        <button type="button" disabled={pending||!!d?.attempt} className="rounded-lg border px-3 py-2" onClick={()=>{drafts.open(drafts.fresh());setReview(false);setKonflik({});setMsg(null);}}>Mulai hitungan baru hari ini</button>{" "}
        <button type="button" disabled={!d} className="rounded-lg border px-3 py-2" onClick={()=>{if(!d)return;const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=`Draft SO ${outletNama} ${tanggal}.json`;a.click();URL.revokeObjectURL(url);}}>Unduh cadangan draft</button>
        {d?.attempt&&<p role="alert" className="text-amber-800">Status penyimpanan belum pasti. Isian dikunci sementara; klik Cek / kirim ulang untuk mendapatkan bukti tanpa menggandakan SO.</p>}
        {d?.completedId&&<p className="text-green-800">Arsip sudah final. Nomor bukti: {d.completedId}. Mulai hitungan baru untuk SO berikutnya.</p>}
        {tanggal<kemarinSo()&&!d?.completedId&&<p className="text-amber-800">Ini draft tanggal {tanggal}. Jangan gunakan hitungan lama untuk menimpa stok hari ini. Arsip tetap tersedia; mulai hitungan baru hari ini.</p>}
      </section>
      <section className="grid grid-cols-2 gap-2">
        {(
          [
            ["awal", "🆕 Stok awal", "pertama kali / mulai pakai sistem"],
            ["rutin", "🔁 Opname rutin", "hitung ulang akhir bulan"],
          ] as const
        ).map(([k, l, sub]) => (
          <button
            key={k}
            disabled={locked} onClick={() => { setJenis(k);setReview(false); }}
            className={`rounded-2xl border-2 p-3 text-left ${jenis === k ? "border-kopi-900 bg-white" : "border-stone-200 bg-white/60 text-stone-500"}`}
          >
            <p className="font-bold">{l}</p>
            <p className="text-xs">{sub}</p>
          </button>
        ))}
      </section>

      {msg && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Cari bahan / kategori…"
            className="min-w-40 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            disabled={!!busy||locked}
            onClick={template}
            className="rounded-lg border border-green-600 px-3 py-2 text-xs font-semibold text-green-700"
          >
            {busy === "tpl" ? "…" : "⬇ Unduh template Excel"}
          </button>
          <label className="cursor-pointer rounded-lg border border-matur-400 px-3 py-2 text-xs font-semibold text-matur-700">
            {busy === "imp" ? "Membaca…" : "⬆ Isi dari Excel"}
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              disabled={locked} onChange={(e) => (
                impor(e.target.files?.[0]),
                (e.target.value = "")
              )}
            />
          </label>
          <button type="button" disabled={locked} onClick={()=>start(periksaStok)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs">Periksa stok terbaru</button>
          {jenis === "rutin" && (
            <button
              disabled={locked} onClick={() =>
                (setReview(false),setIsi(
                  Object.fromEntries(
                    bahan.map((b) => [
                      b.id,
                      b.konversi > 1
                        ? {
                            kemasan: String(Math.floor(b.sistem / b.konversi)),
                            eceran: String(
                              Math.round((b.sistem % b.konversi) * 100) / 100,
                            ),
                          }
                        : { kemasan: String(b.sistem), eceran: "" },
                    ]),
                  ),
                ))
              }
              className="rounded-lg border border-stone-300 px-3 py-2 text-xs"
            >
              Isi sesuai sistem
            </button>
          )}
        </div>
        <p className="mb-2 text-xs text-stone-500">
          Isi jumlah kemasan utuh, lalu sisa yang sudah terbuka dalam satuan
          kecil (gram/ml). Kosongkan bahan yang tidak dihitung; stoknya tetap
          dipertahankan. Riwayat nilai persediaan mencakup seluruh stok outlet.
        </p>
        {tampil.length === 0 && (
          <p className="py-4 text-sm text-stone-500">
            Tidak ada bahan yang cocok dengan pencarian.
          </p>
        )}
        <div className="sticky top-16 z-10 mb-2 rounded-xl border border-matur-200 bg-white/95 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><b>{terisi.length} / {bahan.length} barang sudah dihitung</b><label className="flex items-center gap-2"><input type="checkbox" checked={belum} onChange={e=>setBelum(e.target.checked)}/>Belum diisi ({bahan.length-terisi.length})</label></div><progress value={terisi.length} max={Math.max(bahan.length,1)} className="mt-2 h-2 w-full accent-orange-500"/><p className="text-xs text-stone-500">Kosong = belum dihitung · 0 = habis · Enter untuk kolom berikutnya. Draft tersimpan di perangkat ini.</p></div>
        <fieldset ref={formRef} disabled={locked} onKeyDown={e=>{if(e.key==='Enter'&&e.target instanceof HTMLInputElement){e.preventDefault();berikutnya(e.target);}}}>
          <ul className="divide-y">
            {tampil.map((b,index) => {
              const v = fisik(b, isi[b.id]);
              const basis = snapshot[b.id] ?? b.sistem;
              const beda = v !== null && Math.abs(v - basis) > 0.001;
              return (
                <li key={b.id} className="space-y-1.5 py-2.5 text-sm">
                  {(index===0||tampil[index-1].kategori!==b.kategori)&&<h2 className="mb-2 rounded-lg bg-matur-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-kopi-800">{b.kategori??"Lainnya"}</h2>}
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 font-medium">{b.nama}</p>
                    <span className="text-xs text-stone-500">
                      {b.konversi > 1 &&
                        `1 ${b.satuan_beli} = ${nf.format(b.konversi)} ${b.satuan_pakai} · `}
                      sistem {nf.format(basis)} {b.satuan_pakai}
                    </span>
                  </div>
                  {konflik[b.id]!==undefined&&<div role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs">
                    Stok berubah: pembanding {nf.format(snapshot[b.id]??b.sistem)} → terbaru {nf.format(konflik[b.id])} {b.satuan_pakai}. Hitung fisik ulang bahan ini; perbarui isian di bawah jika berbeda.
                    <button type="button" disabled={locked} className="mt-2 block rounded-lg border border-amber-700 px-3 py-2 font-semibold" onClick={async()=>{if(await tanya(`Sudah menghitung ulang ${b.nama} sekarang dan memastikan isian fisiknya benar?`)){drafts.change(x=>({...x,sistem:{...x.sistem,[b.id]:konflik[b.id]}}));setKonflik(old=>{const next={...old};delete next[b.id];return next;});setReview(false);}}}>Sudah hitung ulang {b.nama}</button>
                  </div>}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      data-so-input onFocus={()=>setFocused(b.id)}
                      value={isi[b.id]?.kemasan ?? ""}
                      onChange={(e) => set(b.id, "kemasan", e.target.value)}
                      aria-label={`Kemasan ${b.nama}`}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-16 rounded-lg border border-stone-300 px-2 py-1.5 text-right"
                    />
                    <span className="text-xs text-stone-600">
                      {b.satuan_beli === b.satuan_pakai || b.konversi <= 1
                        ? b.satuan_pakai
                        : b.satuan_beli}
                    </span>
                    {b.konversi > 1 && (
                      <>
                        <span className="text-stone-400">+</span>
                        <input
                          data-so-input onFocus={()=>setFocused(b.id)}
                          value={isi[b.id]?.eceran ?? ""}
                          onChange={(e) => set(b.id, "eceran", e.target.value)}
                          aria-label={`Sisa ${b.nama}`}
                          inputMode="decimal"
                          placeholder="sisa"
                          className="w-20 rounded-lg border border-stone-300 px-2 py-1.5 text-right"
                        />
                        <span className="text-xs text-stone-600">
                          {b.satuan_pakai}
                        </span>
                      </>
                    )}
                    <button type="button" aria-label={`Berikutnya setelah ${b.nama}`} onClick={e=>{const row=e.currentTarget.closest("li");const last=row?.querySelectorAll<HTMLInputElement>("input[data-so-input]");if(last?.length)berikutnya(last[last.length-1]);}} className="rounded-lg border px-2 py-1 text-xs text-matur-700">Berikutnya ↓</button>
                    {v !== null && (
                      <span className="ml-auto text-xs">
                        ={" "}
                        <b>
                          {nf.format(v)} {b.satuan_pakai}
                        </b>
                        {jenis === "rutin" && beda && (
                          <span className="ml-1 text-amber-700">
                            ({v > basis ? "+" : ""}
                            {nf.format(v - basis)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>
      </section>

      <section className="space-y-2 rounded-2xl border-2 border-kopi-700 bg-white p-4">
        <button type="button" disabled={locked||invalid||!terisi.length||Object.keys(konflik).length>0} onClick={()=>setReview(true)} className="w-full rounded-xl border-2 border-matur-300 p-3 font-semibold text-matur-700 disabled:opacity-40">Periksa hitungan & selisih ({terisi.length} barang)</button>
        {review&&<div className="max-h-64 overflow-y-auto rounded-xl bg-stone-50 p-3"><h2 className="mb-2 font-bold">Periksa sebelum menyimpan SO</h2>{terisi.map(b=>{const sistem=snapshot[b.id]??b.sistem;const actual=fisik(b,isi[b.id])!;return <div key={b.id} className="border-b py-2 text-xs"><b>{b.nama}</b><p>Sistem {nf.format(sistem)} · Fisik {nf.format(actual)} {b.satuan_pakai} · <span className={actual===sistem?"text-green-700":"text-amber-700"}>Selisih {actual-sistem>0?'+':''}{nf.format(actual-sistem)}</span></p></div>;})}{terisi.length<bahan.length&&<p className="mt-2 text-xs text-amber-800">{bahan.length-terisi.length} barang belum dihitung; stoknya tetap dipertahankan.</p>}</div>}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Tanggal hitung
            <input
              type="date"
              value={tanggal}
              disabled={locked} onChange={(e) => {drafts.open(drafts.fresh(e.target.value));setReview(false);setKonflik({});setMsg(null);}}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium">
            Catatan
            <input
              value={catatan}
              disabled={locked} onChange={(e) => setCatatan(e.target.value)}
              placeholder={
                jenis === "awal"
                  ? "mis. stok awal sebelum pakai Matoer"
                  : "mis. opname akhir Oktober"
              }
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <p className="text-sm">
          {terisi.length} dari {bahan.length} bahan terisi{" "}
          {tampilNilai && (
            <>
              · nilai bahan yang dihitung{" "}
              <b>{formatRupiah(Math.round(nilai))}</b>
            </>
          )}
        </p>
        {jenis === "awal" &&
          terisi.length > 0 &&
          terisi.length < bahan.length && (
            <p className="text-xs text-amber-700">
              Bahan yang dikosongkan tidak diubah stoknya. Untuk stok awal
              sebaiknya semua bahan diisi (isi 0 bila tidak ada).
            </p>
          )}
        {invalid && (
          <p role="alert" className="text-sm text-red-700">
            Gunakan jumlah angka yang valid dan tidak negatif.
          </p>
        )}
        {Object.keys(konflik).length>0&&<p role="alert" className="text-sm text-amber-800">{Object.keys(konflik).length} bahan berubah. Hitung ulang bahan yang ditandai di daftar atas; isian lain tetap ada.</p>}
        {msg&&<p role="status" className={`rounded-lg p-3 text-sm ${msg.error?"bg-red-50 text-red-800":"bg-green-50 text-green-800"}`}>{msg.error??msg.ok}</p>}
        <button
          disabled={!d || pending || !!d.completedId || (!d.attempt && (invalid || !terisi.length || Object.keys(konflik).length>0 || tanggal<kemarinSo()))}
          onClick={simpan}
          className="w-full rounded-xl bg-kopi-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : d?.attempt ? "Cek / kirim ulang SO" : review ? "Konfirmasi & simpan SO" : "Periksa & simpan SO"}
        </button>
      </section>

      {riwayat.length > 0 && (
        <section className="rounded-2xl border border-matur-200 bg-white p-4">
          <h2 className="mb-2 font-bold">Riwayat opname</h2>
          <ul className="divide-y text-sm">
            {riwayat.map((r) => (
              <li key={r.id} className="py-3">
                <details>
                  <summary className="cursor-pointer font-medium">
                    {formatTanggal(r.tanggal)} ·{" "}
                    {r.petugas_nama ?? "Petugas tercatat di audit"}
                    {tampilNilai && (
                      <b className="ml-2 tabular-nums">
                        {formatRupiah(r.total_nilai)}
                      </b>
                    )}
                  </summary>
                  <p className="my-2 text-xs text-stone-500">
                    {r.catatan?.replace(/\[Kas:[^\]]+\]/g, 'SO shift').trim()} · Dicatat{" "}
                    {new Date(r.created_at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}
                  </p>
                  <ul className="divide-y rounded-xl bg-stone-50 px-3">
                    {r.item_opname.map((it) => {
                      const b = bahan.find((b) => b.id === it.bahan_id);
                      const selisih =
                        Number(it.qty_fisik) - Number(it.qty_sistem);
                      return (
                        <li key={it.bahan_id} className="py-2">
                          <b>{b?.nama ?? "Bahan diarsipkan"}</b>
                          <p className="text-xs">
                            Sistem {nf.format(Number(it.qty_sistem))} · Fisik{" "}
                            {nf.format(Number(it.qty_fisik))} {b?.satuan_pakai}{" "}
                            ·{" "}
                            <span
                              className={
                                selisih ? "text-amber-700" : "text-green-700"
                              }
                            >
                              Selisih {selisih > 0 ? "+" : ""}
                              {nf.format(selisih)}
                            </span>
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
