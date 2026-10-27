"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gudangRpc } from "@/lib/gudang-revisi-actions";
import { ringkasInvoice } from "@/lib/gudang-invoice";
import type { Kiriman, ItemKiriman } from "@/lib/kiriman";
import { formatRupiah as formatRp } from "@/lib/format";
const rp = (n: number) => (n === 0 ? "Rp 0" : formatRp(n));
export function PenyesuaianInvoice({
  k,
  items,
}: {
  k: Kiriman;
  items: ItemKiriman[];
}) {
  const r = ringkasInvoice(k, items),
    router = useRouter();
  const [arah, setArah] = useState(r.penyesuaian < 0 ? "kurang" : "tambah"),
    [nilai, setNilai] = useState(String(Math.abs(r.penyesuaian))),
    [note, setNote] = useState(k.penyesuaian?.keterangan ?? ""),
    [review, setReview] = useState(false),
    [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const nominal = Number(nilai) * (arah === "kurang" ? -1 : 1),
    total = r.barang + nominal;
  const siap = k.status === "diterima" && k.pemeriksaan_status === "selesai";
  return (
    <section className="my-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <h3 className="font-bold">Penyesuaian invoice</h3>
      <p>
        Nilai barang {rp(r.barang)} · Penyesuaian {rp(r.penyesuaian)} ·{" "}
        <b>Total invoice {rp(r.total)}</b>
      </p>
      {!siap ? (
        <p>
          Selesaikan pemeriksaan penerimaan barang terlebih dahulu. Penyesuaian
          tidak mengubah stok atau harga barang.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !Number.isSafeInteger(nominal) ||
              Math.abs(nominal) > 1e12 ||
              total < 0
            ) {
              setMsg("Nilai tidak valid atau total invoice menjadi negatif.");
              return;
            }
            if (!review) {
              setReview(true);
              setMsg("");
              return;
            }
            start(async () => {
              try {
                const a = await gudangRpc("atur_penyesuaian_invoice", {
                  p_id: k.id,
                  p_nilai: nominal,
                  p_keterangan: note,
                  p_versi: k.penyesuaian?.versi ?? 0,
                });
                setMsg(
                  a.error ?? "Penyesuaian tersimpan. Unduh ulang PDF invoice.",
                );
                if (!a.error) {
                  setReview(false);
                  router.refresh();
                }
              } catch {
                setMsg("Belum tersimpan. Periksa koneksi.");
              }
            });
          }}
        >
          <div className="flex flex-wrap gap-3">
            <label>
              Jenis
              <select
                disabled={busy || review}
                value={arah}
                onChange={(e) => setArah(e.target.value)}
                className="mt-1 block rounded-lg border bg-white p-2"
              >
                <option value="tambah">Tambah (+)</option>
                <option value="kurang">Kurang (-)</option>
              </select>
            </label>
            <label>
              Nominal (Rp)
              <input
                type="number"
                value={nilai}
                onChange={(e) => setNilai(e.target.value)}
                min={0}
                max={1e12}
                step={1}
                required
                disabled={busy || review}
                className="mt-1 block w-44 rounded-lg border bg-white p-2"
              />
            </label>
          </div>
          <label className="block">
            Keterangan / alasan
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required={nominal !== 0}
              minLength={nominal !== 0 ? 3 : 0}
              maxLength={500}
              disabled={busy || review}
              className="mt-1 block w-full rounded-lg border bg-white p-2"
              placeholder="Contoh: pembulatan invoice"
            />
          </label>
          <p>
            Pratinjau total:{" "}
            <b>
              {rp(r.barang)} {nominal < 0 ? "−" : "+"} {rp(Math.abs(nominal))} ={" "}
              {rp(total)}
            </b>
          </p>
          {review && (
            <p className="font-semibold">
              Periksa nilai dan alasan di atas sebelum menyimpan. Riwayat
              perubahan dicatat.
            </p>
          )}
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="rounded-lg bg-stone-800 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {busy
                ? "Menyimpan…"
                : review
                  ? "Konfirmasi & simpan"
                  : "Periksa penyesuaian"}
            </button>
            {review && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setReview(false)}
                className="rounded-lg border px-3 py-2"
              >
                Kembali edit
              </button>
            )}
          </div>
        </form>
      )}
      {msg && (
        <p role="status" className="rounded-lg bg-white p-2">
          {msg}
        </p>
      )}
    </section>
  );
}
