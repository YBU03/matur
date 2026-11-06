"use client";
import { BarisAngka, ChipHeader, HeaderHalaman, KartuAngka, tombolAksi } from "@/components/ui-halaman";
import { tanya } from "@/components/dialog-tanya";
import { denganAlasan } from "@/lib/dengan-alasan";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah, formatTanggal } from "@/lib/format";
import {
  FormPengeluaran,
  label,
  type Kat,
} from "@/components/form-pengeluaran";
import {
  catatPengeluaran,
  hapusPengeluaran,
  ubahPengeluaran,
  type Result,
} from "@/lib/kas-actions";
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
  /** kas shift pengeluaran ini sudah ditutup: kategori & keterangan masih bisa diubah, nominal/sumber khusus akunting */
  final?: boolean;
};

const cls =
  "w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-matur-500";
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
  hari,
}: {
  kategori: Kat[];
  catatan: Catatan[];
  meId: string;
  sesi: {
    id: string;
    modal: number;
    dibuka: string;
    kasirId: string;
    nama: string;
  } | null;
  adaShiftBuka: boolean;
  ringkas: {
    tunai: number;
    nonTunai: number;
    laci: number;
    transaksi: number;
  } | null;
  outletNama: string;
  spv: boolean;
  /** hari operasional (tutup buku 03.00) */
  hari?: string;
}) {
  const [tab, setTab] = useState<"hari" | "riwayat">("hari");
  const semua = catatan;
  const hariIni = hari ? semua.filter((c) => c.tanggal === hari) : semua;
  const lampau = hari ? semua.filter((c) => c.tanggal !== hari) : [];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [ubah, setUbah] = useState<Catatan | null>(null);
  const namaKat = Object.fromEntries(kategori.map((k) => [k.id, k.nama]));
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      let r: Result;
      try {
        r = await fn();
      } catch {
        r = {
          error:
            "Belum dapat menyimpan. Periksa koneksi lalu coba lagi; input tetap tersimpan di form.",
        };
      }
      setMsg(r);
      if (!r.error) {
        after?.();
        router.refresh();
      }
    });
  const tampil = tab === "hari" ? hariIni : lampau;
  const totalLaci = hariIni
    .filter((c) => c.sumber === "laci")
    .reduce((a, c) => a + c.jumlah, 0);
  const totalPusat = hariIni
    .filter((c) => c.sumber === "pusat")
    .reduce((a, c) => a + c.jumlah, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <HeaderHalaman judul="Kas & Pengeluaran" ikon="💰" keterangan="Catat uang keluar dari laci atau yang dibayar pusat, lalu tutup shift dengan hitungan uang fisik.">
        <ChipHeader>🏪 {outletNama}</ChipHeader>
        <ChipHeader>📅 {formatTanggal(hari ?? new Date().toISOString())}</ChipHeader>
      </HeaderHalaman>
      <BarisAngka>
        <KartuAngka label="Pengeluaran hari ini" nilai={hariIni.length} ikon="🧾" sub="catatan" />
        <KartuAngka label="Dari laci" nilai={formatRupiah(totalLaci)} ikon="🗄️" nada="kuning" sub="mengurangi uang laci" />
        <KartuAngka label="Dibayar pusat" nilai={formatRupiah(totalPusat)} ikon="🏢" nada="biru" sub="tidak dari laci" />
        <KartuAngka label="Transaksi shift" nilai={ringkas?.transaksi ?? 0} ikon="☕" nada="hijau" sub={ringkas ? `tunai ${formatRupiah(ringkas.tunai)}` : "kas belum dibuka"} />
      </BarisAngka>
      {msg && (
        <p
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {msg.error ? "⚠️ " : "✅ "}
          {msg.error ?? msg.ok}
        </p>
      )}
      {!adaShiftBuka && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Kas belum tersedia. Muat ulang halaman untuk menyiapkan kas sebelum
          mencatat uang keluar dari laci.
        </p>
      )}

      <p className="text-sm text-stone-500">
        Pengeluaran uang (termasuk fee marketing) dicatat di sini. Produk
        gratis/endorse dicatat terpisah di bagian Produk marketing agar stok dan
        biaya tidak terhitung ganda.
      </p>
      <FormPengeluaran
        kategori={kategori}
        pending={pending}
        onSimpan={(d, reset) => run(() => catatPengeluaran(d), reset)}
      />

      <section className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
          <div className="mr-auto flex gap-1 rounded-xl bg-matur-50 p-1 text-sm font-semibold">
            <button type="button" onClick={() => setTab("hari")} className={`rounded-lg px-3 py-1.5 ${tab === "hari" ? "bg-white text-kopi-900 shadow-sm" : "text-stone-500"}`}>
              🧾 Hari ini ({hariIni.length})
            </button>
            <button type="button" onClick={() => setTab("riwayat")} className={`rounded-lg px-3 py-1.5 ${tab === "riwayat" ? "bg-white text-kopi-900 shadow-sm" : "text-stone-500"}`}>
              🗓 7 hari terakhir ({lampau.length})
            </button>
          </div>
          <span className="text-xs text-stone-500">
            dari laci <b>{formatRupiah(totalLaci)}</b> · dibayar pusat{" "}
            <b>{formatRupiah(totalPusat)}</b>
          </span>
        </div>
        {tab === "riwayat" && (
          <p className="mb-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Salah pilih kategori atau keterangan kemarin? Klik ✏️ Ubah. Pengeluaran bertanda 🔒 sudah masuk kas yang ditutup: kategori & keterangan tetap bisa diperbaiki, nominal/sumber dana hubungi Akunting. Semua perubahan tercatat.
          </p>
        )}
        {tampil.length === 0 && (
          <p className="my-2 rounded-2xl border-2 border-dashed border-matur-200 py-6 text-center text-sm text-stone-500">
            {tab === "hari" ? "Belum ada pengeluaran hari ini." : "Tidak ada pengeluaran 7 hari terakhir."}
          </p>
        )}
        <ul className="divide-y">
          {tampil.map((c, i) => {
            const milik = c.dibuat_oleh === meId || spv;
            // kas final: siapa pun di outlet boleh perbaiki kategori/keterangan (diaudit); hapus khusus akunting
            const bisaUbah = milik || !!c.final;
            const judulTanggal = tab === "riwayat" && (i === 0 || tampil[i - 1].tanggal !== c.tanggal);
            return (
              <li key={c.id} className="flex flex-wrap items-start gap-3 py-2.5 text-sm">
                {judulTanggal && <p className="w-full pt-1 text-xs font-bold uppercase tracking-wide text-matur-700">{formatTanggal(c.tanggal)}</p>}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {c.keterangan ||
                      label(namaKat[c.kategori_id] ?? "Pengeluaran")}
                  </p>
                  <p className="text-xs text-stone-500">
                    {label(namaKat[c.kategori_id] ?? "-")} ·{" "}
                    <span
                      className={
                        c.sumber === "laci" ? "text-amber-700" : "text-blue-700"
                      }
                    >
                      {c.sumber === "laci" ? "dari laci" : "dibayar pusat"}
                    </span>
                    {c.final && <span className="font-semibold text-stone-600"> · 🔒 kas final</span>}
                    {c.pengguna?.nama && ` · ${c.pengguna.nama}`} ·{" "}
                    {new Date(c.created_at).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">
                  {formatRupiah(c.jumlah)}
                </span>
                {bisaUbah && (
                  <span className="flex shrink-0">
                    <button
                      onClick={() => (setMsg(null), setUbah(c))}
                      className={tombolAksi.edit}
                      title="Ubah"
                    >
                      ✏️ Ubah
                    </button>
                    {!c.final && (
                    <button
                      disabled={pending}
                      onClick={async () =>
                        (await tanya("Hapus pengeluaran ini?")) &&
                        run(() => denganAlasan((a) => hapusPengeluaran(c.id, a)))
                      }
                      className={`${tombolAksi.hapus} ml-1.5`}
                      title="Hapus"
                    >
                      🗑 Hapus
                    </button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {sesi && ringkas && (
        <TutupShift
          sesi={sesi}
          ringkas={ringkas}
          pending={pending}
          perluPin={sesi.kasirId !== meId && !spv}
          onTutup={(a, pin) => run(() => tutupShiftPin(sesi.id, pin, a))}
        />
      )}

      {ubah && (
        <Modal title={`Ubah pengeluaran · ${formatTanggal(ubah.tanggal)}`}>
          <FormPengeluaran
            kategori={kategori}
            pending={pending}
            kunciNominal={!!ubah.final}
            awal={ubah}
            onBatal={() => setUbah(null)}
            onSimpan={(d) =>
              run(
                () => denganAlasan((a) => ubahPengeluaran(ubah.id, d, a)),
                () => setUbah(null),
              )
            }
          />
          {msg?.error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {msg.error}
            </p>
          )}
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
    <section className="space-y-3 rounded-2xl border-2 border-kopi-700 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-bold text-kopi-900">🔒 
        Shift {sesi.nama} · buka{" "}
        {new Date(sesi.dibuka).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })}
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
          <div key={k} className={`rounded-xl px-3 py-2 ${k === "Tunai seharusnya" ? "bg-kopi-900 text-white" : "bg-stone-50"}`}>
            <dt className={`text-xs ${k === "Tunai seharusnya" ? "text-white/70" : "text-stone-500"}`}>{k}</dt>
            <dd className="font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <label className="block text-sm font-medium">
        Uang tunai aktual yang disetor (di luar modal laci)
        <input
          value={aktual ? Number(angka(aktual)).toLocaleString("id-ID") : ""}
          onChange={(e) => setAktual(e.target.value)}
          inputMode="numeric"
          className={`mt-1 ${cls} text-right text-lg font-bold`}
        />
      </label>
      {selisih !== null && (
        <p
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${selisih === 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          {selisih === 0
            ? "✓ Pas, tidak ada selisih"
            : `Selisih ${formatRupiah(selisih)} ${selisih > 0 ? "(lebih)" : "(kurang)"}`}
        </p>
      )}
      {perluPin && (
        <label className="block text-sm font-medium">
          PIN {sesi.nama} (konfirmasi tutup shift)
          <input
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            type="password"
            inputMode="numeric"
            autoComplete="off"
            className={`mt-1 ${cls} text-center text-lg tracking-[0.5em]`}
          />
        </label>
      )}
      <button
        disabled={pending || !aktual || (perluPin && pin.length < 4)}
        onClick={async () =>
          (await tanya(
            `Tutup shift ${sesi.nama} dengan setoran ${formatRupiah(angka(aktual))}?`,
          )) && onTutup(angka(aktual), pin)
        }
        className="w-full rounded-xl bg-kopi-900 py-3.5 text-base font-bold text-white shadow-sm hover:bg-kopi-700 disabled:opacity-50"
      >
        🔒 Tutup shift & serah terima
      </button>
    </section>
  );
}
