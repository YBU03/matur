"use client";

// Tampilan Campaign & Promo untuk Mitra (hanya baca). Timer berjalan lokal; data dari RPC promo_mitra.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah as rp } from "@/lib/format";
import { Badge, BarisAngka, HeaderHalaman, Kartu, KartuAngka, Kosong, tabKelas } from "@/components/ui-halaman";
import { syaratPromo, hargaPromoDenganBatas, hitungMundur, labelKuota, labelNilai, labelWaktu, mulaiLagi, rentangTanggal, statusPromo } from "@/lib/promo-tampilan";
import type { AturanPromo, KuotaPromoHarian, Promo } from "@/lib/promo";

export type AturanMitra = AturanPromo & { menu_nama?: string | null; kemasan?: string | null; harga_langsung?: number | null; harga_ojol?: number | null };
export type PemakaianMitra = { tanggal: string; promo_id: string; promo: string; transaksi: number; item: number; potongan: number; subsidi: boolean };
export type PromoMitra = Omit<Promo, "aturan"> & { aturan: AturanMitra[] };
type Kelompok = "berlangsung" | "datang" | "selesai";
const isian = "rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";
const jam = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

function kelompok(p: PromoMitra, now: number): Kelompok {
  if (p.berakhir_at && Date.parse(p.berakhir_at) > now) return "berlangsung";
  return statusPromo(p, now) === "selesai" ? "selesai" : "datang";
}

function BarKuota({ p, unit }: { p: PromoMitra; unit: string }) {
  if (!p.kuota || !p.sisa_kuota) return null;
  const nama = (k: string) => (k === "semua" ? "Sisa kuota hari ini" : p.aturan.find((a) => a.menu_id === k)?.menu_nama ?? "Menu");
  return (
    <div className="space-y-1.5">
      {Object.entries(p.sisa_kuota).map(([k, sisa]) => {
        const pct = Math.min(100, Math.round(((p.kuota! - sisa) / p.kuota!) * 100));
        const habis = sisa <= 0, tipis = !habis && sisa <= Math.ceil(p.kuota! * 0.2);
        return (
          <div key={k}>
            <div className="flex items-center justify-between gap-2 text-xs font-semibold">
              <span className="truncate">{nama(k)}</span>
              <span className="tabular-nums">{habis ? "Kuota terpenuhi ✅" : `${sisa} / ${p.kuota} ${unit}`}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/30">
              <div className={`h-full rounded-full transition-all duration-700 ${habis ? "bg-emerald-200" : tipis ? "bg-amber-200" : "bg-white"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Detail({ p }: { p: PromoMitra }) {
  const potongan = (a: AturanMitra) => (a.jenis === "persen" ? `${a.nilai}%` : a.jenis === "potongan" ? rp(a.nilai) : a.jenis === "gratis" ? "Gratis" : "Harga tetap");
  return (
    <div className="space-y-3 text-sm text-kopi-900">
      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-matur-50 px-3 py-2"><dt className="text-[11px] font-semibold text-stone-500">📅 Periode</dt><dd className="font-semibold">{rentangTanggal(p.mulai, p.selesai)}</dd></div>
        <div className="rounded-xl bg-matur-50 px-3 py-2"><dt className="text-[11px] font-semibold text-stone-500">🕘 Hari & jam</dt><dd className="font-semibold">{labelWaktu(p)}</dd></div>
        <div className="rounded-xl bg-matur-50 px-3 py-2"><dt className="text-[11px] font-semibold text-stone-500">🎟️ Kuota</dt><dd className="font-semibold">{labelKuota(p)}</dd></div>
        <div className="rounded-xl bg-matur-50 px-3 py-2">
          <dt className="text-[11px] font-semibold text-stone-500">ℹ️ Ketentuan</dt>
          <dd className="font-semibold">
            {p.cakupan === "transaksi" ? "Voucher sekali per transaksi" : "Potongan per cup/menu"}
            {syaratPromo(p) ? ` · ${syaratPromo(p)}` : ""}
            {p.subsidi ? ` · ditanggung ${p.nama_subsidi || "subsidi kantor"}` : ""}
          </dd>
        </div>
      </dl>
      {p.cakupan === "transaksi" ? (
        <p className="rounded-xl border border-matur-100 px-3 py-2 text-xs text-stone-600">Berlaku bila keranjang berisi salah satu menu: <b>{p.aturan.map((a) => a.menu_nama ?? "Menu").join(", ")}</b>. Potongan {rp(p.nilai_voucher ?? 0)} sekali per transaksi.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-matur-100">
          {p.batas_diskon && <p className="bg-amber-50 p-3 text-xs text-amber-900">Simulasi harga untuk satu item setelah minimum belanja terpenuhi. Jika beberapa menu digabung, total diskon tetap maksimal {rp(p.batas_diskon)} untuk satu transaksi.</p>}
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-matur-50 text-left text-[11px] font-semibold uppercase tracking-wide text-matur-800">
              <tr><th className="px-3 py-2">Menu</th><th className="px-3 py-2 text-right">Harga normal</th><th className="px-3 py-2 text-right">Potongan</th><th className="px-3 py-2 text-right">Harga akhir</th></tr>
            </thead>
            <tbody>
              {p.aturan.map((a, i) => {
                const h = Number(a.harga_langsung ?? 0), ho = Number(a.harga_ojol ?? 0);
                return (
                  <tr key={i} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-semibold">{a.menu_nama ?? "Menu"}{a.kemasan ? <span className="font-normal text-stone-500"> · {a.kemasan}</span> : null}{a.varian_ids.length ? <span className="block text-[11px] font-normal text-stone-500">dengan varian tertentu</span> : null}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-500">{h ? rp(h) : "—"}{ho ? <span className="block text-[11px]">ojol {rp(ho)}</span> : null}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-red-600">{potongan(a)}</td>
                    <td className="px-3 py-2 text-right font-extrabold tabular-nums text-matur-700">{h ? rp(hargaPromoDenganBatas(h, a.jenis, a.nilai,p.batas_diskon)) : a.jenis === "harga_akhir" ? rp(a.nilai) : "—"}{ho ? <span className="block text-[11px] font-semibold">ojol {rp(hargaPromoDenganBatas(ho, a.jenis, a.nilai,p.batas_diskon))}</span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CampaignMitra({ outlets, outletId, dari, sampai, hariIni, promos, kuota, pemakaian, error }: {
  outlets: { id: string; nama: string }[]; outletId: string; dari: string; sampai: string; hariIni: string;
  promos: PromoMitra[]; kuota: KuotaPromoHarian[]; pemakaian: PemakaianMitra[]; error?: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Kelompok>("berlangsung");
  const [buka, setBuka] = useState<string | null>(null);
  const grup = useMemo(() => promos.map((p) => ({ p, k: kelompok(p, now) })), [promos, now]);
  const adaLive = grup.some((g) => g.k === "berlangsung");
  useEffect(() => {
    if (!adaLive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [adaLive]);
  // Segarkan data tiap 3 menit (kuota & slot berikutnya).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 180_000);
    return () => clearInterval(t);
  }, [router]);
  const hitung = { berlangsung: 0, datang: 0, selesai: 0 } as Record<Kelompok, number>;
  for (const g of grup) hitung[g.k]++;
  const hariIniPakai = pemakaian.filter((x) => x.tanggal === hariIni);
  const totalPotongan = pemakaian.reduce((s, x) => s + Number(x.potongan), 0);
  const tanggal = [...new Set([...pemakaian.map((x) => x.tanggal), ...kuota.map((x) => x.tanggal)])].sort().reverse();
  const tampil = grup.filter((g) => g.k === tab);
  const outletNama = outlets.find((o) => o.id === outletId)?.nama ?? "Outlet";

  return (
    <div className="space-y-5">
      <HeaderHalaman ikon="🎯" judul="Campaign & Promo" keterangan={`Promo yang sedang dan akan berjalan di ${outletNama}, lengkap dengan kuota dan pemakaiannya. Hanya untuk dilihat.`}>
        {outlets.length > 1 && (
          <select aria-label="Pilih outlet" className="rounded-xl bg-white/90 px-3 py-1.5 text-sm font-semibold text-kopi-900" value={outletId} onChange={(e) => router.push(`/portal/promo?outlet=${e.target.value}`)}>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
          </select>
        )}
      </HeaderHalaman>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <BarisAngka>
        <KartuAngka ikon="🔥" nada="hijau" label="Sedang berlangsung" nilai={hitung.berlangsung} sub="promo aktif saat ini" />
        <KartuAngka ikon="🗓️" nada="biru" label="Akan datang" nilai={hitung.datang} sub="terjadwal / slot berikutnya" />
        <KartuAngka ikon="🧾" nada="netral" label="Transaksi promo hari ini" nilai={hariIniPakai.reduce((s, x) => s + Number(x.transaksi), 0)} sub={`${hariIniPakai.reduce((s, x) => s + Number(x.item), 0)} item`} />
        <KartuAngka ikon="💸" nada="ungu" label="Potongan hari ini" nilai={<span className="block whitespace-normal text-lg sm:text-xl">{rp(hariIniPakai.reduce((s, x) => s + Number(x.potongan), 0))}</span>} sub="mengurangi omzet outlet" />
      </BarisAngka>

      <section className="space-y-3">
        <div className={tabKelas.wadah} role="tablist" aria-label="Status campaign">
          {([["berlangsung", "🔥 Berlangsung"], ["datang", "🗓️ Akan datang"], ["selesai", "✔️ Selesai"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? tabKelas.aktif : tabKelas.pasif} onClick={() => setTab(k)}>
              {l}<span className="ml-1 text-xs font-normal text-stone-400">{hitung[k]}</span>
            </button>
          ))}
        </div>
        {tampil.length ? (
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {tampil.map(({ p, k }) => {
              const terbuka = buka === p.id;
              const unit = p.cakupan === "transaksi" ? "transaksi" : "cup";
              if (k === "berlangsung") {
                const sisaMs = Date.parse(p.berakhir_at!) - now, kritis = sisaMs <= 10 * 60_000;
                return (
                  <article key={p.id} className="overflow-hidden rounded-2xl border border-matur-100 bg-white shadow-sm">
                    <button type="button" aria-expanded={terbuka} onClick={() => setBuka(terbuka ? null : p.id)} className={`relative block w-full overflow-hidden p-4 text-left text-white ${kritis ? "bg-gradient-to-br from-rose-500 via-red-500 to-orange-500" : "bg-gradient-to-br from-matur-400 via-matur-500 to-orange-600"}`}>
                      <span className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10" aria-hidden />
                      <div className="relative flex items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl backdrop-blur">🏷️</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white/90 [overflow-wrap:anywhere]">{p.nama}</p>
                          <p className="text-xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere]">{labelNilai(p)}</p>
                          <p className="mt-0.5 text-[11px] text-white/85">{labelWaktu(p)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">{kritis ? "Segera berakhir" : `Sampai ${jam(p.berakhir_at!)}`}</p>
                          <p className={`font-mono text-lg font-extrabold tabular-nums ${kritis ? "animate-pulse" : ""}`}>⏱ {hitungMundur(sisaMs)}</p>
                        </div>
                      </div>
                      <div className="relative mt-3"><BarKuota p={p} unit={unit} /></div>
                      <p className="relative mt-2 text-[11px] font-semibold text-white/85">{terbuka ? "Tutup detail ▲" : "Lihat detail campaign ▼"}</p>
                    </button>
                    {terbuka && <div className="p-4"><Detail p={p} /></div>}
                  </article>
                );
              }
              const lagi = k === "datang" ? mulaiLagi(p, now) : null;
              return (
                <article key={p.id} className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
                  <button type="button" aria-expanded={terbuka} onClick={() => setBuka(terbuka ? null : p.id)} className="block w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-kopi-900 [overflow-wrap:anywhere]">{p.nama}</p>
                        <p className="text-xl font-extrabold text-matur-700">{labelNilai(p)}</p>
                      </div>
                      {k === "selesai" ? <Badge>Selesai</Badge> : lagi ? <Badge nada="biru">Mulai lagi {lagi}</Badge> : <Badge nada="biru">Mulai {rentangTanggal(p.mulai, p.mulai).replace(/ \d{4}$/, "")}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-stone-500">📅 {rentangTanggal(p.mulai, p.selesai)} · 🕘 {labelWaktu(p)}</p>
                    <p className="mt-2 text-[11px] font-semibold text-matur-700">{terbuka ? "Tutup detail ▲" : "Lihat detail campaign ▼"}</p>
                  </button>
                  {terbuka && <div className="mt-3 border-t border-stone-100 pt-3"><Detail p={p} /></div>}
                </article>
              );
            })}
          </div>
        ) : (
          <Kosong ikon="🎯" judul={tab === "berlangsung" ? "Tidak ada promo yang sedang berlangsung" : tab === "datang" ? "Belum ada promo terjadwal" : "Belum ada promo yang selesai"}>
            {tab === "berlangsung" ? "Campaign yang aktif akan muncul di sini lengkap dengan timer dan sisa kuota." : "Campaign dari kantor pusat untuk outlet ini akan tampil di sini."}
          </Kosong>
        )}
      </section>

      <Kartu judul="Riwayat pemakaian & kuota" keterangan={`Total potongan periode ini ${rp(totalPotongan)}. Jam habis = jam transaksi yang memakai kuota terakhir. Transaksi void/hapus tidak dihitung.`}>
        <form className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
          {outlets.length > 1 && <input type="hidden" name="outlet" value={outletId} />}
          <label className="text-xs font-semibold text-stone-600">Dari<input className={`${isian} mt-1 w-full`} type="date" name="dari" defaultValue={dari} /></label>
          <label className="text-xs font-semibold text-stone-600">Sampai<input className={`${isian} mt-1 w-full`} type="date" name="sampai" defaultValue={sampai} /></label>
          <button className="col-span-2 rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white hover:bg-matur-600 sm:col-span-1">Tampilkan</button>
        </form>
        {tanggal.length ? (
          <div className="mt-4 space-y-3">
            {tanggal.map((t) => (
              <div key={t} className="rounded-2xl border border-stone-100 p-3">
                <p className="mb-2 text-sm font-bold text-kopi-900">{rentangTanggal(t, t)}{t === hariIni ? " · hari ini" : ""}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {pemakaian.filter((x) => x.tanggal === t).map((x) => (
                    <div key={x.promo_id} className="flex items-center justify-between gap-2 rounded-xl bg-matur-50/70 px-3 py-2 text-xs">
                      <span className="min-w-0"><b className="block truncate text-sm text-kopi-900">{x.promo}</b>{x.transaksi} transaksi · {x.item} item{x.subsidi ? " · subsidi" : ""}</span>
                      <span className="text-right font-bold tabular-nums text-red-600">−{rp(x.potongan)}</span>
                    </div>
                  ))}
                  {kuota.filter((x) => x.tanggal === t).map((x, i) => {
                    const pct = Math.min(100, Math.round((x.terpakai / x.kuota) * 100));
                    return (
                      <div key={`k${i}`} className={`rounded-xl border px-3 py-2 text-xs ${x.habis_at ? "border-emerald-200 bg-emerald-50/60" : "border-stone-100"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-semibold text-kopi-900">🎟️ {x.promo}{x.menu ? ` · ${x.menu}` : ""}</span>
                          {x.habis_at ? <Badge nada="hijau">Habis {jam(x.habis_at)}</Badge> : <Badge nada="biru">Sisa {Math.max(x.kuota - x.terpakai, 0)}</Badge>}
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${x.habis_at ? "bg-emerald-500" : "bg-matur-400"}`} style={{ width: `${pct}%` }} /></div>
                        <p className="mt-1 tabular-nums text-stone-600">Terpakai {x.terpakai} / {x.kuota} · {x.outlet}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-stone-50 p-3 text-sm text-stone-500">Belum ada pemakaian promo pada periode ini.</p>
        )}
      </Kartu>
    </div>
  );
}
