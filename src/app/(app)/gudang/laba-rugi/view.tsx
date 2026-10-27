"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ringkasGudang, type GudangLaporan } from "@/lib/gudang-laporan";
import { formatRupiah as rp } from "@/lib/format";
import { gudangRpc } from "@/lib/gudang-revisi-actions";
export function LabaGudang({
  data: d,
  awal,
  akhir,
  outlet,
  bahan,
  outlets,
  boleh,
}: {
  data: GudangLaporan;
  awal: string;
  akhir: string;
  outlet: string;
  bahan: string;
  outlets: { id: string; nama: string }[];
  boleh: boolean;
}) {
  const r = ringkasGudang(d),
    router = useRouter();
  const [busy, start] = useTransition(),
    [msg, setMsg] = useState("");
  const req = useRef<string | null>(null);
  function csv() {
    const rows = [
      ["Laba Rugi Gudang", awal, akhir],
      [
        "Tanggal",
        "Kiriman",
        "Outlet",
        "Kepemilikan",
        "Bahan",
        "Qty",
        "Harga jual",
        "HPP per kemasan",
        "Penjualan",
        "Margin diketahui",
      ],
      ...d.rows.map((x) => [
        x.waktu,
        x.nomor,
        x.outlet,
        x.kepemilikan,
        x.nama,
        x.qty,
        x.harga,
        x.hpp_gudang ?? "Belum tersedia",
        Number(x.qty) * Number(x.harga),
        x.hpp_gudang === null
          ? "Belum lengkap"
          : Number(x.qty) * (Number(x.harga) - Number(x.hpp_gudang)),
      ]),
      [],
      ["Penjualan", r.penjualan],
      ["Penjualan HPP belum lengkap", r.penjualanBelum],
      ["HPP diketahui", r.hpp],
      ["Laba kotor diketahui", r.labaKotor],
      ["Biaya", r.biaya],
      ["Penyesuaian invoice", r.invoice],
      ["Penyesuaian stok diketahui", r.penyesuaian],
      ["Laba rugi diketahui", r.laba],
      [],
      [
        "Penyesuaian invoice",
        "Tanggal",
        "Kiriman",
        "Outlet",
        "Nilai",
        "Keterangan",
      ],
      ...(d.invoice ?? []).map((x) => [
        "",
        x.tanggal,
        x.nomor,
        x.outlet,
        x.nilai,
        x.keterangan,
      ]),
      [],
      ["Biaya operasional", "Tanggal", "Nominal", "Keterangan"],
      ...d.biaya.map((b) => ["", b.tanggal, b.jumlah, b.keterangan]),
    ];
    const safe = (v: unknown) => {
      let s = String(v ?? "");
      if (typeof v === "string" && /^[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((row) => row.map(safe).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laba Gudang ${awal} ${akhir}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      {!!d.invoice?.length && (
        <section className="rounded-xl border bg-white p-4 text-sm">
          <h2 className="font-bold">Penyesuaian invoice</h2>
          <p className="text-xs text-stone-500">
            Dihitung sekali per invoice di periode penerimaan selesai; tidak
            dialokasikan saat filter bahan. Koreksi akan memperbarui laporan
            periode invoice tersebut.
          </p>
          {d.invoice.map((x) => (
            <p key={x.id} className="mt-2 border-t pt-2">
              {x.nomor} · {x.outlet} · <b>{rp(Number(x.nilai))}</b> ·{" "}
              {x.keterangan}
            </p>
          ))}
        </section>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Penjualan diterima", r.penjualan],
          ["HPP diketahui", r.hpp],
          ["Laba kotor diketahui", r.labaKotor],
          ["Biaya operasional", r.biaya],
          ["Penyesuaian invoice", r.invoice],
          ["Penyesuaian stok diketahui", r.penyesuaian],
          [
            bahan
              ? "Margin bahan setelah penyesuaian"
              : outlet
                ? "Kontribusi outlet sebelum biaya umum"
                : "Laba/rugi gudang diketahui",
            r.laba,
          ],
          ["Termasuk penjualan internal Pusat", r.pusat],
          ["Penjualan HPP belum lengkap", r.penjualanBelum],
        ].map(([l, n]) => (
          <article key={l} className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-stone-500">{l}</p>
            <b className={Number(n) < 0 ? "text-red-700" : ""}>
              {rp(Number(n))}
            </b>
          </article>
        ))}
      </div>
      {r.belum > 0 && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm">
          {r.belum} baris belum memiliki HPP historis. Laba yang ditampilkan
          baru bagian dengan HPP lengkap; data lama tidak dihitung menggunakan
          harga bahan terbaru.
        </p>
      )}
      {(outlet || bahan) && (
        <p className="text-sm text-stone-600">
          {bahan
            ? "Filter bahan menampilkan margin dan penyesuaian bahan saja; biaya operasional belum dialokasikan."
            : "Filter outlet hanya memasukkan biaya yang ditandai untuk outlet tersebut. Biaya umum dan penyesuaian persediaan gudang tidak dialokasikan."}
        </p>
      )}
      <p className="text-xs text-stone-500">
        Penjualan internal Pusat dipisahkan untuk analisis. Jangan menjumlahkan
        margin internal ini lagi ke laba konsolidasi perusahaan. Pembelian
        persediaan tidak langsung menjadi beban seluruhnya.
      </p>
      <div className="flex gap-2 print:hidden">
        <button
          onClick={csv}
          className="rounded-xl border bg-white px-4 py-2 text-sm"
        >
          Unduh CSV
        </button>
        <button
          onClick={async () => {
            try {
              const { buatLabaPDF } = await import("@/lib/gudang-laporan-pdf");
              const { unduh } = await import("@/lib/pdf-kop");
              unduh(
                buatLabaPDF(
                  d,
                  awal,
                  akhir,
                  bahan
                    ? "Filter bahan"
                    : outlet
                      ? "Filter outlet"
                      : "Semua outlet",
                ),
                "Laba Rugi Gudang " + awal + " " + akhir,
              );
            } catch {
              setMsg("PDF belum dapat dibuat. Coba lagi.");
            }
          }}
          className="rounded-xl border bg-white px-4 py-2 text-sm"
        >
          Cetak / PDF
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-white p-4">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="text-left">
              <th>Tanggal</th>
              <th>Kiriman / Outlet</th>
              <th>Bahan</th>
              <th>Qty</th>
              <th>Penjualan</th>
              <th>HPP</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((x, i) => (
              <tr key={i} className="border-t">
                <td className="py-2">
                  {new Date(x.waktu).toLocaleDateString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}
                </td>
                <td>
                  <Link
                    className="underline"
                    href={
                      "/operasional/kiriman?outlet=" +
                      x.outlet_id +
                      "&id=" +
                      x.id
                    }
                  >
                    {x.nomor}
                  </Link>
                  <small className="block">
                    {x.outlet} · {x.kepemilikan}
                  </small>
                </td>
                <td>{x.nama}</td>
                <td>{Number(x.qty)}</td>
                <td>{rp(Number(x.qty) * Number(x.harga))}</td>
                <td>
                  {x.hpp_gudang === null
                    ? "Belum tersedia"
                    : rp(Number(x.qty) * Number(x.hpp_gudang))}
                </td>
                <td>
                  {x.hpp_gudang === null
                    ? "Belum lengkap"
                    : rp(
                        Number(x.qty) *
                          (Number(x.harga) - Number(x.hpp_gudang)),
                      )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.rows.length && (
          <p className="py-4 text-sm text-stone-500">
            Belum ada penerimaan barang pada periode ini.
          </p>
        )}
      </div>
      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <h2 className="font-bold">Biaya operasional gudang</h2>
        <p className="text-xs text-stone-500">
          Catat sekali saja. Biaya ini masuk laporan gudang; tidak otomatis
          membuat pembayaran bank atau menyalin biaya outlet.
        </p>
        {boleh && (
          <form
            className="flex flex-wrap items-end gap-2 print:hidden"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              start(async () => {
                try {
                  req.current ??= crypto.randomUUID();
                  const result = await gudangRpc("proses_biaya_gudang", {
                    p: {
                      aksi: "tambah",
                      request_id: req.current,
                      tanggal: f.get("tanggal"),
                      jumlah: Number(f.get("jumlah")),
                      keterangan: f.get("keterangan"),
                      outlet_id: f.get("outlet") || null,
                    },
                  });
                  if (result.error) setMsg(result.error);
                  else {
                    req.current = null;
                    form.reset();
                    router.refresh();
                  }
                } catch {
                  setMsg(
                    "Belum ada konfirmasi server. Coba kembali dengan data yang sama.",
                  );
                }
              });
            }}
          >
            <label className="text-sm">
              Tanggal
              <input
                type="date"
                name="tanggal"
                required
                defaultValue={akhir}
                className="mt-1 block rounded-lg border p-2"
              />
            </label>
            <label className="text-sm">
              Nominal
              <input
                type="number"
                name="jumlah"
                required
                min="1"
                max="1000000000000"
                step="1"
                className="mt-1 block w-40 rounded-lg border p-2"
              />
            </label>
            <label className="text-sm">
              Keterangan
              <input
                name="keterangan"
                minLength={3}
                maxLength={500}
                required
                className="mt-1 block rounded-lg border p-2"
              />
            </label>
            <label className="text-sm">
              Alokasi
              <select
                name="outlet"
                defaultValue={outlet}
                className="mt-1 block max-w-52 rounded-lg border p-2"
              >
                <option value="">Biaya umum gudang</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nama}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy}
              className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
            >
              {busy ? "Menyimpan…" : "Simpan biaya"}
            </button>
          </form>
        )}
        {msg && (
          <p role="status" className="text-sm text-red-700">
            {msg}
          </p>
        )}
        {d.biaya.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap justify-between gap-2 border-t py-2 text-sm"
          >
            <p>
              {b.tanggal} · {b.keterangan} · <b>{rp(Number(b.jumlah))}</b>
            </p>
            {boleh && (
              <button
                disabled={busy}
                className="text-red-700 underline print:hidden"
                onClick={() => {
                  const alasan = window.prompt(
                    "Alasan membatalkan biaya ini (riwayat tetap disimpan):",
                  );
                  if (!alasan) return;
                  start(async () => {
                    try {
                      const result = await gudangRpc("proses_biaya_gudang", {
                        p: { aksi: "batal", id: b.id, alasan },
                      });
                      if (result.error) setMsg(result.error);
                      else router.refresh();
                    } catch {
                      setMsg(
                        "Pembatalan belum dikonfirmasi. Muat ulang status.",
                      );
                    }
                  });
                }}
              >
                Batalkan
              </button>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
