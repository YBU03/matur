"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { terimaBelanja } from "@/lib/accounting-operasional-actions";
export type BelanjaBahan = {
  id: string;
  biaya_id: string;
  created_at: string;
  items: { bahan_id: string; nama: string; satuan: string; qty: number }[];
  hasil: { bahan_id: string; qty: number }[] | null;
  diterima_at: string | null;
  nama_penerima: string | null;
  catatan: string | null;
};
export function PenerimaanBelanja({
  data,
  bolehTerima = true,
}: {
  data: BelanjaBahan[];
  bolehTerima?: boolean;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-white p-4">
      <h2 className="font-bold">Penerimaan pembelian langsung</h2>
      <p className="text-xs text-stone-600">
        Periksa barang sebelum konfirmasi. Jumlah memakai satuan stok; isi 0
        untuk barang yang tidak diterima. Selisih wajib diberi catatan. Kiriman
        dari gudang tetap diterima melalui menu Terima Barang.
      </p>
      {!data.length && (
        <p className="text-sm text-stone-500">
          Belum ada pembelian langsung dengan rincian bahan.
        </p>
      )}
      {data.map((x) => (
        <Baris key={x.id} x={x} boleh={bolehTerima} />
      ))}
    </section>
  );
}
function Baris({ x, boleh }: { x: BelanjaBahan; boleh: boolean }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [qty, setQty] = useState(x.items.map((i) => String(i.qty)));
  const [catatan, setCatatan] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <article className="rounded-xl border p-3 text-sm">
      <button
        type="button"
        className="flex w-full flex-wrap justify-between gap-2 text-left"
        aria-expanded={buka}
        onClick={() => setBuka(!buka)}
      >
        <span>
          {new Date(x.created_at).toLocaleDateString("id-ID")} ·{" "}
          {x.items.map((i) => i.nama).join(", ")}
        </span>
        <b className={x.diterima_at ? "text-green-700" : "text-amber-800"}>
          {x.diterima_at ? "Diterima" : "Menunggu pengecekan"} ▾
        </b>
      </button>
      {buka && (
        <div className="mt-3 space-y-2">
          {x.items.map((i, n) => (
            <label
              key={i.bahan_id}
              className="flex items-center justify-between gap-3"
            >
              <span>
                {i.nama} · dibeli {i.qty} {i.satuan}
              </span>
              {x.diterima_at ? (
                <b>
                  {x.hasil?.find((h) => h.bahan_id === i.bahan_id)?.qty ?? 0}{" "}
                  {i.satuan}
                </b>
              ) : (
                <input
                  aria-label={`Diterima ${i.nama}`}
                  className="w-28 rounded-lg border p-2"
                  type="number"
                  min="0"
                  max={i.qty}
                  step="0.001"
                  disabled={!boleh || pending}
                  value={qty[n]}
                  onChange={(e) =>
                    setQty(qty.map((v, k) => (k === n ? e.target.value : v)))
                  }
                />
              )}
            </label>
          ))}
          {x.diterima_at ? (
            <p className="text-xs text-stone-600">
              Diterima {x.nama_penerima} ·{" "}
              {new Date(x.diterima_at).toLocaleString("id-ID")} · {x.catatan}
            </p>
          ) : (
            boleh && (
              <>
                <label className="block">
                  Catatan pengecekan
                  <input
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    className="mt-1 w-full rounded-lg border p-2"
                    disabled={pending}
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    pending ||
                    qty.some(
                      (q, n) =>
                        q === "" ||
                        !Number.isFinite(Number(q)) ||
                        Number(q) < 0 ||
                        Number(q) > x.items[n].qty,
                    )
                  }
                  className="rounded-lg bg-matur-500 px-3 py-2 font-semibold text-white disabled:opacity-50"
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Konfirmasi barang sudah diperiksa? Stok akan ditambahkan sesuai jumlah diterima.",
                      )
                    )
                      return;
                    start(async () => {
                      try {
                        const r = await terimaBelanja({
                          id: x.id,
                          items: x.items.map((i, n) => ({
                            bahan_id: i.bahan_id,
                            qty: Number(qty[n]),
                          })),
                          catatan,
                        });
                        setMsg(r.error ?? r.ok ?? "");
                        if (!r.error) router.refresh();
                      } catch {
                        setMsg(
                          "Koneksi terputus. Coba lagi; input tetap tersimpan.",
                        );
                      }
                    });
                  }}
                >
                  {pending ? "Menyimpan…" : "Konfirmasi penerimaan"}
                </button>
              </>
            )
          )}
          {msg && <p role="status">{msg}</p>}
        </div>
      )}
    </article>
  );
}
