"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReceiptDialog } from "@/components/pos-receipt";
import { formatRupiah } from "@/lib/format";
import { voidTransaksi } from "@/lib/pos-actions";
import { PinSpv } from "../pos/pos-screen";

export type Trx = {
  id: string;
  nomor: number;
  kanal: string;
  total: number;
  diskon: number;
  status: "lunas" | "void";
  void_alasan: string | null;
  created_at: string;
  operator_nama?: string | null;
  pelanggan: string | null;
  subtotal?: number;
  item_transaksi: { nama: string; qty: number; harga?: number }[];
  pembayaran: { metode: string; nominal: number; diterima?: number | null }[];
};
export type Ringkas = { transaksi: number; omzet: number; void: number; metode: Record<string, number> };

export type DraftRiwayat = {
  id: string;
  label: string | null;
  items: { nama: string; qty: number }[];
  total: number;
  status: "draft" | "dibayar" | "dibatalkan";
  alasan_batal: string | null;
  nama_pembuat: string | null;
  nama_penutup: string | null;
  created_at: string;
  selesai_at: string | null;
  transaksi: { nomor: number } | null;
};
const jam = (t: string) => new Date(t).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const geser = (iso: string, hari: number) => new Date(Date.parse(iso + "T00:00:00Z") + hari * 86400_000).toISOString().slice(0, 10);
const akhirBulan = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
const tglPendek = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const hariIniWib = (t: string, hari: string) => new Date(Date.parse(t) + 7 * 3600_000).toISOString().slice(0, 10) === hari;
const LABEL_METODE: Record<string, string> = { tunai: "Tunai", qris: "QRIS", debit: "Debit/Kredit", transfer: "Transfer" };
const isi = "mt-0.5 block w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500";

export function RiwayatView({ trx, drafts, outletNama, awal = "trx", adaLagi, n, ringkas, dari, sampai, hari }: { trx: Trx[]; drafts: DraftRiwayat[]; outletNama: string; awal?: "trx" | "draft"; adaLagi: boolean; n: number; ringkas: Ringkas; dari: string; sampai: string; hari: string }) {
  const [tab, setTab] = useState<"trx" | "draft">(awal);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [batal, setBatal] = useState<Trx | null>(null);
  const [alasan, setAlasan] = useState("");
  const [ok, setOk] = useState("");
  const [struk, setStruk] = useState<Trx | null>(null);
  const [mode, setMode] = useState<"tanggal" | "bulan">("tanggal");
  const tampil = trx.filter((t) => !q || String(t.nomor) === q.replace("#", "") || t.item_transaksi.some((i) => i.nama.toLowerCase().includes(q.toLowerCase())) || (t.pelanggan ?? "").toLowerCase().includes(q.toLowerCase()));
  const url = (d: string, s2: string, extra = "") => `/kasir/riwayat?dari=${d}&sampai=${s2}${extra}`;
  const awalBulan = hari.slice(0, 7) + "-01";
  const akhirBulanLalu = geser(awalBulan, -1);
  const preset: [string, string, string][] = [
    ["Hari ini", hari, hari],
    ["Kemarin", geser(hari, -1), geser(hari, -1)],
    ["7 hari", geser(hari, -6), hari],
    ["30 hari", geser(hari, -29), hari],
    ["Bulan ini", awalBulan, hari],
    ["Bulan lalu", akhirBulanLalu.slice(0, 7) + "-01", akhirBulanLalu],
  ];
  const labelPeriode = dari === sampai ? tglPendek(dari) : `${tglPendek(dari)} – ${tglPendek(sampai)}`;
  const chipCls = (on: boolean) => `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-kopi-900 bg-kopi-900 text-white" : "border-matur-200 bg-white text-kopi-800"}`;
  const bukaStruk = (t: Trx) => setStruk(t);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="mr-auto text-xl font-bold">🧾 Riwayat Transaksi</h1>
        <p className="text-sm font-semibold text-stone-600">📅 {labelPeriode}</p>
      </div>

      <section className="space-y-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {preset.map(([l, a, b]) => (
            <Link key={l} href={url(a, b)} className={chipCls(dari === a && sampai === b)}>
              {l}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl bg-matur-50 p-1 text-xs font-semibold">
          {(["tanggal", "bulan"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-lg px-3 py-1.5 ${mode === m ? "bg-white text-kopi-900 shadow-sm" : "text-stone-500"}`}>
              {m === "tanggal" ? "Custom tanggal" : "Custom bulan"}
            </button>
          ))}
        </div>
        <form
          key={mode}
          className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const a = String(f.get("a") ?? ""), b = String(f.get("b") ?? "");
            if (!a || !b) return;
            if (mode === "bulan") router.push(url(a + "-01", akhirBulan(b) > hari ? hari : akhirBulan(b)));
            else router.push(url(a, b));
          }}
        >
          <label className="text-[11px] text-stone-500">
            {mode === "tanggal" ? "Dari tanggal" : "Dari bulan"}
            <input name="a" type={mode === "tanggal" ? "date" : "month"} required max={mode === "tanggal" ? hari : hari.slice(0, 7)} defaultValue={mode === "tanggal" ? dari : dari.slice(0, 7)} className={isi} />
          </label>
          <label className="text-[11px] text-stone-500">
            {mode === "tanggal" ? "Sampai tanggal" : "Sampai bulan"}
            <input name="b" type={mode === "tanggal" ? "date" : "month"} required max={mode === "tanggal" ? hari : hari.slice(0, 7)} defaultValue={mode === "tanggal" ? sampai : sampai.slice(0, 7)} className={isi} />
          </label>
          <button className="col-span-2 rounded-xl bg-kopi-900 px-5 py-2.5 text-sm font-semibold text-white sm:col-span-1">Tampilkan</button>
        </form>
        <p className="text-[11px] text-stone-400">Maksimal 3 bulan per tampilan.</p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-stone-500">Transaksi lunas</p>
          <p className="text-lg font-extrabold tabular-nums text-kopi-900">{ringkas.transaksi}</p>
        </div>
        <div className="rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-stone-500">Omzet</p>
          <p className="text-lg font-extrabold tabular-nums text-kopi-900">{formatRupiah(ringkas.omzet)}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] text-stone-500">Per metode{ringkas.void ? ` · ${ringkas.void} void` : ""}</p>
          <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
            {Object.entries(ringkas.metode).length ? (
              Object.entries(ringkas.metode).map(([m, v]) => (
                <span key={m} className="rounded-full bg-matur-50 px-2 py-0.5 font-semibold text-kopi-800">
                  {LABEL_METODE[m] ?? m} {formatRupiah(v)}
                </span>
              ))
            ) : (
              <span className="text-stone-400">Belum ada</span>
            )}
          </p>
        </div>
      </section>

      <nav className="flex gap-1 rounded-xl bg-matur-50 p-1 text-sm font-semibold">
        {(
          [
            ["trx", `🧾 Transaksi (${ringkas.transaksi + ringkas.void})`],
            ["draft", `📋 Draft (${drafts.filter((d) => d.status === "draft").length} menunggu)`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg px-3 py-2 ${tab === k ? "bg-white shadow-sm" : "text-stone-500"}`}>
            {l}
          </button>
        ))}
      </nav>
      {tab === "draft" ? (
        <ul className="space-y-2">
          {drafts.length === 0 && <li className="rounded-2xl border bg-white p-6 text-center text-sm text-stone-400">Belum ada draft 7 hari terakhir.</li>}
          {drafts.map((d) => (
            <li key={d.id} className="rounded-2xl border bg-white p-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {d.label ?? "Tanpa nama"}{" "}
                    <span className={`ml-1 rounded-full px-2 text-xs font-bold ${d.status === "draft" ? "bg-amber-100 text-amber-800" : d.status === "dibayar" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                      {d.status === "draft" ? "menunggu bayar" : d.status === "dibayar" ? `dibayar · struk #${d.transaksi?.nomor ?? "-"}` : "dibatalkan"}
                    </span>
                  </p>
                  <p className="truncate text-stone-600">{d.items.map((i) => `${i.qty}× ${i.nama}`).join(", ")}</p>
                  <p className="text-xs text-stone-500">
                    dibuat {jam(d.created_at)} oleh {d.nama_pembuat ?? "-"}
                    {d.selesai_at && ` · ${d.status === "dibayar" ? "dibayar" : "dibatalkan"} ${jam(d.selesai_at)} oleh ${d.nama_penutup ?? "-"}`}
                    {d.alasan_batal && ` · alasan: ${d.alasan_batal}`}
                  </p>
                </div>
                <b className="tabular-nums">{formatRupiah(d.total)}</b>
              </div>
            </li>
          ))}
        </ul>
      ) : (<>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Cari no. struk / menu / pelanggan…" className="w-full rounded-xl border px-3 py-2" />
      {ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</p>}
      <ul className="space-y-2">
        {tampil.length === 0 && <li className="rounded-2xl border bg-white p-6 text-center text-sm text-stone-400">Belum ada transaksi.</li>}
        {tampil.map((t) => (
          <li key={t.id} className={`rounded-2xl border bg-white shadow-sm ${t.status === "void" ? "opacity-70" : ""}`}>
            <button type="button" onClick={() => bukaStruk(t)} className="flex w-full items-start gap-2 p-3 text-left hover:bg-matur-50/50">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  #{t.nomor} · {jam(t.created_at)} · <span className="text-sm font-normal text-stone-500">{t.kanal}{t.operator_nama ? ` · ${t.operator_nama}` : ""}</span>
                  {t.status === "void" && <span className="ml-2 rounded-full bg-red-100 px-2 text-xs font-bold text-red-700">VOID</span>}
                </p>
                <p className="truncate text-sm text-stone-600">{t.item_transaksi.map((i) => `${i.qty}× ${i.nama}`).join(", ")}</p>
                <p className="text-xs text-stone-500">
                  {t.pembayaran.map((p) => `${LABEL_METODE[p.metode] ?? p.metode} ${formatRupiah(p.nominal)}`).join(" + ")}
                  {t.void_alasan && ` · alasan void: ${t.void_alasan}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <b className={`tabular-nums ${t.status === "void" ? "line-through" : ""}`}>{formatRupiah(t.total)}</b>
                <p className="text-[11px] font-semibold text-matur-700">🧾 Lihat struk ›</p>
              </div>
            </button>
            {t.status === "lunas" && hariIniWib(t.created_at, hari) && (
              <div className="flex justify-end gap-4 border-t border-stone-100 px-3 py-1.5 text-xs font-semibold">
                <button onClick={() => (setBatal(t), setAlasan(""), setOk(""))} className="text-red-600">
                  Void (batalkan)
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {adaLagi && (
        <Link href={url(dari, sampai, `&n=${n + 100}`)} scroll={false} className="block rounded-2xl border border-dashed border-matur-300 bg-white py-3 text-center text-sm font-semibold text-matur-700">
          Muat lagi ({trx.length} dari {ringkas.transaksi + ringkas.void} ditampilkan)
        </Link>
      )}
      </>)}
      {struk && (
        <ReceiptDialog
          salinan
          waktuTransaksi={struk.created_at}
          voidAlasan={struk.status === "void" ? (struk.void_alasan ?? "") : null}
          r={{
            id: struk.id,
            nomor: struk.nomor,
            subtotal: Number(struk.subtotal ?? struk.total),
            diskon: Number(struk.diskon ?? 0),
            total: Number(struk.total),
            kembalian: struk.pembayaran.filter((p) => p.metode === "tunai" && p.diterima != null).reduce((n2, p) => n2 + Number(p.diterima) - Number(p.nominal), 0),
          }}
          lines={struk.item_transaksi.map((i, k) => ({ key: String(k), nama: i.nama, qty: i.qty, total: Number(i.harga ?? 0) * i.qty }))}
          kanal={struk.kanal}
          metode={struk.pembayaran.length > 1 ? "split" : (struk.pembayaran[0]?.metode ?? "tunai")}
          outletNama={outletNama}
          kasir={struk.operator_nama ?? "-"}
          onClose={() => setStruk(null)}
        />
      )}
      {batal && (
        <PinSpv
          judul={`Void struk #${batal.nomor} (${formatRupiah(batal.total)})`}
          keterangan={<input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan pembatalan (wajib), mis. salah input" className="mb-2 w-full rounded-lg border px-3 py-2" />}
          onBatal={() => setBatal(null)}
          onOk={async (login, pin) => {
            if (!alasan.trim()) return "Isi alasan pembatalan dulu.";
            const r = await voidTransaksi(batal.id, alasan, login, pin);
            if (r.error) return r.error;
            setBatal(null);
            setOk(r.ok ?? "");
            router.refresh();
            return null;
          }}
        />
      )}
    </div>
  );
}
