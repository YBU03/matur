"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./confirm-edit";
import { revisiAktual } from "@/lib/accounting-operasional-actions";
import { formatRupiah as uang } from "@/lib/format";
const formatRupiah = (nilai: number) => (nilai === 0 ? "Rp0" : uang(nilai));
export type RevisiKas = {
  id: string;
  sesi_id: string;
  lama: number | null;
  baru: number;
  alasan: string;
  nama: string;
  created_at: string;
};
export function RevisiAktualKas({
  sesi,
  riwayat,
  inline = false,
  onSaved,
}: {
  sesi: {
    id: string;
    pos_tim?: boolean;
    fisik_akhir?: number | null;
    setoran: number | null;
    modal_laci: number;
    seharusnya?: number | null;
  };
  riwayat: RevisiKas[];
  inline?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const awal = sesi.pos_tim ? (sesi.fisik_akhir ?? null) : sesi.setoran;
  const [buka, setBuka] = useState(false);
  const [nilai, setNilai] = useState(String(awal ?? ""));
  const [alasan, setAlasan] = useState("");
  const [pesan, setPesan] = useState("");
  const [pending, start] = useTransition();
  const Panel = inline ? "div" : Modal;
  return (
    <>
      <button
        type="button"
        className="ml-2 rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800"
        onClick={() => {
          setNilai(String(awal ?? ""));
          setBuka(true);
        }}
      >
        Revisi aktual
      </button>
      {riwayat.length > 0 && (
        <details className="mt-1 text-xs text-stone-600">
          <summary>Riwayat revisi ({riwayat.length})</summary>
          {riwayat.map((r) => (
            <p key={r.id} className="py-1">
              {new Date(r.created_at).toLocaleString("id-ID")} · {r.nama}:{" "}
              {r.lama === null ? "Belum dihitung" : formatRupiah(r.lama)} →{" "}
              {formatRupiah(r.baru)} · {r.alasan}
            </p>
          ))}
        </details>
      )}
      {buka && (
        <Panel
          title="Revisi aktual kas"
          {...(!inline ? { scrollable: true } : {})}
          {...(!inline ? { onClose: () => !pending && setBuka(false) } : {})}
        >
          <p className="text-sm">
            {sesi.pos_tim
              ? "Isi uang fisik di laci termasuk modal. Setoran dihitung setelah dikurangi modal."
              : "Isi nominal setoran aktual."}{" "}
            Angka sebelumnya:{" "}
            {awal === null ? "belum dihitung" : formatRupiah(awal)}.
          </p>
          <div className="rounded-lg bg-stone-50 p-2 text-xs">
            <p>Modal tetap di laci: {formatRupiah(sesi.modal_laci)}.</p>
            <p>
              Setoran seharusnya tercatat:{" "}
              {sesi.seharusnya == null
                ? "belum dihitung"
                : formatRupiah(sesi.seharusnya)}
              .
            </p>
            {nilai !== "" && (
              <p>
                Setoran setelah revisi:{" "}
                {formatRupiah(
                  Number(nilai) - (sesi.pos_tim ? sesi.modal_laci : 0),
                )}
                .
              </p>
            )}
            {nilai !== "" && sesi.seharusnya != null && (
              <p>
                Selisih setelah revisi:{" "}
                {formatRupiah(
                  Number(nilai) -
                    (sesi.pos_tim ? sesi.modal_laci : 0) -
                    sesi.seharusnya,
                )}
                . Selisih hanya menjadi Rp0 jika uang aktual sesuai uang
                seharusnya.
              </p>
            )}
            <p>
              Jika pengeluaran salah tanggal/shift, gunakan “Periksa &
              rekonsiliasi kas”. Mengubah uang aktual saja tidak memperbaiki
              hubungan pengeluaran.
            </p>
          </div>
          <label className="block text-sm">
            {sesi.pos_tim
              ? "Uang fisik termasuk modal (Rp)"
              : "Setoran aktual (Rp)"}
            <input
              type="number"
              min="0"
              max="1000000000000"
              step="1"
              value={nilai}
              onChange={(e) => setNilai(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2"
              disabled={pending}
            />
          </label>
          <label className="block text-sm">
            Alasan revisi (wajib)
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              maxLength={500}
              className="mt-1 w-full rounded-lg border p-2"
              disabled={pending}
            />
          </label>
          {pesan && (
            <p role="alert" className="text-sm text-red-700">
              {pesan}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setBuka(false)}
              className="rounded-lg border px-3 py-2"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={
                pending ||
                nilai === "" ||
                !Number.isSafeInteger(Number(nilai)) ||
                Number(nilai) < 0 ||
                alasan.trim().length < 3
              }
              className="rounded-lg bg-matur-500 px-3 py-2 text-white disabled:opacity-50"
              onClick={() =>
                start(async () => {
                  try {
                    const r = await revisiAktual({
                      sesi_id: sesi.id,
                      aktual: Number(nilai),
                      sebelum: awal,
                      alasan,
                    });
                    if (r.error) setPesan(r.error);
                    else {
                      setBuka(false);
                      setAlasan("");
                      onSaved?.();
                      router.refresh();
                    }
                  } catch {
                    setPesan(
                      "Koneksi terputus. Muat ulang untuk memeriksa hasil sebelum mencoba lagi.",
                    );
                  }
                })
              }
            >
              {pending ? "Menyimpan…" : "Simpan revisi"}
            </button>
          </div>
        </Panel>
      )}
    </>
  );
}
