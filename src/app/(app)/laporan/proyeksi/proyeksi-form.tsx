"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { BARIS_PENDAPATAN, hitung, namaBulan, PENDAPATAN_LAIN, type Laporan, type Proyeksi, type Transfer } from "@/lib/laporan";
import { simpanPenutupan, terbitkanLaporan } from "@/lib/laporan-actions";
import type { Rincian } from "@/lib/skema-actions";

type Props = {
  /** titipan terjual bulan ini (cheesecake & dessert) */
  titipan?: { nama: string; produsen: string; terjual: number; harga: number; tagihan: number }[];
  outlets: { id: string; nama: string }[];
  outletId: string;
  bulan: string;
  sim: boolean;
  bolehSim: boolean;
  proy: Proyeksi;
  sebelum: Laporan | null;
  sudahTerbit: string | null;
  kategori: string[];
  skema: { nama: string; persen_sedekah: number; rincian: Rincian[] } | null;
  perjanjian: { modal: number; sewa: number; mitra: string | null; bank: string | null; no_rekening: string | null; atas_nama: string | null } | null;
  penutupan: { ojol: Record<string, number>; koreksi_lain: number | null; persediaan_akhir: number | null; catatan: string | null } | null;
  karyawan: string[];
  penandatangan: { nama: string | null; jabatan: string | null };
  namaOutlet: string;
};

const cls = "w-full rounded-lg border border-stone-300 px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-matur-500";
/** Tagihan titipan per produsen; bila total diubah manual & tidak cocok lagi, dicatat satu baris "Titipan (disesuaikan)". */
function rincianTitipan(xs: { produsen: string; tagihan: number }[], total: number) {
  const per = new Map<string, number>();
  for (const x of xs) per.set(x.produsen || "-", (per.get(x.produsen || "-") ?? 0) + Number(x.tagihan));
  const r = [...per].map(([produsen, jumlah]) => ({ produsen, jumlah: Math.round(jumlah) }));
  return r.reduce((t, x) => t + x.jumlah, 0) === total ? r : total ? [{ produsen: "Titipan (disesuaikan)", jumlah: total }] : [];
}
const n = (v: string) => Math.round(Number(v.replace(/[^\d-]/g, "")) || 0);

export function ProyeksiForm(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [ganti, setGanti] = useState(false);
  const [lihatHarian, setLihatHarian] = useState(false);
  const periode = `${p.bulan}-01`;
  const sewaAuto = (nama: string) => /sewa/i.test(nama) && p.perjanjian?.sewa ? p.perjanjian.sewa : 0;

  const [pend, setPend] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(BARIS_PENDAPATAN.map(([k]) => [k, String(Math.round(p.proy?.pendapatan?.[k] ?? 0))])),
  }));
  // cocok ojol: angka asli dari aplikasi vs catatan kasir → selisihnya jadi Pendapatan Lain-lain (format Ruma)
  const [ojol, setOjol] = useState<Record<string, string>>(() =>
    Object.fromEntries(["gofood", "grabfood", "shopeefood"].map((k) => [k, p.penutupan?.ojol?.[k] !== undefined ? String(p.penutupan.ojol[k]) : ""])),
  );
  const [koreksi, setKoreksi] = useState(String(p.penutupan?.koreksi_lain ?? Math.round(p.proy?.diskon ?? 0)));
  const [draftMsg, setDraftMsg] = useState("");
  const [beban, setBeban] = useState<Record<string, string>>(() =>
    Object.fromEntries(p.kategori.map((k) => [k, String(p.proy?.beban?.find((b) => b.nama === k)?.jumlah ?? sewaAuto(k))])),
  );
  const [stok, setStok] = useState({
    awal: String(p.sebelum?.persediaan_akhir ?? 0),
    pembelian: String(p.proy?.pembelian ?? 0),
    akhir: String(p.penutupan?.persediaan_akhir ?? p.proy?.opname?.nilai ?? p.proy?.persediaan_akhir_sistem ?? 0),
    titipan: String((p.titipan ?? []).reduce((t, x) => t + Number(x.tagihan), 0)),
  });
  const [info, setInfo] = useState({
    nama_outlet: p.namaOutlet,
    mitra: p.sebelum?.mitra ?? p.perjanjian?.mitra ?? "",
    pj: p.sebelum?.pj_laporan ?? "",
    karyawan: (p.karyawan.length ? p.karyawan : (p.sebelum?.karyawan ?? [])).join("\n"),
    terbit: (() => {
      const d = new Date(periode + "T00:00:00");
      d.setMonth(d.getMonth() + 1, 10);
      return d.toISOString().slice(0, 10);
    })(),
    catatan: p.penutupan?.catatan ?? "",
  });
  const selisihOjol = (["gofood", "grabfood", "shopeefood"] as const).reduce((t, k) => t + (ojol[k] === "" ? 0 : n(ojol[k]) - n(pend[k])), 0);
  const lain = selisihOjol + n(koreksi);
  const persenSedekah = Number(p.skema?.persen_sedekah ?? 2.5);
  const modalAwal = p.sebelum?.modal_awal ?? p.perjanjian?.modal ?? 0;

  // susun laporan dari isian, lalu hitung (sama persis dengan halaman laporan resmi)
  const l = useMemo(() => {
    const pendapatan = [...BARIS_PENDAPATAN.map(([k, nama]) => ({ nama, jumlah: n(pend[k]) })), { nama: PENDAPATAN_LAIN, jumlah: lain }];
    const bebanRows = p.kategori.map((k) => ({ nama: k, jumlah: n(beban[k] ?? "0") }));
    const base: Laporan = {
      id: "",
      outlet_id: p.outletId,
      periode,
      nama_outlet: info.nama_outlet,
      mitra: info.mitra || null,
      pj_laporan: info.pj || null,
      karyawan: info.karyawan.split("\n").map((x) => x.trim()).filter(Boolean),
      modal_awal: modalAwal,
      persediaan_awal: n(stok.awal),
      pembelian: n(stok.pembelian),
      tagihan_titipan: n(stok.titipan),
      rincian_titipan: rincianTitipan(p.titipan ?? [], n(stok.titipan)),
      persediaan_akhir: n(stok.akhir),
      pendapatan,
      diskon: Math.round(p.proy?.diskon ?? 0),
      persen_sedekah: persenSedekah,
      sedekah: 0,
      beban: bebanRows,
      bagi_hasil: [],
      transfer: [],
      tgl_terbit: info.terbit,
      kota_terbit: "Purbalingga",
      penandatangan: p.penandatangan.nama,
      jabatan_penandatangan: p.penandatangan.jabatan,
      catatan: info.catatan || null,
      laba_bersih: null,
    };
    const lk = hitung(base).labaKotor;
    base.sedekah = Math.max(0, Math.round((lk * persenSedekah) / 100));
    const lb = hitung(base).labaBersih;
    base.bagi_hasil = (p.skema?.rincian ?? []).map((r) => ({ nama: r.penerima, persen: r.persen, jumlah: Math.round((Math.max(lb, 0) * r.persen) / 100) }));
    const sewa = bebanRows.find((b) => /sewa/i.test(b.nama))?.jumlah ?? 0;
    const sewaLama = p.sebelum?.transfer.find((t) => /sewa/i.test(t.keterangan));
    base.transfer = [
      ...(p.skema?.rincian ?? [])
        .filter((r) => !r.pengelola)
        .map((r): Transfer => ({ keterangan: `Bagi hasil ${r.penerima}`, jumlah: base.bagi_hasil.find((b) => b.nama === r.penerima)?.jumlah ?? 0, bank: r.bank ?? null, no_rekening: r.no_rekening ?? null, atas_nama: r.atas_nama ?? null })),
      ...(sewa
        ? [{ keterangan: "Sewa", jumlah: sewa, bank: p.perjanjian?.bank ?? sewaLama?.bank ?? null, no_rekening: p.perjanjian?.no_rekening ?? sewaLama?.no_rekening ?? null, atas_nama: p.perjanjian?.atas_nama ?? sewaLama?.atas_nama ?? null }]
        : []),
    ];
    return base;
  }, [pend, beban, stok, info, p, periode, persenSedekah, modalAwal, lain]);
  const h = hitung(l);

  const pindah = (q: Record<string, string>) => router.push(`/laporan/proyeksi?${new URLSearchParams({ outlet: p.outletId, bulan: p.bulan, ...(p.sim ? { sim: "1" } : {}), ...q })}`);
  const dataTutup = () => ({
    ojol: Object.fromEntries(Object.entries(ojol).map(([k, v]) => [k, v === "" ? null : n(v)])),
    koreksi_lain: n(koreksi),
    persediaan_akhir: n(stok.akhir),
    catatan: info.catatan || null,
  });
  const simpanDraft = () =>
    start(async () => {
      const r = await simpanPenutupan(p.outletId, periode, dataTutup());
      setDraftMsg(r.error ?? r.ok ?? "");
    });
  const terbit = () =>
    start(async () => {
      setErr("");
      if (!p.sim) await simpanPenutupan(p.outletId, periode, dataTutup());
      const r = await terbitkanLaporan({ ...l, tgl_terbit: info.terbit }, ganti);
      if (r.error) return setErr(r.error);
      router.push(`/laporan/${r.id}`);
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/laporan" className="text-sm text-matur-700">← Laporan Keuangan</Link>
      <div>
        <h1 className="text-2xl font-bold">Proyeksi Laporan Otomatis</h1>
        <p className="text-sm text-stone-500">Penjualan dari kasir POS, pembelian bahan dari kiriman gudang yang diterima, dan biaya dari input harian — terhitung otomatis.</p>
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-matur-200 bg-white p-3">
        <select value={p.outletId} onChange={(e) => pindah({ outlet: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
          {p.outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
        <input type="month" value={p.bulan} onChange={(e) => e.target.value && pindah({ bulan: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        {p.bolehSim && (
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={p.sim} onChange={(e) => pindah({ sim: e.target.checked ? "1" : "" })} className="accent-matur-500" />
            Coba dengan data simulasi
          </label>
        )}
      </section>
      {p.sim && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Memakai data simulasi — hanya untuk mencoba, tidak bisa diterbitkan.</p>}
      {p.sudahTerbit && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Laporan {namaBulan(periode)} sudah terbit. <Link href={`/laporan/${p.sudahTerbit}`} className="font-semibold underline">Lihat laporan</Link>
        </p>
      )}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Transaksi POS", String(p.proy?.jumlah_transaksi ?? 0)],
          ["Total penjualan", formatRupiah(h.totalPenjualan)],
          ["Laba kotor", formatRupiah(h.labaKotor)],
          ["Laba bersih", formatRupiah(h.labaBersih)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-matur-200 bg-white p-3">
            <p className="text-xs text-stone-500">{k}</p>
            <p className="font-bold">{v}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <button onClick={() => setLihatHarian(!lihatHarian)} className="flex w-full items-center font-bold">
          <span className="mr-auto">Rekap harian otomatis</span>
          <span className="text-sm text-matur-700">{lihatHarian ? "tutup ▴" : "lihat ▾"}</span>
        </button>
        {lihatHarian && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-stone-500">
                <tr>
                  <th className="py-1">Tanggal</th>
                  <th className="text-right">Trx</th>
                  <th className="text-right">Penjualan</th>
                  <th className="text-right">Diskon</th>
                  <th className="text-right">Pembelian bahan</th>
                  <th className="text-right">Biaya</th>
                </tr>
              </thead>
              <tbody>
                {(p.proy?.harian ?? []).map((d) => (
                  <tr key={d.tanggal} className="border-t">
                    <td className="py-1">{formatTanggal(d.tanggal.slice(0, 10))}</td>
                    <td className="text-right">{d.transaksi}</td>
                    <td className="text-right tabular-nums">{formatRupiah(d.penjualan)}</td>
                    <td className="text-right tabular-nums">{formatRupiah(d.diskon)}</td>
                    <td className="text-right tabular-nums">{formatRupiah(d.pembelian)}</td>
                    <td className="text-right tabular-nums">{formatRupiah(d.biaya)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-1 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-1 rounded-lg bg-matur-100 px-3 py-1.5 text-sm font-bold uppercase">Harga Pokok Penjualan</h2>
        <Baris k="Persediaan awal (akhir bulan lalu)">
          <Angka v={stok.awal} onChange={(v) => setStok({ ...stok, awal: v })} auto={!!p.sebelum} />
        </Baris>
        <Baris k="Pembelian bahan baku">
          <Angka v={stok.pembelian} onChange={(v) => setStok({ ...stok, pembelian: v })} auto />
        </Baris>
        <Baris k="Tagihan titipan produsen (yang terjual)">
          <Angka v={stok.titipan} onChange={(v) => setStok({ ...stok, titipan: v })} auto={(p.titipan ?? []).length > 0} />
        </Baris>
        {(p.titipan ?? []).length > 0 && (
          <p className="pl-3 text-xs text-stone-500">
            {p.titipan!.map((x) => `${x.nama} ${x.terjual} pcs × ${formatRupiah(x.harga)}`).join(" · ")} (produsen: {[...new Set(p.titipan!.map((x) => x.produsen))].join(", ")}). Yang dibebankan hanya yang terjual.
          </p>
        )}
        <Baris k="Persediaan akhir (isi dengan hasil opname)">
          <Angka v={stok.akhir} onChange={(v) => setStok({ ...stok, akhir: v })} />
        </Baris>
        <p className="text-xs text-stone-500">
          Pembelian = kiriman gudang ({p.proy?.jumlah_kiriman ?? 0}× {formatRupiah(p.proy?.pembelian_rincian?.kiriman_gudang ?? 0)})
          {Object.entries(p.proy?.pembelian_rincian ?? {})
            .filter(([k]) => k !== "kiriman_gudang")
            .map(([k, v]) => ` + ${k} ${formatRupiah(Number(v))}`)
            .join("")}
          .{" "}
          {p.proy?.opname ? (
            <>
              Persediaan akhir dari opname {formatTanggal(p.proy.opname.tanggal)} ({formatRupiah(p.proy.opname.nilai)}).
            </>
          ) : (
            <>
              Belum ada opname bulan ini — <Link href="/stok" className="text-matur-700 underline">lakukan opname</Link> (perkiraan sistem {formatRupiah(p.proy?.persediaan_akhir_sistem ?? 0)}).
            </>
          )}
        </p>
        <Baris k="Harga pokok penjualan" tebal>
          <span className="tabular-nums">{formatRupiah(h.hpp)}</span>
        </Baris>
      </section>

      <section className="space-y-1 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-1 rounded-lg bg-matur-100 px-3 py-1.5 text-sm font-bold uppercase">Pendapatan</h2>
        {BARIS_PENDAPATAN.map(([k, nama]) => (
          <Baris key={k} k={nama}>
            <Angka v={pend[k]} onChange={(v) => setPend({ ...pend, [k]: v })} auto />
          </Baris>
        ))}
        <div className="my-2 space-y-1 rounded-xl bg-blue-50 p-3">
          <p className="text-sm font-semibold text-blue-900">Cocok ojol (angka asli dari aplikasi)</p>
          {(
            [
              ["gofood", "GoFood"],
              ["grabfood", "GrabFood"],
              ["shopeefood", "ShopeeFood"],
            ] as const
          ).map(([k, l]) => (
            <Baris key={k} k={`${l} menurut aplikasi${ojol[k] !== "" ? ` (selisih ${formatRupiah(n(ojol[k]) - n(pend[k]))})` : ""}`}>
              <Angka v={ojol[k]} onChange={(v) => setOjol({ ...ojol, [k]: v })} />
            </Baris>
          ))}
          <Baris k="Koreksi lain (format Ruma: discount dikembalikan)">
            <Angka v={koreksi} onChange={setKoreksi} />
          </Baris>
        </div>
        <Baris k={PENDAPATAN_LAIN}>
          <span className="text-sm font-semibold tabular-nums">{formatRupiah(lain)}</span>
        </Baris>
        <Baris k="Discount">
          <span className="text-sm tabular-nums">{formatRupiah(-l.diskon)}</span>
        </Baris>
        <Baris k="Total penjualan" tebal>
          <span className="tabular-nums">{formatRupiah(h.totalPenjualan)}</span>
        </Baris>
      </section>

      <section className="space-y-1 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-1 rounded-lg bg-matur-100 px-3 py-1.5 text-sm font-bold uppercase">Beban operasional</h2>
        <p className="text-xs text-stone-500">
          Terisi otomatis dari menu <Link href="/master/biaya_outlet" className="text-matur-700 underline">Biaya Operasional</Link>
          {p.perjanjian?.sewa ? " · sewa dari perjanjian bila belum diinput" : ""}.
        </p>
        <Baris k={`Sedekah ${String(persenSedekah).replace(".", ",")}% dari laba kotor`}>
          <span className="text-sm tabular-nums">{formatRupiah(l.sedekah)}</span>
        </Baris>
        {p.kategori.map((k) => (
          <Baris key={k} k={k}>
            <Angka v={beban[k] ?? "0"} onChange={(v) => setBeban({ ...beban, [k]: v })} auto={!!p.proy?.beban?.some((b) => b.nama === k) || (!!sewaAuto(k) && !p.proy?.beban?.some((b) => b.nama === k))} />
          </Baris>
        ))}
        <Baris k="Total beban operasional" tebal>
          <span className="tabular-nums">{formatRupiah(h.totalBeban)}</span>
        </Baris>
        <Baris k="Laba bersih" tebal>
          <span className="tabular-nums">{formatRupiah(h.labaBersih)}</span>
        </Baris>
      </section>

      <section className="space-y-1 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-1 rounded-lg bg-matur-100 px-3 py-1.5 text-sm font-bold uppercase">Sharing profit · {p.skema?.nama ?? "skema belum dipilih"}</h2>
        {!p.skema && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Outlet ini belum punya skema bagi hasil. <Link href="/skema-bagi-hasil" className="font-semibold underline">Pilih skema</Link>
          </p>
        )}
        {l.bagi_hasil.map((b) => (
          <Baris key={b.nama} k={`${b.nama} ${b.persen}%`}>
            <span className="text-sm tabular-nums">{formatRupiah(b.jumlah)}</span>
          </Baris>
        ))}
        {l.transfer.length > 0 && <p className="pt-2 text-xs text-stone-500">Transfer: {l.transfer.map((t) => `${t.keterangan} ${formatRupiah(t.jumlah)}`).join(" · ")}</p>}
      </section>

      <section className="grid gap-3 rounded-2xl border border-matur-200 bg-white p-4 sm:grid-cols-2">
        {(
          [
            ["nama_outlet", "Nama outlet di laporan"],
            ["mitra", "Mitra"],
            ["pj", "Penanggung jawab laporan"],
            ["terbit", "Tanggal terbit"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="text-sm font-medium">
            {label}
            <input type={k === "terbit" ? "date" : "text"} value={info[k]} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
        ))}
        <label className="text-sm font-medium sm:col-span-2">
          Karyawan (satu nama per baris)
          <textarea rows={4} value={info.karyawan} onChange={(e) => setInfo({ ...info, karyawan: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Catatan (opsional)
          <input value={info.catatan} onChange={(e) => setInfo({ ...info, catatan: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        </label>
      </section>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {!p.sim && (
        <button disabled={pending} onClick={simpanDraft} className="w-full rounded-xl border-2 border-matur-400 bg-white py-2.5 text-sm font-semibold text-matur-700">
          💾 Simpan draft (cocok ojol, koreksi, persediaan, catatan)
        </button>
      )}
      {draftMsg && <p className="text-center text-sm text-stone-600">{draftMsg}</p>}
      {p.sudahTerbit && !p.sim && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ganti} onChange={(e) => setGanti(e.target.checked)} className="accent-matur-500" />
          Ganti laporan yang sudah terbit
        </label>
      )}
      <button
        disabled={pending || p.sim || !p.skema || (!!p.sudahTerbit && !ganti)}
        onClick={() => confirm(`Terbitkan laporan ${info.nama_outlet} ${namaBulan(periode)}? Mitra akan bisa melihatnya.`) && terbit()}
        className="w-full rounded-xl bg-matur-500 py-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Menerbitkan…" : `📄 Terbitkan laporan ${namaBulan(periode)}`}
      </button>
    </div>
  );
}

function Angka({ v, onChange, auto }: { v: string; onChange: (s: string) => void; auto?: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      {auto && <span className="rounded bg-green-100 px-1.5 text-[10px] font-semibold leading-4 text-green-800">otomatis</span>}
      <input value={v} onChange={(e) => onChange(e.target.value)} inputMode="numeric" className={`${cls} w-32 sm:w-40`} />
    </div>
  );
}

function Baris({ k, children, tebal }: { k: string; children: React.ReactNode; tebal?: boolean }) {
  return (
    <div className={`flex items-center gap-2 py-1 text-sm ${tebal ? "border-t-2 border-kopi-900 font-bold" : ""}`}>
      <span className="min-w-0 flex-1">{k}</span>
      {children}
    </div>
  );
}
