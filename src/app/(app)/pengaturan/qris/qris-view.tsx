"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { QrisTampil } from "@/components/qris-tampil";
import { cekQris } from "@/lib/qris";
import { aturQris, hapusQris, type Result } from "@/lib/qris-actions";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type OutletQris = { id: string; nama: string; qris_url: string | null; qris_payload: string | null; qris_nama: string | null; qris_penyedia: string | null; qris_merchant_id: string | null; qris_mode: "statis" | "dinamis"; qris_dinamis: boolean };

/** Baca isi kode QR dari gambar (di browser). */
async function bacaQr(file: File): Promise<string | null> {
  const jsQR = (await import("jsqr")).default;
  const img = await createImageBitmap(file);
  for (const skala of [1, 0.5, 2]) {
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * skala);
    c.height = Math.round(img.height * skala);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const r = jsQR(d.data, d.width, d.height);
    if (r?.data) return r.data;
  }
  return null;
}

function Kartu({ o }: { o: OutletQris }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState(o.qris_url);
  const [payload, setPayload] = useState(o.qris_payload ?? "");
  const [penyedia, setPenyedia] = useState(o.qris_penyedia ?? "");
  const [merchant, setMerchant] = useState(o.qris_merchant_id ?? "");
  const [nama, setNama] = useState(o.qris_nama ?? "");
  const [dinamis, setDinamis] = useState(o.qris_mode === "dinamis");
  const [msg, setMsg] = useState<Result | null>(null);
  const [unggah, setUnggah] = useState(false);
  const info = payload ? cekQris(payload) : null;
  const berubah = penyedia !== (o.qris_penyedia ?? "") || merchant !== (o.qris_merchant_id ?? "") || url !== o.qris_url || (payload || null) !== o.qris_payload || (nama || null) !== o.qris_nama || dinamis !== (o.qris_mode === "dinamis");

  const pilihFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return setMsg({ error: "Gambar maksimal 3 MB." });
    setUnggah(true);
    setMsg(null);
    try {
      const isi = await bacaQr(f).catch(() => null);
      const sb = supabaseBrowser();
      const path = `${o.id}/${Date.now()}.${f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg"}`;
      const up = await sb.storage.from("qris").upload(path, f, { contentType: f.type });
      if (up.error) return setMsg({ error: "Gagal mengunggah: " + up.error.message });
      setUrl(sb.storage.from("qris").getPublicUrl(path).data.publicUrl);
      if (isi && cekQris(isi).valid) {
        setPayload(isi);

        const i = cekQris(isi);
        if (!nama && i.merchant) setNama(i.merchant);
        setMsg({ ok: `Gambar terunggah & kode QRIS terbaca (${i.merchant ?? "merchant"}). Mode mengikuti pilihan di bawah. Jangan lupa Simpan.` });
      } else setMsg({ ok: "Gambar terunggah. Kode QR tidak terbaca otomatis — QRIS tampil sebagai gambar (pelanggan ketik nominal). Jangan lupa Simpan." });
    } finally {
      setUnggah(false);
    }
  };

  return (
    <section className="rounded-2xl border border-matur-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-bold">{o.nama}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${o.qris_mode === "dinamis" ? "bg-green-100 text-green-700" : o.qris_url ? "bg-sky-100 text-sky-700" : "bg-stone-100 text-stone-500"}`}>
          {o.qris_mode === "dinamis" ? "Dinamis · Menunggu konfigurasi" : o.qris_url || o.qris_payload ? "Statis" : "Belum diatur"}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <div className="rounded-xl bg-stone-50 p-3 text-center">
          {dinamis ? <p className="py-10 text-sm text-amber-800">QRIS dinamis menunggu konfigurasi penyedia pembayaran. QR per transaksi dan konfirmasi otomatis belum aktif.</p> : url || payload ? <QrisTampil q={{ url, payload: payload || null, nama, dinamis: false }} ukuran={210} /> : <p className="py-16 text-sm text-stone-400">Belum ada QRIS</p>}

        </div>
        <div className="space-y-3 text-sm">
          <label className="block font-semibold">
            1. Unggah gambar QRIS (dari bank / aplikasi merchant)
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={unggah} onChange={(e) => pilihFile(e.target.files?.[0])} className="mt-1 block w-full text-xs font-normal file:mr-2 file:rounded-lg file:border-0 file:bg-kopi-900 file:px-3 file:py-2 file:text-white" />
          </label>
          {unggah && <p className="text-xs text-stone-500">Mengunggah & membaca kode QR…</p>}
          <label className="block font-semibold">
            Nama tampil (opsional)
            <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. RUMA KOPIAKSA" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <details open={!!payload}>
            <summary className="cursor-pointer font-semibold">2. Kode QRIS statis (terbaca otomatis dari gambar, atau tempel manual)</summary>
            <textarea value={payload} onChange={(e) => setPayload(e.target.value.trim())} rows={3} placeholder="000201010211…" className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs" />
            {info && (
              <p className={`text-xs ${info.valid ? "text-green-700" : "text-red-600"}`}>
                {info.valid ? `✓ QRIS valid · ${info.merchant ?? "-"} · ${info.kota ?? ""}${info.nmid ? ` · NMID ${info.nmid}` : ""}` : `✗ ${info.alasan}`}
              </p>
            )}
          </details>
          <fieldset className="space-y-2">
            <legend className="mb-1 font-semibold">3. Jenis QRIS yang tampil di kasir (pilih salah satu)</legend>
            <label className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-3 ${!dinamis ? "border-sky-500 bg-sky-50" : "border-stone-200"}`}>
              <input type="radio" name={`jenis-${o.id}`} checked={!dinamis} onChange={() => setDinamis(false)} className="mt-0.5 size-4 accent-sky-600" />
              <span>
                <b>QRIS statis</b>
                <span className="block text-xs text-stone-500">Kasir menampilkan QRIS apa adanya — pelanggan mengetik nominal sendiri di aplikasinya.</span>
              </span>
            </label>
            <label className={`flex items-start gap-2 rounded-xl border-2 p-3 cursor-pointer ${dinamis ? "border-green-600 bg-green-50" : "border-stone-200"}`}>
              <input type="radio" name={`jenis-${o.id}`} checked={dinamis} onChange={() => setDinamis(true)} className="mt-0.5 size-4 accent-green-600" />
              <span>
                <b>QRIS dinamis (konfirmasi otomatis)</b>
                <span className="block text-xs text-stone-500">QR dibuat per transaksi dan pembayaran dikonfirmasi otomatis oleh penyedia. Saat ini menunggu penyedia dan konfigurasi integrasi. Gambar statis tetap tersimpan saat beralih mode.</span>
              </span>
            </label>
          </fieldset>
          {dinamis && <div className="space-y-2 rounded-xl bg-amber-50 p-3">
            <p className="text-xs text-amber-900">Menunggu konfigurasi. Informasi ini disimpan sebagai persiapan; belum mengaktifkan transaksi otomatis.</p>
            <label className="block">Penyedia pembayaran<input maxLength={80} value={penyedia} onChange={(e) => setPenyedia(e.target.value)} placeholder="Nama bank / penyedia" className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="block">Merchant ID<input maxLength={120} value={merchant} onChange={(e) => setMerchant(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
          </div>}
          {msg && <p className={`rounded-lg px-3 py-2 text-xs ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}
          <div className="flex flex-wrap gap-2">
            <button disabled={pending || !berubah} onClick={() => start(async () => { const r = await aturQris(o.id, { url, payload: payload || null, nama, dinamis, penyedia, merchant }); setMsg(r); if (!r.error) router.refresh(); })} className="rounded-xl bg-kopi-900 px-4 py-2 font-semibold text-white disabled:opacity-40">
              Simpan
            </button>
            {(o.qris_url || o.qris_payload) && (
              <button disabled={pending} onClick={() => confirm(`Hapus QRIS ${o.nama}?`) && start(async () => { const r = await hapusQris(o.id); setMsg(r); if (!r.error) { setUrl(null); setPayload(""); setDinamis(false); router.refresh(); } })} className="rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-600">
                Hapus
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function QrisView({ outlets }: { outlets: OutletQris[] }) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">QRIS Outlet</h1>
        <p className="text-sm text-stone-500">QRIS tampil di layar kasir saat pelanggan bayar QRIS. Statis memakai gambar/kode yang diunggah dan dikonfirmasi kasir. Dinamis disiapkan untuk integrasi konfirmasi pembayaran otomatis.</p>
      </div>
      {outlets.map((o) => (
        <Kartu key={o.id} o={o} />
      ))}
    </div>
  );
}
