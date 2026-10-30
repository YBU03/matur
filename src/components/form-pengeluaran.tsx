"use client";

// Form catat/ubah pengeluaran outlet — dipakai di aplikasi kasir dan di Catatan Harian (admin)
import { useRef, useState } from "react";
import { muatBahanBelanja } from "@/lib/accounting-operasional-actions";
import type { Pengeluaran } from "@/lib/kas-actions";

export type Kat = { id: string; nama: string; grup: string };
export type Awal = {
  kategori_id: string;
  jumlah: number;
  keterangan: string | null;
  sumber: "laci" | "pusat";
};

const cls =
  "w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-matur-500";
const angka = (v: string) => Math.round(Number(v.replace(/[^\d]/g, "")) || 0);
export const label = (n: string) => n.replace(/^Biaya /, "");
// belanja bahan baku/dessert biasanya dibayar pusat (tidak dari laci) — tetap bisa diubah
const sumberAwal = (k: Kat | undefined) =>
  k?.nama === "Bahan Baku" ? "pusat" : "laci";

export function FormPengeluaran({
  kategori,
  pending,
  awal,
  baru = false,
  onSimpan,
  onBatal,
}: {
  kategori: Kat[];
  pending: boolean;
  awal?: Awal;
  /** awal dipakai sebagai nilai awal form tambah (bukan ubah) */
  baru?: boolean;
  onSimpan: (d: Pengeluaran, reset: () => void) => void;
  onBatal?: () => void;
}) {
  const [bahan, setBahan] = useState<
    { id: string; nama: string; satuan_pakai: string }[]
  >([]);
  const [items, setItems] = useState<{ bahan_id: string; qty: string }[]>([]);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(false);
  const requestId = useRef<string | null>(null);
  const [kat, setKat] = useState(awal?.kategori_id ?? "");
  const bahanBaku = kategori.find((k) => k.id === kat)?.nama === "Bahan Baku";
  const [jumlah, setJumlah] = useState(awal?.jumlah ? String(awal.jumlah) : "");
  const [ket, setKet] = useState(awal?.keterangan ?? "");
  const [sumber, setSumber] = useState<"laci" | "pusat">(
    awal?.sumber ?? "laci",
  );
  const pilih = (id: string) => {
    setKat(id);
    if (!awal || baru) setSumber(sumberAwal(kategori.find((k) => k.id === id)));
  };
  const reset = () => {
    requestId.current = null;
    setItems([]);
    setPesan("");
    setKat("");
    setJumlah("");
    setKet("");
    setSumber("laci");
  };
  const body = (
    <fieldset disabled={pending} className="space-y-3">
      {kategori.length === 0 && (
        <p role="alert" className="text-sm text-red-700">
          Kategori belum tersedia. Muat ulang halaman atau hubungi admin.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {kategori.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => pilih(k.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${kat === k.id ? "bg-kopi-900 font-semibold text-white" : "border border-matur-200 bg-white text-kopi-700"}`}
          >
            {label(k.nama)}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
        <input
          value={jumlah ? Number(angka(jumlah)).toLocaleString("id-ID") : ""}
          onChange={(e) => setJumlah(e.target.value)}
          inputMode="numeric"
          placeholder="Nominal (Rp)"
          className={`${cls} text-right text-base font-semibold`}
        />
        <input
          value={ket}
          onChange={(e) => setKet(e.target.value)}
          placeholder="Keterangan (mis. galon 2, parkir, tissue)"
          className={cls}
        />
      </div>
      {bahanBaku && (!awal || baru) && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm">
          <p>
            Pembelian langsung di luar gudang? Tambahkan rincian bahan. Setelah
            pengeluaran tersimpan, barista memeriksa dan mengonfirmasi
            penerimaan pada panel di bawah. Stok belum bertambah saat uang
            dicatat.
          </p>
          <button
            type="button"
            disabled={memuat}
            className="rounded-lg border bg-white px-3 py-2"
            onClick={async () => {
              setMemuat(true);
              try {
                if (!bahan.length) {
                  const r = await muatBahanBelanja();
                  if (r.error) {
                    setPesan(r.error);
                    return;
                  }
                  setBahan(r.data ?? []);
                }
                setItems([...items, { bahan_id: "", qty: "" }]);
              } catch {
                setPesan("Bahan belum dapat dimuat. Coba lagi.");
              } finally {
                setMemuat(false);
              }
            }}
          >
            {memuat ? "Memuat bahan…" : "+ Rincian bahan"}
          </button>
          {items.map((x, n) => (
            <div key={n} className="flex flex-wrap gap-2">
              <select
                aria-label="Bahan dibeli"
                className="min-w-0 flex-1 rounded-lg border bg-white p-2"
                value={x.bahan_id}
                onChange={(e) =>
                  setItems(
                    items.map((v, k) =>
                      k === n ? { ...v, bahan_id: e.target.value } : v,
                    ),
                  )
                }
              >
                <option value="">Pilih bahan</option>
                {bahan.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nama} ({b.satuan_pakai})
                  </option>
                ))}
              </select>
              <input
                aria-label="Jumlah satuan stok"
                type="number"
                min="0.001"
                step="0.001"
                className="w-28 rounded-lg border bg-white p-2"
                placeholder="Jumlah"
                value={x.qty}
                onChange={(e) =>
                  setItems(
                    items.map((v, k) =>
                      k === n ? { ...v, qty: e.target.value } : v,
                    ),
                  )
                }
              />
              <button
                type="button"
                aria-label="Hapus rincian"
                onClick={() => setItems(items.filter((_, k) => k !== n))}
              >
                ×
              </button>
            </div>
          ))}
          {pesan && (
            <p role="alert" className="text-red-700">
              {pesan}
            </p>
          )}
          <p className="text-xs">
            Gunakan satuan stok yang tertera, misalnya gram atau ml. Pembayaran
            invoice gudang dan titipan jangan dicatat lagi sebagai pembelian
            langsung.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {(["laci", "pusat"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSumber(s)}
            className={`rounded-xl border-2 py-2 font-semibold ${sumber === s ? (s === "laci" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-blue-500 bg-blue-50 text-blue-800") : "border-stone-200 text-stone-500"}`}
          >
            {s === "laci" ? "💵 Uang laci kasir" : "🏢 Dibayar pusat"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {onBatal && (
          <button
            type="button"
            onClick={onBatal}
            className="flex-1 rounded-xl border py-2.5 text-sm"
          >
            Batal
          </button>
        )}
        <button
          disabled={
            pending ||
            memuat ||
            !kat ||
            !(angka(jumlah) > 0) ||
            (bahanBaku &&
              items.some((i) => !i.bahan_id || !(Number(i.qty) > 0)))
          }
          type="button"
          onClick={() =>
            onSimpan(
              {
                ...(bahanBaku && (!awal || baru) && items.length
                  ? {
                      items: items.map((i) => ({
                        bahan_id: i.bahan_id,
                        qty: Number(i.qty),
                      })),
                    }
                  : {}),
                kategori_id: kat,
                jumlah: angka(jumlah),
                keterangan: ket,
                sumber,
                request_id: (requestId.current ??= crypto.randomUUID()),
              },
              reset,
            )
          }
          className="flex-1 rounded-xl bg-matur-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending
            ? "Menyimpan…"
            : awal && !baru
              ? "Simpan perubahan"
              : "+ Catat pengeluaran"}
        </button>
      </div>
    </fieldset>
  );
  if (awal) return body;
  return (
    <section className="rounded-2xl border border-matur-200 bg-white p-4">
      <h2 className="mb-3 font-bold">Catat pengeluaran</h2>
      {body}
    </section>
  );
}
