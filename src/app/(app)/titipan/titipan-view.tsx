"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { minta } from "@/components/dialog-tanya";
import { BarisAngka, Badge, Kartu, KartuAngka, Kosong, isian, tabel, tombolAksi } from "@/components/ui-halaman";
import { formatRupiah } from "@/lib/format";
import { catatTitipan, hapusTitipan, ubahTitipan } from "@/lib/titipan-actions";

export type RekapTitipan = {
  menu_id: string;
  nama: string;
  produsen: string;
  harga: number;
  awal: number;
  keluar: number;
  masuk: number;
  terjual: number;
  sisa: number;
  tagihan: number;
};

type Jenis = "masuk" | "retur" | "rusak" | "koreksi";
type Riwayat = {
  id: string;
  menu_id: string;
  tanggal: string;
  qty: number;
  jenis?: string;
  catatan: string | null;
  nama_pembuat: string | null;
  created_at: string;
};

const JENIS: { v: Jenis; label: string; nada: "hijau" | "kuning" | "merah" | "biru" }[] = [
  { v: "masuk", label: "Barang masuk", nada: "hijau" },
  { v: "retur", label: "Retur ke produsen", nada: "kuning" },
  { v: "rusak", label: "Rusak / tidak layak jual", nada: "merah" },
  { v: "koreksi", label: "Koreksi (+/−)", nada: "biru" },
];
const labelJenis = (j?: string) => JENIS.find((x) => x.v === (j ?? "masuk"))?.label ?? j ?? "masuk";
const nadaJenis = (j?: string) => JENIS.find((x) => x.v === (j ?? "masuk"))?.nada ?? "biru";
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const tglPendek = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" });
const qtyBertanda = (jenis: Jenis, qty: string) => (jenis === "retur" || jenis === "rusak" ? -Math.abs(Number(qty)) : Number(qty));
const cocok = (teks: string, q: string) => teks.toLowerCase().includes(q);

export function TitipanView({
  outletId,
  awal,
  akhir,
  rekap,
  menu,
  riwayat,
}: {
  outletId: string;
  awal: string;
  akhir: string;
  rekap: RekapTitipan[];
  menu: { id: string; nama: string; produsen: string | null; harga_titip: number }[];
  riwayat: Riwayat[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [cari, setCari] = useState("");
  const [fProdusen, setFProdusen] = useState("");
  const [fJenis, setFJenis] = useState("");
  const [edit, setEdit] = useState<Riwayat | null>(null);
  const [f, setF] = useState({ menu: menu[0]?.id ?? "", qty: "", tanggal: hariIni(), catatan: "", jenis: "masuk" as Jenis });
  const formRef = useRef<HTMLElement>(null);

  const infoMenu = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const q = cari.trim().toLowerCase();
  const produsenSemua = [...new Set(rekap.map((r) => r.produsen))];
  const rekapTampil = rekap.filter((r) => (!fProdusen || r.produsen === fProdusen) && (!q || cocok(`${r.nama} ${r.produsen}`, q)));
  const produsen = [...new Set(rekapTampil.map((r) => r.produsen))];
  const riwayatTampil = riwayat.filter((r) => {
    const m = infoMenu.get(r.menu_id);
    if (fJenis && (r.jenis ?? "masuk") !== fJenis) return false;
    if (fProdusen && (m?.produsen ?? "-") !== fProdusen) return false;
    return !q || cocok(`${m?.nama ?? ""} ${m?.produsen ?? ""} ${r.catatan ?? ""} ${r.nama_pembuat ?? ""}`, q);
  });

  const total = rekapTampil.reduce((t, r) => t + r.tagihan, 0);
  const terjual = rekapTampil.reduce((t, r) => t + r.terjual, 0);
  const masuk = rekapTampil.reduce((t, r) => t + r.masuk, 0);
  const minus = rekapTampil.filter((r) => r.sisa < 0).length;

  const jalankan = (fn: () => Promise<{ error?: string; ok?: string }>, sukses?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        sukses?.();
        router.refresh();
      }
    });

  const setoranCepat = (menuId: string) => {
    setF({ ...f, menu: menuId, jenis: "masuk", qty: "" });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (!menu.length)
    return (
      <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Belum ada menu titipan. Buka{" "}
        <Link href="/master/menu" className="font-semibold underline">
          Data Menu
        </Link>
        , ubah menunya lalu centang <b>Produk titipan</b>, pilih <b>Produsen</b> (daftar di{" "}
        <Link href="/master/produsen_titipan" className="font-semibold underline">
          Produsen Titipan
        </Link>
        ) dan <b>Harga dari produsen / pcs</b>.
      </p>
    );

  return (
    <div className="space-y-4">
      <BarisAngka>
        <KartuAngka ikon="💰" label="Tagihan periode" nilai={formatRupiah(total)} sub={`${awal} s/d ${akhir}`} />
        <KartuAngka ikon="🧁" nada="hijau" label="Terjual (dari POS)" nilai={`${terjual} pcs`} sub="otomatis dari kasir" />
        <KartuAngka ikon="📦" nada="biru" label="Setoran masuk" nilai={`${masuk} pcs`} sub={`${riwayat.length} catatan`} />
        <KartuAngka ikon="⚠️" nada={minus ? "merah" : "hijau"} label="Sisa minus" nilai={`${minus} produk`} sub={minus ? "setoran belum dicatat?" : "aman"} />
      </BarisAngka>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔎 Cari produk, produsen, catatan, pencatat…" className={`${isian} min-w-0 flex-1 basis-60`} />
        <select value={fProdusen} onChange={(e) => setFProdusen(e.target.value)} className={isian}>
          <option value="">Semua produsen</option>
          {produsenSemua.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={fJenis} onChange={(e) => setFJenis(e.target.value)} className={isian}>
          <option value="">Semua jenis</option>
          {JENIS.map((j) => (
            <option key={j.v} value={j.v}>
              {j.label}
            </option>
          ))}
        </select>
        {(cari || fProdusen || fJenis) && (
          <button onClick={() => (setCari(""), setFProdusen(""), setFJenis(""))} className={tombolAksi.netral}>
            ✕ Reset
          </button>
        )}
      </section>

      {msg && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {msg.error ?? msg.ok}
        </p>
      )}

      {!rekapTampil.length && <Kosong ikon="🔎" judul="Tidak ada produk yang cocok">Ubah kata pencarian atau filter produsen.</Kosong>}
      {produsen.map((pr) => {
        const xs = rekapTampil.filter((r) => r.produsen === pr);
        return (
          <Kartu key={pr} judul={`Produsen: ${pr}`} keterangan={`${xs.length} produk · ${xs.reduce((t, r) => t + r.terjual, 0)} pcs terjual`} aksi={<Badge nada="netral">Tagihan {formatRupiah(xs.reduce((t, r) => t + r.tagihan, 0))}</Badge>}>
            <div className={tabel.bungkus}>
              <table className={tabel.tabel}>
                <thead className={tabel.kepala}>
                  <tr>
                    <th className={tabel.th}>Produk</th>
                    <th className={`${tabel.th} text-right`}>Awal</th>
                    <th className={`${tabel.th} text-right`}>Masuk</th>
                    <th className={`${tabel.th} text-right`}>Retur/rusak −</th>
                    <th className={`${tabel.th} text-right`}>Terjual</th>
                    <th className={`${tabel.th} text-right`}>Sisa</th>
                    <th className={`${tabel.th} text-right`}>Harga/pcs</th>
                    <th className={`${tabel.th} text-right`}>Tagihan</th>
                    <th className={tabel.th} />
                  </tr>
                </thead>
                <tbody>
                  {xs.map((r) => (
                    <tr key={r.menu_id} className={tabel.baris}>
                      <td className={`${tabel.td} font-medium`}>{r.nama}</td>
                      <td className={`${tabel.td} text-right tabular-nums`}>{r.awal}</td>
                      <td className={`${tabel.td} text-right tabular-nums`}>{r.masuk}</td>
                      <td className={`${tabel.td} text-right tabular-nums`}>{r.keluar}</td>
                      <td className={`${tabel.td} text-right font-semibold tabular-nums`}>{r.terjual}</td>
                      <td className={`${tabel.td} text-right tabular-nums ${r.sisa < 0 ? "font-bold text-red-600" : ""}`}>{r.sisa}</td>
                      <td className={`${tabel.td} text-right tabular-nums`}>{formatRupiah(r.harga)}</td>
                      <td className={`${tabel.td} text-right font-semibold tabular-nums`}>{formatRupiah(r.tagihan)}</td>
                      <td className={`${tabel.td} text-right`}>
                        <button onClick={() => setoranCepat(r.menu_id)} className={tombolAksi.utama} title="Catat setoran produk ini">
                          + Setoran
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {xs.some((r) => r.sisa < 0) && <p className="mt-2 text-xs text-red-600">Sisa minus: penjualan lebih banyak dari setoran tercatat — catat setoran yang belum diinput.</p>}
          </Kartu>
        );
      })}

      <section ref={formRef}>
        <Kartu judul="Catat pergerakan titipan" keterangan="Setoran dari produsen, retur, barang rusak, atau koreksi hitungan.">
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs text-stone-500">Produk</span>
              <select value={f.menu} onChange={(e) => setF({ ...f, menu: e.target.value })} className={`${isian} w-full`}>
                {menu.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama} {m.produsen ? `· ${m.produsen}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-stone-500">Jenis</span>
              <select value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value as Jenis })} className={`${isian} w-full`}>
                {JENIS.map((j) => (
                  <option key={j.v} value={j.v}>
                    {j.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-stone-500">Jumlah (pcs)</span>
              <input value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} inputMode="numeric" placeholder="0" className={`${isian} w-full`} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-stone-500">Tanggal</span>
              <input type="date" max={hariIni()} value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} className={`${isian} w-full`} />
            </label>
            <label className="space-y-1 text-sm sm:col-span-3">
              <span className="text-xs text-stone-500">Catatan {f.jenis !== "masuk" && <b className="text-red-600">(wajib)</b>}</span>
              <input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} placeholder={f.jenis === "masuk" ? "opsional" : "alasan retur/rusak/koreksi"} className={`${isian} w-full`} />
            </label>
          </div>
          <button
            disabled={pending || !f.menu || !Number(f.qty)}
            onClick={() => jalankan(() => catatTitipan(outletId, f.menu, qtyBertanda(f.jenis, f.qty), f.tanggal, f.catatan, f.jenis), () => setF({ ...f, qty: "", catatan: "", jenis: "masuk" }))}
            className="mt-3 w-full rounded-xl bg-matur-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Menyimpan…" : "Simpan catatan"}
          </button>
          <p className="mt-2 text-xs text-stone-500">Setoran titipan jangan dicatat sebagai pengeluaran “Bahan Baku” agar tidak terhitung dua kali — tagihannya otomatis masuk HPP dari jumlah terjual.</p>
        </Kartu>
      </section>

      <Kartu judul="Riwayat pergerakan" keterangan={`${riwayatTampil.length} dari ${riwayat.length} catatan · ${awal} s/d ${akhir}`}>
        {!riwayatTampil.length ? (
          <Kosong ikon="🗒️" judul={riwayat.length ? "Tidak ada catatan yang cocok" : "Belum ada catatan di periode ini"} />
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {riwayatTampil.map((r) => {
              const m = infoMenu.get(r.menu_id);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-kopi-900">
                      {m?.nama ?? "?"} <span className="text-xs font-normal text-stone-500">· {m?.produsen ?? "-"}</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                      <span>{tglPendek(r.tanggal)}</span>
                      <Badge nada={nadaJenis(r.jenis)}>{labelJenis(r.jenis)}</Badge>
                      <span>oleh {r.nama_pembuat ?? "-"}</span>
                      {r.catatan && <span className="italic">“{r.catatan}”</span>}
                    </p>
                  </div>
                  <b className={`tabular-nums ${r.qty < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {r.qty > 0 ? "+" : ""}
                    {r.qty} pcs
                  </b>
                  <div className="flex gap-1.5">
                    <button disabled={pending} onClick={() => (setMsg(null), setEdit(r))} className={tombolAksi.edit}>
                      ✏️ Edit
                    </button>
                    <button
                      disabled={pending}
                      onClick={async () => {
                        const alasan = await minta(`Hapus catatan ${m?.nama ?? ""} ${r.qty > 0 ? "+" : ""}${r.qty} pcs (${tglPendek(r.tanggal)})? Sisa & tagihan akan dihitung ulang.`, { judul: "Hapus catatan titipan", ya: "Hapus", bahaya: true, placeholder: "alasan (opsional)" });
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
      </Kartu>

      {edit && (
        <EditTitipan
          data={edit}
          nama={infoMenu.get(edit.menu_id)?.nama ?? "?"}
          pending={pending}
          tutup={() => setEdit(null)}
          simpan={(v) => jalankan(() => ubahTitipan(edit.id, qtyBertanda(v.jenis, v.qty), v.tanggal, v.jenis, v.catatan), () => setEdit(null))}
          galat={msg?.error}
        />
      )}
    </div>
  );
}

function EditTitipan({
  data,
  nama,
  pending,
  tutup,
  simpan,
  galat,
}: {
  data: Riwayat;
  nama: string;
  pending: boolean;
  tutup: () => void;
  simpan: (v: { qty: string; tanggal: string; jenis: Jenis; catatan: string }) => void;
  galat?: string;
}) {
  const [v, setV] = useState({ qty: String(Math.abs(data.qty)), tanggal: data.tanggal, jenis: (data.jenis ?? "masuk") as Jenis, catatan: data.catatan ?? "" });
  const [tandaMinus, setTandaMinus] = useState(data.qty < 0 && (data.jenis ?? "masuk") === "koreksi");
  const qtyKirim = v.jenis === "koreksi" && tandaMinus ? `-${Math.abs(Number(v.qty))}` : v.qty;
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && tutup()}>
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
        <div>
          <h3 className="text-lg font-bold text-kopi-900">✏️ Edit catatan titipan</h3>
          <p className="text-sm text-stone-500">{nama}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 space-y-1 text-sm">
            <span className="text-xs text-stone-500">Jenis</span>
            <select value={v.jenis} onChange={(e) => setV({ ...v, jenis: e.target.value as Jenis })} className={`${isian} w-full`}>
              {JENIS.map((j) => (
                <option key={j.v} value={j.v}>
                  {j.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-stone-500">Jumlah (pcs)</span>
            <input value={v.qty} onChange={(e) => setV({ ...v, qty: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" className={`${isian} w-full`} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-stone-500">Tanggal</span>
            <input type="date" max={hariIni()} value={v.tanggal} onChange={(e) => setV({ ...v, tanggal: e.target.value })} className={`${isian} w-full`} />
          </label>
          {v.jenis === "koreksi" && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tandaMinus} onChange={(e) => setTandaMinus(e.target.checked)} /> Koreksi mengurangi stok (−)
            </label>
          )}
          <label className="col-span-2 space-y-1 text-sm">
            <span className="text-xs text-stone-500">Catatan {v.jenis !== "masuk" && <b className="text-red-600">(wajib)</b>}</span>
            <input value={v.catatan} onChange={(e) => setV({ ...v, catatan: e.target.value })} className={`${isian} w-full`} />
          </label>
        </div>
        {galat && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{galat}</p>}
        <div className="flex gap-2">
          <button onClick={tutup} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-700">
            Batal
          </button>
          <button disabled={pending || !Number(v.qty)} onClick={() => simpan({ ...v, qty: qtyKirim })} className="flex-1 rounded-xl bg-matur-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
