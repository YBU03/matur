"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, ChipHeader, HeaderHalaman, Kosong } from "@/components/ui-halaman";
import { formatRupiah } from "@/lib/format";
import { hitungForecast, labelData, type BahanForecast, type BulanData, type HasilForecast } from "@/lib/gudang-forecast";
import { simpanBuffer } from "@/lib/gudang-forecast-actions";

export type Gerak = {
  periode: { p: string; b: string; masuk: number; keluar: number; waste: number; sesuai: number; lain: number }[];
  saldo: Record<string, [number, number]>;
};
type Forecast = { bulan: BulanData[]; stok_gudang: Record<string, number>; stok_outlet: Record<string, number>; awal_data: string | null; hari_ini: string; buffer: number };

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const kemasan = (v: number, b: BahanForecast) => nf.format(Number(v) / (b.konversi || 1));
const geser = (iso: string, hari: number) => new Date(Date.parse(iso + "T00:00:00Z") + hari * 86400_000).toISOString().slice(0, 10);
const akhirBulan = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
const tgl = (iso: string, opt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) => new Date(iso + "T00:00:00").toLocaleDateString("id-ID", opt);
const labelPeriode = (p: string, grain: string) =>
  grain === "bulan" ? tgl(p, { month: "short", year: "numeric" }) : grain === "minggu" ? `${tgl(p, { day: "2-digit", month: "short" })}–${tgl(geser(p, 6), { day: "2-digit", month: "short" })}` : tgl(p, { day: "2-digit", month: "short" });
const isi = "mt-0.5 block w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm text-kopi-900 outline-none focus:border-matur-500";
const STATUS: Record<HasilForecast["status"], [string, "merah" | "kuning" | "hijau" | "netral", number]> = {
  kritis: ["🔴 Kritis", "merah", 0],
  beli: ["🟡 Perlu beli", "kuning", 1],
  aman: ["🟢 Aman", "hijau", 2],
  diam: ["Tidak dipakai", "netral", 3],
};

export function PergerakanView(p: {
  tab: "pergerakan" | "forecast";
  grain: "hari" | "minggu" | "bulan";
  dari: string;
  sampai: string;
  hari: string;
  outlet: string;
  outlets: { id: string; nama: string }[];
  bahan: BahanForecast[];
  bisaUbah: boolean;
  error: string;
  gerak: Gerak | null;
  forecast: Forecast | null;
}) {
  const url = (o: Record<string, string>) => "/gudang/pergerakan?" + new URLSearchParams({ tab: p.tab, grain: p.grain, dari: p.dari, sampai: p.sampai, ...(p.outlet && { outlet: p.outlet }), ...o });
  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-6">
      <Link href="/gudang/stok" className="inline-flex text-sm font-semibold text-matur-700 hover:underline">
        ← Stok Gudang
      </Link>
      <HeaderHalaman
        ikon="📈"
        judul={p.tab === "forecast" ? "Smart Forecast Stok" : "Pergerakan Stok Gudang"}
        keterangan={
          p.tab === "forecast"
            ? "Perkiraan kebutuhan bulan depan dari kiriman Gudang ke outlet dan pemakaian bahan dari penjualan POS, lengkap dengan saran beli."
            : "Stok awal, masuk (pembelian), keluar (kiriman ke outlet), waste, penyesuaian opname dan stok akhir per periode."
        }
      >
        {p.tab === "pergerakan" ? <ChipHeader>📅 {tgl(p.dari)} – {tgl(p.sampai)}</ChipHeader> : <ChipHeader>🏪 {p.outlet ? p.outlets.find((o) => o.id === p.outlet)?.nama : "Semua outlet (perusahaan)"}</ChipHeader>}
      </HeaderHalaman>
      <nav className="flex gap-1 rounded-2xl bg-matur-50 p-1 text-sm font-semibold">
        {(
          [
            ["pergerakan", "📊 Pergerakan Stok"],
            ["forecast", "🔮 Smart Forecast"],
          ] as const
        ).map(([k, l]) => (
          <Link key={k} href={url({ tab: k })} className={`flex-1 rounded-xl px-3 py-2 text-center ${p.tab === k ? "bg-white text-kopi-900 shadow-sm" : "text-stone-500"}`}>
            {l}
          </Link>
        ))}
      </nav>
      {p.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{p.error}</p>
      ) : p.tab === "pergerakan" ? (
        p.gerak && <TabPergerakan {...p} gerak={p.gerak} url={url} />
      ) : (
        p.forecast && <TabForecast {...p} forecast={p.forecast} url={url} />
      )}
    </div>
  );
}

// ---------------- Pergerakan ----------------
type BarisGerak = { b: BahanForecast; awal: number; masuk: number; keluar: number; waste: number; sesuai: number; akhir: number };

function TabPergerakan({ grain, dari, sampai, hari, bahan, gerak, url }: { grain: "hari" | "minggu" | "bulan"; dari: string; sampai: string; hari: string; bahan: BahanForecast[]; gerak: Gerak; url: (o: Record<string, string>) => string }) {
  const router = useRouter();
  const [cari, setCari] = useState("");
  const [pilih, setPilih] = useState<string | null>(null);
  const [aktif, setAktif] = useState(true);
  const rows: BarisGerak[] = useMemo(
    () =>
      bahan.map((b) => {
        const ps = gerak.periode.filter((x) => x.b === b.id);
        const sum = (k: "masuk" | "keluar" | "waste" | "sesuai" | "lain") => ps.reduce((t, x) => t + Number(x[k]), 0);
        const [awal, akhir] = gerak.saldo[b.id] ?? [0, 0];
        return { b, awal: Number(awal), masuk: sum("masuk"), keluar: sum("keluar"), waste: sum("waste"), sesuai: sum("sesuai") + sum("lain"), akhir: Number(akhir) };
      }),
    [bahan, gerak],
  );
  const tampil = rows.filter((r) => r.b.nama.toLowerCase().includes(cari.toLowerCase()) && (!aktif || r.masuk || r.keluar || r.waste || r.sesuai || r.awal || r.akhir));
  const awalBulan = hari.slice(0, 7) + "-01";
  const preset: [string, string, string][] = [
    ["7 hari", geser(hari, -6), hari],
    ["30 hari", geser(hari, -29), hari],
    ["Bulan ini", awalBulan, hari],
    ["Bulan lalu", geser(awalBulan, -1).slice(0, 7) + "-01", geser(awalBulan, -1)],
    ["3 bulan", geser(awalBulan, -62).slice(0, 7) + "-01", hari],
  ];
  const detail = pilih ? rows.find((r) => r.b.id === pilih) : null;
  const periodeDetail = detail ? gerak.periode.filter((x) => x.b === detail.b.id) : [];

  const ekspor = async (jenis: "excel" | "pdf") => {
    const judul = `Pergerakan Stok Gudang ${dari} sd ${sampai}`;
    const head = ["Bahan", "Satuan", "Stok awal", "Masuk", "Keluar ke outlet", "Waste", "Penyesuaian", "Stok akhir"];
    const body = tampil.map((r) => [r.b.nama, r.b.satuan_beli, ...[r.awal, r.masuk, r.keluar, r.waste, r.sesuai, r.akhir].map((v) => Math.round((v / (r.b.konversi || 1)) * 100) / 100)]);
    if (jenis === "excel") {
      const [{ Workbook }, { unduhExcel }] = await Promise.all([import("exceljs").then((m) => m.default), import("@/lib/gudang-laporan-excel")]);
      const wb = new Workbook();
      const ws = wb.addWorksheet("Ringkasan");
      ws.addRow([judul.toUpperCase()]).font = { bold: true, size: 13 };
      ws.addRow([`Tampilan ${grain === "hari" ? "harian" : grain === "minggu" ? "mingguan (Senin–Minggu)" : "bulanan"} · jumlah dalam satuan beli (kemasan)`]);
      ws.addRow([]);
      const h = ws.addRow(head);
      h.font = { bold: true };
      body.forEach((b) => ws.addRow(b));
      [28, 10, 12, 12, 16, 10, 14, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
      ws.views = [{ state: "frozen", ySplit: 4 }];
      const wd = wb.addWorksheet("Per periode");
      const hd = wd.addRow(["Periode", "Bahan", "Satuan", "Masuk", "Keluar ke outlet", "Waste", "Penyesuaian"]);
      hd.font = { bold: true };
      for (const x of gerak.periode) {
        const b = bahan.find((y) => y.id === x.b);
        if (!b) continue;
        const k = b.konversi || 1;
        wd.addRow([labelPeriode(x.p, grain), b.nama, b.satuan_beli, Number(x.masuk) / k, Number(x.keluar) / k, Number(x.waste) / k, (Number(x.sesuai) + Number(x.lain)) / k]);
      }
      [18, 28, 10, 12, 16, 10, 14].forEach((w, i) => (wd.getColumn(i + 1).width = w));
      await unduhExcel(wb, judul);
    } else {
      const [{ jsPDF }, { default: autoTable }, { unduh }] = await Promise.all([import("jspdf"), import("jspdf-autotable"), import("@/lib/pdf-kop")]);
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFont("helvetica", "bold").setFontSize(13).text("PERGERAKAN STOK GUDANG", 14, 15);
      doc.setFont("helvetica", "normal").setFontSize(9).text(`${tgl(dari)} – ${tgl(sampai)} · jumlah dalam satuan beli (kemasan)`, 14, 21);
      autoTable(doc, { startY: 26, head: [head], body: body.map((r) => r.map((v) => (typeof v === "number" ? nf.format(v) : v))), styles: { fontSize: 8 }, headStyles: { fillColor: 235, textColor: 0 }, columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } } });
      unduh(doc, judul);
    }
  };

  return (
    <>
      <section className="space-y-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-matur-50 p-1 text-xs font-semibold">
            {(
              [
                ["hari", "Harian"],
                ["minggu", "Mingguan"],
                ["bulan", "Bulanan"],
              ] as const
            ).map(([g, l]) => (
              <Link key={g} href={url({ grain: g, ...(g === "hari" && grain !== "hari" ? { dari: geser(sampai, -29) } : {}) })} className={`rounded-lg px-3 py-1.5 ${grain === g ? "bg-white text-kopi-900 shadow-sm" : "text-stone-500"}`}>
                {l}
              </Link>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {preset.map(([l, a, b]) => (
              <Link key={l} href={url({ dari: a, sampai: b })} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${dari === a && sampai === b ? "border-kopi-900 bg-kopi-900 text-white" : "border-matur-200 text-kopi-800"}`}>
                {l}
              </Link>
            ))}
          </div>
        </div>
        <form
          className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const a = String(f.get("a")), b = String(f.get("b"));
            if (grain === "bulan") router.push(url({ dari: a + "-01", sampai: akhirBulan(b) > hari ? hari : akhirBulan(b) }));
            else router.push(url({ dari: a, sampai: b }));
          }}
        >
          <label className="text-[11px] text-stone-500">
            {grain === "bulan" ? "Dari bulan" : "Dari tanggal"}
            <input name="a" type={grain === "bulan" ? "month" : "date"} required max={grain === "bulan" ? hari.slice(0, 7) : hari} defaultValue={grain === "bulan" ? dari.slice(0, 7) : dari} className={isi} />
          </label>
          <label className="text-[11px] text-stone-500">
            {grain === "bulan" ? "Sampai bulan" : "Sampai tanggal"}
            <input name="b" type={grain === "bulan" ? "month" : "date"} required max={grain === "bulan" ? hari.slice(0, 7) : hari} defaultValue={grain === "bulan" ? sampai.slice(0, 7) : sampai} className={isi} />
          </label>
          <button className="col-span-2 rounded-xl bg-kopi-900 px-5 py-2.5 text-sm font-semibold text-white sm:col-span-1">Tampilkan</button>
        </form>
        <p className="text-[11px] text-stone-400">Mingguan = Senin–Minggu. Harian maks. 3 bulan, mingguan/bulanan maks. 1 tahun.</p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-matur-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-3">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔎 Cari bahan…" className="min-w-0 flex-1 rounded-xl border border-matur-200 px-3 py-2 text-sm outline-none focus:border-matur-500" />
          <label className="flex items-center gap-1.5 text-xs text-stone-600">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} /> Hanya yang ada stok/pergerakan
          </label>
          <button onClick={() => ekspor("excel")} className="rounded-xl bg-kopi-900 px-3 py-2 text-xs font-semibold text-white">⬇ Excel</button>
          <button onClick={() => ekspor("pdf")} className="rounded-xl border border-matur-300 px-3 py-2 text-xs font-semibold text-kopi-800">⬇ PDF</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-matur-50 text-left text-xs font-semibold uppercase tracking-wide text-matur-800">
              <tr>
                <th className="px-3 py-2">Bahan</th>
                <th className="px-3 text-right">Stok awal</th>
                <th className="px-3 text-right">Masuk</th>
                <th className="px-3 text-right">Keluar ke outlet</th>
                <th className="px-3 text-right">Waste</th>
                <th className="px-3 text-right">Penyesuaian</th>
                <th className="px-3 text-right">Stok akhir</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((r) => (
                <tr key={r.b.id} onClick={() => setPilih(pilih === r.b.id ? null : r.b.id)} className={`cursor-pointer border-t border-stone-100 hover:bg-matur-50/60 ${pilih === r.b.id ? "bg-matur-50" : ""}`}>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-kopi-900">{r.b.nama}</p>
                    <p className="text-[11px] text-stone-500">{r.b.satuan_beli} · isi {nf.format(r.b.konversi)} {r.b.satuan_pakai}</p>
                  </td>
                  <td className="px-3 text-right tabular-nums">{kemasan(r.awal, r.b)}</td>
                  <td className="px-3 text-right tabular-nums text-emerald-700">{r.masuk ? "+" + kemasan(r.masuk, r.b) : "–"}</td>
                  <td className="px-3 text-right tabular-nums text-sky-700">{r.keluar ? "−" + kemasan(r.keluar, r.b) : "–"}</td>
                  <td className="px-3 text-right tabular-nums text-red-700">{r.waste ? "−" + kemasan(r.waste, r.b) : "–"}</td>
                  <td className="px-3 text-right tabular-nums">{r.sesuai ? (r.sesuai > 0 ? "+" : "") + kemasan(r.sesuai, r.b) : "–"}</td>
                  <td className="px-3 text-right font-bold tabular-nums text-kopi-900">{kemasan(r.akhir, r.b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tampil.length && <Kosong ikon="📦" judul="Belum ada pergerakan pada periode ini" />}
        </div>
        <p className="border-t border-stone-100 px-3 py-2 text-[11px] text-stone-500">Angka dalam satuan beli (kemasan). Klik bahan untuk grafik & rincian per periode.</p>
      </section>

      {detail && (
        <section className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-kopi-900">{detail.b.nama}</h2>
              <p className="text-xs text-stone-500">per {grain === "hari" ? "hari" : grain === "minggu" ? "minggu" : "bulan"} · {detail.b.satuan_beli}</p>
            </div>
            <button onClick={() => setPilih(null)} className="text-sm text-stone-400">✕</button>
          </div>
          {periodeDetail.length ? (
            <>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={periodeDetail.map((x) => ({ label: labelPeriode(x.p, grain), Masuk: Number(x.masuk) / (detail.b.konversi || 1), Keluar: Number(x.keluar) / (detail.b.konversi || 1), Waste: Number(x.waste) / (detail.b.konversi || 1) }))}>
                    <CartesianGrid stroke="#eee" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={44} />
                    <Tooltip formatter={(v) => nf.format(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Masuk" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Keluar" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Waste" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 divide-y divide-stone-100 text-sm">
                {periodeDetail.map((x) => (
                  <li key={x.p} className="flex flex-wrap justify-between gap-2 py-1.5">
                    <span className="text-stone-600">{labelPeriode(x.p, grain)}</span>
                    <span className="tabular-nums text-xs">
                      masuk <b className="text-emerald-700">{kemasan(x.masuk, detail.b)}</b> · keluar <b className="text-sky-700">{kemasan(x.keluar, detail.b)}</b> · waste <b className="text-red-700">{kemasan(x.waste, detail.b)}</b> · penyesuaian <b>{kemasan(Number(x.sesuai) + Number(x.lain), detail.b)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-stone-500">Tidak ada pergerakan pada periode ini.</p>
          )}
        </section>
      )}
    </>
  );
}

// ---------------- Smart Forecast ----------------
function TabForecast({ outlet, outlets, bahan, bisaUbah, forecast, url }: { outlet: string; outlets: { id: string; nama: string }[]; bahan: BahanForecast[]; bisaUbah: boolean; forecast: Forecast; url: (o: Record<string, string>) => string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [buffer, setBuffer] = useState(String(Number(forecast.buffer)));
  const [pesan, setPesan] = useState<{ ok?: string; error?: string } | null>(null);
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<string | null>(null);
  const [semua, setSemua] = useState(false);
  const bufferAngka = Math.min(200, Math.max(0, Number(buffer.replace(",", ".")) || 0));
  const stok = useMemo(() => {
    const out: Record<string, number> = {};
    for (const b of bahan) out[b.id] = Number(forecast.stok_outlet[b.id] ?? 0) + (outlet ? 0 : Number(forecast.stok_gudang[b.id] ?? 0));
    return out;
  }, [bahan, forecast, outlet]);
  const hasil = useMemo(
    () => hitungForecast({ bahan, bulan: forecast.bulan, stok, hariIni: forecast.hari_ini, awalData: forecast.awal_data, bufferPersen: bufferAngka }).sort((a, b) => STATUS[a.status][2] - STATUS[b.status][2] || b.estimasi - a.estimasi),
    [bahan, forecast, stok, bufferAngka],
  );
  const tampil = hasil.filter((h) => (semua || h.status !== "diam") && h.bahan.nama.toLowerCase().includes(cari.toLowerCase()));
  const hitung = (s: HasilForecast["status"]) => hasil.filter((h) => h.status === s).length;
  const total = hasil.reduce((t, h) => t + h.estimasi, 0);
  const label = labelData(forecast.hari_ini, forecast.awal_data);
  const bulanDepan = new Date(forecast.hari_ini.slice(0, 7) + "-15T00:00:00");
  bulanDepan.setMonth(bulanDepan.getMonth() + 1);
  const namaBulan = bulanDepan.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const kataSaran = outlet ? "Saran kirim" : "Saran beli";

  const eksporExcel = async () => {
    const [{ Workbook }, { unduhExcel }] = await Promise.all([import("exceljs").then((m) => m.default), import("@/lib/gudang-laporan-excel")]);
    const wb = new Workbook();
    const ws = wb.addWorksheet("Forecast");
    ws.addRow([`SMART FORECAST STOK · ${namaBulan.toUpperCase()}`]).font = { bold: true, size: 13 };
    ws.addRow([`${outlet ? outlets.find((o) => o.id === outlet)?.nama : "Semua outlet"} · buffer ${bufferAngka}% · ${label.teks}`]);
    ws.addRow([]);
    const h = ws.addRow(["Status", "Bahan", "Satuan beli", "Kebutuhan bulan depan", "Dari kiriman/hari (pakai)", "Dari POS/hari (pakai)", "Stok sekarang", "Cukup (hari)", kataSaran + " (kemasan)", "Estimasi Rp"]);
    h.font = { bold: true };
    for (const r of hasil) {
      const k = r.bahan.konversi || 1;
      ws.addRow([STATUS[r.status][0].replace(/^\S+ /, ""), r.bahan.nama, r.bahan.satuan_beli, Math.round((r.kebutuhan / k) * 100) / 100, Math.round(r.rateKirim * 100) / 100, Math.round(r.ratePakai * 100) / 100, Math.round((r.stok / k) * 100) / 100, r.cukupHari === null ? "" : Math.floor(r.cukupHari), r.saranKemasan, r.estimasi]).getCell(10).numFmt = '"Rp" #,##0';
    }
    [14, 28, 11, 14, 16, 16, 13, 11, 16, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.views = [{ state: "frozen", ySplit: 4 }];
    await unduhExcel(wb, `Smart Forecast ${namaBulan}`);
  };

  return (
    <>
      <section className="grid gap-3 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-[11px] text-stone-500">
          Lingkup
          <select value={outlet} onChange={(e) => router.push(url({ outlet: e.target.value }))} className={isi}>
            <option value="">Semua outlet (perusahaan): stok Gudang + outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.nama}: stok outlet saja</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="text-[11px] text-stone-500">
            Buffer cadangan
            <div className="relative mt-0.5">
              <input value={buffer} disabled={!bisaUbah || busy} inputMode="decimal" onChange={(e) => (setBuffer(e.target.value.replace(/[^0-9.,]/g, "")), setPesan(null))} className={`${isi} w-24 pr-7 text-right`} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">%</span>
            </div>
          </label>
          {bisaUbah && (
            <button
              disabled={busy || bufferAngka === Number(forecast.buffer)}
              onClick={() =>
                start(async () => {
                  const r = await simpanBuffer(bufferAngka);
                  setPesan(r);
                  if (r.ok) router.refresh();
                })
              }
              className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Simpan
            </button>
          )}
        </div>
        {pesan && <p className={`text-xs sm:col-span-2 ${pesan.error ? "text-red-700" : "text-emerald-700"}`}>{pesan.error ?? pesan.ok}</p>}
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {(
          [
            ["kritis", "🔴 Kritis", "stok < 7 hari / di bawah minimum"],
            ["beli", "🟡 Perlu beli", "untuk " + namaBulan],
            ["aman", "🟢 Aman", "stok mencukupi"],
          ] as const
        ).map(([k, l, sub]) => (
          <div key={k} className="rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold text-stone-500">{l}</p>
            <p className="text-2xl font-extrabold tabular-nums text-kopi-900">{hitung(k)}</p>
            <p className="text-[11px] text-stone-400">{sub}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-2xl bg-gradient-to-br from-matur-400 to-orange-600 p-3 text-white shadow-sm">
          <p className="text-[11px] font-semibold text-white/85">Estimasi {kataSaran.toLowerCase()} {namaBulan}</p>
          <p className="text-2xl font-extrabold tabular-nums">{formatRupiah(total)}</p>
          <p className="text-[11px] text-white/85">
            buffer {bufferAngka}% · <span className="rounded bg-white/20 px-1">{label.teks}</span>
          </p>
        </div>
      </section>

      {label.nada === "kuning" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ Data pemakaian baru {label.teks.toLowerCase()}. Perkiraan memakai rata-rata harian dan akan makin akurat setelah 2–3 bulan data.
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-matur-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-3">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔎 Cari bahan…" className="min-w-0 flex-1 rounded-xl border border-matur-200 px-3 py-2 text-sm outline-none focus:border-matur-500" />
          <label className="flex items-center gap-1.5 text-xs text-stone-600">
            <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan yang tidak dipakai
          </label>
          <button onClick={eksporExcel} className="rounded-xl bg-kopi-900 px-3 py-2 text-xs font-semibold text-white">⬇ Excel</button>
        </div>
        <ul className="divide-y divide-stone-100">
          {tampil.map((h) => {
            const [l, nada] = STATUS[h.status];
            const k = h.bahan.konversi || 1;
            return (
              <li key={h.bahan.id}>
                <button type="button" onClick={() => setBuka(buka === h.bahan.id ? null : h.bahan.id)} className="grid w-full grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-3 text-left text-sm hover:bg-matur-50/50 md:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_1.2fr]">
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-kopi-900">
                      {h.bahan.nama} <Badge nada={nada}>{l}</Badge>
                    </p>
                    <p className="text-[11px] text-stone-500">{h.bahan.satuan_beli} · isi {nf.format(k)} {h.bahan.satuan_pakai}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-400">Kebutuhan {namaBulan.split(" ")[0]}</p>
                    <p className="font-bold tabular-nums">{nf.format(h.kebutuhan / k)} <span className="text-xs font-normal text-stone-500">{h.bahan.satuan_beli}</span></p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-400">Stok sekarang</p>
                    <p className="font-bold tabular-nums">{nf.format(h.stok / k)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-400">Cukup untuk</p>
                    <p className={`font-bold tabular-nums ${h.cukupHari !== null && h.cukupHari < 7 ? "text-red-700" : ""}`}>{h.cukupHari === null ? "–" : `± ${Math.floor(h.cukupHari)} hari`}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-[11px] text-stone-400">{kataSaran}</p>
                    <p className="font-extrabold tabular-nums text-matur-700">{h.saranKemasan ? `${h.saranKemasan} ${h.bahan.satuan_beli}` : "–"}</p>
                    {h.estimasi > 0 && <p className="text-[11px] tabular-nums text-stone-500">{formatRupiah(h.estimasi)}</p>}
                  </div>
                </button>
                {buka === h.bahan.id && (
                  <div className="space-y-2 bg-matur-50/40 px-4 pb-4 pt-1 text-xs">
                    <p className="text-stone-600">
                      Laju harian: kiriman <b>{nf.format(h.rateKirim / k)}</b> · pemakaian POS <b>{nf.format(h.ratePakai / k)}</b> {h.bahan.satuan_beli}/hari. Dipakai yang lebih besar, lalu kebutuhan × (1 + {bufferAngka}%) + stok minimum {nf.format(h.bahan.stok_min / k)} − stok sekarang.
                    </p>
                    {h.riwayat.length > 0 && (
                      <div className="h-44 rounded-xl bg-white p-2">
                        <ResponsiveContainer>
                          <BarChart data={h.riwayat.map((r) => ({ label: tgl(r.p + "-01", { month: "short", year: "2-digit" }), Kiriman: r.kirim / k, "Pemakaian POS": r.pakai / k }))}>
                            <CartesianGrid stroke="#eee" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} width={40} />
                            <Tooltip formatter={(v) => nf.format(Number(v))} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="Kiriman" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Pemakaian POS" fill="#f97316" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {!tampil.length && <li className="p-6 text-center text-sm text-stone-500">Belum ada bahan dengan pemakaian. Data akan terisi otomatis dari kiriman & penjualan POS.</li>}
        </ul>
      </section>
      <p className="px-1 text-[11px] text-stone-500">
        Cara hitung: laju harian per bulan (maks. 3 bulan terakhir + bulan berjalan), bulan terbaru lebih berbobot, ditambah tren naik/turun yang diredam. Kebutuhan memakai yang lebih besar antara kiriman ke outlet dan pemakaian dari penjualan POS.
      </p>
    </>
  );
}
