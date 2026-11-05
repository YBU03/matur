"use client";

import { useEffect, useState } from "react";
import { Badge, Kosong } from "@/components/ui-halaman";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { riwayatPerbaikan, type Perbaikan } from "@/lib/harian-actions";

const JENIS: Record<string, { label: string; nada: "kuning" | "merah" | "biru" | "ungu" | "hijau" | "netral" }> = {
  koreksi_transaksi: { label: "Koreksi transaksi", nada: "kuning" },
  koreksi_data_akunting: { label: "Koreksi data akunting", nada: "kuning" },
  hapus_transaksi: { label: "Transaksi ke tempat sampah", nada: "merah" },
  pulihkan_transaksi: { label: "Transaksi dipulihkan", nada: "hijau" },
  void_pos: { label: "Void POS", nada: "merah" },
  update: { label: "Ubah pengeluaran", nada: "biru" },
  koreksi_biaya_final: { label: "Perbaikan pengeluaran (kas final)", nada: "biru" },
  hapus_biaya_final: { label: "Hapus pengeluaran (kas final)", nada: "merah" },
  koreksi_manual: { label: "Penyesuaian angka", nada: "kuning" },
  input_platform: { label: "Input manual/platform", nada: "ungu" },
  hapus_manual: { label: "Penyesuaian diarsipkan", nada: "netral" },
};
const LABEL_KOLOM: Record<string, string> = { kanal: "Kanal", metode: "Metode", jumlah: "Nominal", sumber: "Sumber", keterangan: "Keterangan", kategori_id: "Kategori", tanggal: "Tanggal" };
const tampilNilai = (k: string, v: unknown, kat: Record<string, string>) =>
  v === null || v === undefined || v === "" ? "–" : k === "jumlah" ? formatRupiah(Number(v)) : k === "kategori_id" ? (kat[String(v)] ?? "?") : String(v);

/** Daftar semua perbaikan admin bulan ini: siapa, kapan, apa yang berubah (dari → ke), alasannya. */
export function RiwayatPerbaikan({ outletId, bulan, kategori }: { outletId: string; bulan: string; kategori: { id: string; nama: string }[] }) {
  const [data, setData] = useState<Perbaikan[] | null>(null);
  const [error, setError] = useState("");
  const [cari, setCari] = useState("");
  const kat = Object.fromEntries(kategori.map((k) => [k.id, k.nama]));
  useEffect(() => {
    let batal = false;
    riwayatPerbaikan(outletId, bulan).then((r) => {
      if (batal) return;
      setData(r.data ?? []);
      setError(r.error ?? "");
    });
    return () => {
      batal = true;
    };
  }, [outletId, bulan]);

  const q = cari.trim().toLowerCase();
  const tampil = (data ?? []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q) || (JENIS[r.jenis]?.label ?? "").toLowerCase().includes(q));

  return (
    <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="font-bold text-kopi-900">🕘 Riwayat perbaikan</h2>
          <p className="text-xs text-stone-500">Semua koreksi & penyesuaian admin bulan ini — tercatat otomatis, tidak bisa dihapus.</p>
        </div>
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔎 Cari nama, transaksi, alasan…" className="min-w-52 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="py-6 text-center text-sm text-stone-500">Memuat riwayat…</p>}
      {data && !tampil.length && <Kosong ikon="🗂️" judul={data.length ? "Tidak ada yang cocok" : "Belum ada perbaikan bulan ini"} />}
      <ul className="divide-y divide-stone-100">
        {tampil.map((r, i) => {
          const j = JENIS[r.jenis] ?? { label: r.jenis, nada: "netral" as const };
          const lama = r.lama ?? {};
          const baru = r.baru ?? {};
          const beda = Object.keys(LABEL_KOLOM).filter((k) => k in baru && (r.lama === null || JSON.stringify(lama[k]) !== JSON.stringify(baru[k])));
          const alasan = (baru.alasan as string | undefined) ?? (r.jenis.includes("manual") || r.jenis === "input_platform" ? (baru.keterangan as string | undefined) : undefined);
          return (
            <li key={i} className="py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge nada={j.nada}>{j.label}</Badge>
                <b className="text-kopi-900">{r.judul}</b>
                <span className="text-xs text-stone-500">data {r.tanggal ? formatTanggal(r.tanggal) : "-"}</span>
                <span className="ml-auto text-xs text-stone-500">
                  {r.siapa} · {new Date(r.waktu).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}
                </span>
              </div>
              {beda.length > 0 && r.lama !== null && (
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-600">
                  {beda.map((k) => (
                    <span key={k}>
                      {LABEL_KOLOM[k]}: <s className="text-stone-400">{tampilNilai(k, lama[k], kat)}</s> → <b>{tampilNilai(k, baru[k], kat)}</b>
                    </span>
                  ))}
                </p>
              )}
              {alasan && <p className="mt-0.5 text-xs italic text-stone-500">“{alasan}”</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
