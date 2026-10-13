"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { catatPengeluaran, hapusPengeluaran, tutupShift, ubahPengeluaran, type Pengeluaran, type Result } from "@/lib/kas-actions";

export type Catatan = {
  id: string;
  tanggal: string;
  kategori_id: string;
  jumlah: number;
  keterangan: string | null;
  sumber: "laci" | "pusat";
  sesi_kas_id: string | null;
  dibuat_oleh: string | null;
  created_at: string;
  pengguna: { nama: string } | null;
};
type Kat = { id: string; nama: string; grup: string };

const cls = "w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-matur-500";
const angka = (v: string) => Math.round(Number(v.replace(/[^\d]/g, "")) || 0);
const label = (n: string) => n.replace(/^Biaya /, "");
// belanja bahan baku/dessert biasanya dibayar pusat (tidak dari laci) — tetap bisa diubah
const sumberAwal = (k: Kat | undefined) => (k?.nama === "Bahan Baku" ? "pusat" : "laci");

export function KasView({
  kategori,
  catatan,
  meId,
  sesi,
  adaShiftBuka,
  ringkas,
  outletNama,
  spv,
}: {
  kategori: Kat[];
  catatan: Catatan[];
  meId: string;
  sesi: { id: string; modal: number; dibuka: string } | null;
  adaShiftBuka: boolean;
  ringkas: { tunai: number; nonTunai: number; laci: number; transaksi: number } | null;
  outletNama: string;
  spv: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [ubah, setUbah] = useState<Catatan | null>(null);
  const namaKat = Object.fromEntries(kategori.map((k) => [k.id, k.nama]));
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        after?.();
        router.refresh();
      }
    });
  const totalLaci = catatan.filter((c) => c.sumber === "laci").reduce((a, c) => a + c.jumlah, 0);
  const totalPusat = catatan.filter((c) => c.sumber === "pusat").reduce((a, c) => a + c.jumlah, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Kas & Pengeluaran</h1>
        <p className="text-sm text-stone-500">
          {outletNama} · {formatTanggal(new Date().toISOString())}
        </p>
      </div>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}
      {!adaShiftBuka && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Belum ada shift kasir yang buka. Pengeluaran dari laci tetap tercatat untuk hari ini.</p>}

      <FormPengeluaran kategori={kategori} pending={pending} onSimpan={(d, reset) => run(() => catatPengeluaran(d), reset)} />

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
          <h2 className="mr-auto font-bold">Pengeluaran hari ini ({catatan.length})</h2>
          <span className="text-xs text-stone-500">
            dari laci <b>{formatRupiah(totalLaci)}</b> · dibayar pusat <b>{formatRupiah(totalPusat)}</b>
          </span>
        </div>
        {catatan.length === 0 && <p className="py-3 text-sm text-stone-400">Belum ada pengeluaran.</p>}
        <ul className="divide-y">
          {catatan.map((c) => {
            const milik = c.dibuat_oleh === meId || spv;
            return (
              <li key={c.id} className="flex items-start gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.keterangan || label(namaKat[c.kategori_id] ?? "Pengeluaran")}</p>
                  <p className="text-xs text-stone-500">
                    {label(namaKat[c.kategori_id] ?? "-")} ·{" "}
                    <span className={c.sumber === "laci" ? "text-amber-700" : "text-blue-700"}>{c.sumber === "laci" ? "dari laci" : "dibayar pusat"}</span>
                    {c.pengguna?.nama && ` · ${c.pengguna.nama}`} · {new Date(c.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatRupiah(c.jumlah)}</span>
                {milik && (
                  <span className="flex shrink-0">
                    <button onClick={() => (setMsg(null), setUbah(c))} className="rounded-lg px-2 py-1 text-matur-700 hover:bg-matur-50" title="Ubah">
                      ✏️
                    </button>
                    <button disabled={pending} onClick={() => confirm("Hapus pengeluaran ini?") && run(() => hapusPengeluaran(c.id))} className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50" title="Hapus">
                      🗑
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {sesi && ringkas && <TutupShift sesi={sesi} ringkas={ringkas} pending={pending} onTutup={(a) => run(() => tutupShift(sesi.id, a))} />}

      {ubah && (
        <Modal title="Ubah pengeluaran">
          <FormPengeluaran
            kategori={kategori}
            pending={pending}
            awal={ubah}
            onBatal={() => setUbah(null)}
            onSimpan={(d) => run(() => ubahPengeluaran(ubah.id, d), () => setUbah(null))}
          />
          {msg?.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
        </Modal>
      )}
    </div>
  );
}

function FormPengeluaran({
  kategori,
  pending,
  awal,
  onSimpan,
  onBatal,
}: {
  kategori: Kat[];
  pending: boolean;
  awal?: Catatan;
  onSimpan: (d: Pengeluaran, reset: () => void) => void;
  onBatal?: () => void;
}) {
  const [kat, setKat] = useState(awal?.kategori_id ?? "");
  const [jumlah, setJumlah] = useState(awal ? String(awal.jumlah) : "");
  const [ket, setKet] = useState(awal?.keterangan ?? "");
  const [sumber, setSumber] = useState<"laci" | "pusat">(awal?.sumber ?? "laci");
  const pilih = (id: string) => {
    setKat(id);
    if (!awal) setSumber(sumberAwal(kategori.find((k) => k.id === id)));
  };
  const reset = () => {
    setKat("");
    setJumlah("");
    setKet("");
    setSumber("laci");
  };
  const body = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {kategori.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => pilih(k.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${kat === k.id ? "bg-kopi-900 font-semibold text-white" : "border border-matur-200 bg-white text-kopi-700"}`}
          >
            {label(k.nama)}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
        <input value={jumlah ? Number(angka(jumlah)).toLocaleString("id-ID") : ""} onChange={(e) => setJumlah(e.target.value)} inputMode="numeric" placeholder="Nominal (Rp)" className={`${cls} text-right text-base font-semibold`} />
        <input value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Keterangan (mis. galon 2, parkir, tissue)" className={cls} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {(["laci", "pusat"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSumber(s)}
            className={`rounded-xl border-2 py-2 font-semibold ${sumber === s ? (s === "laci" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-blue-500 bg-blue-50 text-blue-800") : "border-stone-200 text-stone-500"}`}
          >
            {s === "laci" ? "💵 Uang laci kasir" : "🏢 Dibayar pusat"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {onBatal && (
          <button type="button" onClick={onBatal} className="flex-1 rounded-xl border py-2.5 text-sm">
            Batal
          </button>
        )}
        <button
          disabled={pending || !kat || !(angka(jumlah) > 0)}
          onClick={() => onSimpan({ kategori_id: kat, jumlah: angka(jumlah), keterangan: ket, sumber }, reset)}
          className="flex-1 rounded-xl bg-matur-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : awal ? "Simpan perubahan" : "+ Catat pengeluaran"}
        </button>
      </div>
    </div>
  );
  if (awal) return body;
  return (
    <section className="rounded-2xl border border-matur-200 bg-white p-4">
      <h2 className="mb-3 font-bold">Catat pengeluaran</h2>
      {body}
    </section>
  );
}

function TutupShift({
  sesi,
  ringkas,
  pending,
  onTutup,
}: {
  sesi: { id: string; modal: number; dibuka: string };
  ringkas: { tunai: number; nonTunai: number; laci: number; transaksi: number };
  pending: boolean;
  onTutup: (aktual: number) => void;
}) {
  const [aktual, setAktual] = useState("");
  const seharusnya = ringkas.tunai - ringkas.laci;
  const selisih = aktual ? angka(aktual) - seharusnya : null;
  return (
    <section className="space-y-3 rounded-2xl border-2 border-kopi-700 bg-white p-4">
      <h2 className="font-bold">Shift saya · buka {new Date(sesi.dibuka).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {[
          ["Transaksi", String(ringkas.transaksi)],
          ["Modal laci", formatRupiah(sesi.modal)],
          ["Penjualan tunai", formatRupiah(ringkas.tunai)],
          ["Penjualan non tunai", formatRupiah(ringkas.nonTunai)],
          ["Pengeluaran dari laci", formatRupiah(-ringkas.laci)],
          ["Tunai seharusnya", formatRupiah(seharusnya)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-stone-50 px-3 py-2">
            <dt className="text-xs text-stone-500">{k}</dt>
            <dd className="font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <label className="block text-sm font-medium">
        Uang tunai aktual yang disetor (di luar modal laci)
        <input value={aktual ? Number(angka(aktual)).toLocaleString("id-ID") : ""} onChange={(e) => setAktual(e.target.value)} inputMode="numeric" className={`mt-1 ${cls} text-right text-lg font-bold`} />
      </label>
      {selisih !== null && (
        <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${selisih === 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {selisih === 0 ? "✓ Pas, tidak ada selisih" : `Selisih ${formatRupiah(selisih)} ${selisih > 0 ? "(lebih)" : "(kurang)"}`}
        </p>
      )}
      <button
        disabled={pending || !aktual}
        onClick={() => confirm(`Tutup shift dengan setoran ${formatRupiah(angka(aktual))}?`) && onTutup(angka(aktual))}
        className="w-full rounded-xl bg-kopi-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        🔒 Tutup shift
      </button>
    </section>
  );
}
