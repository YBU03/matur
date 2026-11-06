"use client";

// Catatan Harian model spreadsheet: baris = tanggal, kolom = kanal penjualan + kategori pengeluaran + kas.
// Klik sel → bar keterangan (asal angka); ketik angka + Enter → disimpan sebagai penyesuaian (angka POS tetap utuh).
import { useMemo, useRef, useState } from "react";
import { minta, tanya } from "@/components/dialog-tanya";
import { Badge } from "@/components/ui-halaman";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { LABEL_KANAL, OJOL, nilaiHari, type KanalHarian, type Manual } from "@/lib/harian";
import { aturTabelHarian, gantiNamaKategoriBiaya, kembalikanKePos, rincianHarian, simpanKoreksi, tambahKategoriBiaya, type SusunanTabel, type TrxRincian } from "@/lib/harian-actions";
import { koreksiTransaksi } from "@/lib/transaksi-admin-actions";
import type { Result } from "@/lib/kas-actions";
import type { Biaya, Hari } from "./catatan-view";

import { kolomHarianRuma, keteranganHarian, totalPenjualanHarian, type KolomHarian } from "@/lib/tabel-harian-format";

type Kat = { id: string; nama: string; grup: string; urutan: number };
type Kolom = KolomHarian;

const angka = (n: number) => (n ? Math.round(n).toLocaleString("id-ID") : "");
const ojol = ["gofood", "grabfood", "shopeefood", "tiktok", "ruma_app"];
/** kolom catatan harian untuk satu pembayaran (sama dengan rekap_harian: kanal menentukan, Normal dipecah tunai/non tunai) */
export const kolomBayar = (kanal: string, metode: string) => (kanal !== "langsung" ? kanal : metode === "tunai" ? "tunai" : "non_tunai");
export const janggal = (kanal: string, metode: string) =>
  (kanal === "langsung" && ojol.includes(metode)) || (ojol.includes(kanal) && metode !== kanal);
const LABEL_METODE: Record<string, string> = { tunai: "Tunai", qris: "QRIS", debit: "Debit", transfer: "Transfer", shopeepay: "ShopeePay", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood", tiktok: "TikTok", ruma_app: "Ruma App" };
const LABEL_KANAL_POS: Record<string, string> = { langsung: "Normal", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood", tiktok: "TikTok", ruma_app: "Ruma App", tumbler: "Tumbler" };
const jamWib = (t: string) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const tglPendek = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "2-digit" });

export function TabelHarian({
  hari,
  manual,
  biaya,
  kategori,
  outletId,
  sim,
  akunting,
  pending,
  run,
  onPengeluaran,
  onPlatform,
  susunan = {},
  outletNama = "",
  bulan = "",
}: {
  hari: Hari[];
  manual: Manual[];
  biaya: Biaya[];
  kategori: Kat[];
  outletId: string;
  sim: boolean;
  akunting: boolean;
  pending: boolean;
  run: (fn: () => Promise<Result>, after?: () => void) => void;
  onPengeluaran: (tanggal: string, item?: Biaya) => void;
  onPlatform: (tanggal: string) => void;
  susunan?: Partial<SusunanTabel>;
  outletNama?: string;
  bulan?: string;
}) {
  const [sus, setSus] = useState<SusunanTabel>(() => ({ urutan: susunan.urutan ?? [], sembunyi: susunan.sembunyi ?? [], tampil: susunan.tampil ?? [], lebar: susunan.lebar ?? {} }));
  const [atur, setAtur] = useState(false);
  const [seret, setSeret] = useState<string | null>(null);
  const simpanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** ubah susunan kolom; akunting → tersimpan ke server (berlaku semua akunting) */
  const ubahSus = (f: (x: SusunanTabel) => SusunanTabel) =>
    setSus((x) => {
      const baru = f(x);
      if (akunting) {
        if (simpanTimer.current) clearTimeout(simpanTimer.current);
        simpanTimer.current = setTimeout(() => void aturTabelHarian(baru), 600);
      }
      return baru;
    });
  const [pos, setPos] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [edit, setEdit] = useState<string | null>(null);
  const [ket, setKet] = useState("Penyesuaian akunting");
  const [perKategori, setPerKategori] = useState(true);
  const [rincian, setRincian] = useState<{ tanggal: string; kanal?: string; data?: TrxRincian[]; error?: string } | null>(null);
  const wadah = useRef<HTMLDivElement>(null);

  const kat = useMemo(() => Object.fromEntries(kategori.map((k) => [k.id, k])), [kategori]);
  const baris = useMemo(() => [...hari].sort((a, b) => a.tanggal.localeCompare(b.tanggal)), [hari]);
  const nilai = useMemo(() => new Map(baris.map((h) => [h.tanggal, nilaiHari(h as never, manual)])), [baris, manual]);
  const biayaSel = useMemo(() => {
    const m = new Map<string, Biaya[]>();
    for (const b of biaya) {
      const k = `${b.tanggal}|${b.kategori_id}`;
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return m;
  }, [biaya]);

  // semua kolom yang mungkin (urutan bawaan), lalu disaring & diurutkan sesuai susunan bersama akunting
  const semuaKolom = useMemo(() => kolomHarianRuma(kategori, perKategori), [kategori, perKategori]);
  const urutkan = <T extends { key: string }>(xs: T[]) => {
    // kolom yang ada di susunan memakai posisinya; kolom lain menempel setelah tetangga bawaannya
    const posisi = new Map(sus.urutan.map((k, i) => [k, i]));
    let terakhir = -1;
    const rank = xs.map((x, i) => {
      const p = posisi.get(x.key);
      if (p !== undefined) terakhir = Math.max(terakhir, p);
      return { x, r: p ?? terakhir + 0.001 * (i + 1) };
    });
    return rank.sort((a, b) => a.r - b.r).map((y) => y.x);
  };
  const kolom: Kolom[] = useMemo(
    () => urutkan(semuaKolom.filter((k) => (k.ada || sus.tampil.includes(k.key)) && !sus.sembunyi.includes(k.key))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [semuaKolom, sus],
  );
  const pindahKolom = (key: string, ke: string | number) =>
    ubahSus((x) => {
      const now = kolom.map((k) => k.key);
      const dari = now.indexOf(key);
      if (dari < 0) return x;
      now.splice(dari, 1);
      const tujuan = typeof ke === "number" ? Math.max(0, Math.min(now.length, dari + ke)) : Math.max(0, now.indexOf(ke));
      now.splice(tujuan, 0, key);
      return { ...x, urutan: [...now, ...x.urutan.filter((k) => !now.includes(k))] };
    });
  const sembunyikan = (key: string) => ubahSus((x) => ({ ...x, sembunyi: [...new Set([...x.sembunyi, key])], tampil: x.tampil.filter((k) => k !== key) }));
  const tampilkan = (key: string) => ubahSus((x) => ({ ...x, sembunyi: x.sembunyi.filter((k) => k !== key), tampil: [...new Set([...x.tampil, key])] }));
  const gantiNama = async (kk: Kolom) => {
    if (kk.jenis !== "biaya" || !akunting) return;
    const nama = await minta(`Ganti nama kolom/kategori "${kk.label}". Nama baru ikut berubah di POS, Catatan Harian, Rumus HPP & laporan.`, { judul: "Ganti nama kategori", awal: kk.label, wajib: true, ya: "Simpan nama" });
    if (nama && nama !== kk.label) run(() => gantiNamaKategoriBiaya(kk.key, nama), () => tampilkan(kk.key));
  };
  const mulaiLebar = (key: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).parentElement!;
    const awal = th.getBoundingClientRect().width;
    const x0 = e.clientX;
    let w = awal;
    const gerakan = (ev: PointerEvent) => {
      w = Math.max(60, Math.min(400, awal + ev.clientX - x0));
      setSus((x) => ({ ...x, lebar: { ...x.lebar, [key]: w } }));
    };
    const selesai = () => {
      window.removeEventListener("pointermove", gerakan);
      window.removeEventListener("pointerup", selesai);
      ubahSus((x) => ({ ...x, lebar: { ...x.lebar, [key]: w } }));
    };
    window.addEventListener("pointermove", gerakan);
    window.addEventListener("pointerup", selesai);
  };
  const unduhTabel = async () => {
    const { Workbook } = (await import("exceljs")).default;
    const wb = new Workbook();
    const ws = wb.addWorksheet("Catatan Harian");
    ws.addRow([`Catatan Harian ${outletNama} ${bulan}`]).font = { bold: true, size: 13 };
    const kepala = ws.addRow(["Tanggal", ...kolom.map((k) => k.label)]);
    kepala.font = { bold: true };
    for (const hh of baris) ws.addRow([hh.tanggal, ...kolom.map((k) => isiSel(hh, k) ?? null)]);
    ws.addRow(["TOTAL", ...kolom.map((k) => total(k))]).font = { bold: true };
    ws.columns.forEach((c, i) => {
      c.width = i === 0 ? 12 : 16;
      if (i > 0 && kolom[i-1].jenis !== "keterangan") c.numFmt = "#,##0";
      if (i > 0 && kolom[i-1].jenis === "keterangan") c.width = 48;
    });
    ws.views = [{ state: "frozen", xSplit: 1, ySplit: 2 }];
    const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Tabel Harian ${outletNama} ${bulan}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const totalJual = (t: string) => totalPenjualanHarian(nilai.get(t)!);
  const isiSel = (h: Hari, k: Kolom): number | string | null => {
    if (k.jenis === "keterangan") return keteranganHarian(h.shift, biaya.filter(b => b.tanggal === h.tanggal), kategori);
    const v = nilai.get(h.tanggal)!;
    if (k.jenis === "jual") return v[k.key].akhir;
    if (k.jenis === "total_jual") return totalJual(h.tanggal);
    if (k.jenis === "biaya") return (biayaSel.get(`${h.tanggal}|${k.key}`) ?? []).reduce((s, b) => s + b.jumlah, 0);
    if (k.jenis === "total_biaya") return biaya.filter((b) => b.tanggal === h.tanggal).reduce((s, b) => s + b.jumlah, 0);
    return h[k.key];
  };
  const tandaSel = (h: Hari, k: Kolom) => {
    if (k.jenis !== "jual") return "";
    const v = nilai.get(h.tanggal)![k.key];
    if (v.koreksi) return "koreksi";
    if (v.platform !== null) return "manual";
    return "";
  };

  const h = baris[pos.r];
  const k = kolom[pos.c];
  const bisaEdit = (kk: Kolom) => kk.jenis === "jual";

  const simpanSel = (hh: Hari, kk: Kolom, teks: string, keterangan = ket) => {
    if (kk.jenis !== "jual") return;
    const baru = Number(teks.replace(/[^\d-]/g, ""));
    if (!Number.isFinite(baru)) return;
    const sekarang = nilai.get(hh.tanggal)![kk.key].akhir;
    const delta = baru - sekarang;
    if (!delta) return;
    run(() => simpanKoreksi(outletId, { tanggal: hh.tanggal, kanal: kk.key, jumlah: delta, keterangan: keterangan.trim() || "Penyesuaian akunting" }));
  };

  const gerak = (dr: number, dc: number) => setPos((p) => ({ r: Math.max(0, Math.min(baris.length - 1, p.r + dr)), c: Math.max(0, Math.min(kolom.length - 1, p.c + dc)) }));
  const bukaRincian = async (tanggal: string, kanal?: string) => {
    setRincian({ tanggal, kanal });
    const r = await rincianHarian(outletId, tanggal, sim);
    setRincian({ tanggal, kanal, ...r });
  };
  const aksiSel = () => {
    if (!h || !k) return;
    if (k.jenis === "jual") {
      if (OJOL.includes(k.key)) onPlatform(h.tanggal);
      else bukaRincian(h.tanggal, k.key);
    } else if (k.jenis === "biaya") {
      const xs = biayaSel.get(`${h.tanggal}|${k.key}`) ?? [];
      if (xs.length === 1) onPengeluaran(h.tanggal, xs[0]);
      else onPengeluaran(h.tanggal);
    } else bukaRincian(h.tanggal);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (edit !== null) return;
    const peta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (peta[e.key]) {
      e.preventDefault();
      gerak(...peta[e.key]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      gerak(0, e.shiftKey ? -1 : 1);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      if (k && bisaEdit(k)) setEdit(String(isiSel(h, k) ?? 0));
      else aksiSel();
    } else if (/^[0-9]$/.test(e.key) && k && bisaEdit(k)) {
      e.preventDefault();
      setEdit(e.key);
    } else if ((e.key === "Delete" || e.key === "Backspace") && k?.jenis === "jual" && tandaSel(h, k)) {
      e.preventDefault();
      kembali(h.tanggal, k.key);
    }
  };
  const kembali = async (tanggal: string, kanal: KanalHarian) => {
    if (await tanya(`Kembalikan ${LABEL_KANAL[kanal]} ${formatTanggal(tanggal)} ke angka POS? Penyesuaian & input manual sel ini diarsipkan (tetap tercatat di riwayat).`, { ya: "Ya, kembalikan" }))
      run(() => kembalikanKePos(outletId, tanggal, kanal));
  };

  // tempel dari Excel: blok angka (tab/baris) mulai dari sel aktif, hanya kolom penjualan
  const onPaste = async (e: React.ClipboardEvent) => {
    if (edit !== null) return;
    const teks = e.clipboardData.getData("text");
    if (!teks.trim()) return;
    e.preventDefault();
    const blok = teks.replace(/\r/g, "").split("\n").filter((x) => x.length).map((x) => x.split("\t"));
    const rencana: { hh: Hari; kk: Kolom; v: string }[] = [];
    blok.forEach((row, i) =>
      row.forEach((v, j) => {
        const hh = baris[pos.r + i];
        const kk = kolom[pos.c + j];
        if (hh && kk && bisaEdit(kk) && v.trim() !== "") rencana.push({ hh, kk, v });
      }),
    );
    if (!rencana.length) return;
    if (!(await tanya(`Tempel ${rencana.length} angka dari clipboard ke kolom penjualan mulai ${formatTanggal(baris[pos.r].tanggal)} · ${kolom[pos.c].label}?`, { ya: "Tempel" }))) return;
    for (const x of rencana) simpanSel(x.hh, x.kk, x.v, ket || "Tempel dari Excel");
  };

  const total = (kk: Kolom): number | string => kk.jenis === "keterangan" ? "" : baris.reduce((s, hh) => s + Number(isiSel(hh, kk) ?? 0), 0);
  const v = h && k?.jenis === "jual" ? nilai.get(h.tanggal)![k.key] : null;
  const itemBiaya = h && k?.jenis === "biaya" ? biayaSel.get(`${h.tanggal}|${k.key}`) ?? [] : [];

  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500">Urutan utama mengikuti 26 kolom Ruma. Total mencakup seluruh kanal dan pengeluaran, termasuk kolom tambahan yang disembunyikan. Kas seharusnya dan setoran adalah angka kas, bukan laba usaha. Sedekah di sini adalah uang yang benar-benar dikeluarkan.</p>
      {/* bar keterangan sel (seperti formula bar Excel) */}
      <section className="z-20 space-y-2 rounded-2xl sm:min-h-48 sm:sticky sm:top-0 border border-matur-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-kopi-900 px-2.5 py-1 text-xs font-bold text-white">{h ? `${formatTanggal(h.tanggal)} · ${k?.label ?? ""}` : "Pilih sel"}</span>
          {v && (
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
              <span>POS <b className="tabular-nums">{formatRupiah(v.pos)}</b></span>
              {v.platform !== null && <span className="text-violet-700">· manual/platform <b className="tabular-nums">{formatRupiah(v.platform)}</b></span>}
              {v.koreksi !== 0 && <span className="text-amber-700">· penyesuaian <b className="tabular-nums">{v.koreksi > 0 ? "+" : ""}{formatRupiah(v.koreksi)}</b></span>}
              <span>= <b className="tabular-nums text-kopi-900">{formatRupiah(v.akhir)}</b></span>
            </span>
          )}
          {k?.jenis === "biaya" && <span className="text-xs text-stone-600">{itemBiaya.length} pengeluaran</span>}
          <span className="ml-auto flex flex-wrap gap-1.5">
            {h && k?.jenis === "jual" && (
              <>
                <button onClick={() => bukaRincian(h.tanggal, k.key)} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">🔍 Asal uang</button>
                {OJOL.includes(k.key) && <button onClick={() => onPlatform(h.tanggal)} className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">🛵 Input platform</button>}
                {tandaSel(h, k) && <button onClick={() => kembali(h.tanggal, k.key)} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700">↺ Kembali ke POS</button>}
              </>
            )}
            {h && (k?.jenis === "biaya" || k?.jenis === "total_biaya") && (
              <button onClick={() => onPengeluaran(h.tanggal)} className="rounded-lg border border-matur-200 bg-matur-50 px-2.5 py-1 text-xs font-semibold text-matur-800">+ Pengeluaran</button>
            )}
            {h && <button onClick={() => bukaRincian(h.tanggal)} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700">🧾 Transaksi hari ini</button>}
          </span>
        </div>
        {h && k?.jenis === "keterangan" && <p className="break-words text-xs text-stone-600">{keteranganHarian(h.shift, biaya.filter(b => b.tanggal === h.tanggal), kategori) || "Belum ada keterangan pengeluaran atau shift."}</p>}
        {itemBiaya.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {itemBiaya.map((b) => (
              <li key={b.id}>
                <button onClick={() => onPengeluaran(b.tanggal, b)} className="rounded-lg border border-matur-200 px-2 py-1 text-xs hover:bg-matur-50">
                  ✏️ {b.keterangan || kat[b.kategori_id]?.nama} · <b className="tabular-nums">{formatRupiah(b.jumlah)}</b> · {b.sumber === "laci" ? "laci" : "pusat"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex w-full min-w-0 flex-col items-stretch gap-1 text-xs text-stone-500 sm:w-auto sm:flex-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="shrink-0">Keterangan penyesuaian</span>
            <input value={ket} onChange={(e) => setKet(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-800" />
          </label>
          {akunting && (
            <button type="button" onClick={() => setAtur(true)} className="rounded-lg border border-matur-200 bg-matur-50 px-2.5 py-1 text-xs font-semibold text-matur-800">
              ⚙ Atur kolom
            </button>
          )}
          <button type="button" onClick={unduhTabel} className="rounded-lg border border-green-600 px-2.5 py-1 text-xs font-semibold text-green-700">
            ⬇ Excel (tabel ini)
          </button>
          <label className="flex items-center gap-1.5 text-xs text-stone-600">
            <input type="checkbox" checked={perKategori} onChange={(e) => setPerKategori(e.target.checked)} className="accent-matur-500" /> Pengeluaran per kategori
          </label>
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-500">
          <span>⌨️ Klik sel · ketik angka + <b>Enter</b> simpan · panah/Tab pindah · <b>Enter</b> di sel pengeluaran = buka · <b>Del</b> = kembali ke POS · <b>Ctrl+V</b> tempel dari Excel</span>
          <span className="flex gap-2">
            <span><i className="inline-block size-2.5 rounded-sm border bg-white align-middle" /> POS</span>
            <span><i className="inline-block size-2.5 rounded-sm bg-violet-200 align-middle" /> manual/platform</span>
            <span><i className="inline-block size-2.5 rounded-sm bg-amber-200 align-middle" /> disesuaikan</span>
            <span>⚠️ perlu dicek</span>
          </span>
        </p>
      </section>

      <div ref={wadah} tabIndex={0} onKeyDown={onKey} onPaste={onPaste} className="max-h-[70vh] overflow-auto rounded-2xl border border-matur-200 bg-white shadow-sm outline-none focus:ring-2 focus:ring-matur-200">
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-24 border-b border-r border-matur-200 bg-matur-100 px-2 py-2 text-left font-bold text-kopi-900">Tanggal</th>
              {kolom.map((kk, c) => (
                <th
                  key={kk.key}
                  draggable={akunting}
                  onDragStart={(e) => (setSeret(kk.key), e.dataTransfer.setData("text/plain", kk.key))}
                  onDragOver={(e) => seret && e.preventDefault()}
                  onDrop={(e) => (e.preventDefault(), seret && seret !== kk.key && pindahKolom(seret, kk.key), setSeret(null))}
                  onDragEnd={() => setSeret(null)}
                  onDoubleClick={() => gantiNama(kk)}
                  style={sus.lebar[kk.key] ? { width: sus.lebar[kk.key], minWidth: sus.lebar[kk.key], maxWidth: sus.lebar[kk.key] } : undefined}
                  title={akunting ? `Seret untuk memindah kolom${kk.jenis === "biaya" ? " · klik dua kali untuk ganti nama" : ""}` : undefined}
                  className={`group sticky top-0 z-20 min-w-24 whitespace-nowrap border-b border-r border-matur-100 px-2 py-2 text-right font-bold ${akunting ? "cursor-grab active:cursor-grabbing" : ""} ${seret === kk.key ? "opacity-40" : ""} ${kk.jenis === "biaya" || kk.jenis === "total_biaya" ? "bg-rose-50 text-rose-900" : kk.jenis === "kas" ? "bg-sky-50 text-sky-900" : "bg-matur-50 text-kopi-900"} ${pos.c === c ? "underline" : ""}`}
                >
                  <span className="block truncate">{kk.label}</span>
                  {akunting && (
                    <span className="absolute left-1 top-0.5 hidden gap-0.5 text-[10px] font-normal group-hover:flex">
                      <button type="button" onClick={() => pindahKolom(kk.key, -1)} className="rounded bg-white/90 px-1 shadow-sm" title="Geser ke kiri">◀</button>
                      <button type="button" onClick={() => pindahKolom(kk.key, 1)} className="rounded bg-white/90 px-1 shadow-sm" title="Geser ke kanan">▶</button>
                      <button type="button" onClick={() => sembunyikan(kk.key)} className="rounded bg-white/90 px-1 shadow-sm" title="Sembunyikan kolom">👁</button>
                    </span>
                  )}
                  <span onPointerDown={(e) => mulaiLebar(kk.key, e)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-matur-300" title="Tarik untuk ubah lebar" />
                </th>
              ))}
              {akunting && (
                <th className="sticky top-0 z-20 border-b border-r border-matur-100 bg-white px-1 py-1">
                  <button type="button" onClick={() => setAtur(true)} className="whitespace-nowrap rounded-lg border border-dashed border-matur-400 px-2 py-1 text-xs font-bold text-matur-700 hover:bg-matur-50" title="Tambah kolom">
                    ＋ Kolom
                  </button>
                </th>
              )}
              <th className="sticky top-0 z-20 border-b border-matur-100 bg-matur-50 px-2 py-2 text-left font-bold">Cek</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((hh, r) => {
              const kosong = !totalJual(hh.tanggal) && !biaya.some((b) => b.tanggal === hh.tanggal);
              return (
                <tr key={hh.tanggal} className={kosong ? "text-stone-400" : ""}>
                  <th className={`sticky left-0 z-10 whitespace-nowrap border-b border-r border-matur-200 px-2 py-1.5 text-left font-semibold ${pos.r === r ? "bg-matur-100" : "bg-white"}`}>{tglPendek(hh.tanggal)}</th>
                  {kolom.map((kk, c) => {
                    const aktif = pos.r === r && pos.c === c;
                    const tanda = tandaSel(hh, kk);
                    const nilaiSel = isiSel(hh, kk);
                    const selisihMerah = kk.key === "selisih" && nilaiSel !== null && nilaiSel !== 0;
                    return (
                      <td
                        key={kk.key}
                        onClick={() => (setPos({ r, c }), setEdit(null), wadah.current?.focus())}
                        onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); setPos({ r, c }); if (bisaEdit(kk)) setEdit(String(nilaiSel ?? 0)); else if (kk.jenis === "biaya") { const xs = biayaSel.get(`${hh.tanggal}|${kk.key}`) ?? []; onPengeluaran(hh.tanggal, xs.length === 1 ? xs[0] : undefined); } else bukaRincian(hh.tanggal); }}
                        title={kk.jenis === "keterangan" ? String(nilaiSel ?? "") : undefined}
                        style={sus.lebar[kk.key] ? { width: sus.lebar[kk.key], maxWidth: sus.lebar[kk.key] } : kk.jenis === "keterangan" ? { minWidth: 240, maxWidth: 320 } : undefined}
                        className={`relative cursor-cell overflow-hidden whitespace-nowrap border-b border-r border-stone-100 px-2 py-1.5 text-right tabular-nums ${
                          tanda === "koreksi" ? "bg-amber-100" : tanda === "manual" ? "bg-violet-100" : kk.jenis === "total_jual" || kk.jenis === "total_biaya" ? "bg-stone-50 font-bold" : ""
                        } ${kk.jenis === "keterangan" ? "!text-left text-stone-600" : ""} ${selisihMerah ? "font-bold text-red-600" : ""} ${aktif ? "outline outline-2 -outline-offset-2 outline-matur-500" : ""}`}
                      >
                        {aktif && edit !== null ? (
                          <input
                            autoFocus
                            onClick={event => event.stopPropagation()}
                            onDoubleClick={event => event.stopPropagation()}
                            value={edit}
                            inputMode="numeric"
                            onChange={(e) => setEdit(e.target.value)}
                            onBlur={() => setEdit(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                simpanSel(hh, kk, edit);
                                setEdit(null);
                                gerak(e.key === "Enter" ? 1 : 0, e.key === "Tab" ? 1 : 0);
                                wadah.current?.focus();
                              } else if (e.key === "Escape") {
                                setEdit(null);
                                wadah.current?.focus();
                              }
                            }}
                            className="w-24 rounded border border-matur-400 px-1 text-right outline-none"
                          />
                        ) : kk.jenis === "kas" ? (
                          nilaiSel === null ? <span className="text-stone-300">–</span> : kk.key === "selisih" && nilaiSel === 0 ? <span className="text-emerald-600">0</span> : angka(Number(nilaiSel))
                        ) : (
                          kk.jenis === "keterangan" ? String(nilaiSel ?? "") : angka(Number(nilaiSel ?? 0))
                        )}
                      </td>
                    );
                  })}
                  {akunting && <td className="border-b border-r border-stone-100" />}
                  <td className="whitespace-nowrap border-b border-stone-100 px-2 py-1.5">
                    {(hh.janggal ?? 0) > 0 && (
                      <button onClick={() => bukaRincian(hh.tanggal)} title="Ada transaksi yang kanal & metode bayarnya tidak cocok">
                        <Badge nada="kuning">⚠️ {hh.janggal} cek</Badge>
                      </button>
                    )}
                    {hh.selisih !== null && hh.selisih !== 0 && <Badge nada="merah">kas</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th className="sticky bottom-0 left-0 z-30 border-r border-t-2 border-matur-300 bg-kopi-900 px-2 py-2 text-left text-white">TOTAL</th>
              {kolom.map((kk) => (
                <td key={kk.key} className="sticky bottom-0 z-20 whitespace-nowrap border-r border-t-2 border-matur-300 bg-kopi-900 px-2 py-2 text-right font-bold tabular-nums text-white">
                  {typeof total(kk) === "string" ? "" : angka(Number(total(kk)))}
                </td>
              ))}
              {akunting && <td className="sticky bottom-0 border-t-2 border-matur-300 bg-kopi-900" />}
              <td className="sticky bottom-0 border-t-2 border-matur-300 bg-kopi-900" />
            </tr>
          </tfoot>
        </table>
      </div>
      {pending && <p className="text-xs text-stone-500">Menyimpan…</p>}

      {atur && (
        <AturKolom
          semua={urutkan(semuaKolom)}
          tampil={kolom.map((k) => k.key)}
          pending={pending}
          tutup={() => setAtur(false)}
          tampilkan={tampilkan}
          sembunyikan={sembunyikan}
          geser={pindahKolom}
          gantiNama={gantiNama}
          bawaan={() => ubahSus(() => ({ urutan: [], sembunyi: [], tampil: [], lebar: {} }))}
          tambahKategori={(nama, grup) =>
            run(
              async () => {
                const r = await tambahKategoriBiaya(nama, grup);
                if (r.id) tampilkan(r.id);
                return r;
              },
            )
          }
        />
      )}
      {rincian && (
        <PanelRincian
          {...rincian}
          akunting={akunting}
          pending={pending}
          tutup={() => setRincian(null)}
          koreksi={async (t, kanal, metode) => {
            const alasan = await minta(`Koreksi transaksi #${t.nomor} menjadi kanal ${LABEL_KANAL_POS[kanal] ?? kanal}${metode ? `, bayar ${LABEL_METODE[metode] ?? metode}` : ""}. Tulis alasannya:`, {
              judul: "Koreksi transaksi",
              wajib: true,
              placeholder: "mis. sesuai mutasi BNI / dashboard Grab",
              ya: "Simpan koreksi",
            });
            if (!alasan) return;
            run(
              () => koreksiTransaksi(t.id, { kanal, metode, alasan }),
              () => bukaRincian(rincian.tanggal, rincian.kanal),
            );
          }}
        />
      )}
    </div>
  );
}

function PanelRincian({
  tanggal,
  kanal,
  data,
  error,
  akunting,
  pending,
  tutup,
  koreksi,
}: {
  tanggal: string;
  kanal?: string;
  data?: TrxRincian[];
  error?: string;
  akunting: boolean;
  pending: boolean;
  tutup: () => void;
  koreksi: (t: TrxRincian, kanal: string, metode: string | null) => void;
}) {
  const [filter, setFilter] = useState(kanal ?? "");
  const [cari, setCari] = useState("");
  const [ubah, setUbah] = useState<string | null>(null);
  const [isi, setIsi] = useState<{ kanal: string; metode: string }>({ kanal: "langsung", metode: "qris" });
  const baris = (data ?? []).map((t) => {
    const kol = t.bayar.length ? [...new Set(t.bayar.map((b) => kolomBayar(t.kanal, b.metode)))] : [t.kanal === "langsung" ? "tunai" : t.kanal];
    return { t, kol, aneh: t.bayar.some((b) => janggal(t.kanal, b.metode)) };
  });
  const q = cari.trim().toLowerCase();
  const tampil = baris.filter((x) => (!filter || (filter === "janggal" ? x.aneh : x.kol.includes(filter))) && (!q || `#${x.t.nomor} ${x.t.items ?? ""} ${x.t.kasir}`.toLowerCase().includes(q)));
  const jumlah = tampil.reduce((s, x) => s + x.t.subtotal, 0);
  const pilihan = [
    ["", "Semua"],
    ["tunai", "Tunai"],
    ["non_tunai", "QRIS/Non tunai"],
    ...["gofood", "grabfood", "shopeefood", "tiktok", "ruma_app", "tumbler"].filter((k) => baris.some((x) => x.kol.includes(k))).map((k) => [k, LABEL_KANAL[k as KanalHarian]]),
    ["janggal", `⚠️ Perlu dicek (${baris.filter((x) => x.aneh).length})`],
  ];
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && tutup()}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-start gap-2 border-b p-4">
          <div className="mr-auto">
            <h3 className="text-lg font-bold text-kopi-900">🔍 Asal uang · {formatTanggal(tanggal)}</h3>
            <p className="text-xs text-stone-500">Transaksi POS hari operasional ini (tutup buku 03.00 WIB). Kolom mengikuti <b>kanal</b> (Normal dipecah tunai/QRIS). ⚠️ = kanal & metode bayar tidak cocok — cocokkan dengan mutasi bank/dashboard platform lalu koreksi.</p>
          </div>
          <button onClick={tutup} className="rounded-full px-2 text-xl text-stone-400 hover:text-stone-700" aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
          {pilihan.map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === v ? "bg-kopi-900 text-white" : "bg-stone-100 text-stone-600"}`}>
              {l}
            </button>
          ))}
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔎 nomor, menu, kasir" className="ml-auto min-w-36 rounded-lg border border-stone-200 px-2 py-1 text-xs" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!data && !error && <p className="py-6 text-center text-sm text-stone-500">Memuat transaksi…</p>}
          {data && !tampil.length && <p className="py-6 text-center text-sm text-stone-500">Tidak ada transaksi.</p>}
          <ul className="divide-y divide-stone-100">
            {tampil.map(({ t, aneh }) => (
              <li key={t.id} className={`py-2 ${aneh ? "bg-amber-50/60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <b>#{t.nomor}</b>
                  <span className="text-xs text-stone-500">{jamWib(t.waktu)} · {t.kasir}</span>
                  <Badge nada="netral">{LABEL_KANAL_POS[t.kanal] ?? t.kanal}</Badge>
                  {t.bayar.map((b, i) => (
                    <Badge key={i} nada={b.metode === "tunai" ? "hijau" : ojol.includes(b.metode) ? "ungu" : "biru"}>
                      {LABEL_METODE[b.metode] ?? b.metode} {formatRupiah(b.nominal)}
                    </Badge>
                  ))}
                  {aneh && <Badge nada="kuning">⚠️ kanal ≠ metode</Badge>}
                  <b className="ml-auto tabular-nums">{formatRupiah(t.subtotal)}</b>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">{t.items}</p>
                {akunting && (
                  <div className="mt-1">
                    {ubah === t.id ? (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <select value={isi.kanal} onChange={(e) => setIsi({ ...isi, kanal: e.target.value })} className="rounded-lg border px-2 py-1">
                          {Object.entries(LABEL_KANAL_POS).map(([v, l]) => (
                            <option key={v} value={v}>
                              Kanal: {l}
                            </option>
                          ))}
                        </select>
                        {t.bayar.length === 1 && (
                          <select value={isi.metode} onChange={(e) => setIsi({ ...isi, metode: e.target.value })} className="rounded-lg border px-2 py-1">
                            {Object.entries(LABEL_METODE).map(([v, l]) => (
                              <option key={v} value={v}>
                                Bayar: {l}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          disabled={pending}
                          onClick={() => (koreksi(t, isi.kanal, t.bayar.length === 1 && isi.metode !== t.bayar[0].metode ? isi.metode : null), setUbah(null))}
                          className="rounded-lg bg-matur-500 px-2.5 py-1 font-bold text-white disabled:opacity-50"
                        >
                          Simpan
                        </button>
                        <button onClick={() => setUbah(null)} className="rounded-lg border px-2.5 py-1">
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => (setUbah(t.id), setIsi({ kanal: t.kanal, metode: t.bayar[0]?.metode ?? "qris" }))}
                        className="rounded-lg border border-matur-200 bg-matur-50 px-2 py-0.5 text-xs font-semibold text-matur-800"
                      >
                        ✏️ Koreksi kanal/metode
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-stone-500">{tampil.length} transaksi</span>
          <b className="tabular-nums">{formatRupiah(jumlah)}</b>
        </div>
      </div>
    </div>
  );
}

function AturKolom({
  semua,
  tampil,
  pending,
  tutup,
  tampilkan,
  sembunyikan,
  geser,
  gantiNama,
  bawaan,
  tambahKategori,
}: {
  semua: Kolom[];
  tampil: string[];
  pending: boolean;
  tutup: () => void;
  tampilkan: (k: string) => void;
  sembunyikan: (k: string) => void;
  geser: (k: string, arah: number) => void;
  gantiNama: (k: Kolom) => void;
  bawaan: () => void;
  tambahKategori: (nama: string, grup: "hpp" | "beban" | "lain") => void;
}) {
  const [nama, setNama] = useState("");
  const [grup, setGrup] = useState<"hpp" | "beban" | "lain">("beban");
  const urut = [...semua.filter((k) => tampil.includes(k.key)).sort((a, b) => tampil.indexOf(a.key) - tampil.indexOf(b.key)), ...semua.filter((k) => !tampil.includes(k.key))];
  const warna = (k: Kolom) => (k.jenis === "biaya" || k.jenis === "total_biaya" ? "bg-rose-50 text-rose-900" : k.jenis === "kas" ? "bg-sky-50 text-sky-900" : "bg-matur-50 text-kopi-900");
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && tutup()}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-start gap-2 border-b p-4">
          <div className="mr-auto">
            <h3 className="text-lg font-bold text-kopi-900">⚙ Atur kolom</h3>
            <p className="text-xs text-stone-500">Susunan berlaku untuk semua akun akunting. Di tabel: seret judul kolom untuk memindah, tarik tepi kanan untuk ubah lebar, klik dua kali judul pengeluaran untuk ganti nama.</p>
          </div>
          <button onClick={tutup} className="rounded-full px-2 text-xl text-stone-400 hover:text-stone-700" aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <section className="space-y-2 rounded-2xl border border-dashed border-matur-300 bg-matur-50/50 p-3">
            <p className="text-sm font-bold text-kopi-900">＋ Kolom pengeluaran baru</p>
            <div className="flex flex-wrap gap-2">
              <input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={60} placeholder="mis. Biaya Kebersihan" className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
              <select value={grup} onChange={(e) => setGrup(e.target.value as "hpp" | "beban" | "lain")} className="rounded-lg border border-stone-200 px-2 py-2 text-sm">
                <option value="beban">Beban operasional</option>
                <option value="hpp">Pembelian bahan (HPP)</option>
                <option value="lain">Lain-lain</option>
              </select>
              <button disabled={pending || nama.trim().length < 3} onClick={() => (tambahKategori(nama.trim(), grup), setNama(""))} className="rounded-lg bg-matur-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                Tambah
              </button>
            </div>
            <p className="text-[11px] text-stone-500">Kategori baru langsung muncul di pilihan pengeluaran POS, Catatan Harian, dan Rumus HPP.</p>
          </section>
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200">
            {urut.map((k) => {
              const aktif = tampil.includes(k.key);
              return (
                <li key={k.key} className={`flex items-center gap-2 px-3 py-2 text-sm ${aktif ? "" : "opacity-60"}`}>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${warna(k)}`}>{k.jenis === "jual" ? "Penjualan" : k.jenis === "biaya" ? "Pengeluaran" : k.jenis === "kas" ? "Kas" : "Total"}</span>
                  <span className="min-w-0 flex-1 truncate">{k.label}</span>
                  {aktif && (
                    <>
                      <button onClick={() => geser(k.key, -1)} className="rounded border px-1.5 text-xs" title="Geser ke kiri">◀</button>
                      <button onClick={() => geser(k.key, 1)} className="rounded border px-1.5 text-xs" title="Geser ke kanan">▶</button>
                    </>
                  )}
                  {k.jenis === "biaya" && (
                    <button onClick={() => gantiNama(k)} className="rounded border px-1.5 text-xs" title="Ganti nama">✏️</button>
                  )}
                  <button onClick={() => (aktif ? sembunyikan(k.key) : tampilkan(k.key))} className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${aktif ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>
                    {aktif ? "👁 Tampil" : "Tampilkan"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-center justify-between gap-2 border-t p-4">
          <button onClick={bawaan} className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700">
            ↺ Susunan bawaan
          </button>
          <button onClick={tutup} className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white">
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
