"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gudangRpc } from "@/lib/gudang-revisi-actions";
import { formatRupiah as rp } from "@/lib/format";
import { Modal } from "@/components/confirm-edit";
export type DraftGudang = {
  id: string;
  tanggal: string;
  status: string;
  versi: number;
  catatan: string;
  nama_petugas: string;
  created_at: string;
  final_at: string | null;
};
export type HitungGudang = {
  bahan_id: string;
  nama: string;
  satuan: string;
  sistem: number;
  fisik: number | null;
  hpp: number | null;
  alasan: string;
};
export function OpnameGudang({
  draft: d,
  items,
  list,
  boleh,
}: {
  draft: DraftGudang | null;
  items: HitungGudang[];
  list: DraftGudang[];
  boleh: boolean;
}) {
  const router = useRouter();
  const request = useRef<string | null>(null);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState(""),
    [tanggal, setTanggal] = useState(
      new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
    ),
    [rows, setRows] = useState(
      items.map((i) => ({ ...i, isi: i.fisik == null ? "" : String(i.fisik) })),
    ),
    [catatan, setCatatan] = useState(d?.catatan ?? ""),
    [cari, setCari] = useState(""),
    [dirty, setDirty] = useState(false),
    [review, setReview] = useState(false);
  const counted = rows.filter((r) => r.isi !== "");
  const total = counted.reduce(
    (n, r) => n + (Number(r.isi) - Number(r.sistem)) * Number(r.hpp ?? 0),
    0,
  );
  const run = (aksi: string) =>
    start(async () => {
      try {
        request.current ??= crypto.randomUUID();
        const p =
          aksi === "buat"
            ? { aksi, request_id: request.current, tanggal }
            : {
                aksi,
                id: d!.id,
                versi: d!.versi,
                catatan,
                items: rows.map((r) => ({
                  bahan_id: r.bahan_id,
                  fisik: r.isi === "" ? null : Number(r.isi),
                  alasan: r.alasan,
                })),
              };
        const r = await gudangRpc("proses_opname_gudang", { p });
        if (r.error) setMsg(r.error);
        else {
          setDirty(false);
          setReview(false);
          request.current = null;
          if (aksi === "buat") router.push("/gudang/opname?id=" + r.id);
          else router.refresh();
        }
      } catch {
        setMsg(
          "Belum ada konfirmasi server. Isian tetap tersedia; coba lagi dengan data yang sama.",
        );
      }
    });
  return (
    <>
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-white p-4">
        {boleh && (
          <>
            <label className="text-sm">
              Tanggal opname
              <input
                type="date"
                required
                max={new Date(Date.now() + 7 * 3600000)
                  .toISOString()
                  .slice(0, 10)}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="ml-2 rounded-lg border p-2"
              />
            </label>
            <button
              disabled={busy || !tanggal || dirty}
              onClick={() => run("buat")}
              className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
            >
              {busy ? "Memproses…" : "+ Buat draft opname"}
            </button>
          </>
        )}
        {d && (
          <button
            className="rounded-xl border px-4 py-2"
            disabled={dirty}
            onClick={async () => {
              try {
                const { buatOpnamePDF } = await import(
                  "@/lib/gudang-laporan-pdf"
                );
                const { unduh } = await import("@/lib/pdf-kop");
                unduh(buatOpnamePDF(d, items), "Opname Gudang " + d.tanggal);
              } catch {
                setMsg("PDF belum dapat dibuat. Coba lagi.");
              }
            }}
          >
            Cetak hasil / PDF
          </button>
        )}
      </div>
      {msg && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">
          {msg}
        </p>
      )}
      {d && (
        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <h2 className="font-bold">
            {d.tanggal} · {d.status.toUpperCase()} · {d.nama_petugas}
          </h2>
          <p className="text-sm">
            {counted.length} bahan dihitung · Nilai selisih diketahui{" "}
            {rp(total)}
            {counted.some((r) => r.hpp == null)
              ? " · Ada HPP belum lengkap"
              : ""}
          </p>
          <input
            aria-label="Cari bahan opname"
            placeholder="Cari bahan…"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            className="w-full rounded-xl border p-2 print:hidden"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="text-left">
                  <th>Bahan / satuan</th>
                  <th>Sistem</th>
                  <th>Fisik</th>
                  <th>Selisih</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) =>
                    r.nama.toLowerCase().includes(cari.toLowerCase()),
                  )
                  .map((r) => (
                    <tr key={r.bahan_id} className="border-t">
                      <td className="py-2">
                        {r.nama}
                        <small className="block text-stone-500">
                          {r.satuan}
                        </small>
                      </td>
                      <td>{Number(r.sistem).toLocaleString("id-ID")}</td>
                      <td>
                        {boleh && d.status === "draft" ? (
                          <input
                            aria-label={"Fisik " + r.nama}
                            type="number"
                            min="0"
                            step="0.001"
                            value={r.isi}
                            onChange={(e) => {
                              setDirty(true);
                              setRows(
                                rows.map((x) =>
                                  x.bahan_id === r.bahan_id
                                    ? { ...x, isi: e.target.value }
                                    : x,
                                ),
                              );
                            }}
                            placeholder="Belum dihitung"
                            className="w-36 rounded-lg border p-2"
                          />
                        ) : (
                          r.isi || "Belum dihitung"
                        )}
                      </td>
                      <td
                        className={
                          r.isi !== "" && Number(r.isi) !== Number(r.sistem)
                            ? "font-semibold text-red-700"
                            : "text-green-700"
                        }
                      >
                        {r.isi === ""
                          ? "—"
                          : (Number(r.isi) - Number(r.sistem)).toLocaleString(
                              "id-ID",
                            )}
                      </td>
                      <td>
                        {boleh && d.status === "draft" ? (
                          <input
                            aria-label={"Alasan " + r.nama}
                            value={r.alasan}
                            maxLength={500}
                            onChange={(e) => {
                              setDirty(true);
                              setRows(
                                rows.map((x) =>
                                  x.bahan_id === r.bahan_id
                                    ? { ...x, alasan: e.target.value }
                                    : x,
                                ),
                              );
                            }}
                            className="rounded-lg border p-2"
                          />
                        ) : (
                          r.alasan || "—"
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <label className="block text-sm">
            Catatan
            <textarea
              disabled={!boleh || d.status !== "draft"}
              value={catatan}
              onChange={(e) => {
                setDirty(true);
                setCatatan(e.target.value);
              }}
              maxLength={2000}
              className="mt-1 w-full rounded-xl border p-3"
            />
          </label>
          {boleh && d.status === "draft" && (
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                disabled={busy}
                onClick={() => run("simpan")}
                className="rounded-xl border px-4 py-2"
              >
                Simpan draft
              </button>
              <button
                disabled={busy || dirty || !counted.length}
                onClick={() => setReview(true)}
                className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
              >
                Periksa & finalisasi
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Batalkan draft opname ini? Stok tidak berubah.",
                    )
                  )
                    run("batal");
                }}
                className="rounded-xl border px-4 py-2 text-red-700"
              >
                Batalkan draft
              </button>
              {dirty && (
                <p className="w-full text-xs text-amber-800">
                  Simpan draft sebelum finalisasi. Draft belum mengubah stok
                  gudang.
                </p>
              )}
            </div>
          )}
        </section>
      )}
      {review && (
        <Modal
          title="Konfirmasi opname gudang"
          onClose={busy ? undefined : () => setReview(false)}
        >
          <div className="space-y-3 text-sm">
            <p>
              Sesuaikan stok gudang untuk {counted.length} bahan yang sudah
              dihitung? Bahan yang kosong tetap tidak berubah.
            </p>
            <p>
              Nilai selisih diketahui: <b>{rp(total)}</b>. Jika stok bergerak
              sejak draft dibuat, sistem meminta penghitungan ulang.
            </p>
            <button
              disabled={busy}
              onClick={() => run("final")}
              className="rounded-xl bg-kopi-900 px-4 py-3 text-white"
            >
              {busy ? "Memeriksa stok…" : "Ya, finalisasi opname"}
            </button>
            {msg && <p role="alert">{msg}</p>}
          </div>
        </Modal>
      )}
      <section className="space-y-2 print:hidden">
        <h2 className="font-bold">Riwayat opname gudang</h2>
        {!list.length && <p className="text-sm">Belum ada opname gudang.</p>}
        {list.map((x) => (
          <Link
            key={x.id}
            href={"/gudang/opname?id=" + x.id}
            onClick={(e) => {
              if (
                dirty &&
                !window.confirm("Tinggalkan isian yang belum disimpan?")
              )
                e.preventDefault();
            }}
            className="block rounded-xl border bg-white p-3 text-sm"
          >
            {x.tanggal} · {x.status} · {x.nama_petugas}
          </Link>
        ))}
      </section>
    </>
  );
}
