"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  pelanggan: string | null;
  item_transaksi: { nama: string; qty: number }[];
  pembayaran: { metode: string; nominal: number }[];
};

export function RiwayatView({ trx }: { trx: Trx[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [batal, setBatal] = useState<Trx | null>(null);
  const [alasan, setAlasan] = useState("");
  const [ok, setOk] = useState("");
  const lunas = trx.filter((t) => t.status === "lunas");
  const tampil = trx.filter((t) => !q || String(t.nomor) === q.replace("#", "") || t.item_transaksi.some((i) => i.nama.toLowerCase().includes(q.toLowerCase())) || (t.pelanggan ?? "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="mr-auto text-xl font-bold">Transaksi Hari Ini</h1>
        <p className="text-sm text-stone-500">
          {lunas.length} lunas · {formatRupiah(lunas.reduce((s, t) => s + Number(t.total), 0))}
        </p>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Cari no. struk / menu / pelanggan…" className="w-full rounded-xl border px-3 py-2" />
      {ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</p>}
      <ul className="space-y-2">
        {tampil.length === 0 && <li className="rounded-2xl border bg-white p-6 text-center text-sm text-stone-400">Belum ada transaksi.</li>}
        {tampil.map((t) => (
          <li key={t.id} className={`rounded-2xl border bg-white p-3 ${t.status === "void" ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  #{t.nomor} · {new Date(t.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · <span className="text-sm font-normal text-stone-500">{t.kanal}</span>
                  {t.status === "void" && <span className="ml-2 rounded-full bg-red-100 px-2 text-xs font-bold text-red-700">VOID</span>}
                </p>
                <p className="truncate text-sm text-stone-600">{t.item_transaksi.map((i) => `${i.qty}× ${i.nama}`).join(", ")}</p>
                <p className="text-xs text-stone-500">
                  {t.pembayaran.map((p) => `${p.metode} ${formatRupiah(p.nominal)}`).join(" + ")}
                  {t.void_alasan && ` · alasan void: ${t.void_alasan}`}
                </p>
              </div>
              <b className={`tabular-nums ${t.status === "void" ? "line-through" : ""}`}>{formatRupiah(t.total)}</b>
            </div>
            {t.status === "lunas" && (
              <div className="mt-1 text-right">
                <button onClick={() => (setBatal(t), setAlasan(""), setOk(""))} className="text-xs font-semibold text-red-600">
                  Void (batalkan)
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
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
