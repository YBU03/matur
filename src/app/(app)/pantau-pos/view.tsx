import Link from "next/link";
import { BarList, ChartCard, Heatmap, TrendChart } from "@/components/charts";
import { LiveRefresh } from "@/components/live-refresh";
import { Badge, ChipHeader, HeaderHalaman, Kartu, KartuAngka, Kosong, isian } from "@/components/ui-halaman";
import { SERIES, angka, rupiah } from "@/lib/chart-utils";

// Tampilan Pemantau POS: satu halaman omzet harian, tren, menu terlaris, jam ramai/sepi. Data hanya lewat RPC pantau_pos*.

export type Periode = { kode: string; label: string; dari: string; sampai: string; omzet: number; trx: number; prev_omzet: number; prev_trx: number };
export type OutletP = { id: string; nama: string; jam_operasional: string | null };
export type Ringkas = { hari_ini: string; outlet: OutletP[]; periode: Periode[] };
export type Detail = {
  kpi: { omzet: number; trx: number; diskon: number; void: number };
  harian: { tgl: string; outlet_id: string; omzet: number; trx: number }[];
  kanal: { kanal: string; omzet: number; trx: number }[];
  jam: { dow: number; jam: number; trx: number; omzet: number }[];
  menu: { nama: string; qty: number; omzet: number }[];
  outlet: { outlet_id: string; nama: string; omzet: number; trx: number }[];
};

const KANAL: Record<string, string> = {
  langsung: "Langsung", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood", tiktok: "TikTok Go", ruma_app: "Ruma App", tumbler: "Tumbler",
};
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const HARI_ISO = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const IKON: Record<string, string> = { hari: "☀️", kemarin: "🌙", "3": "📆", "7": "🗓️", bulan_lalu: "📅", "90": "📈" };
const RENTANG = [
  { kode: "7", label: "7 hari" },
  { kode: "30", label: "30 hari" },
  { kode: "bulan", label: "Bulan ini" },
  { kode: "90", label: "3 bulan" },
];

export const tglRe = /^\d{4}-\d{2}-\d{2}$/;
export const tambah = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
export const selisihHari = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const tglPendek = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${BLN[d.getUTCMonth()]}`;
};
const tglPanjang = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const jamLabel = (j: number) => `${String(j).padStart(2, "0")}.00–${String(j + 1).padStart(2, "0")}.00`;
/** "09.00 - 22.00 WIB" → [9, 22] */
function jamBuka(teks: string | null | undefined): [number, number] | null {
  const m = teks?.match(/(\d{1,2})[.:]\d{2}\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  const tutup = Number(m[2]) + (Number(m[3]) > 0 ? 1 : 0);
  return [Number(m[1]), tutup <= Number(m[1]) ? 24 : tutup];
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev && !now) return <span className="text-stone-400">belum ada penjualan</span>;
  if (!prev) return <span className="font-semibold text-emerald-700">▲ baru ada penjualan</span>;
  const p = Math.round(((now - prev) / prev) * 100);
  return (
    <span className={`font-semibold ${p >= 0 ? "text-emerald-700" : "text-red-600"}`}>
      {p >= 0 ? "▲" : "▼"} {Math.abs(p)}%
    </span>
  );
}

export function PantauView({ ringkas, d, outlets, outletId, rentang, dari, sampai, hariIni }: {
  ringkas: Ringkas;
  d: Detail;
  outlets: OutletP[];
  outletId: string | null;
  rentang: string;
  dari: string;
  sampai: string;
  hariIni: string;
}) {
  const jumlahHari = selisihHari(dari, sampai) + 1;
  const tampil = outletId ? outlets.filter((o) => o.id === outletId) : outlets.filter((o) => d.harian.some((h) => h.outlet_id === o.id));
  const warna = Object.fromEntries(outlets.map((o, i) => [o.id, SERIES[i % SERIES.length]]));

  // tren harian: isi hari tanpa penjualan dengan 0 agar terlihat sepinya
  const perTgl = new Map<string, Record<string, number>>();
  for (const h of d.harian) {
    const row = perTgl.get(h.tgl) ?? {};
    row[h.outlet_id] = (row[h.outlet_id] ?? 0) + Number(h.omzet);
    row.__trx = (row.__trx ?? 0) + Number(h.trx);
    perTgl.set(h.tgl, row);
  }
  const hariList = Array.from({ length: jumlahHari }, (_, i) => tambah(dari, i));
  const tren = hariList.map((t) => {
    const row = perTgl.get(t) ?? {};
    return { label: tglPendek(t), tgl: t, ...Object.fromEntries(tampil.map((o) => [o.id, row[o.id] ?? 0])), __total: tampil.reduce((a, o) => a + (row[o.id] ?? 0), 0), __trx: row.__trx ?? 0 };
  });
  const urutHari = [...tren].sort((a, b) => b.__total - a.__total);
  const teramai = urutHari[0];
  const tersepi = urutHari[urutHari.length - 1];

  // jam & hari ramai/sepi
  const perJam = new Map<number, number>();
  const perDow = new Map<number, number>();
  for (const c of d.jam) {
    perJam.set(c.jam, (perJam.get(c.jam) ?? 0) + Number(c.trx));
    perDow.set(c.dow, (perDow.get(c.dow) ?? 0) + Number(c.omzet));
  }
  const outletJam = outletId ? outlets.find((o) => o.id === outletId) : outlets.find((o) => o.jam_operasional);
  const buka = jamBuka(outletJam?.jam_operasional);
  const rentangJam = buka ? Array.from({ length: buka[1] - buka[0] }, (_, i) => buka[0] + i) : [...perJam.keys()].sort((a, b) => a - b);
  const jamUrut = rentangJam.map((j) => ({ jam: j, trx: perJam.get(j) ?? 0 }));
  const jamMaks = Math.max(1, ...jamUrut.map((j) => j.trx));
  const jamRamai = [...jamUrut].sort((a, b) => b.trx - a.trx)[0];
  const jamSepi = [...jamUrut].sort((a, b) => a.trx - b.trx)[0];
  const dowUrut = [...perDow.entries()].sort((a, b) => b[1] - a[1]);

  const menu = d.menu;
  const totalQty = menu.reduce((a, m) => a + Number(m.qty), 0);
  const kanal = d.kanal.map((k) => ({ name: KANAL[k.kanal] ?? k.kanal, value: Number(k.omzet), trx: k.trx }));
  const cabang = d.outlet.map((o) => ({ name: o.nama, value: Number(o.omzet), id: o.outlet_id, trx: o.trx }));
  const k = d.kpi;

  const qs = (ubah: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const isi = { outlet: outletId, rentang, dari: rentang === "kustom" ? dari : null, sampai: rentang === "kustom" ? sampai : null, ...ubah };
    for (const [key, v] of Object.entries(isi)) if (v) p.set(key, v);
    const str = p.toString();
    return `/pantau-pos${str ? `?${str}` : ""}`;
  };
  const jamSekarang = new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <LiveRefresh pantau={[]} cadanganDetik={60} />
      <HeaderHalaman
        judul="Pemantauan POS"
        ikon="📊"
        keterangan="Omzet & penjualan kasir dari POS Matoer — tren harian, menu terlaris, dan jam ramai/sepi. Diperbarui otomatis setiap menit."
      >
        <ChipHeader>🏪 {outletId ? outlets.find((o) => o.id === outletId)?.nama : outlets.length > 1 ? `Semua outlet (${outlets.length})` : (outlets[0]?.nama ?? "-")}</ChipHeader>
        <ChipHeader>🕒 {tglPanjang(hariIni)} · {jamSekarang} WIB</ChipHeader>
      </HeaderHalaman>

      {outlets.length > 1 && (
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Pilih outlet">
          {[{ id: null as string | null, nama: "Semua outlet" }, ...outlets].map((o) => (
            <Link
              key={o.id ?? "semua"}
              href={qs({ outlet: o.id })}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${outletId === o.id ? "bg-kopi-900 text-white shadow" : "bg-white text-kopi-800 ring-1 ring-matur-200 hover:bg-matur-50"}`}
            >
              {o.nama}
            </Link>
          ))}
        </nav>
      )}

      {/* omzet per periode tetap */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {ringkas.periode.map((p) => {
          const pilih = rentang === "kustom" && dari === p.dari && sampai === p.sampai;
          return (
            <Link
              key={p.kode}
              href={qs({ rentang: "kustom", dari: p.dari, sampai: p.sampai })}
              className={`group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${pilih ? "border-matur-500 ring-2 ring-matur-200" : "border-matur-100"}`}
              title="Lihat detail periode ini"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
                <span>{IKON[p.kode]}</span>
                {p.label}
              </p>
              <p className="mt-1 truncate text-base font-extrabold tabular-nums text-kopi-900 sm:text-xl">{rupiah(Number(p.omzet))}</p>
              <p className="text-xs text-stone-500">
                {angka(p.trx)} struk{p.dari !== p.sampai && ` · ${tglPendek(p.dari)}–${tglPendek(p.sampai)}`}
              </p>
              <p className="mt-1 text-xs">
                <Delta now={Number(p.omzet)} prev={Number(p.prev_omzet)} />
                <span className="text-stone-400"> vs {p.kode === "hari" ? "kemarin" : p.kode === "kemarin" ? "lusa" : p.kode === "bulan_lalu" ? "bulan sebelumnya" : "periode sebelumnya"}</span>
              </p>
            </Link>
          );
        })}
      </section>

      {/* pilih rentang detail */}
      <Kartu>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-bold text-kopi-900">Detail:</span>
          {RENTANG.map((r) => (
            <Link
              key={r.kode}
              href={qs({ rentang: r.kode, dari: null, sampai: null })}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${rentang === r.kode ? "bg-matur-500 text-white" : "bg-matur-50 text-kopi-800 hover:bg-matur-100"}`}
            >
              {r.label}
            </Link>
          ))}
          <form action="/pantau-pos" className="ml-auto flex flex-wrap items-center gap-2">
            {outletId && <input type="hidden" name="outlet" value={outletId} />}
            <input type="hidden" name="rentang" value="kustom" />
            <input type="date" name="dari" defaultValue={dari} max={hariIni} className={isian} aria-label="Dari tanggal" />
            <span className="text-sm text-stone-500">s/d</span>
            <input type="date" name="sampai" defaultValue={sampai} max={hariIni} className={isian} aria-label="Sampai tanggal" />
            <button className="rounded-xl bg-kopi-900 px-3 py-2 text-sm font-semibold text-white hover:bg-kopi-800">Tampilkan</button>
          </form>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {tglPanjang(dari)} – {tglPanjang(sampai)} · {jumlahHari} hari
        </p>
      </Kartu>

      {k.trx === 0 ? (
        <Kosong ikon="🧾" judul="Belum ada penjualan pada rentang ini">Data terisi otomatis begitu kasir berjualan lewat POS Matoer.</Kosong>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KartuAngka label="Total omzet" nilai={rupiah(Number(k.omzet))} ikon="💰" nada="hijau" sub={k.diskon ? `setelah diskon ${rupiah(Number(k.diskon))}` : "tanpa diskon"} />
            <KartuAngka label="Jumlah struk" nilai={angka(k.trx)} ikon="🧾" nada="biru" sub={k.void ? `${angka(k.void)} struk dibatalkan (void)` : `± ${angka(Math.round(k.trx / jumlahHari))} struk per hari`} />
            <KartuAngka label="Rata-rata per struk" nilai={rupiah(Number(k.omzet) / k.trx)} ikon="🧮" nada="ungu" sub={`± ${angka(Math.round((totalQty / k.trx) * 10) / 10)} item per struk`} />
            <KartuAngka label="Rata-rata omzet per hari" nilai={rupiah(Number(k.omzet) / jumlahHari)} ikon="📈" nada="kuning" sub={`${angka(totalQty)} item terjual`} />
          </section>

          <ChartCard
            title="Tren harian"
            sub={`Omzet per hari${tampil.length > 1 ? " per outlet" : ""}`}
            rows={tren.map((t) => ({ Tanggal: tglPanjang(t.tgl), Omzet: t.__total, Struk: t.__trx }))}
            cols={[{ key: "Tanggal", label: "Tanggal" }, { key: "Omzet", label: "Omzet", money: true }, { key: "Struk", label: "Struk" }]}
          >
            {teramai && (
              <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-800">🔥 Hari teramai</p>
                  <p className="text-sm font-bold">{tglPanjang(teramai.tgl)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-800">Omzet tertinggi</p>
                  <p className="text-sm font-bold tabular-nums">{rupiah(teramai.__total)} · {angka(teramai.__trx)} struk</p>
                </div>
                <div className="rounded-xl bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-800">🧊 Hari tersepi</p>
                  <p className="text-sm font-bold">{tglPanjang(tersepi.tgl)}</p>
                </div>
                <div className="rounded-xl bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-800">Omzet terendah</p>
                  <p className="text-sm font-bold tabular-nums">{rupiah(tersepi.__total)} · {angka(tersepi.__trx)} struk</p>
                </div>
              </div>
            )}
            <TrendChart data={tren} series={tampil.map((o) => ({ key: o.id, name: o.nama, color: warna[o.id] }))} />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <Kartu judul="🏆 Menu terlaris (bestseller)" keterangan="10 teratas berdasarkan jumlah terjual">
              <ol className="space-y-2">
                {menu.slice(0, 10).map((m, i) => (
                  <li key={m.nama} className="flex items-center gap-3">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-stone-300 text-kopi-900" : i === 2 ? "bg-orange-300 text-kopi-900" : "bg-matur-50 text-matur-800"}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold text-kopi-900">{m.nama}</p>
                        <p className="shrink-0 text-sm font-bold tabular-nums">{angka(Number(m.qty))} terjual</p>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-matur-50">
                        <div className="h-full rounded-full bg-gradient-to-r from-matur-400 to-orange-500" style={{ width: `${(Number(m.qty) / Number(menu[0].qty)) * 100}%` }} />
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {rupiah(Number(m.omzet))} · {totalQty ? Math.round((Number(m.qty) / totalQty) * 100) : 0}% dari semua item
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Kartu>

            <div className="space-y-4">
              <Kartu judul="🐢 Menu kurang laku" keterangan="5 terbawah dari menu yang terjual di rentang ini">
                {menu.length <= 5 ? (
                  <p className="text-sm text-stone-500">Menu terjual masih sedikit, belum bisa dibandingkan.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 text-sm">
                    {menu.slice(-5).reverse().map((m) => (
                      <li key={m.nama} className="flex justify-between gap-2 py-1.5">
                        <span className="truncate">{m.nama}</span>
                        <span className="shrink-0 tabular-nums text-stone-600">{angka(Number(m.qty))} terjual</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Kartu>
              <ChartCard title="Kanal penjualan" sub="Omzet per kanal" rows={kanal.map((c) => ({ Kanal: c.name, Omzet: c.value, Struk: c.trx }))} cols={[{ key: "Kanal", label: "Kanal" }, { key: "Omzet", label: "Omzet", money: true }, { key: "Struk", label: "Struk" }]}>
                <BarList data={kanal} colors={kanal.map((_, i) => SERIES[i % SERIES.length])} />
              </ChartCard>
            </div>
          </div>

          <Kartu judul="⏰ Ramai & sepi" keterangan={`Jumlah struk per jam${buka ? ` · jam buka ${jamLabel(buka[0]).slice(0, 5)}–${String(buka[1]).padStart(2, "0")}.00` : ""}`}>
            <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-xl bg-red-50 px-3 py-2">
                <p className="text-xs text-red-700">🔥 Jam teramai</p>
                <p className="text-sm font-bold">{jamRamai ? jamLabel(jamRamai.jam) : "-"}</p>
                <p className="text-xs text-stone-500">{jamRamai ? `${angka(jamRamai.trx)} struk` : ""}</p>
              </div>
              <div className="rounded-xl bg-sky-50 px-3 py-2">
                <p className="text-xs text-sky-700">🧊 Jam tersepi{buka ? " (saat buka)" : ""}</p>
                <p className="text-sm font-bold">{jamSepi ? jamLabel(jamSepi.jam) : "-"}</p>
                <p className="text-xs text-stone-500">{jamSepi ? `${angka(jamSepi.trx)} struk` : ""}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 px-3 py-2">
                <p className="text-xs text-emerald-700">📅 Hari teramai (per pekan)</p>
                <p className="text-sm font-bold">{dowUrut[0] ? HARI_ISO[dowUrut[0][0]] : "-"}</p>
                <p className="text-xs text-stone-500">{dowUrut[0] ? rupiah(dowUrut[0][1]) : ""}</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-700">📅 Hari tersepi (per pekan)</p>
                <p className="text-sm font-bold">{dowUrut.length > 1 ? HARI_ISO[dowUrut[dowUrut.length - 1][0]] : "-"}</p>
                <p className="text-xs text-stone-500">{dowUrut.length > 1 ? rupiah(dowUrut[dowUrut.length - 1][1]) : ""}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="flex h-40 min-w-[480px] items-end gap-1">
                {jamUrut.map((j) => (
                  <div key={j.jam} className="flex flex-1 flex-col items-center gap-1" title={`${jamLabel(j.jam)} · ${j.trx} struk`}>
                    <span className="text-[10px] tabular-nums text-stone-500">{j.trx || ""}</span>
                    <div
                      className={`w-full rounded-t-md ${j.trx === jamRamai?.trx && j.trx > 0 ? "bg-red-500" : j.trx === 0 ? "bg-stone-200" : "bg-matur-400"}`}
                      style={{ height: `${Math.max(4, (j.trx / jamMaks) * 110)}px` }}
                    />
                    <span className="text-[10px] font-semibold text-stone-600">{String(j.jam).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-matur-700">Lihat peta ramai per hari & jam</summary>
              <div className="mt-3">
                <Heatmap cells={d.jam} buka={buka?.[0]} tutup={buka?.[1]} />
              </div>
            </details>
          </Kartu>

          {!outletId && cabang.length > 1 && (
            <ChartCard title="Omzet per outlet" sub="Perbandingan outlet pada rentang ini" rows={cabang.map((c) => ({ Outlet: c.name, Omzet: c.value, Struk: c.trx }))} cols={[{ key: "Outlet", label: "Outlet" }, { key: "Omzet", label: "Omzet", money: true }, { key: "Struk", label: "Struk" }]}>
              <BarList data={cabang} colors={cabang.map((c) => warna[c.id] ?? SERIES[0])} />
            </ChartCard>
          )}

          <p className="text-center text-xs text-stone-400">
            <Badge>👁 Mode pantau</Badge> Hanya menampilkan omzet & penjualan. Data dihitung dari struk lunas POS (bukan mode simulasi).
          </p>
        </>
      )}
    </div>
  );
}
