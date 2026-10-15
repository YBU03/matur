"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/format";
import {
  periksaKiriman,
  selesaikanKiriman,
  type Result,
} from "@/lib/operasional-actions";
import { BuktiOperasional } from "./bukti-operasional";
import type { Kiriman, ItemKiriman } from "@/lib/kiriman";
import type { Kop } from "@/lib/pdf-kop";
export type Shipment = Kiriman & {
  outlet_id: string;
  total_kirim: number;
  pemeriksaan_status: string;
  penyelesaian: string | null;
  kiriman_induk_id: string | null;
};
export type ReceiptRow = {
  id: string;
  penerima_nama: string;
  waktu: string;
  catatan: string | null;
  foto_path: string | null;
  items: { id: string; baik: number; rusak: number; salah: number }[];
};
export function KirimanOperasionalView({
  shipment: k,
  items,
  receipts,
  urls,
  gudang,
  bolehTerima,
  namaSaya,
  pt,
}: {
  shipment: Shipment;
  items: ItemKiriman[];
  receipts: ReceiptRow[];
  urls: Record<string, string>;
  gudang: boolean;
  bolehTerima: boolean;
  namaSaya: string;
  pt: Kop;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result>({});
  const [tab, setTab] = useState("surat");
  const [foto, setFoto] = useState("");
  const [note, setNote] = useState("");
  const [client, setClient] = useState(() => crypto.randomUUID());
  const [tindakan, setTindakan] = useState("susulan");
  const [retur, setRetur] = useState<Record<string, string>>({});
  const received = (id: string, part: "baik" | "rusak" | "salah") =>
    receipts.reduce(
      (s, r) => s + Number(r.items.find((i) => i.id === id)?.[part] ?? 0),
      0,
    );
  const sisa = (i: ItemKiriman) =>
    Math.max(
      0,
      i.qty -
        received(i.id, "baik") -
        received(i.id, "rusak") -
        received(i.id, "salah"),
    );
  const [nilai, setNilai] = useState<
    Record<string, { baik: string; rusak: string; salah: string }>
  >(() =>
    Object.fromEntries(
      items.map((i) => [i.id, { baik: "", rusak: "0", salah: "0" }]),
    ),
  );
  const call = (f: () => Promise<Result>) =>
    start(async () => {
      try {
        const r = await f();
        setMsg(r);
        if (!r.error) {
          setClient(crypto.randomUUID());
          router.refresh();
        }
      } catch {
        setMsg({ error: "Koneksi terputus; coba lagi dengan data yang sama." });
      }
    });
  const pdf = async (jenis: "surat-jalan" | "invoice") => {
    try {
      const { cetakDokumen } = await import(
        "@/app/(app)/gudang/kiriman/[id]/dokumen"
      );
      await cetakDokumen(jenis, k, items, pt);
    } catch {
      setMsg({ error: "PDF belum dapat dibuat." });
    }
  };
  const jumlahDiterima = items.reduce(
    (s, i) => s + Number(i.qty_diterima ?? 0) * i.harga,
    0,
  );
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-xl font-bold">{k.nomor}</h2>
        <p className="text-sm text-stone-500">
          {k.outlet?.nama} · {k.tanggal} · {k.status} · {k.pemeriksaan_status}
        </p>
        {k.kiriman_induk_id && (
          <p className="text-xs text-sky-700">
            Kiriman susulan dari pengiriman sebelumnya.
          </p>
        )}
        <nav className="my-3 flex flex-wrap gap-2">
          {[
            ["surat", "Surat Jalan"],
            ["invoice", "Invoice"],
            ["riwayat", "Pemeriksaan"],
          ].map(([id, l]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg border px-3 py-2 text-sm ${tab === id ? "bg-matur-100 font-bold" : ""}`}
            >
              {l}
            </button>
          ))}
        </nav>
        {tab !== "riwayat" ? (
          <>
            <p className="mb-2 text-xs text-stone-500">
              Pengirim: {k.pengirim ?? "—"} · Penerima terakhir:{" "}
              {k.nama_penerima ?? "Belum diperiksa"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-stone-500">
                    <th>Barang</th>
                    <th>Kirim</th>
                    <th>Baik diterima</th>
                    {tab === "invoice" && (
                      <>
                        <th>Harga</th>
                        <th>Nilai diterima</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="py-2">{i.nama}</td>
                      <td>
                        {i.qty} {i.satuan}
                      </td>
                      <td>{i.qty_diterima ?? 0}</td>
                      {tab === "invoice" && (
                        <>
                          <td>{formatRupiah(i.harga)}</td>
                          <td>
                            {formatRupiah(
                              Number(i.qty_diterima ?? 0) * i.harga,
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tab === "invoice" && (
              <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
                <p>
                  Nilai pengiriman:{" "}
                  <b>
                    {formatRupiah(
                      items.reduce((s, i) => s + i.qty * i.harga, 0),
                    )}
                  </b>
                </p>
                <p>
                  Nilai barang baik diterima:{" "}
                  <b>{formatRupiah(jumlahDiterima)}</b>
                </p>
                <p className="text-xs text-stone-500">
                  Nilai akhir mengikuti penerimaan dan penyelesaian selisih.
                  Susulan mempunyai dokumen terpisah.
                </p>
              </div>
            )}
            <button
              onClick={() => pdf(tab === "invoice" ? "invoice" : "surat-jalan")}
              className="mt-3 rounded-lg border px-3 py-2 text-sm"
            >
              Unduh {tab === "invoice" ? "Invoice" : "Surat Jalan"} PDF
            </button>
          </>
        ) : (
          <div className="space-y-3">
            {receipts.map((r) => (
              <article
                key={r.id}
                className="rounded-xl bg-stone-50 p-3 text-sm"
              >
                <b>{r.penerima_nama}</b>
                <p>
                  {new Date(r.waktu).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  WIB
                </p>
                <p>{r.catatan}</p>
                {r.items.map((x) => (
                  <p key={x.id} className="text-xs">
                    {items.find((i) => i.id === x.id)?.nama}: baik {x.baik},
                    rusak {x.rusak}, salah {x.salah}
                  </p>
                ))}
                {r.foto_path && urls[r.foto_path] && (
                  <a
                    href={urls[r.foto_path]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-matur-700 underline"
                  >
                    Lihat foto bukti
                  </a>
                )}
              </article>
            ))}
            {!receipts.length && (
              <p className="text-sm text-stone-500">
                Belum ada pemeriksaan digital. Penerimaan lama tetap tercatat di
                dokumen.
              </p>
            )}
          </div>
        )}
        {k.penyelesaian && (
          <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm">
            Penyelesaian: {k.penyelesaian}
          </p>
        )}
      </section>
      {msg.error || msg.ok ? (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      ) : null}
      {k.status === "dikirim" && bolehTerima && (
        <form
          className="space-y-3 rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            call(() =>
              periksaKiriman(
                k.id,
                client,
                items.map((i) => ({
                  id: i.id,
                  baik: Number(nilai[i.id].baik),
                  rusak: Number(nilai[i.id].rusak),
                  salah: Number(nilai[i.id].salah),
                })),
                note,
                foto,
              ),
            );
          }}
        >
          <h3 className="font-bold">Cek barang datang · {namaSaya}</h3>
          <p className="text-xs text-stone-500">
            Isi setiap baris, termasuk 0 bila belum datang. Sisa yang belum
            diperiksa tetap menunggu; foto wajib untuk barang rusak/salah.
          </p>
          {items.map((i) => (
            <fieldset key={i.id} className="rounded-xl bg-stone-50 p-3">
              <legend className="text-sm font-semibold">
                {i.nama} · belum diperiksa {sisa(i)} {i.satuan}
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["baik", "Baik"],
                    ["rusak", "Rusak"],
                    ["salah", "Salah barang"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-xs">
                    {label}
                    <input
                      required
                      type="number"
                      min="0"
                      max={sisa(i)}
                      step="0.001"
                      value={nilai[i.id][key]}
                      onChange={(e) =>
                        setNilai({
                          ...nilai,
                          [i.id]: { ...nilai[i.id], [key]: e.target.value },
                        })
                      }
                      className="mt-1 w-full rounded-lg border p-2"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <label className="block text-sm">
            Catatan selisih / barang belum datang
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <BuktiOperasional
            jenis="kiriman"
            outlet={k.outlet_id}
            label="Foto bukti pemeriksaan"
            onChange={setFoto}
          />
          <button
            disabled={pending}
            className="rounded-xl bg-matur-500 px-4 py-2 font-bold text-white disabled:opacity-40"
          >
            Simpan pemeriksaan
          </button>
        </form>
      )}
      {gudang &&
        k.status === "dikirim" &&
        k.pemeriksaan_status === "selisih" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                confirm(
                  "Selesaikan selisih? Jumlah retur hanya yang sudah tiba fisik di gudang.",
                )
              )
                call(() =>
                  selesaikanKiriman(
                    k.id,
                    tindakan,
                    items.map((i) => ({
                      id: i.id,
                      qty: Number(retur[i.id] ?? 0),
                    })),
                    note,
                  ),
                );
            }}
            className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4"
          >
            <h3 className="font-bold">Penyelesaian oleh Gudang</h3>
            <select
              value={tindakan}
              onChange={(e) => setTindakan(e.target.value)}
              className="w-full rounded-lg border bg-white p-2"
            >
              <option value="susulan">Buat draft kiriman susulan</option>
              <option value="koreksi">
                Koreksi invoice sesuai barang baik diterima
              </option>
            </select>
            <p className="text-xs">
              Isi jumlah bahan rusak yang SUDAH kembali fisik. Barang salah
              tidak otomatis menambah stok bahan asli; catat identitasnya untuk
              koreksi stok gudang sesuai barang sebenarnya.
            </p>
            {items
              .filter((i) => received(i.id, "rusak") > 0)
              .map((i) => (
                <label key={i.id} className="block text-sm">
                  {i.nama} · rusak tercatat {received(i.id, "rusak")}
                  <input
                    type="number"
                    min="0"
                    max={received(i.id, "rusak")}
                    step="0.001"
                    value={retur[i.id] ?? "0"}
                    onChange={(e) =>
                      setRetur({ ...retur, [i.id]: e.target.value })
                    }
                    className="ml-2 w-28 rounded-lg border p-2"
                  />
                </label>
              ))}
            <textarea
              required
              minLength={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Alasan, tindak lanjut dan barang tidak kembali/ditangani sebagai waste"
              className="w-full rounded-lg border p-2"
            />
            <button
              disabled={pending}
              className="rounded-xl bg-kopi-900 px-4 py-2 font-bold text-white"
            >
              Selesaikan selisih
            </button>
          </form>
        )}
    </div>
  );
}
