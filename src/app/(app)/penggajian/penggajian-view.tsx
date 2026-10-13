"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { jumlahkan, totalSlip, type Baris, type Komponen } from "@/lib/gaji";
import { bukaPenggajian, finalkanPenggajian, hitungPenggajian, simpanGajiStaf, ubahSlip } from "@/lib/gaji-actions";
import type { Kop } from "@/lib/pdf-kop";
import { namaBulan } from "./slip-pdf";

export type Slip = {
  id: string;
  pengguna_id: string;
  nama: string;
  jabatan: string | null;
  hadir: number;
  telat: number;
  menit_telat: number;
  tidak_absen: number;
  izin: number;
  menit_kerja: number;
  pendapatan: Baris[];
  potongan: Baris[];
  total: number;
  rekening: string | null;
};
type KomponenStaf = Komponen & { bank: string | null; no_rekening: string | null; atas_nama: string | null };

export function PenggajianView({
  outlets,
  outlet,
  bulan,
  tab,
  bisaUbah,
  penggajian,
  slips,
  staf,
  perusahaan,
}: {
  outlets: { id: string; nama: string }[];
  outlet: { id: string; nama: string };
  bulan: string;
  tab: "slip" | "komponen";
  bisaUbah: boolean;
  penggajian: { id: string; status: string; final_at: string | null } | null;
  slips: Slip[];
  staf: { id: string; nama: string; peran: string; komponen: KomponenStaf }[];
  perusahaan: Kop;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [buka, setBuka] = useState<string | null>(null);
  const final = penggajian?.status === "final";
  const total = slips.reduce((s, x) => s + Number(x.total), 0);
  const href = (p: Record<string, string>) => `/penggajian?${new URLSearchParams({ outlet: outlet.id, bulan, ...(tab === "komponen" ? { tab } : {}), ...p })}`;
  const jalankan = (fn: () => Promise<{ error?: string; ok?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) router.refresh();
    });
  const pdf = async (xs: Slip[], nama: string) => {
    const { unduhSlip } = await import("./slip-pdf");
    await unduhSlip(perusahaan, xs.map((x) => ({ ...x, outlet: outlet.nama, bulan })), nama);
  };
  const belumAtur = staf.filter((x) => !x.komponen.gaji_pokok);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Penggajian</h1>
        <p className="text-sm text-stone-500">Gaji staf outlet dihitung dari absensi sebulan. Setelah final, total gaji otomatis tercatat sebagai Biaya Gaji di laporan keuangan.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {outlets.length > 1 && (
          <select value={outlet.id} onChange={(e) => router.push(`/penggajian?${new URLSearchParams({ outlet: e.target.value, bulan })}`)} className="rounded-lg border border-matur-200 bg-white px-3 py-2 text-sm">
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        )}
        <input type="month" value={bulan} onChange={(e) => e.target.value && router.push(href({ bulan: e.target.value }))} className="rounded-lg border border-matur-200 bg-white px-3 py-2 text-sm" />
        <nav className="ml-auto flex gap-1 rounded-xl bg-matur-50 p-1 text-sm font-semibold">
          {(
            [
              ["slip", "🧾 Slip gaji"],
              ["komponen", "⚙️ Komponen gaji staf"],
            ] as const
          ).map(([k, l]) => (
            <Link key={k} href={`/penggajian?${new URLSearchParams({ outlet: outlet.id, bulan, ...(k === "komponen" ? { tab: k } : {}) })}`} className={`rounded-lg px-3 py-1.5 ${tab === k ? "bg-white shadow-sm" : "text-stone-500"}`}>
              {l}
            </Link>
          ))}
        </nav>
      </div>

      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}

      {tab === "komponen" ? (
        <section className="space-y-2">
          <p className="text-sm text-stone-500">Isi sekali per staf; dipakai setiap kali gaji dihitung. Uang makan dihitung per hari hadir, potongan telat per kejadian, potongan tidak masuk per hari tanpa izin.</p>
          {staf.length === 0 && <p className="rounded-2xl border border-matur-200 bg-white p-6 text-center text-sm text-stone-400">Belum ada staf di outlet ini.</p>}
          {staf.map((x) => (
            <FormKomponen key={x.id} staf={x} bisaUbah={bisaUbah} pending={pending} onSimpan={(k) => jalankan(() => simpanGajiStaf(x.id, k))} />
          ))}
        </section>
      ) : (
        <>
          <section className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-4 ${final ? "border-green-300 bg-green-50" : "border-matur-200 bg-white"}`}>
            <div className="mr-auto">
              <p className="font-bold">
                {namaBulan(bulan)} · {outlet.nama}
              </p>
              <p className="text-sm">
                {!penggajian ? "Belum dihitung" : final ? "✅ Final — tercatat di laporan keuangan" : "📝 Draft — masih bisa diubah"} · {slips.length} slip · total <b>{formatRupiah(total)}</b>
              </p>
            </div>
            {slips.length > 0 && (
              <button onClick={() => pdf(slips, `Slip gaji ${outlet.nama} ${bulan}`)} className="rounded-xl border border-matur-300 bg-white px-3 py-2 text-sm font-semibold text-matur-700">
                ⬇ Semua slip (PDF)
              </button>
            )}
            {bisaUbah && !final && (
              <button disabled={pending} onClick={() => jalankan(() => hitungPenggajian(outlet.id, bulan))} className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {pending ? "…" : penggajian ? "🔄 Hitung ulang dari absensi" : "🧮 Hitung dari absensi"}
              </button>
            )}
            {bisaUbah && penggajian && !final && slips.length > 0 && (
              <button
                disabled={pending}
                onClick={() => confirm(`Finalkan gaji ${namaBulan(bulan)} sebesar ${formatRupiah(total)}? Slip terkunci, staf bisa melihat slipnya, dan total masuk ke Biaya Gaji laporan.`) && jalankan(() => finalkanPenggajian(penggajian.id))}
                className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                ✅ Finalkan
              </button>
            )}
            {bisaUbah && final && (
              <button disabled={pending} onClick={() => confirm("Buka kembali penggajian ini? Biaya gaji di laporan ditarik sampai difinalkan lagi.") && jalankan(() => bukaPenggajian(penggajian!.id))} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
                Buka lagi
              </button>
            )}
          </section>

          {bisaUbah && belumAtur.length > 0 && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              ⚠️ {belumAtur.length} staf belum diisi gaji pokoknya ({belumAtur.map((x) => x.nama).join(", ")}).{" "}
              <Link href={href({ tab: "komponen" })} className="font-semibold underline">
                Atur komponen gaji
              </Link>
            </p>
          )}

          {!penggajian && <p className="rounded-2xl border border-dashed border-matur-300 bg-white p-8 text-center text-sm text-stone-500">Tekan “Hitung dari absensi” untuk membuat slip semua staf bulan ini. Bisa dihitung ulang kapan saja sebelum final.</p>}

          <div className="grid gap-3 lg:grid-cols-2">
            {slips.map((x) => (
              <KartuSlip key={x.id} slip={x} terbuka={buka === x.id} onBuka={() => setBuka(buka === x.id ? null : x.id)} bisaUbah={bisaUbah && !final} pending={pending} onPdf={() => pdf([x], `Slip gaji ${x.nama} ${bulan}`)} onSimpan={(p, q) => jalankan(() => ubahSlip(x.id, p, q))} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const nf = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const angka = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;

function FormKomponen({ staf, bisaUbah, pending, onSimpan }: { staf: { nama: string; peran: string; komponen: KomponenStaf }; bisaUbah: boolean; pending: boolean; onSimpan: (k: KomponenStaf) => void }) {
  const [k, setK] = useState(staf.komponen);
  const uang = (key: keyof Komponen, label: string) => (
    <label className="text-xs text-stone-600">
      {label}
      <input disabled={!bisaUbah} inputMode="numeric" value={k[key] ? nf(Number(k[key])) : ""} onChange={(e) => setK({ ...k, [key]: angka(e.target.value) })} placeholder="0" className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-right text-sm text-stone-900" />
    </label>
  );
  const teks = (key: "bank" | "no_rekening" | "atas_nama", label: string) => (
    <label className="text-xs text-stone-600">
      {label}
      <input disabled={!bisaUbah} value={k[key] ?? ""} onChange={(e) => setK({ ...k, [key]: e.target.value })} className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-stone-900" />
    </label>
  );
  return (
    <div className="rounded-2xl border border-matur-200 bg-white p-3">
      <p className="mb-2 font-semibold">
        {staf.nama} <span className="text-xs font-normal text-stone-500">· {staf.peran}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {uang("gaji_pokok", "Gaji pokok / bulan")}
        {uang("tunjangan", "Tunjangan / bulan")}
        {uang("uang_makan", "Uang makan / hadir")}
        {uang("potongan_telat", "Potongan / telat")}
        {uang("potongan_alpa", "Potongan / tidak masuk")}
        {teks("bank", "Bank")}
        {teks("no_rekening", "No. rekening")}
        {teks("atas_nama", "Atas nama")}
      </div>
      {bisaUbah && (
        <div className="mt-2 text-right">
          <button disabled={pending} onClick={() => onSimpan(k)} className="rounded-lg bg-matur-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            Simpan
          </button>
        </div>
      )}
    </div>
  );
}

function KartuSlip({ slip, terbuka, onBuka, bisaUbah, pending, onPdf, onSimpan }: { slip: Slip; terbuka: boolean; onBuka: () => void; bisaUbah: boolean; pending: boolean; onPdf: () => void; onSimpan: (p: Baris[], q: Baris[]) => void }) {
  const [tp, setTp] = useState<Baris[]>(slip.pendapatan.filter((b) => b.manual));
  const [tq, setTq] = useState<Baris[]>(slip.potongan.filter((b) => b.manual));
  const autoP = slip.pendapatan.filter((b) => !b.manual);
  const autoQ = slip.potongan.filter((b) => !b.manual);
  const total = totalSlip([...autoP, ...tp], [...autoQ, ...tq]);
  const daftar = (judul: string, auto: Baris[], tambah: Baris[], set: (x: Baris[]) => void, contoh: string) => (
    <div>
      <p className="mt-2 text-xs font-semibold text-stone-500">{judul}</p>
      {auto.map((b, i) => (
        <p key={i} className="flex justify-between text-sm">
          <span>{b.nama}</span>
          <span className="tabular-nums">{formatRupiah(b.jumlah)}</span>
        </p>
      ))}
      {tambah.map((b, i) =>
        bisaUbah ? (
          <div key={i} className="mt-1 flex gap-1">
            <input value={b.nama} onChange={(e) => set(tambah.map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)))} placeholder={contoh} className="min-w-0 flex-1 rounded-lg border border-stone-300 px-2 py-1 text-sm" />
            <input inputMode="numeric" value={b.jumlah ? nf(b.jumlah) : ""} onChange={(e) => set(tambah.map((x, j) => (j === i ? { ...x, jumlah: angka(e.target.value) } : x)))} placeholder="0" className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-right text-sm" />
            <button onClick={() => set(tambah.filter((_, j) => j !== i))} className="px-1 text-red-600" aria-label="Hapus baris">
              ✕
            </button>
          </div>
        ) : (
          <p key={i} className="flex justify-between text-sm">
            <span>{b.nama}</span>
            <span className="tabular-nums">{formatRupiah(b.jumlah)}</span>
          </p>
        ),
      )}
      {bisaUbah && (
        <button onClick={() => set([...tambah, { nama: "", jumlah: 0, manual: true }])} className="mt-1 text-xs font-semibold text-matur-700">
          + tambah baris
        </button>
      )}
    </div>
  );
  return (
    <div className="rounded-2xl border border-matur-200 bg-white p-3">
      <button onClick={onBuka} className="flex w-full items-start gap-2 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{slip.nama}</p>
          <p className="text-xs text-stone-500">
            {slip.jabatan ?? "-"} · {slip.hadir} hadir · {slip.telat}× telat · {slip.izin} izin · {slip.tidak_absen} tidak absen
          </p>
        </div>
        <b className="tabular-nums">{formatRupiah(terbuka ? total : slip.total)}</b>
      </button>
      {terbuka && (
        <div className="mt-2 border-t pt-1">
          {daftar("Pendapatan", autoP, tp, setTp, "mis. Bonus / Lembur")}
          {daftar("Potongan", autoQ, tq, setTq, "mis. Kasbon")}
          <p className="mt-2 flex justify-between border-t pt-2 font-bold">
            <span>Gaji diterima</span>
            <span className="tabular-nums">{formatRupiah(total)}</span>
          </p>
          <p className="text-[11px] text-stone-400">
            Pendapatan {formatRupiah(jumlahkan([...autoP, ...tp]))} − potongan {formatRupiah(jumlahkan([...autoQ, ...tq]))}
            {slip.rekening && ` · ${slip.rekening}`}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={onPdf} className="rounded-lg border px-3 py-1.5 text-sm">
              ⬇ Slip PDF
            </button>
            {bisaUbah && (
              <button disabled={pending} onClick={() => onSimpan(tp, tq)} className="rounded-lg bg-matur-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                Simpan slip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
