"use client";

// Impor laporan keuangan dari PDF format Ruma: baca di browser → pratinjau & cek total → simpan sebagai draft internal.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { bacaItemPdf } from "@/lib/baca-pdf";
import { formatRupiah } from "@/lib/format";
import { imporLaporan } from "@/lib/impor-actions";
import { hitung, type Laporan } from "@/lib/laporan";
import { parseLaporanPdf, type CekPdf } from "@/lib/laporan-pdf";
import type { LaporanImpor } from "@/lib/ruma-excel";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const namaPeriode = (p: string | null) => (p ? `${BULAN[Number(p.slice(5, 7)) - 1] ?? ""} ${p.slice(0, 4)}` : "—");
const angka = (s: string) => Math.round(Number(s.replace(/[^\d-]/g, "")) || 0);
const kotak = "w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

function Rp({ v, set, label }: { v: number; set: (n: number) => void; label?: string }) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={v ? v.toLocaleString("id-ID") : "0"}
      onChange={(e) => set(angka(e.target.value))}
      className={`${kotak} text-right tabular-nums`}
    />
  );
}

export function ImporLaporanPdf({ outlets, outletId }: { outlets: { id: string; nama: string }[]; outletId: string }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [outlet, setOutlet] = useState(outletId);
  const [baca, setBaca] = useState(false);
  const [namaFile, setNamaFile] = useState("");
  const [l, setL] = useState<LaporanImpor | null>(null);
  const [cek, setCek] = useState<CekPdf | null>(null);
  const [ganti, setGanti] = useState(false);
  const [err, setErr] = useState("");
  const [hasil, setHasil] = useState<{ outlet: string; bulan: string } | null>(null);
  const [pending, start] = useTransition();

  const tutup = () => {
    if (pending) return;
    setBuka(false);
  };
  const reset = () => {
    setL(null);
    setCek(null);
    setErr("");
    setHasil(null);
    setGanti(false);
    setNamaFile("");
  };
  const pilih = async (f?: File) => {
    if (!f) return;
    reset();
    setNamaFile(f.name);
    if (!/\.pdf$/i.test(f.name)) return setErr("Pilih file berformat PDF.");
    setBaca(true);
    try {
      const items = await bacaItemPdf(f);
      if (items.length < 20) throw new Error("Teks PDF tidak terbaca. Pastikan PDF dicetak dari Excel (bukan hasil scan/foto).");
      const r = parseLaporanPdf(items);
      if (!r.laporan.pendapatan.length && !r.laporan.beban.length) throw new Error("Format laporan Ruma tidak dikenali di PDF ini.");
      setL(r.laporan);
      setCek(r.cek);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "PDF tidak dapat dibaca.");
    } finally {
      setBaca(false);
    }
  };

  const h = l ? hitung({ ...l, laba_bersih: null } as unknown as Laporan) : null;
  const baris: { label: string; matoer: number; pdf: number | null }[] = h && cek
    ? [
        { label: "Total penjualan", matoer: h.totalPenjualan, pdf: cek.totalPenjualan },
        { label: "Harga pokok penjualan", matoer: h.hpp, pdf: cek.hpp },
        { label: "Laba kotor", matoer: h.labaKotor, pdf: cek.labaKotor },
        { label: "Laba bersih", matoer: h.labaBersih, pdf: cek.labaBersih },
      ]
    : [];
  const selisih = baris.filter((b) => b.pdf !== null && Math.abs(b.matoer - b.pdf) > 1);
  const set = <K extends keyof LaporanImpor>(k: K, v: LaporanImpor[K]) => setL((x) => (x ? { ...x, [k]: v } : x));
  const ubahBaris = (k: "pendapatan" | "beban", i: number, v: Partial<{ nama: string; jumlah: number }>) =>
    setL((x) => (x ? { ...x, [k]: x[k].map((r, j) => (j === i ? { ...r, ...v } : r)) } : x));

  const simpan = () =>
    start(async () => {
      if (!l) return;
      setErr("");
      if (!l.periode) return setErr("Isi periode laporan dulu.");
      try {
        const r = await imporLaporan(outlet, l, ganti);
        if (r.error) return setErr(r.error);
        setHasil({ outlet, bulan: l.periode });
        router.refresh();
      } catch {
        setErr("Gagal menyimpan. Periksa koneksi lalu coba lagi.");
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={() => (reset(), setOutlet(outletId), setBuka(true))}
        className="rounded-xl border border-violet-400 bg-white px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
      >
        ⬆ Impor laporan (PDF)
      </button>
      {buka && (
        <Modal title="Impor laporan keuangan (PDF)" onClose={tutup} wide>
          <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1 text-sm">
            <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
              Untuk PDF laporan format Ruma (dicetak dari Excel). File dibaca di perangkat ini dan tidak diunggah. Hasilnya disimpan sebagai <b>draft internal</b>; Mitra baru bisa melihat setelah Bapak/Ibu menyetujui dan menjadwalkannya.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-stone-600">
                Outlet
                <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={`${kotak} mt-1`}>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nama}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-stone-600">
                File PDF laporan
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={baca || pending}
                  onChange={(e) => (pilih(e.target.files?.[0]), (e.target.value = ""))}
                  className="mt-1 block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:font-semibold file:text-white"
                />
              </label>
            </div>
            {namaFile && <p className="truncate text-xs text-stone-500">📄 {namaFile}</p>}
            {baca && <p className="text-xs text-violet-700">Membaca PDF…</p>}

            {l && h && !hasil && (
              <>
                <section className={`rounded-2xl border p-3 ${selisih.length ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <p className={`font-bold ${selisih.length ? "text-amber-900" : "text-emerald-900"}`}>
                    {selisih.length ? `⚠ ${selisih.length} angka berbeda dengan PDF — periksa baris di bawah` : "✓ Semua total cocok dengan PDF"}
                  </p>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {baris.map((b) => {
                      const ok = b.pdf === null || Math.abs(b.matoer - b.pdf) <= 1;
                      return (
                        <div key={b.label} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs">
                          <span className="text-stone-600">{b.label}</span>
                          <span className="text-right tabular-nums">
                            <b className={ok ? "text-emerald-700" : "text-amber-800"}>{formatRupiah(b.matoer)}</b>
                            {!ok && b.pdf !== null && <span className="block text-[10px] text-amber-800">PDF: {formatRupiah(b.pdf)}</span>}
                            {ok && <span className="ml-1 text-emerald-600">✓</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-stone-500">Selisih Rp1 dianggap pembulatan.</p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Identitas laporan</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-stone-600">
                      Periode
                      <input type="month" value={l.periode ?? ""} onChange={(e) => set("periode", e.target.value || null)} className={`${kotak} mt-0.5`} />
                      <span className="text-[10px] text-stone-400">Terbaca: {namaPeriode(l.periode)} — ubah bila PDF salah tulis</span>
                    </label>
                    <label className="text-xs text-stone-600">
                      Nama outlet di laporan
                      <input value={l.nama_outlet ?? ""} onChange={(e) => set("nama_outlet", e.target.value)} className={`${kotak} mt-0.5`} />
                    </label>
                    <label className="text-xs text-stone-600">
                      Mitra
                      <input value={l.mitra ?? ""} onChange={(e) => set("mitra", e.target.value)} className={`${kotak} mt-0.5`} />
                    </label>
                    <label className="text-xs text-stone-600">
                      Penanggung jawab laporan
                      <input value={l.pj_laporan ?? ""} onChange={(e) => set("pj_laporan", e.target.value)} className={`${kotak} mt-0.5`} />
                    </label>
                  </div>
                  <p className="text-xs text-stone-500">
                    Karyawan: {l.karyawan.length} orang{l.karyawan.length ? ` (${l.karyawan.join(", ")})` : ""} · Terbit: {l.tgl_terbit ?? "—"} · {l.penandatangan ?? "—"}
                    {l.jabatan_penandatangan ? `, ${l.jabatan_penandatangan}` : ""}
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Harga pokok penjualan</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["modal_awal", "Modal awal"],
                        ["persediaan_awal", "Persediaan awal"],
                        ["pembelian", "Pembelian bahan baku"],
                        ["tagihan_titipan", "Tagihan titipan"],
                        ["persediaan_akhir", "Persediaan akhir"],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="flex items-center justify-between gap-2 text-xs text-stone-600">
                        <span>{label}</span>
                        <span className="w-40">
                          <Rp v={l[k]} set={(n) => set(k, n)} label={label} />
                        </span>
                      </label>
                    ))}
                  </div>
                </section>

                {(["pendapatan", "beban"] as const).map((k) => (
                  <section key={k} className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">{k === "pendapatan" ? "Pendapatan" : "Beban operasional"}</h3>
                    {k === "beban" && (
                      <div className="flex items-center gap-2 text-xs text-stone-600">
                        <span className="flex-1">Sedekah {String(l.persen_sedekah).replace(".", ",")}%</span>
                        <span className="w-40">
                          <Rp v={l.sedekah} set={(n) => set("sedekah", n)} label="Sedekah" />
                        </span>
                      </div>
                    )}
                    {l[k].map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input aria-label="Nama baris" value={r.nama} onChange={(e) => ubahBaris(k, i, { nama: e.target.value })} className={`${kotak} flex-1`} />
                        <span className="w-40 shrink-0">
                          <Rp v={r.jumlah} set={(n) => ubahBaris(k, i, { jumlah: n })} label={r.nama} />
                        </span>
                      </div>
                    ))}
                    {k === "pendapatan" && (
                      <div className="flex items-center gap-2 text-xs text-stone-600">
                        <span className="flex-1">Diskon</span>
                        <span className="w-40">
                          <Rp v={l.diskon} set={(n) => set("diskon", n)} label="Diskon" />
                        </span>
                      </div>
                    )}
                  </section>
                ))}

                <section className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Bagi hasil</h3>
                    {l.bagi_hasil.length ? (
                      l.bagi_hasil.map((b, i) => (
                        <p key={i} className="flex justify-between gap-2 text-xs">
                          <span>
                            {b.nama} <span className="text-stone-400">{b.persen}%</span>
                          </span>
                          <b className="tabular-nums">{formatRupiah(b.jumlah)}</b>
                        </p>
                      ))
                    ) : (
                      <p className="text-xs text-stone-400">Tidak terbaca</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Penerimaan transfer</h3>
                    {l.transfer.length ? (
                      l.transfer.map((t, i) => (
                        <p key={i} className="flex justify-between gap-2 text-xs">
                          <span className="min-w-0">
                            {t.keterangan}
                            {t.no_rekening && <span className="block text-[10px] text-stone-400">{[t.bank, t.no_rekening, t.atas_nama].filter(Boolean).join(" · ")}</span>}
                          </span>
                          <b className="shrink-0 tabular-nums">{formatRupiah(t.jumlah)}</b>
                        </p>
                      ))
                    ) : (
                      <p className="text-xs text-stone-400">Tidak terbaca</p>
                    )}
                  </div>
                </section>

                <label className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs">
                  <input type="checkbox" checked={ganti} onChange={(e) => setGanti(e.target.checked)} className="mt-0.5 accent-violet-600" />
                  <span>Ganti draft / buat revisi bila periode ini sudah ada. Laporan yang sudah terbit ke Mitra tetap seperti semula sampai Bapak/Ibu menyetujui ulang.</span>
                </label>
              </>
            )}

            {hasil && (
              <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <p className="font-bold">✓ Draft laporan {namaPeriode(hasil.bulan)} tersimpan</p>
                <p className="text-xs">Belum terlihat oleh Mitra. Periksa lalu atur jadwal buka dan setujui dari halaman laporan bulan tersebut. Bila tidak sesuai, draft bisa dihapus di sana.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={`/laporan/internal?outlet=${hasil.outlet}&bulan=${hasil.bulan}`} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300">
                    Lihat draft
                  </Link>
                  <Link href={`/laporan/proyeksi?outlet=${hasil.outlet}&bulan=${hasil.bulan}`} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">
                    Buka untuk periksa & jadwalkan →
                  </Link>
                </div>
              </div>
            )}
            {err && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {err}
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={tutup} className="rounded-lg border px-4 py-2 text-sm">
              {hasil ? "Tutup" : "Batal"}
            </button>
            {!hasil && (
              <button type="button" disabled={pending || !l} onClick={simpan} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {pending ? "Menyimpan…" : "Simpan sebagai draft"}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
