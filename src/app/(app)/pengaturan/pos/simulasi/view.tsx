"use client";
import { ReceiptDialog } from "@/components/pos-receipt";
import { useState } from "react";
import { hitungSimulasi, type SimMenu, type SimItem } from "@/lib/pos-simulasi";
import { formatRupiah as rp } from "@/lib/format";
type Struk = ReturnType<typeof hitungSimulasi>;
const input = "w-full rounded-xl border p-2.5 text-sm";
export function SimulasiPos({
  menu,
  cetak = false,
  outletNama = "Outlet Demo",
}: {
  menu: SimMenu[];
  cetak?: boolean;
  outletNama?: string;
}) {
  const [items, setItems] = useState<SimItem[]>([]);
  const [cari, setCari] = useState("");
  const [ojol, setOjol] = useState(false);
  const [diskon, setDiskon] = useState(0);
  const [diterima, setDiterima] = useState("");
  const [struk, setStruk] = useState<Struk | null>(null);
  const [kanalStruk, setKanalStruk] = useState("langsung");
  const [error, setError] = useState("");
  const [riwayat, setRiwayat] = useState<Struk[]>([]);
  const subtotal = items.reduce((n, i) => {
    const m = menu.find((x) => x.id === i.menu)!;
    return (
      n +
      i.qty *
        (Number(ojol ? m.harga_ojol : m.harga_langsung) +
          m.varian
            .filter((v) => i.varian.includes(v.id))
            .reduce((n, v) => n + Number(v.tambahan_harga), 0))
    );
  }, 0);
  const total = Math.max(0, subtotal - diskon);
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="space-y-3">
          <input
            aria-label="Cari menu simulasi"
            placeholder="Cari menu…"
            className={input}
            value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {menu
              .filter((m) => m.nama.toLowerCase().includes(cari.toLowerCase()))
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setItems((xs) => {
                      const i = xs.findIndex(
                        (x) => x.menu === m.id && !x.varian.length,
                      );
                      return i < 0
                        ? [...xs, { menu: m.id, qty: 1, varian: [] }]
                        : xs.map((x, j) =>
                            j === i ? { ...x, qty: x.qty + 1 } : x,
                          );
                    });
                    setStruk(null);
                  }}
                  className="min-h-24 rounded-2xl border bg-white p-4 text-left shadow-sm"
                >
                  <b className="text-sm">{m.nama}</b>
                  <p className="mt-2 text-sm text-matur-700">
                    {rp(Number(ojol ? m.harga_ojol : m.harga_langsung))}
                  </p>
                </button>
              ))}
          </div>
        </section>
        <form
          className="space-y-4 rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const r = hitungSimulasi(
                menu,
                items,
                ojol,
                diskon,
                diterima === "" ? total : Number(diterima),
              );
              setStruk(r);
              setKanalStruk(ojol ? "gofood" : "langsung");
              setRiwayat((xs) => [r, ...xs].slice(0, 20));
              setItems([]);
              setDiskon(0);
              setDiterima("");
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h2 className="font-bold">Keranjang latihan</h2>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={ojol}
              onChange={(e) => setOjol(e.target.checked)}
            />
            Pakai harga ojol
          </label>
          {items.map((i, index) => {
            const m = menu.find((m) => m.id === i.menu)!;
            return (
              <article key={index} className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-2">
                  <b className="mr-auto text-sm">{m.nama}</b>
                  <input
                    aria-label={`Jumlah ${m.nama}`}
                    className="w-16 rounded-lg border p-2"
                    type="number"
                    min={1}
                    max={999}
                    value={i.qty}
                    onChange={(e) =>
                      setItems((xs) =>
                        xs.map((x, j) =>
                          j === index
                            ? { ...x, qty: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setItems((xs) => xs.filter((_, j) => j !== index))
                    }
                    className="text-sm text-red-700"
                  >
                    Hapus
                  </button>
                </div>
                {m.varian.map((v) => (
                  <label key={v.id} className="flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={i.varian.includes(v.id)}
                      onChange={(e) =>
                        setItems((xs) =>
                          xs.map((x, j) =>
                            j === index
                              ? {
                                  ...x,
                                  varian: e.target.checked
                                    ? [...x.varian, v.id]
                                    : x.varian.filter((id) => id !== v.id),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    {v.nama} (+{rp(Number(v.tambahan_harga))})
                  </label>
                ))}
              </article>
            );
          })}
          {!items.length && (
            <p className="text-sm text-stone-500">
              Klik menu untuk mencoba transaksi.
            </p>
          )}
          <p className="flex justify-between text-sm">
            Subtotal <b>{rp(subtotal)}</b>
          </p>
          <label className="block text-sm">
            Diskon (Rp)
            <input
              type="number"
              min={0}
              step={1}
              value={diskon}
              onChange={(e) => setDiskon(Number(e.target.value))}
              className={input}
            />
          </label>
          <p className="flex justify-between font-bold">
            Total <span>{rp(total)}</span>
          </p>
          <label className="block text-sm">
            Uang diterima
            <input
              type="number"
              min={0}
              step={1}
              placeholder={String(total)}
              value={diterima}
              onChange={(e) => setDiterima(e.target.value)}
              className={input}
            />
          </label>
          <button
            disabled={!items.length}
            className="w-full rounded-xl bg-kopi-900 p-3 font-bold text-white disabled:opacity-40"
          >
            Bayar simulasi
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      </div>
      {struk && cetak && (
        <ReceiptDialog
          r={{
            ...struk,
            id: `testing-${riwayat.length}`,
            nomor: riwayat.length,
          }}
          lines={struk.lines.map((l, i) => ({
            key: String(i),
            nama: l.nama,
            qty: l.qty,
            total: l.total,
          }))}
          kanal={kanalStruk}
          metode="tunai"
          testing
          outletNama={outletNama}
          kasir="Kasir Testing"
          onClose={() => setStruk(null)}
        />
      )}
      {struk && !cetak && (
        <section
          role="status"
          className="rounded-2xl border-2 border-dashed border-amber-400 bg-white p-5"
        >
          <h2 className="font-bold">✓ STRUK SIMULASI · BUKAN TRANSAKSI ASLI</h2>
          {struk.lines.map((l, i) => (
            <p key={i} className="mt-2 flex justify-between text-sm">
              <span>
                {l.nama} ×{l.qty}
              </span>
              <b>{rp(l.total)}</b>
            </p>
          ))}
          <p className="mt-3 font-bold">
            Total {rp(struk.total)} · Kembalian {rp(struk.kembalian)}
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Tidak dikirim ke POS, stok, kas, atau laporan Akunting.
          </p>
        </section>
      )}
      <p className="text-sm text-stone-500">
        Latihan pada halaman ini: {riwayat.length} transaksi ·{" "}
        {rp(riwayat.reduce((n, r) => n + r.total, 0))}. Data latihan hilang saat
        halaman dimuat ulang.
      </p>
      <button
        onClick={() => {
          setItems([]);
          setRiwayat([]);
          setStruk(null);
          setError("");
          setDiskon(0);
          setDiterima("");
        }}
        className="rounded-xl border px-4 py-2 text-sm"
      >
        Ulangi simulasi dari awal
      </button>
    </>
  );
}
