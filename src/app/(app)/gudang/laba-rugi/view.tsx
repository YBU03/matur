"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ringkasGudang, type GudangLaporan } from "@/lib/gudang-laporan";
import { formatRupiah as rp, formatTanggal } from "@/lib/format";
import { gudangRpc } from "@/lib/gudang-revisi-actions";
import {
  Badge,
  ChipHeader,
  HeaderHalaman,
  Kosong,
  tombolHeader,
  tombolHeaderUtama,
} from "@/components/ui-halaman";

const isian =
  "mt-0.5 block w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm text-kopi-900 outline-none focus:border-matur-500";
const geser = (iso: string, hari: number) =>
  new Date(Date.parse(iso + "T00:00:00Z") + hari * 86400000)
    .toISOString()
    .slice(0, 10);

export function LabaGudang({
  data: d,
  error,
  awal,
  akhir,
  hari,
  outlet,
  bahan,
  outlets,
  daftarBahan,
  boleh,
}: {
  data: GudangLaporan | null;
  error: string;
  awal: string;
  akhir: string;
  hari: string;
  outlet: string;
  bahan: string;
  outlets: { id: string; nama: string }[];
  daftarBahan: { id: string; nama: string }[];
  boleh: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition(),
    [msg, setMsg] = useState(""),
    [formBiaya, setFormBiaya] = useState(false),
    [unduh, setUnduh] = useState("");
  const req = useRef<string | null>(null);
  const namaOutlet = Object.fromEntries(outlets.map((o) => [o.id, o.nama]));
  const namaBahan = daftarBahan.find((b) => b.id === bahan)?.nama;
  const filterLabel = bahan
    ? "Bahan: " + (namaBahan ?? "-")
    : outlet
      ? "Outlet: " + (namaOutlet[outlet] ?? "-")
      : "Semua outlet";

  // pilihan cepat periode (tanggal WIB)
  const awalBulan = hari.slice(0, 7) + "-01";
  const akhirBulanLalu = geser(awalBulan, -1);
  const preset: [string, string, string][] = [
    ["Bulan ini", awalBulan, hari],
    ["Bulan lalu", akhirBulanLalu.slice(0, 7) + "-01", akhirBulanLalu],
    ["7 hari", geser(hari, -6), hari],
    ["30 hari", geser(hari, -29), hari],
  ];
  const href = (a: string, b: string) =>
    "/gudang/laba-rugi?" +
    new URLSearchParams({
      awal: a,
      akhir: b,
      ...(outlet && { outlet }),
      ...(bahan && { bahan }),
    });

  const ekspor = async (jenis: "pdf" | "excel") => {
    if (!d) return;
    setUnduh(jenis);
    const nama = "Laba Rugi Gudang " + awal + " " + akhir;
    try {
      if (jenis === "pdf") {
        const [{ buatLabaPDF }, { unduh }] = await Promise.all([
          import("@/lib/gudang-laporan-pdf"),
          import("@/lib/pdf-kop"),
        ]);
        unduh(buatLabaPDF(d, awal, akhir, filterLabel), nama);
      } else {
        const { buatLabaExcel, unduhExcel } = await import(
          "@/lib/gudang-laporan-excel"
        );
        await unduhExcel(
          await buatLabaExcel(d, awal, akhir, filterLabel, namaOutlet),
          nama,
        );
      }
    } catch {
      setMsg("File belum dapat dibuat. Coba lagi.");
    } finally {
      setUnduh("");
    }
  };

  const r = d ? ringkasGudang(d) : null;
  const labelLaba = bahan
    ? "Margin bahan setelah penyesuaian"
    : outlet
      ? "Kontribusi outlet sebelum biaya umum"
      : "Laba / rugi gudang diketahui";
  const persen =
    r && r.penjualan ? Math.round((r.laba / r.penjualan) * 1000) / 10 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-4">
      <Link
        href="/gudang/stok"
        className="inline-flex text-sm font-semibold text-matur-700 hover:underline"
      >
        ← Stok Gudang
      </Link>
      <HeaderHalaman
        ikon="📊"
        judul="Laba Rugi Gudang"
        keterangan="Dari barang baik yang diterima outlet. HPP dikunci saat pengiriman. Laporan manajemen gudang, bukan laba gabungan perusahaan."
        aksi={
          d && (
            <>
              <button
                disabled={!!unduh}
                onClick={() => ekspor("excel")}
                className={tombolHeaderUtama + " disabled:opacity-60"}
              >
                {unduh === "excel" ? "Menyiapkan…" : "⬇ Excel"}
              </button>
              <button
                disabled={!!unduh}
                onClick={() => ekspor("pdf")}
                className={tombolHeader + " disabled:opacity-60"}
              >
                {unduh === "pdf" ? "Menyiapkan…" : "⬇ PDF"}
              </button>
            </>
          )
        }
      >
        <ChipHeader>
          📅 {formatTanggal(awal)} – {formatTanggal(akhir)}
        </ChipHeader>
        <ChipHeader>
          {bahan ? "🧺 " : "🏪 "}
          {filterLabel}
        </ChipHeader>
      </HeaderHalaman>

      <form className="space-y-3 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex gap-1.5 overflow-x-auto text-xs font-semibold">
          {preset.map(([l, a, b]) => (
            <Link
              key={l}
              href={href(a, b)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 ${awal === a && akhir === b ? "border-kopi-900 bg-kopi-900 text-white" : "border-matur-200 text-kopi-800 hover:bg-matur-50"}`}
            >
              {l}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.3fr_1.3fr_auto] sm:items-end">
          <label className="text-xs text-stone-500">
            Dari
            <input
              type="date"
              required
              name="awal"
              defaultValue={awal}
              className={isian}
            />
          </label>
          <label className="text-xs text-stone-500">
            Sampai
            <input
              type="date"
              required
              name="akhir"
              defaultValue={akhir}
              className={isian}
            />
          </label>
          <label className="text-xs text-stone-500">
            Outlet
            <select name="outlet" defaultValue={outlet} className={isian}>
              <option value="">Semua outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-stone-500">
            Bahan
            <select name="bahan" defaultValue={bahan} className={isian}>
              <option value="">Semua bahan</option>
              {daftarBahan.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </label>
          <button className="col-span-2 rounded-xl bg-kopi-900 px-5 py-2.5 text-sm font-semibold text-white sm:col-span-1">
            Tampilkan
          </button>
        </div>
      </form>

      {msg && (
        <p
          role="status"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {msg}
        </p>
      )}

      {error || !d || !r ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error || "Laporan belum dapat dimuat."}
        </p>
      ) : (
        <>
          <section className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
            <div
              className={`relative flex flex-col overflow-hidden rounded-3xl p-5 text-white shadow-md ${r.laba < 0 ? "bg-gradient-to-br from-red-500 to-rose-700" : "bg-gradient-to-br from-emerald-500 to-teal-700"}`}
            >
              <span
                className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-white/10"
                aria-hidden
              />
              <p className="relative text-sm font-semibold text-white/85">
                {labelLaba}
              </p>
              <p className="relative mt-1 text-3xl font-extrabold tabular-nums sm:text-4xl">
                {rp(r.laba)}
              </p>
              <p className="relative mt-1 text-sm text-white/85">
                {r.penjualan
                  ? `${persen.toLocaleString("id-ID")}% dari penjualan ${rp(r.penjualan)}`
                  : "Belum ada penjualan pada periode ini"}
              </p>
              <div className="relative mt-4 grid grid-cols-3 gap-2 text-center text-xs lg:mt-auto lg:pt-4">
                {[
                  ["Penjualan", r.penjualan],
                  ["Laba kotor", r.labaKotor],
                  ["Biaya", r.biaya],
                ].map(([l, v]) => (
                  <div
                    key={l as string}
                    className="rounded-xl bg-white/15 px-1 py-2 backdrop-blur"
                  >
                    <p className="text-white/80">{l}</p>
                    <p className="truncate font-bold tabular-nums">
                      {rp(Number(v))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-base font-bold text-kopi-900">
                Rincian laba rugi
              </h2>
              <dl className="text-sm">
                {(
                  [
                    ["Penjualan diterima", r.penjualan, ""],
                    ["Diskon invoice", -r.diskon, "−"],
                    ["HPP diketahui", -r.hpp, "−"],
                    ["Laba kotor diketahui", r.labaKotor, "="],
                    ["Biaya operasional", -r.biaya, "−"],
                    ["Penyesuaian invoice", r.invoice, "±"],
                    ["Penyesuaian stok diketahui", r.penyesuaian, "±"],
                  ] as [string, number, string][]
                ).map(([l, v, t]) => (
                  <div
                    key={l}
                    className={`flex items-center justify-between gap-3 py-1.5 ${t === "=" ? "border-t border-stone-200 font-bold text-kopi-900" : "text-stone-700"}`}
                  >
                    <dt className="flex items-center gap-2">
                      <span className="w-3 text-center text-stone-400">
                        {t}
                      </span>
                      {l}
                    </dt>
                    <dd
                      className={`tabular-nums ${v < 0 ? "text-red-700" : ""}`}
                    >
                      {rp(v)}
                    </dd>
                  </div>
                ))}
                <div
                  className={`mt-1 flex items-center justify-between gap-3 rounded-xl px-3 py-2 font-extrabold ${r.laba < 0 ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                >
                  <dt>{labelLaba}</dt>
                  <dd className="tabular-nums">{rp(r.laba)}</dd>
                </div>
              </dl>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-stone-50 p-2.5">
                  <p className="text-stone-500">Internal Pusat (termasuk)</p>
                  <p className="font-bold tabular-nums text-kopi-900">
                    {rp(r.pusat)}
                  </p>
                </div>
                <div
                  className={`rounded-xl p-2.5 ${r.penjualanBelum ? "bg-amber-50" : "bg-stone-50"}`}
                >
                  <p className="text-stone-500">Penjualan HPP belum lengkap</p>
                  <p className="font-bold tabular-nums text-kopi-900">
                    {rp(r.penjualanBelum)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-2 text-sm">
            {r.belum > 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                ⚠️ <b>{r.belum} baris</b> belum punya HPP historis. Laba di atas
                hanya dari bagian dengan HPP lengkap; data lama tidak dihitung
                dengan harga bahan terbaru.
              </p>
            )}
            {(outlet || bahan) && (
              <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-900">
                ℹ️{" "}
                {bahan
                  ? "Filter bahan: hanya margin dan penyesuaian bahan ini; biaya operasional belum dialokasikan."
                  : "Filter outlet: hanya biaya yang ditandai untuk outlet ini. Biaya umum dan penyesuaian persediaan gudang tidak dialokasikan."}
              </p>
            )}
            <p className="px-1 text-xs text-stone-500">
              Penjualan internal Pusat dipisahkan untuk analisis; jangan
              dijumlahkan lagi ke laba konsolidasi. Pembelian persediaan tidak
              langsung menjadi beban.
            </p>
          </div>

          <section className="overflow-hidden rounded-2xl border border-matur-100 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 p-4">
              <div>
                <h2 className="text-base font-bold text-kopi-900">
                  Penjualan per kiriman
                </h2>
                <p className="text-xs text-stone-500">
                  {d.rows.length} baris barang diterima
                </p>
              </div>
            </div>
            <div className="hidden grid-cols-[6rem_minmax(0,1.4fr)_minmax(0,1.4fr)_4rem_1fr_1fr_1fr] gap-3 bg-matur-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-matur-800 md:grid">
              <span>Tanggal</span>
              <span>Kiriman / Outlet</span>
              <span>Bahan</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Penjualan</span>
              <span className="text-right">HPP</span>
              <span className="text-right">Margin</span>
            </div>
            <ul className="divide-y divide-stone-100 md:max-h-[32rem] md:overflow-y-auto">
              {d.rows.map((x, i) => {
                const jual = Number(x.qty) * Number(x.harga);
                const hpp =
                  x.hpp_gudang === null
                    ? null
                    : Number(x.qty) * Number(x.hpp_gudang);
                return (
                  <li
                    key={i}
                    className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[6rem_minmax(0,1.4fr)_minmax(0,1.4fr)_4rem_1fr_1fr_1fr] md:items-center"
                  >
                    <span className="order-2 text-right text-xs text-stone-500 md:order-none md:text-left md:text-sm md:text-stone-700">
                      {new Date(x.waktu).toLocaleDateString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <div className="order-1 min-w-0 md:order-none">
                      <Link
                        className="font-semibold text-matur-700 hover:underline"
                        href={
                          "/operasional/kiriman?outlet=" +
                          x.outlet_id +
                          "&id=" +
                          x.id
                        }
                      >
                        {x.nomor}
                      </Link>
                      <p className="truncate text-xs text-stone-500">
                        {x.outlet} · {x.kepemilikan}
                      </p>
                    </div>
                    <span className="order-3 col-span-2 truncate text-kopi-900 md:order-none md:col-span-1">
                      {x.nama}{" "}
                      <span className="text-xs text-stone-500 md:hidden">
                        × {Number(x.qty).toLocaleString("id-ID")}
                      </span>
                    </span>
                    <span className="hidden text-right tabular-nums md:block">
                      {Number(x.qty).toLocaleString("id-ID")}
                    </span>
                    <span className="order-4 tabular-nums md:order-none md:text-right">
                      <span className="text-xs text-stone-400 md:hidden">
                        Jual{" "}
                      </span>
                      {rp(jual)}
                    </span>
                    <span className="order-5 text-right tabular-nums text-stone-600 md:order-none">
                      <span className="text-xs text-stone-400 md:hidden">
                        HPP{" "}
                      </span>
                      {hpp === null ? (
                        <Badge nada="kuning">Belum lengkap</Badge>
                      ) : (
                        rp(hpp)
                      )}
                    </span>
                    <span
                      className={`order-6 col-span-2 text-right font-bold tabular-nums md:order-none md:col-span-1 ${hpp !== null && jual - hpp < 0 ? "text-red-700" : "text-emerald-700"}`}
                    >
                      <span className="text-xs font-normal text-stone-400 md:hidden">
                        Margin{" "}
                      </span>
                      {hpp === null ? "—" : rp(jual - hpp)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {!d.rows.length && (
              <Kosong
                ikon="📦"
                judul="Belum ada penerimaan barang pada periode ini"
              />
            )}
          </section>

          <section className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-kopi-900">
                  Biaya operasional gudang
                </h2>
                <p className="text-xs text-stone-500">
                  Total {rp(r.biaya)} · masuk laporan gudang, tidak membuat
                  pembayaran bank.
                </p>
              </div>
              {boleh && (
                <button
                  type="button"
                  onClick={() => setFormBiaya(!formBiaya)}
                  className="rounded-xl border border-matur-300 px-3 py-2 text-sm font-semibold text-kopi-800 hover:bg-matur-50 print:hidden"
                >
                  {formBiaya ? "Tutup" : "+ Catat biaya"}
                </button>
              )}
            </div>
            {boleh && formBiaya && (
              <form
                className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-matur-50/60 p-3 sm:grid-cols-[1fr_1fr_2fr_1.3fr_auto] sm:items-end print:hidden"
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
                        setMsg("");
                        setFormBiaya(false);
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
                <label className="text-xs text-stone-500">
                  Tanggal
                  <input
                    type="date"
                    name="tanggal"
                    required
                    defaultValue={akhir}
                    className={isian}
                  />
                </label>
                <label className="text-xs text-stone-500">
                  Nominal (Rp)
                  <input
                    type="number"
                    name="jumlah"
                    required
                    min="1"
                    max="1000000000000"
                    step="1"
                    inputMode="numeric"
                    className={isian}
                  />
                </label>
                <label className="col-span-2 text-xs text-stone-500 sm:col-span-1">
                  Keterangan
                  <input
                    name="keterangan"
                    minLength={3}
                    maxLength={500}
                    required
                    placeholder="mis. Ongkos kirim"
                    className={isian}
                  />
                </label>
                <label className="col-span-2 text-xs text-stone-500 sm:col-span-1">
                  Alokasi
                  <select name="outlet" defaultValue={outlet} className={isian}>
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
                  className="col-span-2 rounded-xl bg-kopi-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-1"
                >
                  {busy ? "Menyimpan…" : "Simpan"}
                </button>
              </form>
            )}
            <ul className="mt-3 divide-y divide-stone-100">
              {d.biaya.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-50 text-base">
                    💸
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold text-kopi-900">
                      {b.keterangan}
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatTanggal(b.tanggal)} ·{" "}
                      {b.outlet_id
                        ? (namaOutlet[b.outlet_id] ?? "Outlet")
                        : "Biaya umum"}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums text-red-700">
                    {rp(Number(b.jumlah))}
                  </span>
                  {boleh && (
                    <button
                      disabled={busy}
                      aria-label={"Batalkan biaya " + b.keterangan}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-stone-500 hover:bg-red-50 hover:text-red-700 print:hidden"
                      onClick={() => {
                        const alasan = window.prompt(
                          "Alasan membatalkan biaya ini (riwayat tetap disimpan):",
                        );
                        if (!alasan) return;
                        start(async () => {
                          try {
                            const result = await gudangRpc(
                              "proses_biaya_gudang",
                              { p: { aksi: "batal", id: b.id, alasan } },
                            );
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
                </li>
              ))}
              {!d.biaya.length && (
                <li className="py-4 text-center text-sm text-stone-500">
                  Belum ada biaya pada periode ini.
                </li>
              )}
            </ul>
          </section>

          {!!d.dokumen?.length && (
            <section className="rounded-2xl border bg-white p-4 text-sm">
              <h2 className="font-bold">Diskon dan Pajak Invoice</h2>
              <p>
                Diskon {rp(r.diskon)} · Pajak {rp(r.pajak)} · Tagihan termasuk
                pajak {rp(r.tagihan)}
              </p>
              <p className="text-xs text-stone-500">
                Pajak ditampilkan terpisah dan tidak dihitung sebagai laba.
                Mengarsipkan dokumen tidak menghapus nilai laporan.
              </p>
              {!!r.perluTinjau && (
                <p role="alert" className="mt-2 text-red-700">
                  {r.perluTinjau} invoice perlu ditinjau karena barang berubah;
                  diskon/pajaknya belum dimasukkan sampai dokumen direvisi.
                </p>
              )}
              {d.dokumen.map((v) => (
                <p key={v.id} className="mt-2 border-t pt-2">
                  {v.nomor} · {v.outlet} · Diskon {rp(Number(v.diskon))} · Pajak{" "}
                  {rp(Number(v.pajak))}
                  {v.perlu_tinjau ? " · Perlu revisi" : ""}
                </p>
              ))}
            </section>
          )}
          {!!d.invoice?.length && (
            <section className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-kopi-900">
                Penyesuaian invoice
              </h2>
              <p className="text-xs text-stone-500">
                Dihitung sekali per invoice pada periode penerimaan selesai;
                tidak dialokasikan saat filter bahan.
              </p>
              <ul className="mt-2 divide-y divide-stone-100">
                {d.invoice.map((x) => (
                  <li
                    key={x.id}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-kopi-900">
                        {x.nomor}{" "}
                        <span className="font-normal text-stone-500">
                          · {x.outlet}
                        </span>
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {x.keterangan}
                      </p>
                    </div>
                    <span
                      className={`font-bold tabular-nums ${Number(x.nilai) < 0 ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {Number(x.nilai) > 0 ? "+" : ""}
                      {rp(Number(x.nilai))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
