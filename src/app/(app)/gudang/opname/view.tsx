"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gudangRpc } from "@/lib/gudang-revisi-actions";
import { formatRupiah as rp, formatTanggal } from "@/lib/format";
import { Modal } from "@/components/confirm-edit";
import { Badge, HeaderHalaman, Kosong, KartuAngka, ChipHeader, tombolHeader, tombolHeaderUtama } from "@/components/ui-halaman";
export type DraftGudang = {
  id: string;
  tanggal: string;
  status: string;
  versi: number;
  catatan: string;
  nama_petugas: string;
  created_at: string;
  final_at: string | null;
};
export type HitungGudang = {
  bahan_id: string;
  nama: string;
  satuan: string;
  sistem: number;
  fisik: number | null;
  hpp: number | null;
  alasan: string;
};

const STATUS: Record<string, [string, "kuning" | "hijau" | "netral"]> = {
  draft: ["Draft", "kuning"],
  final: ["Final", "hijau"],
  batal: ["Dibatalkan", "netral"],
};
const nf = (v: number) => Number(v).toLocaleString("id-ID", { maximumFractionDigits: 3 });
const hariIni = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

export function OpnameGudang({
  draft: d,
  items,
  list,
  boleh,
}: {
  draft: DraftGudang | null;
  items: HitungGudang[];
  list: DraftGudang[];
  boleh: boolean;
}) {
  const router = useRouter();
  const request = useRef<string | null>(null);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState(""),
    [tanggal, setTanggal] = useState(hariIni()),
    [rows, setRows] = useState(items.map((i) => ({ ...i, isi: i.fisik == null ? "" : String(i.fisik) }))),
    [catatan, setCatatan] = useState(d?.catatan ?? ""),
    [cari, setCari] = useState(""),
    [saring, setSaring] = useState<"semua" | "belum" | "selisih">("semua"),
    [dirty, setDirty] = useState(false),
    [review, setReview] = useState(false),
    [unduh, setUnduh] = useState("");
  const edit = !!d && boleh && d.status === "draft";
  const counted = rows.filter((r) => r.isi !== "");
  const selisih = counted.filter((r) => Number(r.isi) !== Number(r.sistem));
  const total = counted.reduce((n, r) => n + (Number(r.isi) - Number(r.sistem)) * Number(r.hpp ?? 0), 0);
  const persen = rows.length ? Math.round((counted.length / rows.length) * 100) : 0;
  const tampil = rows.filter(
    (r) =>
      r.nama.toLowerCase().includes(cari.toLowerCase()) &&
      (saring === "semua" || (saring === "belum" ? r.isi === "" : r.isi !== "" && Number(r.isi) !== Number(r.sistem))),
  );
  const ubah = (id: string, v: { isi?: string; alasan?: string }) => {
    setDirty(true);
    setRows(rows.map((x) => (x.bahan_id === id ? { ...x, ...v } : x)));
  };
  const run = (aksi: string) =>
    start(async () => {
      try {
        request.current ??= crypto.randomUUID();
        const p =
          aksi === "buat"
            ? { aksi, request_id: request.current, tanggal }
            : {
                aksi,
                id: d!.id,
                versi: d!.versi,
                catatan,
                items: rows.map((r) => ({
                  bahan_id: r.bahan_id,
                  fisik: r.isi === "" ? null : Number(r.isi),
                  alasan: r.alasan,
                })),
              };
        const r = await gudangRpc("proses_opname_gudang", { p });
        if (r.error) setMsg(r.error);
        else {
          setMsg("");
          setDirty(false);
          setReview(false);
          request.current = null;
          if (aksi === "buat") router.push("/gudang/opname?id=" + r.id);
          else router.refresh();
        }
      } catch {
        setMsg("Belum ada konfirmasi server. Isian tetap tersedia; coba lagi dengan data yang sama.");
      }
    });
  const ekspor = async (jenis: "pdf" | "excel") => {
    if (!d) return;
    setUnduh(jenis);
    try {
      if (jenis === "pdf") {
        const [{ buatOpnamePDF }, { unduh }] = await Promise.all([import("@/lib/gudang-laporan-pdf"), import("@/lib/pdf-kop")]);
        unduh(buatOpnamePDF(d, items), "Opname Gudang " + d.tanggal);
      } else {
        const { buatOpnameExcel, unduhExcel } = await import("@/lib/gudang-laporan-excel");
        await unduhExcel(await buatOpnameExcel(d, items), "Opname Gudang " + d.tanggal);
      }
    } catch {
      setMsg("File belum dapat dibuat. Coba lagi.");
    } finally {
      setUnduh("");
    }
  };
  const status = d ? STATUS[d.status] ?? [d.status, "netral"] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-4">
      <Link href="/gudang/stok" className="inline-flex text-sm font-semibold text-matur-700 hover:underline">
        ← Stok Gudang
      </Link>
      <HeaderHalaman
        ikon="📋"
        judul="Stok Opname Gudang"
        keterangan="Khusus Gudang Pusat. Hitung dalam satuan pakai (gram, ml, pcs). Isian kosong berarti belum dihitung dan tidak mengubah stok."
        aksi={
          d && (
            <>
              <button disabled={!!unduh || dirty} onClick={() => ekspor("excel")} className={tombolHeaderUtama + " disabled:opacity-60"}>
                {unduh === "excel" ? "Menyiapkan…" : "⬇ Excel"}
              </button>
              <button disabled={!!unduh || dirty} onClick={() => ekspor("pdf")} className={tombolHeader + " disabled:opacity-60"}>
                {unduh === "pdf" ? "Menyiapkan…" : "⬇ PDF"}
              </button>
            </>
          )
        }
      >
        {d && status && (
          <>
            <ChipHeader>📅 {formatTanggal(d.tanggal)}</ChipHeader>
            <ChipHeader>{status[0]}</ChipHeader>
            <ChipHeader>👤 {d.nama_petugas}</ChipHeader>
          </>
        )}
      </HeaderHalaman>

      {boleh && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run("buat");
          }}
          className="flex flex-wrap items-end gap-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm sm:p-4"
        >
          <div className="mr-auto min-w-0">
            <p className="font-bold text-kopi-900">Opname baru</p>
            <p className="text-xs text-stone-500">Draft memotret stok sistem saat dibuat; stok baru berubah setelah finalisasi.</p>
          </div>
          <label className="text-xs text-stone-500">
            Tanggal
            <input type="date" required max={hariIni()} value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="mt-0.5 block rounded-xl border border-matur-200 px-3 py-2 text-sm text-kopi-900" />
          </label>
          <button disabled={busy || !tanggal || dirty} className="rounded-xl bg-kopi-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy && !d ? "Memproses…" : "+ Buat draft"}
          </button>
        </form>
      )}

      {msg && !review && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {msg}
        </p>
      )}

      {d ? (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2 rounded-2xl border border-matur-100 bg-white p-4 shadow-sm lg:col-span-1">
              <p className="text-xs font-medium text-stone-500">Progres hitung</p>
              <p className="text-xl font-extrabold tabular-nums text-kopi-900">
                {counted.length}
                <span className="text-sm font-semibold text-stone-400"> / {rows.length} bahan</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: persen + "%" }} />
              </div>
            </div>
            <KartuAngka ikon="⚖️" label="Bahan selisih" nilai={selisih.length} nada={selisih.length ? "kuning" : "hijau"} sub={counted.length ? `${counted.length - selisih.length} sesuai` : "Belum ada"} />
            <KartuAngka ikon={d.status === "final" ? "✅" : d.status === "batal" ? "🚫" : "📝"} label="Status" nilai={status![0]} nada={status![1]} sub={d.final_at ? "Final " + formatTanggal(d.final_at, true) : "Dibuat " + formatTanggal(d.created_at, true)} />
            <div className="col-span-2 lg:col-span-1">
              <KartuAngka ikon="💰" label="Nilai selisih" nilai={<span className={total < 0 ? "text-red-700" : ""}>{rp(total)}</span>} nada={total < 0 ? "merah" : "netral"} sub={counted.some((r) => r.hpp == null) ? "Ada HPP belum lengkap" : "HPP lengkap"} />
            </div>
          </div>

          <div className="rounded-2xl border border-matur-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-3">
              <input aria-label="Cari bahan opname" placeholder="🔎 Cari bahan…" value={cari} onChange={(e) => setCari(e.target.value)} className="w-full min-w-0 rounded-xl border border-matur-200 px-3 py-2 text-sm outline-none focus:border-matur-500 sm:w-auto sm:max-w-xs sm:flex-1" />
              <div className="flex w-full gap-1 rounded-xl bg-matur-50 p-1 text-xs font-semibold sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                {(
                  [
                    ["semua", `Semua ${rows.length}`],
                    ["belum", `Belum ${rows.length - counted.length}`],
                    ["selisih", `Selisih ${selisih.length}`],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setSaring(k)} className={`rounded-lg px-2.5 py-1.5 ${saring === k ? "bg-white text-kopi-900 shadow-sm" : "text-stone-500"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1.3fr_1fr_minmax(0,2fr)] gap-3 bg-matur-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-matur-800 sm:grid">
              <span>Bahan</span>
              <span className="text-right">Sistem</span>
              <span>Fisik</span>
              <span className="text-right">Selisih</span>
              <span>Alasan</span>
            </div>
            <ul className="divide-y divide-stone-100">
              {tampil.map((r) => {
                const s = r.isi === "" ? null : Number(r.isi) - Number(r.sistem);
                return (
                  <li key={r.bahan_id} className={`grid grid-cols-3 items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_1fr_1.3fr_1fr_minmax(0,2fr)] ${s ? "bg-amber-50/40" : ""}`}>
                    <div className="col-span-3 min-w-0 sm:col-span-1">
                      <p className="truncate font-semibold text-kopi-900">{r.nama}</p>
                      <p className="text-xs text-stone-500">{r.satuan}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[11px] text-stone-400 sm:hidden">Sistem</p>
                      <p className="tabular-nums text-stone-700">{nf(r.sistem)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-400 sm:hidden">Fisik</p>
                      {edit ? (
                        <input aria-label={"Fisik " + r.nama} type="number" inputMode="decimal" min="0" step="0.001" value={r.isi} onChange={(e) => ubah(r.bahan_id, { isi: e.target.value })} placeholder="—" className="w-full rounded-lg border border-matur-200 px-2.5 py-1.5 text-right tabular-nums outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100" />
                      ) : (
                        <p className={r.isi === "" ? "text-xs italic text-stone-400" : "tabular-nums"}>{r.isi === "" ? "Belum dihitung" : nf(Number(r.isi))}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-stone-400 sm:hidden">Selisih</p>
                      {s === null ? <span className="text-stone-300">—</span> : s === 0 ? <Badge nada="hijau">Sesuai</Badge> : <span className={`font-bold tabular-nums ${s < 0 ? "text-red-700" : "text-sky-700"}`}>{s > 0 ? "+" : ""}{nf(s)}</span>}
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      {edit ? (
                        (s || r.alasan) ? <input aria-label={"Alasan " + r.nama} value={r.alasan} maxLength={500} placeholder="Alasan selisih…" onChange={(e) => ubah(r.bahan_id, { alasan: e.target.value })} className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm outline-none focus:border-matur-500" /> : <span className="hidden text-xs text-stone-300 sm:inline">—</span>
                      ) : (
                        r.alasan && <p className="text-sm text-stone-600">{r.alasan}</p>
                      )}
                    </div>
                  </li>
                );
              })}
              {!tampil.length && <li className="p-6 text-center text-sm text-stone-500">Tidak ada bahan yang cocok.</li>}
            </ul>
          </div>

          <label className="block rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
            <span className="text-sm font-bold text-kopi-900">Catatan</span>
            <textarea disabled={!edit} value={catatan} onChange={(e) => { setDirty(true); setCatatan(e.target.value); }} maxLength={2000} rows={2} placeholder={edit ? "Catatan opname (opsional)" : "-"} className="mt-1 w-full rounded-xl border border-stone-200 p-3 text-sm disabled:bg-stone-50" />
          </label>

          {edit && (
            <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-matur-200 bg-white/95 p-3 shadow-lg backdrop-blur print:hidden">
              <p className="w-full text-xs text-stone-600 sm:mr-auto sm:w-auto">{dirty ? <b className="text-amber-700">● Ada perubahan belum disimpan</b> : "✓ Draft tersimpan · stok gudang belum berubah"}</p>
              <button type="button" disabled={busy} onClick={() => window.confirm("Batalkan draft opname ini? Stok tidak berubah.") && run("batal")} className="rounded-xl px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                Batalkan
              </button>
              <button type="button" disabled={busy || !dirty} onClick={() => run("simpan")} className="flex-1 whitespace-nowrap rounded-xl border border-matur-300 px-3 py-2 text-sm font-semibold text-kopi-800 disabled:opacity-50 sm:flex-none">
                {busy ? "Menyimpan…" : "Simpan draft"}
              </button>
              <button type="button" disabled={busy || dirty || !counted.length} onClick={() => setReview(true)} className="flex-1 whitespace-nowrap rounded-xl bg-kopi-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none">
                Periksa & finalisasi
              </button>
            </div>
          )}
        </section>
      ) : (
        <Kosong ikon="📋" judul="Pilih opname dari riwayat">
          {boleh ? "atau buat draft opname baru di atas." : "Belum ada opname yang dipilih."}
        </Kosong>
      )}

      {review && d && (
        <Modal title="Finalisasi opname gudang" onClose={busy ? undefined : () => setReview(false)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-stone-50 p-2"><p className="text-xs text-stone-500">Dihitung</p><b>{counted.length}</b></div>
              <div className="rounded-xl bg-amber-50 p-2"><p className="text-xs text-stone-500">Selisih</p><b>{selisih.length}</b></div>
              <div className="rounded-xl bg-stone-50 p-2"><p className="text-xs text-stone-500">Nilai</p><b className={total < 0 ? "text-red-700" : ""}>{rp(total)}</b></div>
            </div>
            <p>Stok gudang untuk <b>{counted.length} bahan</b> yang sudah dihitung akan disesuaikan. Bahan yang kosong tidak berubah. Jika stok bergerak sejak draft dibuat, sistem meminta penghitungan ulang.</p>
            {msg && <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-700">{msg}</p>}
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => run("final")} className="flex-1 rounded-xl bg-kopi-900 px-4 py-3 font-semibold text-white disabled:opacity-50">
                {busy ? "Memeriksa stok…" : "Ya, finalisasi"}
              </button>
              <button disabled={busy} onClick={() => setReview(false)} className="rounded-xl border px-4 py-3 font-semibold text-stone-700">
                Kembali
              </button>
            </div>
          </div>
        </Modal>
      )}

      <section className="space-y-2 print:hidden">
        <h2 className="text-base font-bold text-kopi-900">Riwayat opname</h2>
        {!list.length && <p className="text-sm text-stone-500">Belum ada opname gudang.</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((x) => {
            const [l, n] = STATUS[x.status] ?? [x.status, "netral"];
            const aktif = x.id === d?.id;
            return (
              <Link
                key={x.id}
                href={"/gudang/opname?id=" + x.id}
                onClick={(e) => {
                  if (dirty && !window.confirm("Tinggalkan isian yang belum disimpan?")) e.preventDefault();
                }}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm hover:border-matur-300 ${aktif ? "border-matur-400 ring-2 ring-matur-100" : "border-matur-100"}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-matur-50 text-lg">📋</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-kopi-900">{formatTanggal(x.tanggal)}</p>
                  <p className="truncate text-xs text-stone-500">{x.nama_petugas}</p>
                </div>
                <Badge nada={n}>{l}</Badge>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
