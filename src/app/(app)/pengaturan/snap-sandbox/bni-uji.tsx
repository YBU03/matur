"use client";

// Uji QRIS MPM langsung dari server Matoer ke sandbox BNI: Generate QR → Query Payment → simulator notifikasi.
import { useEffect, useState, useTransition } from "react";
import { QrCode, Search, BellRing } from "lucide-react";
import { bniAction } from "@/lib/snap-sandbox-actions";

type Hasil = { ok?: boolean; status?: number; durasiMs?: number; pesan?: string; request?: unknown; respons?: Record<string, unknown> | null; externalId?: string; callbackTarget?: string };
type Notif = { id: number; diterima_at: string; reference_no: string | null; partner_reference_no: string | null; status: string | null; status_desc: string | null; amount: string | null; bill_number: string | null; header_lengkap: boolean };

const kotak = "w-full min-w-0 rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";
const teks = (v: unknown) => (typeof v === "string" ? v : "");

function Respons({ judul, h }: { judul: string; h: Hasil }) {
  const kode = teks(h.respons?.responseCode);
  const sukses = h.ok && (!kode || kode.startsWith("200"));
  return (
    <div className={`space-y-1.5 rounded-xl p-3 text-sm ${sukses ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
      <p className="font-bold">
        {judul}: {sukses ? "✓" : "⚠"} HTTP {h.status}
        {kode ? ` · ${kode}` : ""} {teks(h.respons?.responseMessage) ? `· ${teks(h.respons?.responseMessage)}` : ""}
        <span className="ml-2 text-xs font-normal opacity-70">{h.durasiMs} ms</span>
      </p>
      {h.pesan && <p className="text-xs">{h.pesan}</p>}
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold">Lihat respons & permintaan</summary>
        <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white/70 p-2 text-[11px]">{JSON.stringify({ respons: h.respons, permintaan: h.request }, null, 2)}</pre>
      </details>
    </div>
  );
}

export function BniUji({ partnerAwal, notif, segarkan }: { partnerAwal: string; notif: Notif[]; segarkan: () => void }) {
  const [amount, setAmount] = useState("10000.00");
  const [merchantId, setMerchantId] = useState("618299946");
  const [terminalId, setTerminalId] = useState("301928301");
  const [channelId, setChannelId] = useState("95221");
  const [partnerId, setPartnerId] = useState(partnerAwal);
  const [gen, setGen] = useState<Hasil | null>(null);
  const [qry, setQry] = useState<Hasil | null>(null);
  const [sim, setSim] = useState<Hasil | null>(null);
  const [qrImg, setQrImg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const r = gen?.respons ?? {};
  const ai = (r.additionalInfo ?? {}) as Record<string, unknown>;
  const ref = { partnerReferenceNo: teks(r.partnerReferenceNo) || teks((gen?.request as { body?: { partnerReferenceNo?: string } })?.body?.partnerReferenceNo), referenceNo: teks(r.referenceNo), billNumber: teks(ai.billNumber) || teks(r.billNumber), externalId: gen?.externalId ?? "", qrContent: teks(r.qrContent) };
  const umum = { merchantId, terminalId, channelId, partnerId };

  useEffect(() => {
    if (!ref.qrContent) return setQrImg("");
    import("qrcode").then((q) => q.toDataURL(ref.qrContent, { margin: 1, width: 240 })).then(setQrImg).catch(() => setQrImg(""));
  }, [ref.qrContent]);

  const jalankan = (aksi: "bni-generate" | "bni-query" | "bni-notif-sim", data: Record<string, unknown>, set: (h: Hasil) => void) =>
    start(async () => {
      setErr("");
      const x = await bniAction(aksi, data);
      if (x.error) return setErr(x.error);
      set(x.data as Hasil);
      if (aksi === "bni-notif-sim") setTimeout(segarkan, 2500);
    });

  return (
    <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
      <h2 className="font-bold text-kopi-900">Uji QRIS MPM ke sandbox BNI</h2>
      <p className="text-xs text-stone-500">Permintaan dikirim dari server Matoer ke <span className="font-mono">sandbox.bni.co.id</span> memakai token OAuth & signature simetris SNAP. Hanya pengujian — tidak membuat transaksi POS.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ["Nominal", amount, setAmount, "bni-amount"],
            ["merchantId", merchantId, setMerchantId, "bni-merchant"],
            ["terminalId", terminalId, setTerminalId, "bni-terminal"],
            ["CHANNEL-ID", channelId, setChannelId, "bni-channel"],
            ["X-PARTNER-ID", partnerId, setPartnerId, "bni-partner"],
          ] as const
        ).map(([l, v, set, id]) => (
          <label key={l} className="block text-xs font-semibold text-stone-600">
            {l}
            <input id={id} value={v} onChange={(e) => set(e.target.value.trim())} className={`${kotak} mt-1 font-mono text-xs`} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => jalankan("bni-generate", { ...umum, amount }, (h) => (setGen(h), setQry(null), setSim(null)))} className="inline-flex items-center gap-1.5 rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          <QrCode size={15} /> 1. Tes Generate QR
        </button>
        <button type="button" disabled={pending || !ref.partnerReferenceNo} onClick={() => jalankan("bni-query", { ...umum, ...ref }, setQry)} className="inline-flex items-center gap-1.5 rounded-xl bg-matur-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          <Search size={15} /> 2. Tes Query Payment
        </button>
        <button type="button" disabled={pending || !ref.partnerReferenceNo} onClick={() => jalankan("bni-notif-sim", { ...umum, ...ref, amount }, setSim)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          <BellRing size={15} /> 3. Tes Notifikasi
        </button>
        {pending && <span className="self-center text-xs text-matur-700">Menghubungi BNI…</span>}
      </div>
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {gen && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Respons judul="Generate QR" h={gen} />
          {qrImg && (
            <figure className="rounded-2xl border border-matur-200 bg-white p-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImg} alt="QR sandbox BNI" width={160} height={160} className="mx-auto" />
              <figcaption className="mt-1 text-[10px] text-stone-500">QR sandbox · jangan dibayar</figcaption>
            </figure>
          )}
        </div>
      )}
      {qry && <Respons judul="Query Payment" h={qry} />}
      {sim && (
        <div className="space-y-1">
          <Respons judul="Simulator notifikasi" h={sim} />
          <p className="text-[11px] text-stone-500">Target callback: <span className="font-mono">{sim.callbackTarget}</span></p>
        </div>
      )}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Notifikasi BNI yang diterima Matoer (uji)</h3>
          <button type="button" onClick={segarkan} className="text-xs font-semibold text-matur-700 underline">Muat ulang</button>
        </div>
        {notif.length ? (
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-100 text-xs">
            {notif.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <b>{n.status_desc || n.status || "-"}</b> · Rp {n.amount ?? "-"} · ref {n.partner_reference_no ?? "-"}
                  <span className="block text-[10px] text-stone-400">{new Date(n.diterima_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB · bill {n.bill_number ?? "-"}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${n.header_lengkap ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{n.header_lengkap ? "header lengkap" : "header kurang"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-500">Belum ada notifikasi masuk.</p>
        )}
      </div>
    </section>
  );
}
