"use client";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah as rp } from "@/lib/format";
import { PromoMenuFilter } from "@/components/promo-menu-filter";
import type { MenuPromo } from "@/lib/promo-menu";
import { PilihMenuPromo } from "@/components/pilih-menu-promo";
import { simpanPromo, arsipPromo } from "@/lib/promo-actions";
import { tanya } from "@/components/dialog-tanya";
import { Badge, BarisAngka, HeaderHalaman, Kartu, KartuAngka, Kosong, tabKelas, tabel, tombolAksi, tombolHeaderUtama } from "@/components/ui-halaman";
import { KANAL_PROMO, syaratPromo, LABEL_STATUS, NAMA_HARI, PRESET_JAM, SEMUA_HARI, cekSlot, diLuarJam, hargaPromo, jamLegacy, labelKuota, labelNilai, labelWaktu, pesanRamah, rentangTanggal, slotPromo, statusPromo, urutkanPromo, type StatusPromo } from "@/lib/promo-tampilan";
import type { Promo, PemakaianPromo, AturanPromo, KuotaPromoHarian, SlotPromo } from "@/lib/promo";
type Opsi = { id: string; nama: string };
const input =
  "w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm text-kopi-900 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";
const NADA_STATUS = { berjalan: "hijau", terjadwal: "biru", selesai: "netral", nonaktif: "kuning" } as const;
const GARIS_STATUS: Record<StatusPromo, string> = { berjalan: "bg-emerald-500", terjadwal: "bg-sky-500", selesai: "bg-stone-300", nonaktif: "bg-amber-400" };
const bayar = (n: number) => (Number(n) ? rp(n) : "Rp0");
const TAB: ("semua" | "arsip" | StatusPromo)[] = ["semua", "berjalan", "terjadwal", "nonaktif", "selesai", "arsip"];

function Bagian({ no, judul, keterangan, children, warna = "border-matur-100 bg-white" }: { no: number; judul: string; keterangan?: string; children: ReactNode; warna?: string }) {
  return (
    <fieldset className={`space-y-3 rounded-2xl border p-4 ${warna}`}>
      <legend className="flex items-center gap-2 px-1 text-sm font-bold text-kopi-900">
        <span className="grid size-6 place-items-center rounded-full bg-matur-500 text-xs text-white">{no}</span>
        {judul}
      </legend>
      {keterangan && <p className="-mt-1 text-xs text-stone-500">{keterangan}</p>}
      {children}
    </fieldset>
  );
}

function Centang({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className={`flex items-start gap-2 text-sm ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" className="mt-0.5 size-4 accent-matur-600" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** Satu baris harga promo: Harga normal → Potongan (% / Rp) → Harga akhir (otomatis, bisa diketik). */
function BarisHarga({ aturan: a, menu, onUbah, onSamakan }: { aturan: AturanPromo; menu?: { harga_langsung?: number | null; harga_ojol?: number | null }; onUbah: (x: Partial<AturanPromo>) => void; onSamakan?: () => void }) {
  const h = Number(menu?.harga_langsung ?? 0), ho = Number(menu?.harga_ojol ?? 0);
  const mode = a.jenis === "persen" ? "persen" : a.jenis === "gratis" ? "gratis" : "rp";
  const akhir = (x: number) => hargaPromo(x, a.jenis, a.nilai || 0);
  // Nilai potongan yang tampil: persen apa adanya; Rp untuk potongan; untuk harga akhir = selisih dari harga normal.
  const potong = a.jenis === "persen" || a.jenis === "potongan" ? a.nilai || "" : a.jenis === "harga_akhir" ? (h ? Math.max(h - (a.nilai || 0), 0) : "") : h || "";
  const nilaiAkhir = a.jenis === "harga_akhir" ? a.nilai || "" : h ? akhir(h) : "";
  const peringatan = (a.jenis === "persen" && a.nilai > 100) || (a.jenis === "potongan" && h && a.nilai > h) ? "Potongan melebihi harga menu" : a.jenis === "harga_akhir" && h && a.nilai > h ? "Harga akhir lebih mahal dari harga normal" : "";
  const ganti = (m: "persen" | "rp" | "gratis") => {
    if (m === "gratis") return onUbah({ jenis: "gratis", nilai: 100 });
    if (m === "persen") {
      const rpNow = a.jenis === "potongan" ? a.nilai : a.jenis === "harga_akhir" && h ? h - a.nilai : 0;
      return onUbah({ jenis: "persen", nilai: h && rpNow > 0 ? Math.min(100, Math.round((rpNow / h) * 100)) : a.jenis === "persen" ? a.nilai : 10 });
    }
    const rpNow = a.jenis === "persen" && h ? Math.floor((h * a.nilai) / 100) : a.jenis === "harga_akhir" && h ? h - a.nilai : a.jenis === "potongan" ? a.nilai : 0;
    return onUbah({ jenis: "potongan", nilai: Math.max(rpNow, 0) || 1000 });
  };
  const kotak = "w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-right text-sm font-semibold tabular-nums text-kopi-900 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)_auto_minmax(0,1fr)]">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-stone-500">Harga normal</p>
          <p className="rounded-xl bg-stone-100 px-3 py-2 text-right text-sm font-semibold tabular-nums text-stone-600">{h ? rp(h) : "—"}</p>
        </div>
        <span className="hidden pb-2 text-stone-400 sm:block">−</span>
        <div>
          <div className="mb-1 flex items-center justify-between gap-1">
            <p className="text-[11px] font-semibold text-stone-500">Potongan</p>
            <div className="flex overflow-hidden rounded-lg border border-matur-200 text-[11px] font-bold" role="radiogroup" aria-label="Satuan potongan">
              {(["persen", "rp", "gratis"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => ganti(m)} className={`px-2 py-0.5 ${mode === m ? (m === "gratis" ? "bg-emerald-600 text-white" : "bg-matur-500 text-white") : "bg-white text-stone-500"}`}>
                  {m === "persen" ? "%" : m === "rp" ? "Rp" : "Gratis"}
                </button>
              ))}
            </div>
          </div>
          {mode === "gratis" ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-right text-sm font-bold text-emerald-800">100% subsidi</p>
          ) : (
            <div className="relative">
              {mode === "rp" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">Rp</span>}
              <input aria-label="Nilai potongan" type="number" min="1" max={mode === "persen" ? 100 : undefined} inputMode="numeric" className={`${kotak} ${mode === "persen" ? "pr-7" : "pl-8"}`} value={potong} onChange={(e) => onUbah({ jenis: mode === "persen" ? "persen" : "potongan", nilai: Number(e.target.value) })} />
              {mode === "persen" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">%</span>}
            </div>
          )}
        </div>
        <span className="hidden pb-2 text-stone-400 sm:block">=</span>
        <div>
          <p className="mb-1 text-[11px] font-semibold text-matur-700">Harga akhir</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-matur-400">Rp</span>
            <input aria-label="Harga akhir" type="number" min="0" inputMode="numeric" disabled={mode === "gratis"} className={`${kotak} border-matur-400 bg-matur-50 pl-8 text-matur-800`} value={mode === "gratis" ? 0 : nilaiAkhir} onChange={(e) => onUbah({ jenis: "harga_akhir", nilai: Number(e.target.value) })} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {a.jenis === "harga_akhir" && <span className="font-semibold text-sky-700">Harga akhir tetap Rp{new Intl.NumberFormat("id-ID").format(a.nilai || 0)} per cup (termasuk varian)</span>}
        {ho > 0 && <span className="text-stone-500">Ojol: <span className="line-through">{rp(ho)}</span> → <b className="text-kopi-800">{rp(akhir(ho))}</b></span>}
        {mode === "gratis" && <span className="text-emerald-800">🎁 Gratis = ditanggung subsidi kantor</span>}
        {peringatan && <span className="font-semibold text-amber-700">⚠ {peringatan}</span>}
        {onSamakan && <button type="button" onClick={onSamakan} className="ml-auto font-semibold text-matur-700 underline">Samakan potongan ini ke semua menu</button>}
      </div>
    </div>
  );
}

export function PromoPanel({
  promos,
  outlets,
  menus,
  variants,
  laporan,
  kategori = [],
  kuotaHarian = [],
  error,
  bisaEdit,
  spv,
  dari,
  sampai,
  outlet,
}: {
  promos: Promo[];
  outlets: Opsi[];
  menus: MenuPromo[];
  variants: (Opsi & { menu_id: string; grup: string })[];
  laporan: PemakaianPromo[];
  kategori?: Opsi[];
  kuotaHarian?: KuotaPromoHarian[];
  error?: string;
  bisaEdit: boolean;
  spv: boolean;
  dari: string;
  sampai: string;
  outlet: string;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<Promo | null>(null);
  const [err, setErr] = useState("");
  const [errKartu, setErrKartu] = useState("");
  const [infoKartu, setInfoKartu] = useState("");
  const [tab, setTab] = useState<(typeof TAB)[number]>("semua");
  const [cari, setCari] = useState("");
  const [pending, start] = useTransition();
  const [sekarang] = useState(() => Date.now());
  const baru = (): Promo => ({
    id: "",
    nama: "",
    aktif: false,
    cakupan: "item",
    nilai_voucher: null,
    minimum_belanja: 0,
    batas_diskon: null,
    dasar_minimum: "menu",
    kanal_ids: [],
    subsidi: false,
    nama_subsidi: "Subsidi Kantor",
    mulai: dari,
    selesai: dari,
    jam_mulai: "00:00",
    jam_selesai: "23:59:59",
    semua_outlet: false,
    outlet_ids: spv ? outlets.map((o) => o.id) : [],
    aturan: [],
    kuota: null,
    per_menu: false,
    bersama: false,
    boleh_manual: false,
    versi: 0,
    slot: [{ mulai: "00:00", selesai: "23:59" }],
    hari: [...SEMUA_HARI],
  });
  // Form memakai HH:MM (24 jam); server menyimpan HH:MM:SS.
  const bukaEdit = (p: Promo) => {
    setErr("");
    setEdit({ ...structuredClone(p), slot: slotPromo(p).map((x) => ({ mulai: x.mulai.slice(0, 5), selesai: x.selesai.slice(0, 5) })), hari: p.hari?.length ? [...p.hari] : [...SEMUA_HARI] });
  };
  const ubahSlot = (i: number, x: Partial<SlotPromo>) => set({ slot: (edit!.slot ?? []).map((v, k) => (k === i ? { ...v, ...x } : v)) });
  const set = (p: Partial<Promo>) =>
    setEdit((x) => (x ? { ...x, ...p } : null));
  const rule = (i: number, p: Partial<AturanPromo>) =>
    set({ aturan: edit!.aturan.map((a, k) => (i === k ? { ...a, ...p } : a)) });
  const simpan = async () => {
    const slot = edit!.slot ?? [];
    const salah = cekSlot(slot) || (!(edit!.hari ?? []).length ? "Pilih minimal satu hari" : "");
    if (salah) return setErr(salah);
    let aktifkan = edit!.aktif;
    if (!aktifkan) aktifkan = await tanya("Promo ini akan disimpan dalam keadaan nonaktif sehingga belum muncul di kasir. Aktifkan sekarang?", { judul: "Aktifkan promo?", ya: "Ya, simpan & aktifkan" });
    const kirim = { ...edit!, aktif: aktifkan, slot: slot.map((x) => ({ mulai: x.mulai, selesai: x.selesai === "23:59" ? "23:59:59" : x.selesai })), ...jamLegacy(slot) };
    start(async () => {
      setErr("");
      try {
        const r = await simpanPromo({ ...kirim, id: kirim.id || undefined });
        if (r.error) setErr(pesanRamah(r.error));
        else {
          setEdit(null);
          router.refresh();
        }
      } catch {
        setErr(
          "Koneksi terputus. Muat ulang untuk memeriksa hasil penyimpanan.",
        );
      }
    });
  };
  // Aktif/nonaktif cepat: memakai penyimpanan & versi yang sama dengan form (tercatat di Log Aktivitas).
  const ubahAktif = async (p: Promo) => {
    const ok = await tanya(
      p.aktif
        ? `Nonaktifkan promo "${p.nama}"? Kasir tidak bisa memilihnya lagi. Reservasi yang sudah terbit tetap berlaku maksimal 15 menit.`
        : `Aktifkan promo "${p.nama}" sesuai periode, outlet dan aturannya?`,
      { judul: p.aktif ? "Nonaktifkan promo" : "Aktifkan promo", ya: p.aktif ? "Nonaktifkan" : "Aktifkan", bahaya: p.aktif },
    );
    if (!ok) return;
    start(async () => {
      setErrKartu("");
      try {
        const r = await simpanPromo({ ...p, aktif: !p.aktif });
        if (r.error) setErrKartu(`${p.nama}: ${pesanRamah(r.error)}`);
        else router.refresh();
      } catch {
        setErrKartu("Koneksi terputus. Muat ulang untuk memeriksa status promo.");
      }
    });
  };
  const ubahArsip = async (p: Promo, pulihkan: boolean) => {
    const ok = await tanya(pulihkan
      ? `Pulihkan promo "${p.nama}"? Promo kembali ke daftar dalam keadaan NONAKTIF. Periksa pengaturan lalu aktifkan secara terpisah.`
      : `Hapus/arsipkan promo "${p.nama}"? Promo disembunyikan dari daftar utama dan tidak dapat dipakai kasir. Reservasi yang belum dibayar dilepas. Riwayat transaksi, diskon dan laporan tetap tersimpan.`,
      { judul: pulihkan ? "Pulihkan promo?" : "Hapus/arsipkan promo?", ya: pulihkan ? "Pulihkan sebagai nonaktif" : "Ya, arsipkan", bahaya: !pulihkan });
    if (!ok) return;
    start(async () => {
      setErrKartu("");
      try {
        setInfoKartu("");
        const r = await arsipPromo(p.id, p.versi, pulihkan);
        if (r.error) setErrKartu(`${p.nama}: ${pesanRamah(r.error)}`);
        else {
          setInfoKartu(pulihkan ? `"${p.nama}" dipulihkan sebagai nonaktif. Buka tab Nonaktif untuk memeriksa dan mengaktifkannya.` : `"${p.nama}" dipindahkan ke Arsip. Riwayat transaksi dan laporan tetap tersimpan.`);
          router.refresh();
        }
      } catch { setErrKartu("Koneksi terputus. Muat ulang untuk memeriksa status arsip promo."); }
    });
  };
  const duplikat = (p: Promo) => {
    setErr("");
    bukaEdit({ ...p, id: "", nama: `${p.nama} (salinan)`.slice(0, 120), aktif: false, versi: 0, diarsipkan_at: null, diarsipkan_oleh: null, diarsipkan_nama: null });
  };

  const namaOutlet = useMemo(() => Object.fromEntries(outlets.map((o) => [o.id, o.nama])), [outlets]);
  const namaMenu = useMemo(() => Object.fromEntries(menus.map((m) => [m.id, m.kemasan ? `${m.nama} (${m.kemasan})` : m.nama])), [menus]);
  const daftar = useMemo(() => urutkanPromo(promos, sekarang).map((p) => ({ p, status: statusPromo(p, sekarang) })), [promos, sekarang]);
  const hitung = useMemo(() => {
    const c: Record<string, number> = { semua: 0, arsip: 0 };
    for (const d of daftar) {
      if (d.p.diarsipkan_at) c.arsip++;
      else { c.semua++; c[d.status] = (c[d.status] ?? 0) + 1; }
    }
    return c;
  }, [daftar]);
  const q = cari.trim().toLowerCase();
  const tampil = daftar.filter((d) => (tab === "arsip" ? !!d.p.diarsipkan_at : !d.p.diarsipkan_at && (tab === "semua" || d.status === tab)) && (!q || d.p.nama.toLowerCase().includes(q)));

  const aktif = laporan.filter((r) => r.status === "lunas");
  const totalDiskon = aktif.reduce((s, r) => s + Number(r.diskon), 0);
  const totalSubsidi = aktif.filter((r) => r.subsidi).reduce((s, r) => s + Number(r.diskon), 0);
  const periode = dari === sampai ? rentangTanggal(dari, dari) : rentangTanggal(dari, sampai);

  return (
    <div className="space-y-5">
      <HeaderHalaman
        ikon="🏷️"
        judul="Promo & Diskon"
        keterangan="Atur promo kasir per outlet, menu, periode, dan kuota. Kasir hanya bisa memakai promo yang aktif dan sedang berlaku."
        aksi={
          bisaEdit && (
            <button
              className={tombolHeaderUtama}
              onClick={() => {
                setErr("");
                setEdit(baru());
              }}
            >
              + Buat promo
            </button>
          )
        }
      />
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <BarisAngka>
        <KartuAngka ikon="🟢" nada="hijau" label="Promo berjalan" nilai={hitung.berjalan ?? 0} sub={`dari ${hitung.semua} promo · ${hitung.arsip} arsip`} />
        <KartuAngka ikon="🗓️" nada="biru" label="Terjadwal" nilai={hitung.terjadwal ?? 0} sub="belum dimulai" />
        <KartuAngka ikon="🧾" nada="netral" label="Transaksi promo" nilai={aktif.length} sub={`lunas · ${periode}`} />
        <KartuAngka ikon="💸" nada="ungu" label="Total potongan" nilai={<span className="block whitespace-normal text-lg sm:text-xl">{rp(totalDiskon)}</span>} sub={totalSubsidi ? `subsidi ${rp(totalSubsidi)}` : periode} />
      </BarisAngka>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className={`${tabKelas.wadah} sm:flex-1`} role="tablist" aria-label="Status promo">
            {TAB.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? tabKelas.aktif : tabKelas.pasif} onClick={() => setTab(t)}>
                {t === "semua" ? "Semua" : t === "arsip" ? "Arsip" : LABEL_STATUS[t]}
                <span className="ml-1 text-xs font-normal text-stone-400">{hitung[t] ?? 0}</span>
              </button>
            ))}
          </div>
          <input type="search" aria-label="Cari promo" placeholder="🔍 Cari nama promo" className={`${input} sm:w-64`} value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
        {tab === "arsip" && <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Promo di arsip tidak tersedia di kasir. Riwayat transaksi dan laporan tetap tersimpan. Pulihkan untuk mengembalikannya sebagai promo nonaktif.</p>}
        {infoKartu && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{infoKartu}</p>}
        {errKartu && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {errKartu}
          </p>
        )}
        {tampil.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tampil.map(({ p, status }) => {
              const outletTeks = p.semua_outlet ? ["Semua outlet"] : p.outlet_ids.map((id) => namaOutlet[id] ?? "Outlet lain");
              const menuTeks = p.aturan.map((a) => namaMenu[a.menu_id] ?? "Menu tidak aktif");
              const luarJam = status === "berjalan" && diLuarJam(p, sekarang);
              return (
                <article key={p.id} className="relative flex flex-col overflow-hidden rounded-2xl border border-matur-100 bg-white p-4 pl-5 shadow-sm">
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${GARIS_STATUS[status]}`} aria-hidden />
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 font-bold leading-snug text-kopi-900 [overflow-wrap:anywhere]">{p.nama}</h2>
                    <Badge nada={NADA_STATUS[status]}>
                      {p.diarsipkan_at ? "Diarsipkan" : status === "terjadwal" ? `Mulai ${rentangTanggal(p.mulai, p.mulai).replace(/ \d{4}$/, "")}` : luarJam ? "Di luar jam" : LABEL_STATUS[status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-extrabold tracking-tight text-matur-700">{labelNilai(p)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.subsidi && <Badge nada="hijau">🎁 {p.nama_subsidi || "Subsidi"}</Badge>}
                    {p.cakupan === "transaksi" && <Badge nada="biru">Sekali per transaksi</Badge>}
                    {syaratPromo(p) && <p className="text-xs text-stone-600">{syaratPromo(p)}</p>}
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm text-stone-700">
                    <div className="flex gap-2"><dt aria-label="Periode">📅</dt><dd>{rentangTanggal(p.mulai, p.selesai)}<span className="block text-xs text-stone-500">🕘 {labelWaktu(p)}</span></dd></div>
                    <div className="flex gap-2"><dt aria-label="Outlet">🏪</dt><dd className="flex min-w-0 flex-wrap gap-1">{outletTeks.slice(0, 3).map((o, i) => <span key={i} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs">{o}</span>)}{outletTeks.length > 3 && <span className="text-xs text-stone-500">+{outletTeks.length - 3} lainnya</span>}</dd></div>
                    <div className="flex gap-2"><dt aria-label="Menu">☕</dt><dd className="flex min-w-0 flex-wrap gap-1">{menuTeks.length ? menuTeks.slice(0, 3).map((m, i) => <span key={i} className="rounded-md bg-matur-50 px-1.5 py-0.5 text-xs text-matur-800">{m}</span>) : <span className="text-xs text-stone-500">Belum ada menu</span>}{menuTeks.length > 3 && <span className="text-xs text-stone-500">+{menuTeks.length - 3} menu</span>}</dd></div>
                    <div className="flex gap-2"><dt aria-label="Kuota">🎟️</dt><dd className="text-xs text-stone-600">{labelKuota(p)}</dd></div>
                  </dl>
                  <p className="mt-2 text-xs text-stone-500">{p.boleh_manual ? "Boleh ditambah diskon manual (batas SPV)" : "Tidak digabung diskon manual"}</p>
                  {p.diarsipkan_at && <p className="my-2 text-xs text-stone-500">Diarsipkan {new Date(p.diarsipkan_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB{p.diarsipkan_nama ? ` oleh ${p.diarsipkan_nama}` : ""}</p>}
                  {bisaEdit && (
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                      {p.diarsipkan_at ? <button className={tombolAksi.netral} disabled={pending} onClick={() => ubahArsip(p, true)}>↩ Pulihkan</button> : <>
                      <button className={tombolAksi.edit} disabled={pending} onClick={() => bukaEdit(p)}>✏️ Edit</button>
                      <button className={p.aktif ? tombolAksi.netral : tombolAksi.utama} disabled={pending} onClick={() => ubahAktif(p)}>{p.aktif ? "⏸ Nonaktifkan" : "▶ Aktifkan"}</button>
                      <button className={tombolAksi.netral} disabled={pending} onClick={() => duplikat(p)}>⧉ Duplikat</button>
                      <button className={tombolAksi.hapus} disabled={pending} onClick={() => ubahArsip(p, false)}>🗑 Hapus/Arsipkan</button>
                      </>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : !error ? (
          <Kosong ikon="🏷️" judul={promos.length ? "Tidak ada promo di daftar ini" : "Belum ada promo"}>
            {promos.length ? "Ganti tab atau kata pencarian." : "Buat pengaturan dan pilih outlet yang akan memakainya."}
          </Kosong>
        ) : null}
      </section>

      <Kartu judul="Pemakaian promo · Accounting" keterangan="Diskon promo sudah termasuk diskon transaksi pada laporan penjualan. Void/hapus tidak masuk total. Hari operasional berganti pukul 03.00 WIB.">
        <form className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
          <label className="text-xs font-semibold text-stone-600">
            Dari
            <input className={`${input} mt-1`} type="date" name="dari" defaultValue={dari} />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Sampai
            <input className={`${input} mt-1`} type="date" name="sampai" defaultValue={sampai} />
          </label>
          <label className="col-span-2 text-xs font-semibold text-stone-600 sm:min-w-48">
            Outlet
            <select className={`${input} mt-1`} name="outlet" defaultValue={outlet}>
              {!spv && <option value="">Semua outlet</option>}
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </label>
          <button className="col-span-2 rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white hover:bg-matur-600 sm:col-span-1">Tampilkan</button>
        </form>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {([["Transaksi lunas", String(aktif.length)], ["Item promo", String(aktif.reduce((s, r) => s + Number(r.qty), 0))], ["Diskon promo", rp(totalDiskon)]] as const).map(([l, v]) => (
            <div key={l} className="rounded-xl bg-matur-50 px-2 py-2.5">
              <p className="text-[11px] text-stone-500">{l}</p>
              <p className="truncate font-extrabold tabular-nums text-kopi-900">{v}</p>
            </div>
          ))}
        </div>
        {kuotaHarian.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-bold text-kopi-900">🎟️ Kuota per hari</h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {kuotaHarian.map((k, i) => {
                const pct = Math.min(100, Math.round((k.terpakai / k.kuota) * 100));
                return (
                  <div key={i} className={`rounded-xl border p-3 text-sm ${k.habis_at ? "border-emerald-200 bg-emerald-50/50" : "border-stone-100 bg-white"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-kopi-900">{k.promo}</p>
                        <p className="truncate text-xs text-stone-500">{rentangTanggal(k.tanggal, k.tanggal)} · {k.outlet}{k.menu ? ` · ${k.menu}` : ""}</p>
                      </div>
                      {k.habis_at ? <Badge nada="hijau">✅ Habis {new Date(k.habis_at).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })}</Badge> : <Badge nada="biru">Sisa {Math.max(k.kuota - k.terpakai, 0)}</Badge>}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-full rounded-full ${k.habis_at ? "bg-emerald-500" : pct >= 80 ? "bg-amber-400" : "bg-matur-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-stone-600">Terpakai {k.terpakai} / {k.kuota}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-stone-500">Jam habis = jam transaksi yang memakai kuota terakhir. Transaksi void/hapus tidak dihitung.</p>
          </div>
        )}
        {laporan.length ? (
          <>
            <ul className="mt-4 space-y-2 md:hidden">
              {laporan.map((r) => (
                <li key={r.id} className="rounded-xl border border-stone-100 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-kopi-900 [overflow-wrap:anywhere]">{r.promo}</p>
                      <p className="text-xs text-stone-500">#{r.nomor} · {r.outlet} · {new Date(r.waktu).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" })}</p>
                    </div>
                    <Badge nada={r.status === "lunas" ? "hijau" : "netral"}>{r.status}</Badge>
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span>{r.qty} {r.cakupan === "transaksi" ? "transaksi" : "item"}</span>
                    <span>Diskon <b className="text-matur-700">{rp(r.diskon)}</b> · Bayar <b>{bayar(r.total)}</b></span>
                  </div>
                </li>
              ))}
            </ul>
            <div className={`${tabel.bungkus} mt-4 hidden md:block`}>
              <table className={tabel.tabel}>
                <thead className={tabel.kepala}>
                  <tr>
                    {["Waktu / No.", "Outlet", "Promo", "Unit kuota", "Diskon promo", "Total bayar", "Status"].map((x) => (
                      <th className={tabel.th} key={x}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {laporan.map((r) => (
                    <tr className={tabel.baris} key={r.id}>
                      <td className={tabel.td}>
                        {new Date(r.waktu).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" })}
                        <span className="block text-xs text-stone-400">#{r.nomor}</span>
                      </td>
                      <td className={tabel.td}>{r.outlet}</td>
                      <td className={tabel.td}>{r.promo}</td>
                      <td className={`${tabel.td} tabular-nums`}>
                        {r.qty} {r.cakupan === "transaksi" ? "transaksi" : "item"}
                      </td>
                      <td className={`${tabel.td} tabular-nums font-semibold text-matur-700`}>{rp(r.diskon)}</td>
                      <td className={`${tabel.td} tabular-nums`}>{bayar(r.total)}</td>
                      <td className={tabel.td}><Badge nada={r.status === "lunas" ? "hijau" : "netral"}>{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-xl bg-stone-50 p-3 text-sm text-stone-500">Belum ada pemakaian pada periode ini.</p>
        )}
      </Kartu>

      {edit && (
        <Modal
          scrollable
          wide
          title={edit.id ? "Edit promo" : "Buat promo"}
          onClose={() => !pending && setEdit(null)}
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-r from-matur-50 to-orange-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-matur-700">Pratinjau</p>
              <p className="mt-1 font-bold text-kopi-900 [overflow-wrap:anywhere]">{edit.nama || "Nama promo"}</p>
              <p className="text-2xl font-extrabold text-matur-700">{labelNilai(edit)}</p>
              <p className="mt-1 text-xs text-stone-600">
                {rentangTanggal(edit.mulai, edit.selesai)} · {labelWaktu(edit)} · {edit.semua_outlet ? "semua outlet" : `${edit.outlet_ids.length} outlet`} · {edit.aturan.length} menu · {labelKuota(edit).toLowerCase()}
              </p>
              <p className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${edit.aktif ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{edit.aktif ? "Akan aktif sesuai periode" : "Disimpan nonaktif"}</p>
            </div>

            <Bagian no={1} judul="Info, hari & jam">
              <label className="block text-xs font-semibold text-stone-600">
                Nama promo
                <input
                  className={`${input} mt-1`}
                  value={edit.nama}
                  maxLength={120}
                  placeholder="mis. Diskon Kopi Susu Pagi"
                  onChange={(e) => set({ nama: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["mulai", "selesai"] as const).map((k) => (
                  <label className="text-xs font-semibold text-stone-600" key={k}>
                    {k === "mulai" ? "Tanggal mulai" : "Tanggal selesai"}
                    <input className={`${input} mt-1`} type="date" value={edit[k]} onChange={(e) => set({ [k]: e.target.value })} />
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-stone-600">Hari berlaku</p>
                <div className="flex flex-wrap gap-1.5">
                  {NAMA_HARI.map((h, i) => {
                    const on = (edit.hari ?? []).includes(i + 1);
                    return (
                      <button type="button" key={h} aria-pressed={on} onClick={() => set({ hari: on ? (edit.hari ?? []).filter((x) => x !== i + 1) : [...(edit.hari ?? []), i + 1].sort() })} className={`min-w-11 rounded-xl border px-2.5 py-1.5 text-sm font-semibold transition ${on ? "border-matur-500 bg-matur-500 text-white shadow-sm" : "border-stone-200 bg-white text-stone-500"}`}>
                        {h}
                      </button>
                    );
                  })}
                  {([["Setiap hari", SEMUA_HARI], ["Hari kerja", [1, 2, 3, 4, 5]], ["Akhir pekan", [6, 7]]] as const).map(([l, v]) => (
                    <button type="button" key={l} onClick={() => set({ hari: [...v] })} className="rounded-xl border border-dashed border-matur-300 px-2.5 py-1.5 text-xs font-semibold text-matur-700 hover:bg-matur-50">{l}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-stone-600">Jam berlaku (24 jam, WIB) — bisa lebih dari satu</p>
                {(edit.slot ?? []).map((sl, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-matur-50/60 p-2">
                    <span className="text-xs font-bold text-matur-700">Slot {i + 1}</span>
                    {(["mulai", "selesai"] as const).map((k) => (
                      <span key={k} className="flex items-center gap-1">
                        <span className="text-xs text-stone-500">{k === "mulai" ? "dari" : "s/d"}</span>
                        <select aria-label={`Jam ${k} slot ${i + 1}`} className="rounded-lg border border-matur-200 bg-white px-2 py-1.5 text-sm tabular-nums" value={sl[k].slice(0, 2)} onChange={(e) => ubahSlot(i, { [k]: `${e.target.value}:${sl[k].slice(3, 5)}` })}>
                          {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => <option key={h}>{h}</option>)}
                        </select>
                        <span className="font-bold">:</span>
                        <select aria-label={`Menit ${k} slot ${i + 1}`} className="rounded-lg border border-matur-200 bg-white px-2 py-1.5 text-sm tabular-nums" value={sl[k].slice(3, 5)} onChange={(e) => ubahSlot(i, { [k]: `${sl[k].slice(0, 2)}:${e.target.value}` })}>
                          {Array.from({ length: 60 }, (_, m) => String(m).padStart(2, "0")).map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </span>
                    ))}
                    {sl.selesai <= sl.mulai && sl.selesai !== sl.mulai && <span className="text-[11px] font-semibold text-sky-700">🌙 sampai besok dini hari</span>}
                    {(edit.slot ?? []).length > 1 && (
                      <button type="button" className="ml-auto text-xs font-semibold text-red-700 hover:underline" onClick={() => set({ slot: (edit.slot ?? []).filter((_, k) => k !== i) })}>Hapus</button>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_JAM.map((x) => (
                    <button type="button" key={x.label} className="rounded-xl border border-matur-200 bg-white px-2.5 py-1 text-xs font-semibold text-kopi-800 hover:bg-matur-50" onClick={() => set({ slot: [{ ...x.slot }] })}>{x.label}</button>
                  ))}
                  {(edit.slot ?? []).length < 6 && (
                    <button type="button" className="rounded-xl border-2 border-dashed border-matur-200 px-2.5 py-1 text-xs font-semibold text-matur-700 hover:bg-matur-50" onClick={() => set({ slot: [...(edit.slot ?? []), { mulai: "15:00", selesai: "17:00" }] })}>+ Tambah slot jam</button>
                  )}
                </div>
                <p className="text-xs text-stone-500">Tombol cepat hanya mengisi jam, setelah itu tetap bisa diubah. Jam selesai lebih kecil dari jam mulai berarti berlanjut lewat tengah malam (milik hari mulainya). Kuota harian memakai hari operasional 03.00 WIB.</p>
              </div>
              <Centang checked={edit.aktif} onChange={(v) => set({ aktif: v })}>
                <b>Aktifkan promo</b>
              </Centang>
            </Bagian>

            <Bagian no={2} judul="Outlet yang memakai promo">
              {!spv && (
                <Centang checked={edit.semua_outlet} onChange={(v) => set({ semua_outlet: v })}>
                  Semua outlet, termasuk outlet baru
                </Centang>
              )}
              {!edit.semua_outlet && (
                <div className="flex flex-wrap gap-2">
                  {outlets.map((o) => {
                    const on = edit.outlet_ids.includes(o.id);
                    return (
                      <label key={o.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${on ? "border-matur-400 bg-matur-50 font-semibold text-matur-800" : "border-stone-200 bg-white"}`}>
                        <input
                          type="checkbox"
                          className="size-4 accent-matur-600"
                          checked={on}
                          onChange={(e) =>
                            set({
                              outlet_ids: e.target.checked
                                ? [...edit.outlet_ids, o.id]
                                : edit.outlet_ids.filter((id) => id !== o.id),
                            })
                          }
                        />
                        {o.nama}
                      </label>
                    );
                  })}
                </div>
              )}
            </Bagian>

            <Bagian no={3} judul="Jenis promo & menu" warna="border-sky-200 bg-sky-50/40">
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Jenis promo">
                {([
                  ["item", "☕", "Diskon per menu", "Tiap cup mendapat potongan sendiri. Contoh: Kopi Susu −20%, Americano harga Rp15.000."],
                  ["transaksi", "🎟️", "Voucher belanja", "Potongan sekali per transaksi, berapa pun jumlah menunya. Contoh: potong Rp15.000."],
                ] as const).map(([v, ikon, judul, ket]) => {
                  const on = (edit.cakupan ?? "item") === v;
                  return (
                    <button type="button" role="radio" aria-checked={on} key={v} onClick={() => set({ cakupan: v, ...(v === "transaksi" ? { per_menu: false, nilai_voucher: edit.nilai_voucher ?? 15000 } : {}) })} className={`flex gap-3 rounded-2xl border-2 p-3 text-left transition ${on ? "border-matur-500 bg-white shadow-sm" : "border-transparent bg-white/60 hover:border-matur-200"}`}>
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-xl ${on ? "bg-matur-500 text-white" : "bg-matur-50"}`}>{ikon}</span>
                      <span className="min-w-0">
                        <b className="block text-sm text-kopi-900">{judul}</b>
                        <span className="text-xs text-stone-500">{ket}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {edit.cakupan === "transaksi" && (
                  <label className="block text-xs font-semibold text-stone-600">
                    Nominal voucher sekali per transaksi (Rp)
                    <input
                      className={`${input} mt-1`}
                      type="number"
                      min="1"
                      step="1"
                      value={edit.nilai_voucher ?? ""}
                      onChange={(e) =>
                        set({ nilai_voucher: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
                <label className="block text-xs font-semibold text-stone-600">
                  Minimum belanja sebelum potongan (Rp)
                  <input
                    className={`${input} mt-1`}
                    type="number"
                    min="0"
                    step="1"
                    value={edit.minimum_belanja ?? 0}
                    onChange={(e) =>
                      set({ minimum_belanja: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-stone-600">Dasar minimum belanja<select aria-label="Dasar minimum belanja" className={`${input} mt-1`} value={edit.dasar_minimum ?? "menu"} onChange={(e) => set({ dasar_minimum: e.target.value as "menu" | "keranjang" })}><option value="menu">Hanya menu terpilih</option><option value="keranjang">Total seluruh keranjang</option></select></label>
                <label className="text-xs font-semibold text-stone-600">Maksimal diskon per transaksi (Rp)<input aria-label="Maksimal diskon per transaksi" className={`${input} mt-1`} type="number" min="1" step="1" placeholder="Kosong = tanpa batas" value={edit.batas_diskon ?? ""} onChange={(e) => set({ batas_diskon: e.target.value ? Number(e.target.value) : null })}/></label>
              </div>
              <fieldset className="space-y-2 rounded-xl border border-matur-100 bg-white p-3"><legend className="text-xs font-semibold">Kanal penjualan (kosong = semua kanal)</legend><div className="flex flex-wrap gap-3">{Object.entries(KANAL_PROMO).map(([id,nama]) => <Centang key={id} checked={!!edit.kanal_ids?.includes(id)} onChange={(v) => set({kanal_ids:v?[...(edit.kanal_ids??[]),id]:(edit.kanal_ids??[]).filter(k=>k!==id)})}>{nama}</Centang>)}</div><p className="text-xs text-stone-500">Ruma App adalah kanal pencatatan di Matoer. Website pemesanan terpisah tetap memerlukan pengaturan promo di websitenya sendiri.</p></fieldset>
              {syaratPromo(edit) && <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">{syaratPromo(edit)}. Diskon hanya dikenakan pada menu yang dipilih di bawah.</p>}
              <p className="text-xs text-stone-600">
                {edit.cakupan === "transaksi"
                  ? "Voucher berlaku kalau keranjang berisi salah satu menu di bawah. Potongan tidak melebihi total menu yang memenuhi syarat; kuota dihitung per transaksi."
                  : "Harga akhir Rp15.000 = pembeli bayar Rp15.000 per cup. Potongan Rp15.000 = harga asli dikurangi Rp15.000 per cup. Satu transaksi hanya bisa memakai satu promo."}
              </p>
              <PromoMenuFilter menus={menus} kategori={kategori} terpilih={edit.aturan.map((a) => a.menu_id)} onTambah={(ids) => {
                const contoh = edit.aturan.find((a) => a.menu_id);
                const tambah: AturanPromo[] = ids.map((id) => ({ menu_id: id, varian_ids: [], jenis: contoh?.jenis ?? "persen", nilai: contoh?.nilai ?? 10 }));
                set({ aturan: [...edit.aturan.filter((a) => a.menu_id), ...tambah] });
              }} />
              {edit.aturan.map((a, i) => (
                <div className="space-y-2 rounded-xl border border-matur-100 bg-white p-3" key={i}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-matur-700">Menu {i + 1}</span>
                    <button
                      className="text-xs font-semibold text-red-700 hover:underline"
                      onClick={() =>
                        set({ aturan: edit.aturan.filter((_, k) => k !== i) })
                      }
                    >
                      Hapus
                    </button>
                  </div>
                  <PilihMenuPromo
                    menus={menus}
                    value={a.menu_id}
                    terpakai={edit.aturan
                      .filter((_, k) => k !== i)
                      .map((x) => x.menu_id)}
                    onChange={(id) => rule(i, { menu_id: id, varian_ids: [] })}
                  />
                  {edit.cakupan !== "transaksi" && (
                    <BarisHarga
                      aturan={a}
                      menu={menus.find((x) => x.id === a.menu_id)}
                      onUbah={(x) => (x.jenis === "gratis" ? set({ subsidi: true, aturan: edit.aturan.map((y, k) => (k === i ? { ...y, ...x } : y)) }) : rule(i, x))}
                      onSamakan={edit.aturan.length > 1 ? () => set({ aturan: edit.aturan.map((y) => ({ ...y, jenis: a.jenis, nilai: a.nilai })), ...(a.jenis === "gratis" ? { subsidi: true } : {}) }) : undefined}
                    />
                  )}
                  {variants.some((v) => v.menu_id === a.menu_id) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="w-full text-[11px] font-semibold text-stone-500">Hanya berlaku kalau pembeli memilih varian (kosongkan = semua varian):</span>
                      {variants
                        .filter((v) => v.menu_id === a.menu_id)
                        .map((v) => {
                          const on = a.varian_ids.includes(v.id);
                          return (
                            <label className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs ${on ? "border-matur-400 bg-matur-50 font-semibold" : "border-stone-200"}`} key={v.id}>
                              <input
                                type="checkbox"
                                className="accent-matur-600"
                                checked={on}
                                onChange={(e) =>
                                  rule(i, {
                                    varian_ids: e.target.checked
                                      ? [...a.varian_ids, v.id]
                                      : a.varian_ids.filter((id) => id !== v.id),
                                  })
                                }
                              />
                              {v.grup}: {v.nama}
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
              <button
                className="w-full rounded-xl border-2 border-dashed border-matur-200 px-3 py-2 text-sm font-semibold text-matur-700 hover:bg-matur-50"
                onClick={() =>
                  set({
                    aturan: [
                      ...edit.aturan,
                      {
                        menu_id: "",
                        varian_ids: [],
                        jenis: "harga_akhir",
                        nilai: 0,
                      },
                    ],
                  })
                }
              >
                + Tambah menu promo
              </button>
            </Bagian>

            <Bagian no={4} judul="Subsidi / penanggung biaya" warna="border-green-200 bg-green-50/40">
              <Centang checked={!!edit.subsidi} onChange={(v) => set({ subsidi: v })}>
                Potongan ditanggung kantor sebagai subsidi
              </Centang>
              {edit.subsidi && (
                <label className="block text-xs font-semibold text-stone-600">
                  Nama subsidi (bisa diganti)
                  <input
                    className={`${input} mt-1`}
                    value={edit.nama_subsidi ?? "Subsidi Kantor"}
                    maxLength={120}
                    onChange={(e) => set({ nama_subsidi: e.target.value })}
                  />
                </label>
              )}
              <p className="text-xs text-stone-600">
                Subsidi penuh: pelanggan bayar Rp0. Subsidi sebagian: pelanggan
                membayar sisanya. Tagihan dan pembayaran kantor dikelola
                Accounting; bukan uang masuk laci kasir.
              </p>
            </Bagian>

            <Bagian no={5} judul="Kuota & aturan tambahan">
              <label className="block text-xs font-semibold text-stone-600">
                Kuota {edit.cakupan === "transaksi" ? "transaksi" : "item"} per hari (kosong = tanpa batas)
                <input
                  className={`${input} mt-1`}
                  type="number"
                  min="1"
                  value={edit.kuota ?? ""}
                  onChange={(e) =>
                    set({ kuota: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </label>
              <Centang disabled={edit.cakupan === "transaksi"} checked={edit.per_menu} onChange={(v) => set({ per_menu: v })}>
                Kuota terpisah per menu (jika tidak: gabungan semua menu)
              </Centang>
              <Centang checked={edit.bersama} onChange={(v) => set({ bersama: v })}>
                Kuota bersama semua outlet terpilih (jika tidak: per outlet)
              </Centang>
              <p className="rounded-xl bg-matur-50 px-3 py-2 text-sm font-semibold text-kopi-900">🎟️ {labelKuota(edit)}</p>
              <Centang checked={edit.boleh_manual} onChange={(v) => set({ boleh_manual: v })}>
                Boleh digabung diskon manual (batas persetujuan SPV tetap berlaku)
              </Centang>
            </Bagian>

            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              Reservasi yang sudah diterbitkan tetap berlaku maksimal 15 menit.
              Perubahan berlaku saat promo dipilih berikutnya. Void/hapus
              mengembalikan kuota; pemulihan transaksi memeriksa ketersediaan
              kuota lagi. Setiap perubahan dicatat dalam Log Aktivitas.
            </p>
            {err && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {err}
              </p>
            )}
            <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 bg-white/95 px-1 py-2 backdrop-blur">
              <button
                disabled={pending}
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold"
                onClick={() => setEdit(null)}
              >
                Batal
              </button>
              <button
                disabled={pending}
                className="rounded-xl bg-matur-500 px-5 py-2 text-sm font-bold text-white hover:bg-matur-600 disabled:opacity-50"
                onClick={simpan}
              >
                {pending ? "Menyimpan…" : "Simpan promo"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
