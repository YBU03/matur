import { BarList, ChartCard, Heatmap, StatTile, TrendChart } from "@/components/charts";
import { LipatHp } from "@/components/lipat-hp";
import { SERIES, angka, rupiah } from "@/lib/chart-utils";
import { stokMenipis, type Menipis } from "@/lib/stok-menipis";
import { supabaseServer } from "@/lib/supabase/server";

export type Ringkasan = {
  kpi: { omzet: number; trx: number; hpp: number; diskon: number };
  harian: { tgl: string; outlet_id: string; omzet: number; trx: number }[];
  kanal: { kanal: string; omzet: number; trx: number }[];
  jam: { dow: number; jam: number; trx: number }[];
  menu: { nama: string; qty: number; omzet: number }[];
  kategori?: { nama: string; qty: number; omzet: number }[];
  outlet: { outlet_id: string; nama: string; omzet: number; trx: number; hpp: number }[];
  shift_terbuka: number;
};

const KANAL: Record<string, string> = {
  langsung: "Langsung", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood", tiktok: "TikTok Go", ruma_app: "Ruma App", tumbler: "Tumbler",
};
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
function jakartaToday() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }).replace(/,.*/, "") + " UTC");
}
const tglRe = /^\d{4}-\d{2}(-\d{2})?$/;

export function rentang(periode: string, kDari?: string, kSampai?: string) {
  const t = jakartaToday();
  const hasil = (dari: Date, sampai: Date) => {
    const hari = Math.max(Math.round((sampai.getTime() - dari.getTime()) / 86400000) + 1, 1);
    // periode sebelumnya dengan panjang sama, untuk perbandingan
    return { dari: iso(dari), sampai: iso(sampai), hari, prevDari: iso(new Date(dari.getTime() - hari * 86400000)), prevSampai: iso(new Date(dari.getTime() - 86400000)) };
  };
  if (periode === "kustom" && tglRe.test(kDari ?? "") && tglRe.test(kSampai ?? "")) {
    const [a, b] = [kDari!, kSampai!].sort();
    const dari = new Date((a.length === 7 ? a + "-01" : a) + "T00:00:00Z");
    const akhir = b.length === 7 ? new Date(Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)), 0)) : new Date(b + "T00:00:00Z");
    return hasil(dari, akhir > t ? t : akhir);
  }
  const back = (n: number) => new Date(t.getTime() - n * 86400000);
  if (periode === "kemarin") return hasil(back(1), back(1));
  if (periode === "bulan_lalu") return hasil(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)), new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)));
  const dari =
    periode === "hari" ? t : periode === "7" ? back(6) : periode === "90" ? back(89) : periode === "12bln" ? back(364) : periode === "bulan" ? new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)) : back(29);
  return hasil(dari, t);
}

function bucket(tgl: string, hari: number) {
  const d = new Date(tgl + "T00:00:00Z");
  if (hari <= 31) return { key: tgl, label: `${d.getUTCDate()} ${BLN[d.getUTCMonth()]}` };
  if (hari <= 120) {
    const senin = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000);
    return { key: iso(senin), label: `${senin.getUTCDate()} ${BLN[senin.getUTCMonth()]}` };
  }
  return { key: tgl.slice(0, 7), label: `${BLN[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` };
}
const labelTgl = (tgl: string) => {
  const d = new Date(tgl + "T00:00:00Z");
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
/** "09.00 - 22.00 WIB" → [9, 22] */
function jamBuka(teks: string | null | undefined): [number, number] | null {
  const m = teks?.match(/(\d{1,2})[.:]\d{2}\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  const tutup = Number(m[2]) + (Number(m[3]) > 0 ? 1 : 0);
  return [Number(m[1]), tutup <= Number(m[1]) ? 24 : tutup];
}

const delta = (now: number, prev: number) => (prev ? `${now >= prev ? "▲" : "▼"} ${Math.abs(Math.round(((now - prev) / prev) * 100))}% vs periode sebelumnya` : undefined);
const warnaUrut = (n: number) => Array.from({ length: n }, (_, i) => SERIES[i % SERIES.length]);

// Penjualan harian dari transaksi POS (mirip dasbor Luna). `tanpaRupiah`: Admin Gudang hanya melihat jumlah, bukan omzet.
export async function SalesDashboard({
  outlets,
  outletId,
  periode,
  kDari,
  kSampai,
  mode,
  tanpaRupiah = false,
  ringkasHp = false,
}: {
  outlets: { id: string; nama: string; jam_operasional?: string | null }[];
  outletId: string | null;
  periode: string;
  kDari?: string;
  kSampai?: string;
  mode: "asli" | "simulasi";
  tanpaRupiah?: boolean;
  /** tampilan HP ringkas: kotak buka-tutup (Dashboard POS admin) */
  ringkasHp?: boolean;
}) {
  const r = rentang(periode, kDari, kSampai);
  const supabase = await supabaseServer();
  const tampilOutlet = outletId ? outlets.filter((o) => o.id === outletId) : outlets;
  const [{ data: now }, { data: prev }, menipis] = await Promise.all([
    supabase.rpc("ringkasan_penjualan", { p_outlet: outletId, p_dari: r.dari, p_sampai: r.sampai, p_mode: mode }),
    supabase.rpc("ringkasan_penjualan", { p_outlet: outletId, p_dari: r.prevDari, p_sampai: r.prevSampai, p_mode: mode }),
    mode === "asli" ? stokMenipis(tampilOutlet) : Promise.resolve([]),
  ]);
  return <SalesView d={now as Ringkasan | null} p={prev as Ringkasan | null} menipis={menipis} outlets={outlets} outletId={outletId} r={r} mode={mode} tanpaRupiah={tanpaRupiah} ringkasHp={ringkasHp} />;
}

export function SalesView({
  d,
  p,
  menipis,
  outlets,
  outletId,
  r,
  mode,
  tanpaRupiah,
  ringkasHp = false,
}: {
  d: Ringkasan | null;
  p: Ringkasan | null;
  menipis: Menipis[];
  outlets: { id: string; nama: string; jam_operasional?: string | null }[];
  outletId: string | null;
  r: ReturnType<typeof rentang>;
  mode: "asli" | "simulasi";
  tanpaRupiah: boolean;
  ringkasHp?: boolean;
}) {
  const k = d?.kpi ?? { omzet: 0, trx: 0, hpp: 0, diskon: 0 };
  const pk = p?.kpi ?? { omzet: 0, trx: 0, hpp: 0, diskon: 0 };

  // warna tetap per outlet (urutan nama), tidak berubah saat difilter
  const color = Object.fromEntries(outlets.map((o, i) => [o.id, SERIES[i % SERIES.length]]));
  const nama = Object.fromEntries(outlets.map((o) => [o.id, o.nama]));
  const shown = outletId ? outlets.filter((o) => o.id === outletId) : outlets.filter((o) => d?.harian.some((h) => h.outlet_id === o.id));

  const buckets = new Map<string, Record<string, string | number>>();
  const perHari = new Map<string, number>();
  for (const h of d?.harian ?? []) {
    const b = bucket(h.tgl, r.hari);
    const row = buckets.get(b.key) ?? { label: b.label };
    row[h.outlet_id] = Number(row[h.outlet_id] ?? 0) + h.omzet;
    buckets.set(b.key, row);
    perHari.set(h.tgl, (perHari.get(h.tgl) ?? 0) + h.omzet);
  }
  const trend = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  const satuan = r.hari <= 31 ? "harian" : r.hari <= 120 ? "mingguan" : "bulanan";
  const hariUrut = [...perHari.entries()].sort((a, b) => b[1] - a[1]);
  const ramai = hariUrut[0];
  const sepi = hariUrut[hariUrut.length - 1];

  const menu = d?.menu ?? [];
  const menuRp = [...menu].sort((a, b) => b.omzet - a.omzet);
  const kategori = d?.kategori ?? [];
  const kategoriQty = [...kategori].sort((a, b) => b.qty - a.qty);
  const kanal = (d?.kanal ?? []).map((x) => ({ name: KANAL[x.kanal] ?? x.kanal, value: x.omzet, trx: x.trx }));
  const cabang = (d?.outlet ?? []).map((o) => ({ name: o.nama, value: o.omzet, id: o.outlet_id, trx: o.trx }));
  const qtyTotal = menu.reduce((s, m) => s + Number(m.qty), 0);
  const kotor = k.omzet + k.diskon;
  const perJam = new Map<number, number>();
  for (const c of d?.jam ?? []) perJam.set(c.jam, (perJam.get(c.jam) ?? 0) + Number(c.trx));
  const jamTop = [...perJam.entries()].sort((a, b) => b[1] - a[1])[0];
  const lipat = ringkasHp;
  const jam = jamBuka((outletId ? outlets.find((o) => o.id === outletId) : outlets.find((o) => o.jam_operasional))?.jam_operasional);

  return (
    <section className={`lg:space-y-4 ${lipat ? "space-y-2" : "space-y-4"}`}>
      {mode === "simulasi" && (
        <div className="rounded-xl bg-[repeating-linear-gradient(45deg,#fde68a_0_12px,#fef3c7_12px_24px)] px-4 py-2 text-center text-sm font-bold tracking-wide text-amber-900">
          MODE SIMULASI — data latihan, bukan data asli
        </div>
      )}
      {(d?.shift_terbuka ?? 0) > 0 && mode === "asli" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">⚠️ {d!.shift_terbuka} shift kasir belum ditutup.</p>
      )}
      {k.trx === 0 && (
        <p className="rounded-2xl border border-dashed border-matur-300 bg-white px-4 py-6 text-center text-sm text-stone-500">
          Belum ada transaksi kasir {mode === "asli" ? "asli " : ""}pada rentang ini. Data terisi otomatis begitu kasir berjualan lewat POS Matoer.
        </p>
      )}

      {k.trx > 0 && (
        <>
          {lipat && (
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-kopi-900 to-kopi-700 p-5 text-white shadow-md lg:hidden">
              <span className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10" aria-hidden />
              <p className="text-xs text-white/70">{labelTgl(r.dari)}{r.dari !== r.sampai && ` – ${labelTgl(r.sampai)}`}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/70">{tanpaRupiah ? "Jumlah struk" : "Penjualan bersih"}</p>
              <p className="text-3xl font-black tabular-nums">{tanpaRupiah ? angka(k.trx) : rupiah(k.omzet)}</p>
              {(tanpaRupiah ? delta(k.trx, pk.trx) : delta(k.omzet, pk.omzet)) && (
                <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${(tanpaRupiah ? k.trx >= pk.trx : k.omzet >= pk.omzet) ? "bg-emerald-400/20 text-emerald-200" : "bg-red-400/20 text-red-200"}`}>
                  {tanpaRupiah ? delta(k.trx, pk.trx) : delta(k.omzet, pk.omzet)}
                </p>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-center">
                <div>
                  <p className="text-[11px] text-white/70">Struk</p>
                  <p className="font-bold tabular-nums">{angka(k.trx)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-white/70">{tanpaRupiah ? "Item" : "Per struk"}</p>
                  <p className="font-bold tabular-nums">{tanpaRupiah ? angka(qtyTotal) : rupiah(k.omzet / k.trx).replace("Rp ", "")}</p>
                </div>
                <div>
                  <p className="text-[11px] text-white/70">Struk/hari</p>
                  <p className="font-bold tabular-nums">{angka(Math.round(k.trx / r.hari))}</p>
                </div>
              </div>
            </section>
          )}
          <LipatHp aktif={lipat} ikon="🧮" judul="Angka lainnya" ringkas={tanpaRupiah ? "item terjual, rata-rata harian" : "kotor, laba kotor, margin, item terjual"}>
          <section className="rounded-2xl border border-matur-200 bg-white p-4">
            <h3 className="font-semibold">Ringkasan penjualan</h3>
            <p className="mb-3 text-xs text-stone-500">{labelTgl(r.dari)} – {labelTgl(r.sampai)}</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {!tanpaRupiah && (
                <>
                  <StatTile label="Penjualan kotor" value={rupiah(kotor)} sub={delta(kotor, pk.omzet + pk.diskon)} />
                  <StatTile label="Penjualan bersih" value={rupiah(k.omzet)} sub={k.diskon ? `setelah diskon ${rupiah(k.diskon)}` : "tanpa diskon"} />
                  <StatTile label="Laba kotor (teoritis)" value={rupiah(k.omzet - k.hpp)} sub="penjualan − HPP resep" />
                  <StatTile label="Margin kotor" value={k.omzet ? `${(Math.round(((k.omzet - k.hpp) / k.omzet) * 1000) / 10).toString().replace(".", ",")}%` : "-"} sub={`food cost ${k.omzet ? Math.round((k.hpp / k.omzet) * 100) : 0}%`} />
                </>
              )}
              <StatTile label="Jumlah struk" value={angka(k.trx)} sub={delta(k.trx, pk.trx)} />
              {!tanpaRupiah && <StatTile label="Rata-rata per struk" value={rupiah(k.omzet / k.trx)} />}
              <StatTile label="Item terjual" value={`${angka(qtyTotal)} item`} sub={`± ${angka(Math.round((qtyTotal / k.trx) * 10) / 10)} item per struk`} />
              <StatTile label="Rata-rata struk per hari" value={angka(Math.round(k.trx / r.hari))} sub={`${r.hari} hari`} />
            </div>
          </section>
          </LipatHp>

          {!tanpaRupiah && (
            <LipatHp aktif={lipat} ikon="📈" judul="Tren penjualan" ringkas={ramai ? `Teramai ${labelTgl(ramai[0])}` : undefined}>
            <ChartCard
              title="Penjualan"
              sub={`Omzet ${satuan}${shown.length > 1 ? " per outlet" : ""}`}
              rows={trend.map((t) => ({ Periode: t.label, ...Object.fromEntries(shown.map((o) => [o.nama, Number(t[o.id] ?? 0)])) }))}
              cols={[{ key: "Periode", label: "Periode" }, ...shown.map((o) => ({ key: o.nama, label: o.nama, money: true }))]}
            >
              {ramai && (
                <div className="mb-3 grid grid-cols-2 gap-2 text-center lg:grid-cols-4">
                  {[
                    ["Hari teramai", labelTgl(ramai[0])],
                    ["Omzet tertinggi", rupiah(ramai[1])],
                    ["Hari tersepi", labelTgl(sepi[0])],
                    ["Omzet terendah", rupiah(sepi[1])],
                  ].map(([l, v], i) => (
                    <div key={l} className={`rounded-xl px-2 py-2 ${i < 2 ? "bg-green-50" : "bg-amber-50"}`}>
                      <p className="text-xs text-stone-500">{l}</p>
                      <p className="text-sm font-bold tabular-nums">{v}</p>
                    </div>
                  ))}
                </div>
              )}
              <TrendChart data={trend} series={shown.map((o) => ({ key: o.id, name: nama[o.id], color: color[o.id] }))} />
            </ChartCard>
            </LipatHp>
          )}

          <div className={`grid lg:grid-cols-2 lg:gap-4 ${lipat ? "gap-2" : "gap-4"}`}>
            {!tanpaRupiah && !outletId && cabang.length > 1 && (
              <LipatHp aktif={lipat} ikon="🏪" judul="Omzet per outlet" ringkas={cabang[0] ? `Teratas: ${cabang[0].name}` : undefined}>
              <ChartCard title="Top outlet" sub="Omzet per outlet" rows={cabang.map((c) => ({ Outlet: c.name, Omzet: c.value, Transaksi: c.trx }))} cols={[{ key: "Outlet", label: "Outlet" }, { key: "Omzet", label: "Omzet", money: true }, { key: "Transaksi", label: "Transaksi" }]}>
                <BarList data={cabang} colors={cabang.map((c) => color[c.id] ?? SERIES[0])} />
              </ChartCard>
              </LipatHp>
            )}
            {!tanpaRupiah && (
              <LipatHp aktif={lipat} ikon="🛵" judul="Kanal penjualan" ringkas={kanal[0] ? `Terbesar: ${kanal[0].name}` : undefined}>
              <ChartCard title="Kanal penjualan" sub="Omzet per kanal" rows={kanal.map((c) => ({ Kanal: c.name, Omzet: c.value, Transaksi: c.trx }))} cols={[{ key: "Kanal", label: "Kanal" }, { key: "Omzet", label: "Omzet", money: true }, { key: "Transaksi", label: "Transaksi" }]}>
                <BarList data={kanal} colors={warnaUrut(kanal.length)} />
              </ChartCard>
              </LipatHp>
            )}
            {!tanpaRupiah && (
              <LipatHp aktif={lipat} ikon="💰" judul="Menu teratas (Rp)" ringkas={menuRp[0] ? `#1 ${menuRp[0].nama}` : undefined}>
              <ChartCard title="Top produk berdasarkan nominal" sub="10 teratas (Rp)" rows={menuRp.slice(0, 10).map((m) => ({ Menu: m.nama, Omzet: m.omzet, Terjual: m.qty }))} cols={[{ key: "Menu", label: "Menu" }, { key: "Omzet", label: "Omzet", money: true }, { key: "Terjual", label: "Terjual" }]}>
                <BarList data={menuRp.slice(0, 10).map((m) => ({ name: m.nama, value: m.omzet }))} colors={warnaUrut(10)} />
              </ChartCard>
              </LipatHp>
            )}
            <LipatHp aktif={lipat} ikon="🏆" judul="Menu terlaris" ringkas={menu[0] ? `#1 ${menu[0].nama} · ${angka(Number(menu[0].qty))} terjual` : undefined}>
              <ChartCard title="Top produk berdasarkan qty" sub="10 teratas (jumlah terjual)" rows={menu.slice(0, 10).map((m) => ({ Menu: m.nama, Terjual: m.qty }))} cols={[{ key: "Menu", label: "Menu" }, { key: "Terjual", label: "Terjual" }]}>
              <BarList data={menu.slice(0, 10).map((m) => ({ name: m.nama, value: m.qty }))} money={false} unit=" cup" colors={warnaUrut(10)} />
            </ChartCard>
              </LipatHp>
            {kategori.length > 0 && !tanpaRupiah && (
              <LipatHp aktif={lipat} ikon="🗂️" judul="Kategori (Rp)" ringkas={kategori[0] ? `#1 ${kategori[0].nama}` : undefined}>
              <ChartCard title="Top kategori berdasarkan nominal" sub="Omzet per kategori menu" rows={kategori.map((m) => ({ Kategori: m.nama, Omzet: m.omzet }))} cols={[{ key: "Kategori", label: "Kategori" }, { key: "Omzet", label: "Omzet", money: true }]}>
                <BarList data={kategori.map((m) => ({ name: m.nama, value: m.omzet }))} colors={warnaUrut(kategori.length)} />
              </ChartCard>
              </LipatHp>
            )}
            {kategori.length > 0 && (
              <LipatHp aktif={lipat} ikon="🗂️" judul="Kategori (qty)" ringkas={kategoriQty[0] ? `#1 ${kategoriQty[0].nama}` : undefined}>
              <ChartCard title="Top kategori berdasarkan qty" sub="Jumlah terjual per kategori" rows={kategoriQty.map((m) => ({ Kategori: m.nama, Terjual: m.qty }))} cols={[{ key: "Kategori", label: "Kategori" }, { key: "Terjual", label: "Terjual" }]}>
                <BarList data={kategoriQty.map((m) => ({ name: m.nama, value: m.qty }))} money={false} unit=" item" colors={warnaUrut(kategoriQty.length)} />
              </ChartCard>
              </LipatHp>
            )}
            <LipatHp aktif={lipat} ikon="🐢" judul="Menu kurang laku" ringkas={"5 terbawah berdasarkan jumlah terjual"}>
              <ChartCard title="Menu kurang laku" sub="5 terbawah berdasarkan jumlah terjual" rows={menu.slice(-5).reverse().map((m) => ({ Menu: m.nama, Terjual: m.qty }))} cols={[{ key: "Menu", label: "Menu" }, { key: "Terjual", label: "Terjual" }]}>
              <BarList data={menu.slice(-5).reverse().map((m) => ({ name: m.nama, value: m.qty }))} money={false} unit=" cup" max={menu[0]?.qty} />
            </ChartCard>
              </LipatHp>
          </div>

          <LipatHp aktif={lipat} ikon="⏰" judul="Jam ramai & sepi" ringkas={jamTop ? `Teramai pukul ${String(jamTop[0]).padStart(2, "0")}.00–${String(jamTop[0] + 1).padStart(2, "0")}.00` : undefined}>
          <ChartCard
            title="Jam ramai"
            sub={`Jumlah transaksi per hari dan jam${jam ? ` · jam buka ${String(jam[0]).padStart(2, "0")}.00–${String(jam[1]).padStart(2, "0")}.00` : ""}`}
            rows={(d?.jam ?? []).map((c) => ({ Hari: ["", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][c.dow], Jam: `${c.jam}.00`, Transaksi: c.trx }))}
            cols={[{ key: "Hari", label: "Hari" }, { key: "Jam", label: "Jam" }, { key: "Transaksi", label: "Transaksi" }]}
          >
            <Heatmap cells={d?.jam ?? []} buka={jam?.[0]} tutup={jam?.[1]} />
          </ChartCard>
          </LipatHp>
        </>
      )}

      {menipis.length > 0 && (
        <LipatHp aktif={lipat} ikon="⚠️" judul="Stok menipis" ringkas={`${menipis.reduce((a, m) => a + m.items.length, 0)} bahan di bawah batas minimum`}>
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <h3 className="font-bold">⚠️ Produk dengan stok rendah</h3>
          <p className="mb-2 text-xs text-stone-600">Bahan resep di bawah batas minimum, berkurang otomatis dari penjualan kasir.</p>
          {menipis.map((m) => (
            <div key={m.outletId} className="mt-2">
              {menipis.length > 1 && <p className="text-sm font-semibold">{m.outlet}</p>}
              <ul className="grid gap-x-6 text-sm sm:grid-cols-2">
                {m.items.slice(0, 12).map((i) => (
                  <li key={i.nama} className="flex justify-between border-b border-amber-200 py-1">
                    <span>{i.nama}</span>
                    <span className="tabular-nums text-stone-600">sisa {i.sisa}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        </LipatHp>
      )}
    </section>
  );
}
