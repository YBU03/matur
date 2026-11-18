"use client";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah as rp } from "@/lib/format";
import { PilihMenuPromo } from "@/components/pilih-menu-promo";
import { simpanPromo } from "@/lib/promo-actions";
import { tanya } from "@/components/dialog-tanya";
import { Badge, BarisAngka, HeaderHalaman, Kartu, KartuAngka, Kosong, tabKelas, tabel, tombolAksi, tombolHeaderUtama } from "@/components/ui-halaman";
import { LABEL_STATUS, diLuarJam, labelKuota, labelNilai, rentangJam, rentangTanggal, statusPromo, urutkanPromo, type StatusPromo } from "@/lib/promo-tampilan";
import type { Promo, PemakaianPromo, AturanPromo } from "@/lib/promo";
type Opsi = { id: string; nama: string };
const input =
  "w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm text-kopi-900 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";
const NADA_STATUS = { berjalan: "hijau", terjadwal: "biru", selesai: "netral", nonaktif: "kuning" } as const;
const GARIS_STATUS: Record<StatusPromo, string> = { berjalan: "bg-emerald-500", terjadwal: "bg-sky-500", selesai: "bg-stone-300", nonaktif: "bg-amber-400" };
const bayar = (n: number) => (Number(n) ? rp(n) : "Rp0");
const TAB: ("semua" | StatusPromo)[] = ["semua", "berjalan", "terjadwal", "nonaktif", "selesai"];

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

export function PromoPanel({
  promos,
  outlets,
  menus,
  variants,
  laporan,
  error,
  bisaEdit,
  spv,
  dari,
  sampai,
  outlet,
}: {
  promos: Promo[];
  outlets: Opsi[];
  menus: (Opsi & { kemasan?: string | null })[];
  variants: (Opsi & { menu_id: string; grup: string })[];
  laporan: PemakaianPromo[];
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
  });
  const set = (p: Partial<Promo>) =>
    setEdit((x) => (x ? { ...x, ...p } : null));
  const rule = (i: number, p: Partial<AturanPromo>) =>
    set({ aturan: edit!.aturan.map((a, k) => (i === k ? { ...a, ...p } : a)) });
  const simpan = () =>
    start(async () => {
      setErr("");
      try {
        const r = await simpanPromo({ ...edit!, id: edit!.id || undefined });
        if (r.error) setErr(r.error);
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
        if (r.error) setErrKartu(`${p.nama}: ${r.error}`);
        else router.refresh();
      } catch {
        setErrKartu("Koneksi terputus. Muat ulang untuk memeriksa status promo.");
      }
    });
  };
  const duplikat = (p: Promo) => {
    setErr("");
    setEdit({ ...structuredClone(p), id: "", nama: `${p.nama} (salinan)`.slice(0, 120), aktif: false, versi: 0 });
  };

  const namaOutlet = useMemo(() => Object.fromEntries(outlets.map((o) => [o.id, o.nama])), [outlets]);
  const namaMenu = useMemo(() => Object.fromEntries(menus.map((m) => [m.id, m.kemasan ? `${m.nama} (${m.kemasan})` : m.nama])), [menus]);
  const daftar = useMemo(() => urutkanPromo(promos, sekarang).map((p) => ({ p, status: statusPromo(p, sekarang) })), [promos, sekarang]);
  const hitung = useMemo(() => {
    const c: Record<string, number> = { semua: daftar.length };
    for (const d of daftar) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [daftar]);
  const q = cari.trim().toLowerCase();
  const tampil = daftar.filter((d) => (tab === "semua" || d.status === tab) && (!q || d.p.nama.toLowerCase().includes(q)));

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
        <KartuAngka ikon="🟢" nada="hijau" label="Promo berjalan" nilai={hitung.berjalan ?? 0} sub={`dari ${promos.length} promo`} />
        <KartuAngka ikon="🗓️" nada="biru" label="Terjadwal" nilai={hitung.terjadwal ?? 0} sub="belum dimulai" />
        <KartuAngka ikon="🧾" nada="netral" label="Transaksi promo" nilai={aktif.length} sub={`lunas · ${periode}`} />
        <KartuAngka ikon="💸" nada="ungu" label="Total potongan" nilai={<span className="block whitespace-normal text-lg sm:text-xl">{rp(totalDiskon)}</span>} sub={totalSubsidi ? `subsidi ${rp(totalSubsidi)}` : periode} />
      </BarisAngka>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className={`${tabKelas.wadah} sm:flex-1`} role="tablist" aria-label="Status promo">
            {TAB.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? tabKelas.aktif : tabKelas.pasif} onClick={() => setTab(t)}>
                {t === "semua" ? "Semua" : LABEL_STATUS[t]}
                <span className="ml-1 text-xs font-normal text-stone-400">{hitung[t] ?? 0}</span>
              </button>
            ))}
          </div>
          <input type="search" aria-label="Cari promo" placeholder="🔍 Cari nama promo" className={`${input} sm:w-64`} value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
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
                      {status === "terjadwal" ? `Mulai ${rentangTanggal(p.mulai, p.mulai).replace(/ \d{4}$/, "")}` : luarJam ? "Di luar jam" : LABEL_STATUS[status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-extrabold tracking-tight text-matur-700">{labelNilai(p)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.subsidi && <Badge nada="hijau">🎁 {p.nama_subsidi || "Subsidi"}</Badge>}
                    {p.cakupan === "transaksi" && <Badge nada="biru">Sekali per transaksi</Badge>}
                    {!!p.minimum_belanja && <Badge>Min. belanja {rp(p.minimum_belanja)}</Badge>}
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm text-stone-700">
                    <div className="flex gap-2"><dt aria-label="Periode">📅</dt><dd>{rentangTanggal(p.mulai, p.selesai)} · {rentangJam(p.jam_mulai, p.jam_selesai)}</dd></div>
                    <div className="flex gap-2"><dt aria-label="Outlet">🏪</dt><dd className="flex min-w-0 flex-wrap gap-1">{outletTeks.slice(0, 3).map((o, i) => <span key={i} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs">{o}</span>)}{outletTeks.length > 3 && <span className="text-xs text-stone-500">+{outletTeks.length - 3} lainnya</span>}</dd></div>
                    <div className="flex gap-2"><dt aria-label="Menu">☕</dt><dd className="flex min-w-0 flex-wrap gap-1">{menuTeks.length ? menuTeks.slice(0, 3).map((m, i) => <span key={i} className="rounded-md bg-matur-50 px-1.5 py-0.5 text-xs text-matur-800">{m}</span>) : <span className="text-xs text-stone-500">Belum ada menu</span>}{menuTeks.length > 3 && <span className="text-xs text-stone-500">+{menuTeks.length - 3} menu</span>}</dd></div>
                    <div className="flex gap-2"><dt aria-label="Kuota">🎟️</dt><dd className="text-xs text-stone-600">{labelKuota(p)}</dd></div>
                  </dl>
                  <p className="mt-2 text-xs text-stone-500">{p.boleh_manual ? "Boleh ditambah diskon manual (batas SPV)" : "Tidak digabung diskon manual"}</p>
                  {bisaEdit && (
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                      <button className={tombolAksi.edit} disabled={pending} onClick={() => { setErr(""); setEdit(structuredClone(p)); }}>✏️ Edit</button>
                      <button className={p.aktif ? tombolAksi.netral : tombolAksi.utama} disabled={pending} onClick={() => ubahAktif(p)}>{p.aktif ? "⏸ Nonaktifkan" : "▶ Aktifkan"}</button>
                      <button className={tombolAksi.netral} disabled={pending} onClick={() => duplikat(p)}>⧉ Duplikat</button>
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
                {rentangTanggal(edit.mulai, edit.selesai)} · {rentangJam(edit.jam_mulai, edit.jam_selesai)} · {edit.semua_outlet ? "semua outlet" : `${edit.outlet_ids.length} outlet`} · {edit.aturan.length} menu · {labelKuota(edit).toLowerCase()}
              </p>
              <p className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${edit.aktif ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{edit.aktif ? "Akan aktif sesuai periode" : "Disimpan nonaktif"}</p>
            </div>

            <Bagian no={1} judul="Info & periode">
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
                {(["mulai", "selesai", "jam_mulai", "jam_selesai"] as const).map(
                  (k) => (
                    <label className="text-xs font-semibold text-stone-600" key={k}>
                      {
                        {
                          mulai: "Tanggal mulai",
                          selesai: "Tanggal selesai",
                          jam_mulai: "Jam mulai WIB",
                          jam_selesai: "Jam selesai WIB",
                        }[k]
                      }
                      <input
                        className={`${input} mt-1`}
                        type={k.startsWith("jam") ? "time" : "date"}
                        step={k.startsWith("jam") ? 1 : undefined}
                        value={edit[k]}
                        onChange={(e) => set({ [k]: e.target.value })}
                      />
                    </label>
                  ),
                )}
              </div>
              <p className="text-xs text-stone-500">
                Tanggal kalender WIB, rentang jam dalam hari yang sama. Kuota
                harian memakai hari operasional 03.00 WIB.
              </p>
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

            <Bagian no={3} judul="Cara menghitung & menu" warna="border-sky-200 bg-sky-50/40">
              <label className="block text-xs font-semibold text-stone-600">
                Jenis penghitungan
                <select
                  className={`${input} mt-1`}
                  value={edit.cakupan ?? "item"}
                  onChange={(e) =>
                    set({
                      cakupan: e.target.value as "item" | "transaksi",
                      ...(e.target.value === "transaksi"
                        ? {
                            per_menu: false,
                            nilai_voucher: edit.nilai_voucher ?? 15000,
                          }
                        : {}),
                    })
                  }
                >
                  <option value="item">
                    Per item — potongan / harga akhir / gratis
                  </option>
                  <option value="transaksi">
                    Voucher — sekali per transaksi
                  </option>
                </select>
              </label>
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
                  Minimum belanja menu terpilih, sebelum potongan (Rp)
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
              <p className="text-xs text-stone-600">
                {edit.cakupan === "transaksi"
                  ? "Voucher dipotong satu kali, berapa pun jumlah menu atau minumannya. Menu/varian di bawah hanya menentukan kelayakan; voucher tidak melebihi nilai menu yang memenuhi syarat. Kuota dihitung per transaksi."
                  : "Setiap item mengikuti aturannya sendiri. Harga akhir Rp15.000 berarti bayar Rp15.000 per item; potongan Rp15.000 berarti harga asli dikurangi Rp15.000 per item."}
              </p>
              <p className="text-xs text-stone-500">
                Satu promo dipilih per transaksi. Harga akhir berlaku per item
                termasuk tambahan varian. Varian yang dicentang wajib ada;
                kosong berarti semua varian menu tersebut.
              </p>
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
                    <div className="flex gap-2">
                      <select
                        aria-label="Jenis diskon"
                        className={input}
                        value={a.jenis}
                        onChange={(e) =>
                          e.target.value === "gratis"
                            ? set({
                                subsidi: true,
                                aturan: edit.aturan.map((x, k) =>
                                  k === i
                                    ? { ...x, jenis: "gratis", nilai: 100 }
                                    : x,
                                ),
                              })
                            : rule(i, {
                                jenis: e.target.value as AturanPromo["jenis"],
                              })
                        }
                      >
                        <option value="gratis">
                          Gratis — ditanggung subsidi
                        </option>
                        <option value="persen">
                          Diskon / subsidi persen (%)
                        </option>
                        <option value="potongan">Potongan per item (Rp)</option>
                        <option value="harga_akhir">
                          Harga akhir per item (Rp)
                        </option>
                      </select>
                      {a.jenis === "gratis" ? (
                        <span className="flex items-center whitespace-nowrap rounded-xl bg-green-50 px-3 text-sm font-semibold text-green-800">
                          100% subsidi
                        </span>
                      ) : (
                        <input
                          aria-label="Nilai promo"
                          className={`${input} max-w-40`}
                          type="number"
                          min="1"
                          max={a.jenis === "persen" ? 100 : undefined}
                          placeholder={a.jenis === "persen" ? "%" : "Rp"}
                          value={a.nilai || ""}
                          onChange={(e) =>
                            rule(i, { nilai: Number(e.target.value) })
                          }
                        />
                      )}
                    </div>
                  )}
                  {variants.some((v) => v.menu_id === a.menu_id) && (
                    <div className="flex flex-wrap gap-1.5">
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
