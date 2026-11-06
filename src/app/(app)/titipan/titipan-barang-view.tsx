"use client";

// Titipan per BARANG (pcs/gram) sesuai PDF revisi akunting: rekap stok & tagihan per barang, setoran per barang,
// serta pengaturan barang titipan dan isi tiap menu (mis. Mix Platter = 3 sosis + 3 nugget + 50 gram french fries).
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { minta, tanya } from "@/components/dialog-tanya";
import { Badge, BarisAngka, Kartu, KartuAngka, Kosong, isian, tabKelas, tabel, tombolAksi } from "@/components/ui-halaman";
import { formatRupiah } from "@/lib/format";
import { catatTitipan, catatTitipanBanyak, hapusBarangTitipan, hapusTitipan, simpanBarangTitipan, simpanIsiTitipan, ubahTitipan, type BarangTitipanInput } from "@/lib/titipan-actions";

export type BarangTitipan = { id: string; nama: string; kelompok: "dessert" | "snack" | "lain"; satuan: string; harga: number; produsen: string | null; keterangan: string | null; aktif: boolean; urutan: number };
export type IsiTitipan = { menu_id: string; barang_id: string; qty: number };
export type RekapBarang = {
  barang_id: string; nama: string; kelompok: string; satuan: string; harga: number; produsen: string; keterangan: string | null; aktif: boolean;
  awal: number; masuk: number; keluar: number; terjual: number; sisa: number; tagihan: number; asal: { menu: string; porsi: number; jumlah: number }[];
};
export type RiwayatBarang = { id: string; menu_id: string | null; barang_id: string | null; tanggal: string; qty: number; jenis?: string; catatan: string | null; nama_pembuat: string | null; created_at: string };
type Jenis = "masuk" | "retur" | "rusak" | "koreksi";
type Hasil = { error?: string; ok?: string };

const KELOMPOK: Record<string, string> = { dessert: "🍰 Dessert", snack: "🍟 Snack", lain: "📦 Lainnya" };
const JENIS: { v: Jenis; label: string; nada: "hijau" | "kuning" | "merah" | "biru" }[] = [
  { v: "masuk", label: "Barang masuk", nada: "hijau" },
  { v: "retur", label: "Retur ke produsen", nada: "kuning" },
  { v: "rusak", label: "Rusak / tidak layak jual", nada: "merah" },
  { v: "koreksi", label: "Koreksi (+/−)", nada: "biru" },
];
const angka = (n: number) => (Number(n ?? 0) || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const tglPendek = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" });
const bertanda = (j: Jenis, q: string) => (j === "retur" || j === "rusak" ? -Math.abs(Number(q)) : Number(q));

export function TitipanBarangView({
  outletId, outletNama = "", awal, akhir, bolehAtur, barang, rekap, isi, menu, riwayat,
}: {
  outletId: string; outletNama?: string; awal: string; akhir: string; bolehAtur: boolean;
  barang: BarangTitipan[]; rekap: RekapBarang[]; isi: IsiTitipan[];
  menu: { id: string; nama: string; produsen: string | null; harga_titip: number }[];
  riwayat: RiwayatBarang[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Hasil | null>(null);
  const [tab, setTab] = useState<"rekap" | "atur" | "riwayat">("rekap");
  const [cari, setCari] = useState("");
  const [fKelompok, setFKelompok] = useState("");
  const aktif = barang.filter((b) => b.aktif);
  const [f, setF] = useState({ barang: aktif[0]?.id ?? "", qty: "", tanggal: hariIni(), catatan: "", jenis: "masuk" as Jenis });
  const formRef = useRef<HTMLElement>(null);
  const infoBarang = useMemo(() => new Map(barang.map((b) => [b.id, b])), [barang]);
  const namaMenu = useMemo(() => new Map(menu.map((m) => [m.id, m.nama])), [menu]);

  const jalankan = (fn: () => Promise<Hasil>, sukses?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        sukses?.();
        router.refresh();
      }
    });

  const q = cari.trim().toLowerCase();
  const rekapTampil = rekap.filter((r) => (!fKelompok || r.kelompok === fKelompok) && (!q || `${r.nama} ${r.produsen} ${r.keterangan ?? ""} ${r.asal.map((a) => a.menu).join(" ")}`.toLowerCase().includes(q)));
  const total = rekapTampil.reduce((t, r) => t + Number(r.tagihan), 0);
  const minus = rekapTampil.filter((r) => r.sisa < 0).length;
  const sel = infoBarang.get(f.barang);
  const [modal, setModal] = useState<"nota" | "fisik" | null>(null);
  const [unduh, setUnduh] = useState("");
  const dataEkspor = () => ({ outlet: outletNama, awal, akhir, rekap, riwayat, barang, namaMenu });
  const ekspor = async (jenis: "pdf" | "xlsx") => {
    setUnduh(jenis);
    try {
      const m = await import("./ekspor-titipan");
      if (jenis === "pdf") await m.unduhPdfTitipan(dataEkspor());
      else await m.unduhExcelTitipan(dataEkspor());
    } catch {
      setMsg({ error: "File belum berhasil dibuat. Coba lagi." });
    } finally {
      setUnduh("");
    }
  };

  return (
    <div className="space-y-4">
      <BarisAngka>
        <KartuAngka ikon="💰" label="Tagihan periode" nilai={formatRupiah(total)} sub={`${awal} s/d ${akhir}`} />
        <KartuAngka ikon="🧁" nada="hijau" label="Barang terjual" nilai={`${rekapTampil.filter((r) => r.terjual > 0).length} jenis`} sub="dihitung otomatis dari POS × isi menu" />
        <KartuAngka ikon="📦" nada="biru" label="Setoran tercatat" nilai={`${riwayat.length} catatan`} sub="pcs / gram" />
        <KartuAngka ikon="⚠️" nada={minus ? "merah" : "hijau"} label="Sisa minus" nilai={`${minus} barang`} sub={minus ? "setoran belum dicatat?" : "aman"} />
      </BarisAngka>

      <div className={tabKelas.wadah}>
        {(
          [
            ["rekap", "📦 Rekap per barang"],
            ["atur", "🧩 Barang & isi menu"],
            ["riwayat", `🗒 Riwayat (${riwayat.length})`],
          ] as const
        ).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={tab === v ? tabKelas.aktif : tabKelas.pasif}>
            {l}
          </button>
        ))}
      </div>

      {msg && <p role="status" className={`rounded-xl px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.error ?? msg.ok}</p>}

      {tab !== "atur" && (
        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔎 Cari barang, menu, catatan, pencatat…" className={`${isian} min-w-0 flex-1 basis-60`} />
          <select value={fKelompok} onChange={(e) => setFKelompok(e.target.value)} className={isian}>
            <option value="">Semua kelompok</option>
            {Object.entries(KELOMPOK).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => (setMsg(null), setModal("nota"))} className={tombolAksi.utama}>📥 Setoran dari nota</button>
            <button type="button" onClick={() => (setMsg(null), setModal("fisik"))} className={tombolAksi.edit}>⚖️ Sesuaikan stok</button>
            <button type="button" disabled={!!unduh} onClick={() => ekspor("pdf")} className={tombolAksi.netral}>{unduh === "pdf" ? "Menyiapkan…" : "⬇ PDF"}</button>
            <button type="button" disabled={!!unduh} onClick={() => ekspor("xlsx")} className={tombolAksi.netral}>{unduh === "xlsx" ? "Menyiapkan…" : "⬇ Excel"}</button>
          </span>
        </section>
      )}

      {modal === "nota" && (
        <SetoranNota barang={aktif} akhir={akhir} pending={pending} tutup={() => setModal(null)}
          simpan={(tgl, catatan, items) => jalankan(() => catatTitipanBanyak(outletId, tgl, items.map((x) => ({ ...x, jenis: "masuk" as const, catatan }))), () => setModal(null))} />
      )}
      {modal === "fisik" && (
        <SesuaikanStok rekap={rekap.filter((r) => r.aktif)} akhir={akhir} pending={pending} tutup={() => setModal(null)}
          simpan={(items) => jalankan(() => catatTitipanBanyak(outletId, akhir > hariIni() ? hariIni() : akhir, items.map((x) => ({ ...x, jenis: "koreksi" as const }))), () => setModal(null))} />
      )}

      {tab === "rekap" && (
        <>
          {!rekapTampil.length && <Kosong ikon="🔎" judul="Tidak ada barang yang cocok" />}
          {Object.keys(KELOMPOK).map((kel) => {
            const xs = rekapTampil.filter((r) => r.kelompok === kel);
            if (!xs.length) return null;
            return (
              <Kartu key={kel} judul={KELOMPOK[kel]} keterangan={`${xs.length} barang · satuan sesuai nota produsen (pcs/gram)`} aksi={<Badge>Tagihan {formatRupiah(xs.reduce((t, r) => t + Number(r.tagihan), 0))}</Badge>}>
                <div className={tabel.bungkus}>
                  <table className={tabel.tabel}>
                    <thead className={tabel.kepala}>
                      <tr>
                        <th className={tabel.th}>Barang</th>
                        <th className={`${tabel.th} text-right`}>Awal</th>
                        <th className={`${tabel.th} text-right`}>Masuk</th>
                        <th className={`${tabel.th} text-right`}>Retur/rusak −</th>
                        <th className={`${tabel.th} text-right`}>Terjual</th>
                        <th className={`${tabel.th} text-right`}>Sisa</th>
                        <th className={`${tabel.th} text-right`}>Harga/satuan</th>
                        <th className={`${tabel.th} text-right`}>Tagihan</th>
                        <th className={tabel.th} />
                      </tr>
                    </thead>
                    <tbody>
                      {xs.map((r) => (
                        <tr key={r.barang_id} className={tabel.baris}>
                          <td className={tabel.td}>
                            <p className="font-medium">{r.nama} <span className="text-xs font-normal text-stone-400">({r.satuan})</span></p>
                            {r.asal.length > 0 && (
                              <p className="text-[11px] text-stone-500">
                                {r.asal.map((a) => `${a.menu} ${angka(a.porsi)} porsi → ${angka(a.jumlah)} ${r.satuan}`).join(" · ")}
                              </p>
                            )}
                          </td>
                          <td className={`${tabel.td} text-right tabular-nums`}>{angka(r.awal)}</td>
                          <td className={`${tabel.td} text-right tabular-nums`}>{angka(r.masuk)}</td>
                          <td className={`${tabel.td} text-right tabular-nums`}>{angka(r.keluar)}</td>
                          <td className={`${tabel.td} text-right font-semibold tabular-nums`}>{angka(r.terjual)}</td>
                          <td className={`${tabel.td} text-right tabular-nums ${r.sisa < 0 ? "font-bold text-red-600" : ""}`}>{angka(r.sisa)}</td>
                          <td className={`${tabel.td} text-right tabular-nums`}>{formatRupiah(r.harga)}</td>
                          <td className={`${tabel.td} text-right font-semibold tabular-nums`}>{formatRupiah(r.tagihan)}</td>
                          <td className={`${tabel.td} text-right`}>
                            {r.aktif && (
                              <span className="flex justify-end gap-1">
                                <button onClick={() => (setF({ ...f, barang: r.barang_id, jenis: "masuk", qty: r.sisa < 0 ? String(Math.ceil(-r.sisa)) : "" }), formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }))} className={`${tombolAksi.utama} whitespace-nowrap`} title={r.sisa < 0 ? `Isi setoran minimal ${angka(-r.sisa)} ${r.satuan} agar tidak minus` : "Catat setoran"}>
                                  + Setoran
                                </button>
                                {r.sisa < 0 && (
                                  <button onClick={() => (setMsg(null), setModal("fisik"))} className={tombolAksi.edit} title="Sesuaikan dengan hitungan fisik">⚖️</button>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {xs.some((r) => r.sisa < 0) && <p className="mt-2 text-xs text-red-600">Sisa minus: penjualan lebih banyak dari setoran tercatat — catat setoran produsen yang belum diinput.</p>}
              </Kartu>
            );
          })}

          <section ref={formRef}>
            <Kartu judul="Catat pergerakan titipan" keterangan="Setoran dari produsen, retur, rusak, atau koreksi — dalam satuan barang (pcs/gram) sesuai nota.">
              <div className="grid gap-2 sm:grid-cols-4">
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-xs text-stone-500">Barang</span>
                  <select value={f.barang} onChange={(e) => setF({ ...f, barang: e.target.value })} className={`${isian} w-full`}>
                    {aktif.map((b) => <option key={b.id} value={b.id}>{b.nama} ({b.satuan}) · {KELOMPOK[b.kelompok]?.slice(3)}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-stone-500">Jenis</span>
                  <select value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value as Jenis })} className={`${isian} w-full`}>
                    {JENIS.map((j) => <option key={j.v} value={j.v}>{j.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-stone-500">Jumlah ({sel?.satuan ?? "pcs"})</span>
                  <input value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/[^\d-]/g, "") })} inputMode="numeric" placeholder="0" className={`${isian} w-full`} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-stone-500">Tanggal</span>
                  <input type="date" max={hariIni()} value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} className={`${isian} w-full`} />
                </label>
                <label className="space-y-1 text-sm sm:col-span-3">
                  <span className="text-xs text-stone-500">Catatan {f.jenis !== "masuk" && <b className="text-red-600">(wajib)</b>}</span>
                  <input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} placeholder={f.jenis === "masuk" ? "opsional, mis. nomor nota" : "alasan retur/rusak/koreksi"} className={`${isian} w-full`} />
                </label>
              </div>
              <button
                disabled={pending || !f.barang || !Number(f.qty)}
                onClick={() => jalankan(() => catatTitipan(outletId, "", bertanda(f.jenis, f.qty), f.tanggal, f.catatan, f.jenis, f.barang), () => setF({ ...f, qty: "", catatan: "", jenis: "masuk" }))}
                className="mt-3 w-full rounded-xl bg-matur-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Menyimpan…" : `Simpan ${f.qty ? `${f.qty} ${sel?.satuan ?? ""}` : ""}`}
              </button>
            </Kartu>
          </section>
        </>
      )}

      {tab === "riwayat" && (
        <RiwayatTitipan riwayat={riwayat} q={q} fKelompok={fKelompok} infoBarang={infoBarang} namaMenu={namaMenu} pending={pending} jalankan={jalankan} setMsg={setMsg} />
      )}

      {tab === "atur" && <AturBarang barang={barang} isi={isi} menu={menu} bolehAtur={bolehAtur} pending={pending} jalankan={jalankan} />}
    </div>
  );
}

function RiwayatTitipan({
  riwayat, q, fKelompok, infoBarang, namaMenu, pending, jalankan, setMsg,
}: {
  riwayat: RiwayatBarang[]; q: string; fKelompok: string; infoBarang: Map<string, BarangTitipan>; namaMenu: Map<string, string>;
  pending: boolean; jalankan: (fn: () => Promise<Hasil>, sukses?: () => void) => void; setMsg: (m: Hasil | null) => void;
}) {
  const [edit, setEdit] = useState<RiwayatBarang | null>(null);
  const tampil = riwayat.filter((r) => {
    const b = r.barang_id ? infoBarang.get(r.barang_id) : undefined;
    if (fKelompok && b?.kelompok !== fKelompok) return false;
    return !q || `${b?.nama ?? namaMenu.get(r.menu_id ?? "") ?? ""} ${r.catatan ?? ""} ${r.nama_pembuat ?? ""} ${r.jenis ?? ""}`.toLowerCase().includes(q);
  });
  return (
    <Kartu judul="Riwayat pergerakan" keterangan={`${tampil.length} dari ${riwayat.length} catatan`}>
      {!tampil.length ? (
        <Kosong ikon="🗒️" judul={riwayat.length ? "Tidak ada catatan yang cocok" : "Belum ada catatan di periode ini"} />
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {tampil.map((r) => {
            const b = r.barang_id ? infoBarang.get(r.barang_id) : undefined;
            const nama = b?.nama ?? namaMenu.get(r.menu_id ?? "") ?? "?";
            const j = JENIS.find((x) => x.v === (r.jenis ?? "masuk"));
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-kopi-900">{nama}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                    <span>{tglPendek(r.tanggal)}</span>
                    <Badge nada={j?.nada ?? "biru"}>{j?.label ?? r.jenis}</Badge>
                    <span>oleh {r.nama_pembuat ?? "-"}</span>
                    {r.catatan && <span className="italic">“{r.catatan}”</span>}
                  </p>
                </div>
                <b className={`tabular-nums ${r.qty < 0 ? "text-red-600" : "text-emerald-700"}`}>{r.qty > 0 ? "+" : ""}{angka(r.qty)} {b?.satuan ?? "porsi"}</b>
                <div className="flex gap-1.5">
                  <button disabled={pending} onClick={() => (setMsg(null), setEdit(r))} className={tombolAksi.edit}>✏️ Edit</button>
                  <button
                    disabled={pending}
                    onClick={async () => {
                      const alasan = await minta(`Hapus catatan ${nama} ${r.qty > 0 ? "+" : ""}${angka(r.qty)} (${tglPendek(r.tanggal)})? Sisa & tagihan dihitung ulang.`, { judul: "Hapus catatan titipan", ya: "Hapus", bahaya: true, placeholder: "alasan (opsional)" });
                      if (alasan === null) return;
                      jalankan(() => hapusTitipan(r.id, alasan));
                    }}
                    className={tombolAksi.hapus}
                  >
                    🗑 Hapus
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {edit && <EditCatatan data={edit} satuan={edit.barang_id ? infoBarang.get(edit.barang_id)?.satuan ?? "pcs" : "porsi"} pending={pending} tutup={() => setEdit(null)}
        simpan={(v) => jalankan(() => ubahTitipan(edit.id, bertanda(v.jenis, v.qty), v.tanggal, v.jenis, v.catatan), () => setEdit(null))} />}
    </Kartu>
  );
}

function EditCatatan({ data, satuan, pending, tutup, simpan }: { data: RiwayatBarang; satuan: string; pending: boolean; tutup: () => void; simpan: (v: { qty: string; tanggal: string; jenis: Jenis; catatan: string }) => void }) {
  const [v, setV] = useState({ qty: String(Math.abs(data.qty)), tanggal: data.tanggal, jenis: (data.jenis ?? "masuk") as Jenis, catatan: data.catatan ?? "" });
  const [minus, setMinus] = useState(data.qty < 0 && (data.jenis ?? "masuk") === "koreksi");
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && tutup()}>
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-kopi-900">✏️ Edit catatan titipan</h3>
        <div className="grid grid-cols-2 gap-2">
          <select value={v.jenis} onChange={(e) => setV({ ...v, jenis: e.target.value as Jenis })} className={`${isian} col-span-2`}>
            {JENIS.map((j) => <option key={j.v} value={j.v}>{j.label}</option>)}
          </select>
          <label className="text-xs text-stone-500">Jumlah ({satuan})<input value={v.qty} onChange={(e) => setV({ ...v, qty: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" className={`${isian} mt-1 w-full`} /></label>
          <label className="text-xs text-stone-500">Tanggal<input type="date" max={hariIni()} value={v.tanggal} onChange={(e) => setV({ ...v, tanggal: e.target.value })} className={`${isian} mt-1 w-full`} /></label>
          {v.jenis === "koreksi" && <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={minus} onChange={(e) => setMinus(e.target.checked)} /> Koreksi mengurangi stok (−)</label>}
          <input value={v.catatan} onChange={(e) => setV({ ...v, catatan: e.target.value })} placeholder="catatan" className={`${isian} col-span-2`} />
        </div>
        <div className="flex gap-2">
          <button onClick={tutup} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold">Batal</button>
          <button disabled={pending || !Number(v.qty)} onClick={() => simpan({ ...v, qty: v.jenis === "koreksi" && minus ? `-${v.qty}` : v.qty })} className="flex-1 rounded-xl bg-matur-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">Simpan</button>
        </div>
      </div>
    </div>
  );
}

function AturBarang({
  barang, isi, menu, bolehAtur, pending, jalankan,
}: {
  barang: BarangTitipan[]; isi: IsiTitipan[]; menu: { id: string; nama: string; harga_titip: number }[];
  bolehAtur: boolean; pending: boolean; jalankan: (fn: () => Promise<Hasil>, sukses?: () => void) => void;
}) {
  const [cari, setCari] = useState("");
  const [ubah, setUbah] = useState<BarangTitipanInput | null>(null);
  const [isiMenu, setIsiMenu] = useState<{ menu: { id: string; nama: string }; rows: { barang_id: string; qty: string }[] } | null>(null);
  const info = new Map(barang.map((b) => [b.id, b]));
  const q = cari.trim().toLowerCase();
  const tampil = barang.filter((b) => !q || `${b.nama} ${b.keterangan ?? ""} ${b.satuan}`.toLowerCase().includes(q));
  const isiPer = (id: string) => isi.filter((x) => x.menu_id === id);
  const hpp = (rows: { barang_id: string; qty: number | string }[]) => Math.round(rows.reduce((t, r) => t + Number(r.qty || 0) * Number(info.get(r.barang_id)?.harga ?? 0), 0));
  const menuTampil = menu.filter((m) => !q || m.nama.toLowerCase().includes(q) || isiPer(m.id).some((x) => info.get(x.barang_id)?.nama.toLowerCase().includes(q)));

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔎 Cari barang atau menu…" className={`${isian} min-w-0 flex-1`} />
        {bolehAtur && <button onClick={() => setUbah({ nama: "", kelompok: "snack", satuan: "pcs", harga: 0, produsen: "Bu Ratna", keterangan: "", aktif: true })} className={tombolAksi.utama}>+ Barang titipan</button>}
      </section>
      {!bolehAtur && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Hanya Owner/Admin Pusat/Finance/HRD/Admin Gudang yang bisa mengubah barang & isi menu.</p>}

      <Kartu judul="Barang titipan" keterangan="Harga per satuan sesuai nota produsen. Mengubah harga otomatis memperbarui HPP menu yang memakainya (penjualan lama tidak berubah).">
        <div className={tabel.bungkus}>
          <table className={tabel.tabel}>
            <thead className={tabel.kepala}>
              <tr>
                <th className={tabel.th}>Barang</th><th className={tabel.th}>Kelompok</th><th className={`${tabel.th} text-right`}>Harga</th><th className={tabel.th}>Satuan</th><th className={tabel.th}>Keterangan</th><th className={tabel.th} />
              </tr>
            </thead>
            <tbody>
              {tampil.map((b) => (
                <tr key={b.id} className={`${tabel.baris} ${b.aktif ? "" : "opacity-50"}`}>
                  <td className={`${tabel.td} font-medium`}>{b.nama}{!b.aktif && <Badge nada="netral">nonaktif</Badge>}</td>
                  <td className={tabel.td}>{KELOMPOK[b.kelompok]}</td>
                  <td className={`${tabel.td} text-right tabular-nums`}>{formatRupiah(b.harga)}</td>
                  <td className={tabel.td}>{b.satuan}</td>
                  <td className={`${tabel.td} text-xs text-stone-500`}>{b.keterangan}</td>
                  <td className={`${tabel.td} whitespace-nowrap text-right`}>
                    {bolehAtur && (
                      <>
                        <button onClick={() => setUbah({ id: b.id, nama: b.nama, kelompok: b.kelompok, satuan: b.satuan, harga: Number(b.harga), produsen: b.produsen ?? "", keterangan: b.keterangan ?? "", aktif: b.aktif })} className={tombolAksi.edit}>✏️</button>{" "}
                        <button disabled={pending} onClick={async () => (await tanya(`Hapus barang "${b.nama}"? Bila sudah punya riwayat setoran, barang hanya dinonaktifkan.`, { bahaya: true })) && jalankan(() => hapusBarangTitipan(b.id))} className={tombolAksi.hapus}>🗑</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kartu>

      <Kartu judul="Isi tiap menu titipan" keterangan="Berapa pcs/gram barang di setiap porsi yang dijual di POS. HPP per porsi dihitung otomatis.">
        <ul className="divide-y divide-stone-100 text-sm">
          {menuTampil.map((m) => {
            const xs = isiPer(m.id);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-kopi-900">{m.nama}</p>
                  <p className="text-xs text-stone-500">
                    {xs.length ? xs.map((x) => `${angka(x.qty)} ${info.get(x.barang_id)?.satuan ?? ""} ${info.get(x.barang_id)?.nama ?? "?"}`).join(" + ") : <span className="text-amber-700">⚠️ isi belum diatur — rekap per barang tidak menghitung menu ini</span>}
                  </p>
                </div>
                <span className="text-xs text-stone-500">HPP/porsi <b className="tabular-nums text-kopi-900">{formatRupiah(m.harga_titip)}</b></span>
                {bolehAtur && <button onClick={() => setIsiMenu({ menu: m, rows: xs.length ? xs.map((x) => ({ barang_id: x.barang_id, qty: String(x.qty) })) : [{ barang_id: barang.find((b) => b.aktif)?.id ?? "", qty: "1" }] })} className={tombolAksi.edit}>✏️ Atur isi</button>}
              </li>
            );
          })}
        </ul>
      </Kartu>

      {ubah && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setUbah(null)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-kopi-900">{ubah.id ? "✏️ Ubah barang titipan" : "+ Barang titipan baru"}</h3>
            <div className="grid grid-cols-2 gap-2">
              <input value={ubah.nama} onChange={(e) => setUbah({ ...ubah, nama: e.target.value })} placeholder="Nama barang, mis. Sosis" className={`${isian} col-span-2`} />
              <select value={ubah.kelompok} onChange={(e) => setUbah({ ...ubah, kelompok: e.target.value as BarangTitipanInput["kelompok"] })} className={isian}>
                {Object.entries(KELOMPOK).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input value={ubah.satuan} onChange={(e) => setUbah({ ...ubah, satuan: e.target.value })} list="satuan-titipan" placeholder="pcs / gram" className={isian} />
              <datalist id="satuan-titipan"><option value="pcs" /><option value="gram" /><option value="porsi" /><option value="ml" /></datalist>
              <label className="col-span-2 text-xs text-stone-500">Harga per {ubah.satuan || "satuan"} (Rp)
                <input value={ubah.harga ? String(ubah.harga) : ""} onChange={(e) => setUbah({ ...ubah, harga: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} inputMode="decimal" className={`${isian} mt-1 w-full text-right`} />
              </label>
              <input value={ubah.produsen ?? ""} onChange={(e) => setUbah({ ...ubah, produsen: e.target.value })} placeholder="Produsen" className={`${isian} col-span-2`} />
              <input value={ubah.keterangan ?? ""} onChange={(e) => setUbah({ ...ubah, keterangan: e.target.value })} placeholder="Keterangan, mis. 1 porsi 4 pcs" className={`${isian} col-span-2`} />
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={ubah.aktif !== false} onChange={(e) => setUbah({ ...ubah, aktif: e.target.checked })} /> Aktif</label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setUbah(null)} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold">Batal</button>
              <button disabled={pending || ubah.nama.trim().length < 2} onClick={() => jalankan(() => simpanBarangTitipan(ubah), () => setUbah(null))} className="flex-1 rounded-xl bg-matur-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {isiMenu && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setIsiMenu(null)}>
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-kopi-900">🧩 Isi 1 porsi · {isiMenu.menu.nama}</h3>
            <ul className="space-y-2">
              {isiMenu.rows.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input value={r.qty} onChange={(e) => setIsiMenu({ ...isiMenu, rows: isiMenu.rows.map((x, k) => (k === i ? { ...x, qty: e.target.value.replace(/[^\d.]/g, "") } : x)) })} inputMode="decimal" className={`${isian} w-20 text-right`} />
                  <span className="w-12 text-xs text-stone-500">{info.get(r.barang_id)?.satuan ?? ""}</span>
                  <select value={r.barang_id} onChange={(e) => setIsiMenu({ ...isiMenu, rows: isiMenu.rows.map((x, k) => (k === i ? { ...x, barang_id: e.target.value } : x)) })} className={`${isian} min-w-0 flex-1`}>
                    {barang.filter((b) => b.aktif || b.id === r.barang_id).map((b) => <option key={b.id} value={b.id}>{b.nama} · {formatRupiah(b.harga)}/{b.satuan}</option>)}
                  </select>
                  <button onClick={() => setIsiMenu({ ...isiMenu, rows: isiMenu.rows.filter((_, k) => k !== i) })} className="px-2 text-red-600" aria-label="Hapus komponen">✕</button>
                </li>
              ))}
            </ul>
            <button onClick={() => setIsiMenu({ ...isiMenu, rows: [...isiMenu.rows, { barang_id: barang.find((b) => b.aktif)?.id ?? "", qty: "1" }] })} className={tombolAksi.netral}>+ Komponen</button>
            <p className="rounded-xl bg-matur-50 px-3 py-2 text-sm">HPP per porsi otomatis: <b className="tabular-nums">{formatRupiah(hpp(isiMenu.rows))}</b></p>
            <div className="flex gap-2">
              <button onClick={() => setIsiMenu(null)} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold">Batal</button>
              <button disabled={pending} onClick={() => jalankan(() => simpanIsiTitipan(isiMenu.menu.id, isiMenu.rows.map((r) => ({ barang_id: r.barang_id, qty: Number(r.qty) }))), () => setIsiMenu(null))} className="flex-1 rounded-xl bg-matur-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">Simpan isi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SetoranNota({ barang, akhir, pending, tutup, simpan }: { barang: BarangTitipan[]; akhir: string; pending: boolean; tutup: () => void; simpan: (tanggal: string, catatan: string, items: { barang_id: string; qty: number }[]) => void }) {
  const [tgl, setTgl] = useState(akhir > hariIni() ? hariIni() : akhir);
  const [catatan, setCatatan] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const isi = barang.filter((b) => Number(qty[b.id]) > 0);
  const total = isi.reduce((t, b) => t + Number(qty[b.id]) * Number(b.harga), 0);
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && tutup()}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="border-b p-4">
          <h3 className="text-lg font-bold text-kopi-900">📥 Setoran dari satu nota</h3>
          <p className="text-xs text-stone-500">Isi jumlah barang sesuai nota produsen (pcs/gram). Barang yang dikosongkan tidak dicatat.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-stone-500">Tanggal nota<input type="date" max={hariIni()} value={tgl} onChange={(e) => setTgl(e.target.value)} className={`${isian} mt-1 w-full`} /></label>
            <label className="text-xs text-stone-500">Catatan / nomor nota<input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="opsional" className={`${isian} mt-1 w-full`} /></label>
          </div>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto px-4">
          {barang.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 text-sm"><b className="text-kopi-900">{b.nama}</b> <span className="text-xs text-stone-400">{KELOMPOK[b.kelompok]?.slice(3)} · {formatRupiah(b.harga)}/{b.satuan}</span></span>
              <input value={qty[b.id] ?? ""} onChange={(e) => setQty({ ...qty, [b.id]: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" placeholder="0" aria-label={`Jumlah ${b.nama}`} className={`${isian} w-24 text-right`} />
              <span className="w-10 text-xs text-stone-500">{b.satuan}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t p-4">
          <p className="text-sm text-stone-600">{isi.length} barang · nilai nota <b className="tabular-nums text-kopi-900">{formatRupiah(total)}</b></p>
          <div className="flex gap-2">
            <button onClick={tutup} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold">Batal</button>
            <button disabled={pending || !isi.length} onClick={() => simpan(tgl, catatan || "Setoran nota", isi.map((b) => ({ barang_id: b.id, qty: Number(qty[b.id]) })))} className="flex-1 rounded-xl bg-matur-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {pending ? "Menyimpan…" : `Simpan ${isi.length} barang`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SesuaikanStok({ rekap, akhir, pending, tutup, simpan }: { rekap: RekapBarang[]; akhir: string; pending: boolean; tutup: () => void; simpan: (items: { barang_id: string; qty: number; catatan: string }[]) => void }) {
  const [fisik, setFisik] = useState<Record<string, string>>({});
  const [alasan, setAlasan] = useState("Hitung fisik");
  const ubah = rekap
    .filter((r) => fisik[r.barang_id] !== undefined && fisik[r.barang_id] !== "")
    .map((r) => ({ r, f: Number(fisik[r.barang_id]), d: Math.round(Number(fisik[r.barang_id]) - Number(r.sisa)) }))
    .filter((x) => x.d !== 0);
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && tutup()}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="border-b p-4">
          <h3 className="text-lg font-bold text-kopi-900">⚖️ Sesuaikan stok dengan hitungan fisik</h3>
          <p className="text-xs text-stone-500">Isi jumlah yang benar-benar ada (per {akhir > hariIni() ? hariIni() : akhir}). Sistem membuat catatan koreksi agar sisa = hitungan fisik. Tercatat di riwayat dan tetap bisa diedit/hapus.</p>
          <label className="mt-3 block text-xs text-stone-500">Keterangan<input value={alasan} onChange={(e) => setAlasan(e.target.value)} className={`${isian} mt-1 w-full`} /></label>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto px-4">
          {rekap.map((r) => {
            const v = fisik[r.barang_id];
            const d = v !== undefined && v !== "" ? Math.round(Number(v) - Number(r.sisa)) : 0;
            return (
              <li key={r.barang_id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1"><b className="text-kopi-900">{r.nama}</b> <span className={`text-xs ${r.sisa < 0 ? "font-semibold text-red-600" : "text-stone-400"}`}>sistem {angka(r.sisa)} {r.satuan}</span></span>
                <input value={v ?? ""} onChange={(e) => setFisik({ ...fisik, [r.barang_id]: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" placeholder="fisik" aria-label={`Hitungan fisik ${r.nama}`} className={`${isian} w-24 text-right`} />
                <span className={`w-16 text-right text-xs tabular-nums ${d > 0 ? "text-emerald-700" : d < 0 ? "text-red-600" : "text-stone-300"}`}>{d ? `${d > 0 ? "+" : ""}${angka(d)}` : "–"}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2 border-t p-4">
          <button onClick={tutup} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold">Batal</button>
          <button
            disabled={pending || !ubah.length || alasan.trim().length < 3}
            onClick={() => simpan(ubah.map((x) => ({ barang_id: x.r.barang_id, qty: x.d, catatan: `${alasan.trim()}: sistem ${angka(x.r.sisa)} → fisik ${angka(x.f)} ${x.r.satuan}` })))}
            className="flex-1 rounded-xl bg-matur-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "Menyimpan…" : `Sesuaikan ${ubah.length} barang`}
          </button>
        </div>
      </div>
    </div>
  );
}
