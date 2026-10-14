"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { ImporRuma } from "@/components/impor-ruma";
import { FormPengeluaran, label } from "@/components/form-pengeluaran";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { KANAL_HARIAN, LABEL_KANAL, OJOL, nilaiHari, totalBulan, type KanalHarian, type Manual } from "@/lib/harian";
import { catatProdukKeluar, hapusDataSimulasi, hapusManual, isiDataSimulasi, hapusProdukKeluar, simpanAngkaPlatform, simpanKoreksi } from "@/lib/harian-actions";
import { catatPengeluaran, hapusPengeluaran, ubahPengeluaran, type Result } from "@/lib/kas-actions";

export type Hari = {
  tanggal: string;
  transaksi: number;
  tunai: number;
  non_tunai: number;
  gofood: number;
  grabfood: number;
  shopeefood: number;
  tiktok: number;
  ruma_app: number;
  tumbler: number;
  diskon: number;
  setoran: number | null;
  seharusnya: number | null;
  selisih: number | null;
  shift: number;
};
export type Biaya = { id: string; tanggal: string; kategori_id: string; jumlah: number; keterangan: string | null; sumber: "laci" | "pusat"; created_at: string; pengguna: { nama: string } | null };
export type ProdukKeluar = { id: string; tanggal: string; jenis: string; penerima: string | null; items: { nama: string; qty: number; hpp: number; harga: number }[]; total_hpp: number; nilai_jual: number; catatan: string | null; nama_pembuat: string | null; created_at: string };
export type Sesi = { id: string; dibuka_at: string; ditutup_at: string | null; modal_laci: number; setoran: number | null; seharusnya: number | null; selisih: number | null; nama_kasir: string | null };
type Kat = { id: string; nama: string; grup: string; urutan: number };

/** kolom penjualan untuk tampilan & ekspor (urutan sheet Ruma) */
export const KANAL: [KanalHarian, string][] = KANAL_HARIAN.map((k) => [k, LABEL_KANAL[k]]);
const JENIS_MKT: Record<string, string> = { endorse: "Barter endorse", endorse_fee: "Endorse + fee", sampel: "Sampel / tester", promo: "Promo", lainnya: "Lainnya" };
const jam = (t: string | null) => (t ? new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "–");
const tglWib = (t: string) => new Date(new Date(t).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d-]/g, "")) || 0);

export function CatatanHarian({
  outlets,
  outletId,
  bulan,
  sim,
  bolehSim,
  cariAwal,
  hari,
  biaya,
  kategori,
  manual,
  produk,
  sesi,
  menu,
  bolehImpor = false,
}: {
  outlets: { id: string; nama: string }[];
  outletId: string;
  bulan: string;
  sim: boolean;
  bolehSim: boolean;
  cariAwal: string;
  hari: Hari[];
  biaya: Biaya[];
  kategori: Kat[];
  manual: Manual[];
  produk: ProdukKeluar[];
  sesi: Sesi[];
  menu: { id: string; nama: string }[];
  bolehImpor?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [buka, setBuka] = useState<string | null>(null);
  const [cari, setCari] = useState(cariAwal);
  const [form, setForm] = useState<{ tanggal: string; item?: Biaya } | null>(null);
  const [platform, setPlatform] = useState<{ tanggal: string; isi: Record<string, string>; ket: string; semua?: boolean } | null>(null);
  const [tambah, setTambah] = useState<string | null>(null);
  const [koreksi, setKoreksi] = useState<{ tanggal: string; id?: string; kanal: KanalHarian; jumlah: string; ket: string } | null>(null);
  const [mkt, setMkt] = useState<{ tanggal: string; penerima: string; jenis: string; catatan: string; items: { menu_id: string; qty: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const kat = Object.fromEntries(kategori.map((k) => [k.id, k]));
  const per = <T extends { tanggal: string }>(xs: T[]) => {
    const m = new Map<string, T[]>();
    xs.forEach((b) => m.set(b.tanggal, [...(m.get(b.tanggal) ?? []), b]));
    return m;
  };
  const biayaHari = useMemo(() => per(biaya), [biaya]);
  const produkHari = useMemo(() => per(produk), [produk]);
  const manualHari = useMemo(() => per(manual), [manual]);
  const sesiHari = useMemo(() => per(sesi.map((x) => ({ ...x, tanggal: tglWib(x.dibuka_at) }))), [sesi]);
  const run = (fn: () => Promise<Result>, after?: () => void, bolehDiSim = false) =>
    start(async () => {
      // data simulasi hanya untuk dilihat/diuji; input & koreksi selalu ke data asli
      const r = sim && !bolehDiSim ? { error: "Mode simulasi hanya untuk melihat. Matikan centang Simulasi untuk mengedit data asli." } : await fn();
      setMsg(r);
      if (!r.error) {
        after?.();
        router.refresh();
      }
    });
  const SEMUA: KanalHarian[] = [...KANAL_HARIAN, "diskon"];
  const bukaPlatform = (t: string, semua = false) =>
    (setMsg(null),
    setPlatform({ tanggal: t, ket: "", semua, isi: Object.fromEntries((semua ? SEMUA : OJOL).map((k) => [k, nilai.get(t)?.[k].platform != null ? String(nilai.get(t)![k].platform) : ""])) }));
  const pindah = (q: Record<string, string>) => router.push(`/catatan-harian?${new URLSearchParams({ outlet: outletId, bulan, ...(sim ? { sim: "1" } : {}), ...q })}`);

  // nilai akhir tiap hari (POS + angka platform + koreksi)
  const nilai = useMemo(() => new Map(hari.map((h) => [h.tanggal, nilaiHari(h as never, manual)])), [hari, manual]);
  const jualAkhir = (t: string) => KANAL_HARIAN.reduce((s, k) => s + (nilai.get(t)?.[k].akhir ?? 0), 0);
  const tot = totalBulan(hari as never, manual);
  const totalJual = KANAL_HARIAN.reduce((s, k) => s + tot[k], 0);
  const posOjol = hari.reduce((s, h) => s + OJOL.reduce((t, k) => t + Number(h[k as keyof Hari] ?? 0), 0), 0);
  const akhirOjol = OJOL.reduce((s, k) => s + tot[k], 0);
  const grup = (g: string) => biaya.filter((b) => kat[b.kategori_id]?.grup === g).reduce((s, b) => s + b.jumlah, 0);
  const feeMkt = biaya.filter((b) => /marketing/i.test(kat[b.kategori_id]?.nama ?? "")).reduce((s, b) => s + b.jumlah, 0);
  const produkMkt = produk.reduce((s, p) => s + p.total_hpp, 0);
  const selisihKas = hari.reduce((s, h) => s + (h.selisih ?? 0), 0);
  const outletNama = outlets.find((o) => o.id === outletId)?.nama ?? "";

  // pencarian: tanggal, keterangan pengeluaran, koreksi, penerima marketing, nama kasir, nominal
  const kata = cari.trim().toLowerCase();
  const cocok = (t: string) => {
    if (!kata) return true;
    const teks = [
      formatTanggal(t),
      t,
      ...(biayaHari.get(t) ?? []).flatMap((b) => [b.keterangan ?? "", kat[b.kategori_id]?.nama ?? "", String(b.jumlah), b.pengguna?.nama ?? ""]),
      ...(manualHari.get(t) ?? []).flatMap((m) => [m.keterangan ?? "", LABEL_KANAL[m.kanal], String(m.jumlah), m.jenis]),
      ...(produkHari.get(t) ?? []).flatMap((p) => [p.penerima ?? "", ...p.items.map((i) => i.nama), p.catatan ?? ""]),
      ...(sesiHari.get(t) ?? []).map((x) => x.nama_kasir ?? ""),
    ]
      .join(" ")
      .toLowerCase();
    return teks.includes(kata);
  };
  const hariTampil = [...hari].reverse().filter((h) => cocok(h.tanggal));

  const unduh = async () => {
    setBusy(true);
    try {
      const { eksporExcel } = await import("./ekspor");
      await eksporExcel(outletNama, bulan, hari, manual, biaya, kategori, produk);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Catatan Harian</h1>
          <p className="text-sm text-stone-500">Otomatis dari kasir POS per tanggal — tetap bisa dikoreksi, ditambah, dan diisi angka online food dari dashboard platform.</p>
        </div>
        <button onClick={() => (setMsg(null), setTambah(hari.length ? hari[hari.length - 1].tanggal : `${bulan}-01`))} className="rounded-xl bg-kopi-900 px-3 py-2 text-sm font-semibold text-white">
          + Tambah data
        </button>
        {bolehImpor && <ImporRuma outlets={outlets} outletId={outletId} />}
        <button disabled={busy} onClick={unduh} className="rounded-xl border border-green-600 bg-white px-3 py-2 text-sm font-semibold text-green-700 disabled:opacity-50">
          {busy ? "Menyiapkan…" : "⬇ Excel (format Ruma)"}
        </button>
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-matur-200 bg-white p-3">
        {outlets.length > 1 && (
          <select value={outletId} onChange={(e) => pindah({ outlet: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        )}
        <input type="month" value={bulan} onChange={(e) => e.target.value && pindah({ bulan: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔍 Cari tanggal, pengeluaran, nominal, kasir, influencer…" className="min-w-52 flex-1 rounded-lg border px-3 py-2 text-sm" />
        {bolehSim && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sim} onChange={(e) => pindah({ sim: e.target.checked ? "1" : "" })} className="accent-matur-500" />
            Simulasi
          </label>
        )}
        {bolehSim && sim && (
          <span className="flex gap-1">
            <button disabled={pending} onClick={() => confirm("Isi ulang data simulasi bulan ini untuk outlet ini? Data simulasi lama outlet ini diganti.") && run(() => isiDataSimulasi(outletId), undefined, true)} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              🧪 Isi data simulasi
            </button>
            <button disabled={pending} onClick={() => confirm("Hapus semua data simulasi outlet ini?") && run(() => hapusDataSimulasi(outletId), undefined, true)} className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-semibold text-violet-700 disabled:opacity-50">
              Hapus simulasi
            </button>
          </span>
        )}
      </section>
      {sim && <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">🧪 Mode simulasi: data contoh (shift, transaksi POS semua kanal, online food, koreksi, pengeluaran, produk endorse) untuk mengecek alur sampai proyeksi laporan. Tidak tercampur data asli.</p>}
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {[
          ["Penjualan (setelah koreksi)", formatRupiah(totalJual), `diskon ${formatRupiah(tot.diskon)}`],
          ["Online food", formatRupiah(akhirOjol), akhirOjol !== posOjol ? `POS ${formatRupiah(posOjol)} · selisih ${formatRupiah(akhirOjol - posOjol)}` : "sesuai POS"],
          ["Belanja bahan (HPP)", formatRupiah(grup("hpp")), "es kristal, bahan baku, galon"],
          ["Marketing", formatRupiah(feeMkt), `fee/biaya · produk ${formatRupiah(produkMkt)} (HPP)`],
          ["Selisih kas", formatRupiah(selisihKas), selisihKas === 0 ? "pas" : selisihKas > 0 ? "lebih" : "kurang"],
        ].map(([k, v, sub]) => (
          <div key={k} className="rounded-2xl border border-matur-200 bg-white p-3">
            <p className="text-xs text-stone-500">{k}</p>
            <p className="font-bold tabular-nums">{v}</p>
            <p className="text-[11px] text-stone-400">{sub}</p>
          </div>
        ))}
      </section>
      {kata && <p className="text-xs text-stone-500">{hariTampil.length} tanggal cocok dengan “{cari}”.</p>}

      <ul className="space-y-2">
        {hariTampil.map((h) => {
          const t = h.tanggal;
          const v = nilai.get(t)!;
          const items = biayaHari.get(t) ?? [];
          const man = manualHari.get(t) ?? [];
          const pk = produkHari.get(t) ?? [];
          const shift = sesiHari.get(t) ?? [];
          const keluar = items.reduce((s, b) => s + b.jumlah, 0);
          const laci = items.filter((b) => b.sumber === "laci").reduce((s, b) => s + b.jumlah, 0);
          const terbuka = buka === t || (!!kata && hariTampil.length <= 3);
          const kosong = !jualAkhir(t) && !items.length && !pk.length;
          const adaPlatform = man.some((m) => m.jenis === "platform");
          const adaKoreksi = man.some((m) => m.jenis === "koreksi");
          return (
            <li key={t} className={`rounded-2xl border bg-white ${kosong ? "border-stone-200 opacity-70" : "border-matur-200"}`}>
              <button onClick={() => setBuka(terbuka ? null : t)} className="flex w-full flex-wrap items-center gap-2 p-4 text-left">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{formatTanggal(t)}</p>
                  <p className="text-xs text-stone-500">
                    {h.transaksi} transaksi · {shift.length || h.shift} shift · penjualan <b className="text-kopi-900">{formatRupiah(jualAkhir(t))}</b> · pengeluaran {formatRupiah(keluar)}
                  </p>
                </div>
                {adaPlatform && <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">online food diisi</span>}
                {adaKoreksi && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">dikoreksi</span>}
                {pk.length > 0 && <span className="rounded-md bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-800">marketing</span>}
                {h.selisih !== null && (
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${h.selisih === 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>{h.selisih === 0 ? "kas pas" : `selisih ${formatRupiah(h.selisih)}`}</span>
                )}
                <span className="text-stone-400">{terbuka ? "▴" : "▾"}</span>
              </button>
              {terbuka && (
                <div className="space-y-4 border-t px-4 pb-4 pt-3">
                  {/* Penjualan */}
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="mr-auto text-sm font-semibold">Penjualan</p>
                      <button
                        onClick={() => bukaPlatform(t)}
                        className="rounded-lg border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-700"
                      >
                        🛵 Input online food
                      </button>
                      <button onClick={() => bukaPlatform(t, true)} className="rounded-lg border border-violet-300 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        ✏️ Input manual semua kanal
                      </button>
                      <button onClick={() => (setMsg(null), setKoreksi({ tanggal: t, kanal: "tunai", jumlah: "", ket: "" }))} className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        ± Koreksi
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-left text-stone-500">
                          <tr>
                            <th className="py-1">Kanal</th>
                            <th className="text-right">POS</th>
                            <th className="text-right">Dashboard platform</th>
                            <th className="text-right">Koreksi</th>
                            <th className="text-right">Dipakai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {([...KANAL_HARIAN, "diskon"] as KanalHarian[])
                            .filter((k) => v[k].pos || v[k].platform !== null || v[k].koreksi || k === "tunai")
                            .map((k) => (
                              <tr key={k} className="border-t">
                                <td className="py-1">{LABEL_KANAL[k]}</td>
                                <td className="text-right tabular-nums text-stone-500">{formatRupiah(v[k].pos)}</td>
                                <td className="text-right tabular-nums text-sky-700">{v[k].platform === null ? "" : formatRupiah(v[k].platform!)}</td>
                                <td className="text-right tabular-nums text-amber-700">{v[k].koreksi ? formatRupiah(v[k].koreksi) : ""}</td>
                                <td className="text-right font-semibold tabular-nums">{formatRupiah(v[k].akhir)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {man.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-[11px] text-stone-500">
                        {man.map((m) => (
                          <li key={m.id} className="flex items-center gap-2">
                            <span className="flex-1">
                              {m.jenis === "platform" ? "🛵" : "±"} {LABEL_KANAL[m.kanal]} {formatRupiah(m.jumlah)} · {m.keterangan ?? "-"} · {m.nama_pembuat ?? "-"}
                            </span>
                            {m.jenis === "koreksi" && (
                              <button onClick={() => setKoreksi({ tanggal: t, id: m.id, kanal: m.kanal, jumlah: String(m.jumlah), ket: m.keterangan ?? "" })} className="text-matur-700">
                                ✏️
                              </button>
                            )}
                            <button disabled={pending} onClick={() => confirm("Hapus input manual ini?") && run(() => hapusManual(m.id))} className="text-red-600">
                              🗑
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Pengeluaran */}
                  <div>
                    <div className="mb-1 flex items-center">
                      <p className="mr-auto text-sm font-semibold">Pengeluaran</p>
                      <button onClick={() => (setMsg(null), setForm({ tanggal: t }))} className="rounded-lg border border-matur-300 px-2.5 py-1 text-xs font-semibold text-matur-700">
                        + Tambah
                      </button>
                    </div>
                    {items.length === 0 && <p className="text-xs text-stone-400">Tidak ada pengeluaran.</p>}
                    <ul className="divide-y text-sm">
                      {items.map((b) => (
                        <li key={b.id} className="flex items-center gap-2 py-1.5">
                          <div className="min-w-0 flex-1">
                            <p>{b.keterangan || label(kat[b.kategori_id]?.nama ?? "")}</p>
                            <p className="text-[11px] text-stone-500">
                              {label(kat[b.kategori_id]?.nama ?? "-")} · <span className={b.sumber === "laci" ? "text-amber-700" : "text-blue-700"}>{b.sumber === "laci" ? "laci" : "pusat"}</span>
                              {b.pengguna?.nama && ` · ${b.pengguna.nama}`}
                            </p>
                          </div>
                          <span className="tabular-nums">{formatRupiah(b.jumlah)}</span>
                          <button onClick={() => (setMsg(null), setForm({ tanggal: t, item: b }))} className="rounded px-1.5 text-matur-700" title="Ubah">
                            ✏️
                          </button>
                          <button disabled={pending} onClick={() => confirm("Hapus pengeluaran ini?") && run(() => hapusPengeluaran(b.id))} className="rounded px-1.5 text-red-600" title="Hapus">
                            🗑
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Marketing produk */}
                  <div>
                    <div className="mb-1 flex items-center">
                      <p className="mr-auto text-sm font-semibold">Produk untuk marketing / endorse</p>
                      <button onClick={() => (setMsg(null), setMkt({ tanggal: t, penerima: "", jenis: "endorse", catatan: "", items: [{ menu_id: menu[0]?.id ?? "", qty: "1" }] }))} className="rounded-lg border border-pink-300 px-2.5 py-1 text-xs font-semibold text-pink-700">
                        + Produk marketing
                      </button>
                    </div>
                    {pk.length === 0 && <p className="text-xs text-stone-400">Tidak ada. Fee influencer dicatat sebagai pengeluaran kategori Marketing (sumber pusat).</p>}
                    <ul className="divide-y text-sm">
                      {pk.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 py-1.5">
                          <div className="min-w-0 flex-1">
                            <p>
                              <b>{p.penerima ?? "-"}</b> · {JENIS_MKT[p.jenis] ?? p.jenis}
                            </p>
                            <p className="text-[11px] text-stone-500">
                              {p.items.map((i) => `${i.qty}× ${i.nama}`).join(", ")} · nilai jual {formatRupiah(p.nilai_jual)} · {p.nama_pembuat ?? "-"}
                              {p.catatan && ` · ${p.catatan}`}
                            </p>
                          </div>
                          <span className="tabular-nums" title="HPP produk">
                            {formatRupiah(p.total_hpp)}
                          </span>
                          <button disabled={pending} onClick={() => confirm("Batalkan catatan produk marketing ini? Stok dikembalikan.") && run(() => hapusProdukKeluar(p.id))} className="rounded px-1.5 text-red-600">
                            🗑
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Shift & kas */}
                  {shift.length > 0 && (
                    <div>
                      <p className="mb-1 text-sm font-semibold">Pergantian shift</p>
                      <ul className="divide-y text-xs">
                        {shift.map((x) => (
                          <li key={x.id} className="flex flex-wrap justify-between gap-2 py-1">
                            <span>
                              <b>{x.nama_kasir ?? "Kasir"}</b> · {jam(x.dibuka_at)}–{jam(x.ditutup_at)} · modal {formatRupiah(x.modal_laci)}
                            </span>
                            <span className={x.selisih ? "text-red-600" : "text-stone-600"}>
                              {x.ditutup_at ? `setor ${formatRupiah(x.setoran ?? 0)} · seharusnya ${formatRupiah(x.seharusnya ?? 0)}${x.selisih ? ` · selisih ${formatRupiah(x.selisih)}` : ""}` : "masih buka"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-matur-50 p-2 text-xs sm:grid-cols-4">
                    <div>
                      <p className="text-stone-500">Penjualan tunai</p>
                      <p className="font-semibold tabular-nums">{formatRupiah(v.tunai.akhir)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Keluar dari laci</p>
                      <p className="font-semibold tabular-nums">{formatRupiah(-laci)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Setoran aktual</p>
                      <p className="font-semibold tabular-nums">{h.setoran === null ? "shift belum ditutup" : formatRupiah(h.setoran)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Selisih</p>
                      <p className={`font-semibold tabular-nums ${h.selisih ? "text-red-600" : ""}`}>{h.selisih === null ? "-" : formatRupiah(h.selisih)}</p>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {form && (
        <Modal title={`${form.item ? "Ubah" : "Tambah"} pengeluaran · ${formatTanggal(form.tanggal)}`}>
          <FormPengeluaran
            kategori={kategori}
            pending={pending}
            awal={form.item ?? { kategori_id: "", jumlah: 0, keterangan: "", sumber: "pusat" }}
            baru={!form.item}
            onBatal={() => setForm(null)}
            onSimpan={(d) => run(() => (form.item ? ubahPengeluaran(form.item.id, { ...d, tanggal: form.tanggal }) : catatPengeluaran({ ...d, tanggal: form.tanggal }, outletId)), () => setForm(null))}
          />
          {msg?.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
        </Modal>
      )}

      {tambah && (
        <Modal title="+ Tambah data harian">
          <label className="block text-sm font-semibold">
            Tanggal
            <input type="date" value={tambah} min={`${bulan}-01`} max={hari.length ? hari[hari.length - 1].tanggal : undefined} onChange={(e) => e.target.value && setTambah(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["✏️ Penjualan manual", "tunai, non tunai, online food, Ruma App, diskon", () => bukaPlatform(tambah, true)],
                ["🛵 Online food", "angka dari dashboard GoFood/Grab/Shopee/TikTok", () => bukaPlatform(tambah)],
                ["± Koreksi penjualan", "tambah / kurangi angka satu kanal", () => setKoreksi({ tanggal: tambah, kanal: "tunai", jumlah: "", ket: "" })],
                ["🧾 Pengeluaran", "es kristal, galon, bahan baku, gaji, dll.", () => setForm({ tanggal: tambah })],
                ["🎁 Produk marketing", "endorse / sampel / promo", () => setMkt({ tanggal: tambah, penerima: "", jenis: "endorse", catatan: "", items: [{ menu_id: menu[0]?.id ?? "", qty: "1" }] })],
              ] as [string, string, () => void][]
            ).map(([j, ket, fn]) => (
              <button key={j} onClick={() => (setTambah(null), setBuka(tambah), fn())} className="rounded-xl border-2 border-stone-200 p-3 text-left hover:border-kopi-700">
                <span className="block font-semibold">{j}</span>
                <span className="text-xs text-stone-500">{ket}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => setTambah(null)} className="rounded-lg border px-4 py-2 text-sm">
              Batal
            </button>
          </div>
        </Modal>
      )}

      {platform && (
        <Modal title={`${platform.semua ? "✏️ Penjualan manual" : "🛵 Online food"} · ${formatTanggal(platform.tanggal)}`}>
          <p className="mb-2 text-xs text-stone-500">
            {platform.semua
              ? "Isi angka penjualan per kanal secara manual (mis. hari sebelum memakai POS Matoer, atau data dari catatan kertas). Angka ini menggantikan angka POS untuk tanggal tsb. Kosongkan = tetap pakai angka POS."
              : "Isi angka dari dashboard masing-masing platform. Kosongkan bila ingin tetap memakai angka dari kasir POS."}
          </p>
          <div className="space-y-2">
            {(platform.semua ? SEMUA : OJOL).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <span className="w-24">{LABEL_KANAL[k]}</span>
                <span className="w-28 text-right text-xs text-stone-500">POS {formatRupiah(nilai.get(platform.tanggal)?.[k].pos ?? 0)}</span>
                <input value={platform.isi[k] ?? ""} onChange={(e) => setPlatform({ ...platform, isi: { ...platform.isi, [k]: e.target.value } })} inputMode="numeric" placeholder="angka dashboard" className="flex-1 rounded-lg border px-2 py-1.5 text-right" />
              </label>
            ))}
            <input value={platform.ket} onChange={(e) => setPlatform({ ...platform, ket: e.target.value })} placeholder="keterangan (mis. sudah termasuk potongan promo)" className="w-full rounded-lg border px-2 py-1.5 text-sm" />
          </div>
          {msg?.error && <p className="mt-2 text-sm text-red-600">{msg.error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setPlatform(null)} className="rounded-lg border px-4 py-2 text-sm">
              Batal
            </button>
            <button disabled={pending} onClick={() => run(() => simpanAngkaPlatform(outletId, platform.tanggal, Object.fromEntries((platform.semua ? SEMUA : OJOL).map((k) => [k, num(platform.isi[k] ?? "")])), platform.ket || (platform.semua ? "input manual" : "")), () => setPlatform(null))} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
              Simpan
            </button>
          </div>
        </Modal>
      )}

      {koreksi && (
        <Modal title={`± Koreksi penjualan · ${formatTanggal(koreksi.tanggal)}`}>
          <div className="space-y-2 text-sm">
            <select value={koreksi.kanal} onChange={(e) => setKoreksi({ ...koreksi, kanal: e.target.value as KanalHarian })} className="w-full rounded-lg border px-2 py-2">
              {([...KANAL_HARIAN, "diskon"] as KanalHarian[]).map((k) => (
                <option key={k} value={k}>
                  {LABEL_KANAL[k]}
                </option>
              ))}
            </select>
            <input value={koreksi.jumlah} onChange={(e) => setKoreksi({ ...koreksi, jumlah: e.target.value })} inputMode="numeric" placeholder="mis. 15000 (tambah) atau -15000 (kurang)" className="w-full rounded-lg border px-2 py-2 text-right" />
            <input value={koreksi.ket} onChange={(e) => setKoreksi({ ...koreksi, ket: e.target.value })} placeholder="alasan koreksi (wajib)" className="w-full rounded-lg border px-2 py-2" />
            <p className="text-xs text-stone-500">Angka POS asli tidak diubah; koreksi tercatat terpisah beserta nama pembuatnya.</p>
          </div>
          {msg?.error && <p className="mt-2 text-sm text-red-600">{msg.error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setKoreksi(null)} className="rounded-lg border px-4 py-2 text-sm">
              Batal
            </button>
            <button disabled={pending} onClick={() => run(() => simpanKoreksi(outletId, { id: koreksi.id, tanggal: koreksi.tanggal, kanal: koreksi.kanal, jumlah: num(koreksi.jumlah) ?? 0, keterangan: koreksi.ket }), () => setKoreksi(null))} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
              Simpan koreksi
            </button>
          </div>
        </Modal>
      )}

      {mkt && (
        <Modal title={`Produk marketing · ${formatTanggal(mkt.tanggal)}`}>
          <div className="space-y-2 text-sm">
            <input value={mkt.penerima} onChange={(e) => setMkt({ ...mkt, penerima: e.target.value })} placeholder="penerima, mis. @kulinerpurbalingga" className="w-full rounded-lg border px-2 py-2" />
            <select value={mkt.jenis} onChange={(e) => setMkt({ ...mkt, jenis: e.target.value })} className="w-full rounded-lg border px-2 py-2">
              {Object.entries(JENIS_MKT).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            {mkt.items.map((it, i) => (
              <div key={i} className="flex gap-1">
                <select value={it.menu_id} onChange={(e) => setMkt({ ...mkt, items: mkt.items.map((x, j) => (j === i ? { ...x, menu_id: e.target.value } : x)) })} className="min-w-0 flex-1 rounded-lg border px-2 py-2">
                  {menu.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama}
                    </option>
                  ))}
                </select>
                <input value={it.qty} onChange={(e) => setMkt({ ...mkt, items: mkt.items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })} inputMode="numeric" className="w-16 rounded-lg border px-2 py-2 text-right" />
                {mkt.items.length > 1 && (
                  <button onClick={() => setMkt({ ...mkt, items: mkt.items.filter((_, j) => j !== i) })} className="px-1 text-red-600">
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setMkt({ ...mkt, items: [...mkt.items, { menu_id: menu[0]?.id ?? "", qty: "1" }] })} className="text-xs font-semibold text-matur-700">
              + produk lain
            </button>
            <input value={mkt.catatan} onChange={(e) => setMkt({ ...mkt, catatan: e.target.value })} placeholder="catatan (mis. konten reels 1x)" className="w-full rounded-lg border px-2 py-2" />
            <p className="text-xs text-stone-500">Stok bahan dipotong sesuai resep. Fee yang dibayar pusat dicatat terpisah lewat “+ Tambah” pengeluaran kategori Marketing.</p>
          </div>
          {msg?.error && <p className="mt-2 text-sm text-red-600">{msg.error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setMkt(null)} className="rounded-lg border px-4 py-2 text-sm">
              Batal
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => catatProdukKeluar({ outlet_id: outletId, tanggal: mkt.tanggal, jenis: mkt.jenis, penerima: mkt.penerima, catatan: mkt.catatan, items: mkt.items.filter((x) => x.menu_id && Number(x.qty) > 0).map((x) => ({ menu_id: x.menu_id, qty: Number(x.qty) })) }), () => setMkt(null))}
              className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Simpan
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
