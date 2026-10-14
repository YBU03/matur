"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { FormPengeluaran, label, type Kat } from "@/components/form-pengeluaran";
import { catatPengeluaran, hapusPengeluaran, ubahPengeluaran, type Result } from "@/lib/kas-actions";
import { tutupShiftPin } from "@/lib/shift-actions";

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

const cls = "w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-matur-500";
const angka = (v: string) => Math.round(Number(v.replace(/[^\d]/g, "")) || 0);

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
  sesi: { id: string; modal: number; dibuka: string; kasirId: string; nama: string } | null;
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

      {sesi && ringkas && <TutupShift sesi={sesi} ringkas={ringkas} pending={pending} perluPin={sesi.kasirId !== meId && !spv} onTutup={(a, pin) => run(() => tutupShiftPin(sesi.id, pin, a))} />}

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

function TutupShift({
  sesi,
  ringkas,
  pending,
  perluPin,
  onTutup,
}: {
  sesi: { id: string; modal: number; dibuka: string; nama: string };
  ringkas: { tunai: number; nonTunai: number; laci: number; transaksi: number };
  pending: boolean;
  perluPin: boolean;
  onTutup: (aktual: number, pin: string) => void;
}) {
  const [aktual, setAktual] = useState("");
  const [pin, setPin] = useState("");
  const seharusnya = ringkas.tunai - ringkas.laci;
  const selisih = aktual ? angka(aktual) - seharusnya : null;
  return (
    <section className="space-y-3 rounded-2xl border-2 border-kopi-700 bg-white p-4">
      <h2 className="font-bold">
        Shift {sesi.nama} · buka {new Date(sesi.dibuka).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
      </h2>
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
      {perluPin && (
        <label className="block text-sm font-medium">
          PIN {sesi.nama} (konfirmasi tutup shift)
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" autoComplete="off" className={`mt-1 ${cls} text-center text-lg tracking-[0.5em]`} />
        </label>
      )}
      <button
        disabled={pending || !aktual || (perluPin && pin.length < 4)}
        onClick={() => confirm(`Tutup shift ${sesi.nama} dengan setoran ${formatRupiah(angka(aktual))}?`) && onTutup(angka(aktual), pin)}
        className="w-full rounded-xl bg-kopi-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        🔒 Tutup shift & serah terima
      </button>
    </section>
  );
}
