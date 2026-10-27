"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./confirm-edit";
import { gudangRpc } from "@/lib/gudang-revisi-actions";
import { formatRupiah as rp } from "@/lib/format";
export function HargaGudang({
  id,
  nama,
  satuan,
  harga,
  beli,
}: {
  id: string;
  nama: string;
  satuan: string;
  harga: number | null;
  beli: number;
}) {
  const [open, setOpen] = useState(false),
    [nilai, setNilai] = useState(String(harga ?? beli)),
    [review, setReview] = useState(false),
    [error, setError] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        className="text-matur-700 underline"
        onClick={() => {
          setOpen(true);
          setReview(false);
          setError("");
          setNilai(String(harga ?? beli));
        }}
      >
        Edit harga
      </button>
      {open && (
        <Modal
          title={"Harga jual · " + nama}
          onClose={busy ? undefined : () => setOpen(false)}
        >
          <form
            className="space-y-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (!review) {
                setReview(true);
                return;
              }
              start(async () => {
                try {
                  const r = await gudangRpc("atur_harga_jual_gudang", {
                    p_bahan: id,
                    p_harga: Number(nilai),
                    p_lama: harga,
                  });
                  if (r.error) setError(r.error);
                  else {
                    setOpen(false);
                    router.refresh();
                  }
                } catch {
                  setError("Belum tersimpan. Periksa koneksi lalu coba lagi.");
                }
              });
            }}
          >
            <p>
              Harga beli {rp(beli)} / {satuan}
            </p>
            <label className="block">
              Harga jual / {satuan}
              <input
                type="number"
                min="0"
                max="1000000000000"
                step="1"
                required
                value={nilai}
                onChange={(e) => {
                  setNilai(e.target.value);
                  setReview(false);
                }}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <p>
              Margin per {satuan}: <b>{rp(Number(nilai) - beli)}</b>
            </p>
            {review && (
              <p className="rounded-xl bg-amber-50 p-3">
                Simpan harga jual {rp(Number(nilai))}? Harga pada
                kiriman/invoice yang sudah dibuat tetap sama. Harga baru
                digunakan saat menambahkan barang ke kiriman berikutnya.
              </p>
            )}
            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
            >
              {busy
                ? "Menyimpan…"
                : review
                  ? "Ya, simpan harga"
                  : "Periksa perubahan"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
