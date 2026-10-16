"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import {
  ATURAN_GAJI,
  jumlahkan,
  totalSlip,
  type AturanGaji,
  type HitunganJam,
  type Baris,
  type Komponen,
} from "@/lib/gaji";
import {
  bukaPenggajian,
  finalkanPenggajian,
  hitungPenggajian,
  simpanGajiStaf,
  ubahSlip,
} from "@/lib/gaji-actions";
import { setujuiJamGaji } from "@/lib/operasional-actions";
import type { Kop } from "@/lib/pdf-kop";
import {
  Badge,
  BarisAngka,
  ChipHeader,
  HeaderHalaman,
  KartuAngka,
  Kosong,
  isian,
  tabKelas,
  tombolHeader,
} from "@/components/ui-halaman";
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
  hitungan_jam?: HitunganJam;
  jam_disetujui?: boolean;
};
type KomponenStaf = Komponen & {
  bank: string | null;
  no_rekening: string | null;
  atas_nama: string | null;
};

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
  const href = (p: Record<string, string>) =>
    `/penggajian?${new URLSearchParams({ outlet: outlet.id, bulan, ...(tab === "komponen" ? { tab } : {}), ...p })}`;
  const jalankan = (fn: () => Promise<{ error?: string; ok?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) router.refresh();
    });
  const pdf = async (xs: Slip[], nama: string) => {
    const { unduhSlip } = await import("./slip-pdf");
    await unduhSlip(
      perusahaan,
      xs.map((x) => ({ ...x, outlet: outlet.nama, bulan })),
      nama,
    );
  };
  const belumAtur = staf.filter((x) => !x.komponen.gaji_pokok);
  const totalPendapatan = slips.reduce((s, x) => s + jumlahkan(x.pendapatan), 0);
  const totalPotongan = slips.reduce((s, x) => s + jumlahkan(x.potongan), 0);
  const totalKasbon = slips.reduce(
    (s, x) =>
      s +
      jumlahkan(x.potongan.filter((b) => /kasbon/i.test(b.nama))),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <HeaderHalaman
        judul="Penggajian"
        ikon="💰"
        keterangan="Gaji staf outlet dihitung dari absensi sebulan. Setelah final, total gaji otomatis tercatat sebagai Biaya Gaji di laporan keuangan."
        aksi={
          <Link href={`/kasbon?outlet=${outlet.id}`} className={tombolHeader}>
            🤝 Kasbon & cicilan
          </Link>
        }
      >
        <ChipHeader>📅 {namaBulan(bulan)}</ChipHeader>
        <ChipHeader>🏪 {outlet.nama}</ChipHeader>
        <ChipHeader>
          {!penggajian ? "⏳ Belum dihitung" : final ? "✅ Final" : "📝 Draft"}
        </ChipHeader>
      </HeaderHalaman>

      <BarisAngka>
        <KartuAngka
          label="Total gaji diterima"
          nilai={formatRupiah(total)}
          ikon="💵"
          nada={final ? "hijau" : "netral"}
          sub={`${slips.length} slip`}
        />
        <KartuAngka
          label="Jumlah staf"
          nilai={staf.length}
          ikon="👥"
          nada="biru"
          sub={
            belumAtur.length
              ? `${belumAtur.length} belum diatur gajinya`
              : "semua sudah diatur"
          }
        />
        <KartuAngka
          label="Total pendapatan"
          nilai={formatRupiah(totalPendapatan)}
          ikon="📈"
          nada="ungu"
          sub="sebelum potongan"
        />
        <KartuAngka
          label="Total potongan"
          nilai={formatRupiah(totalPotongan)}
          ikon="✂️"
          nada="merah"
          sub={`kasbon ${formatRupiah(totalKasbon)}`}
        />
      </BarisAngka>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {outlets.length > 1 && (
            <select
              value={outlet.id}
              onChange={(e) =>
                router.push(
                  `/penggajian?${new URLSearchParams({ outlet: e.target.value, bulan })}`,
                )
              }
              className={isian}
              aria-label="Outlet"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          )}
          <input
            type="month"
            value={bulan}
            onChange={(e) =>
              e.target.value && router.push(href({ bulan: e.target.value }))
            }
            className={isian}
            aria-label="Bulan"
          />
        </div>
        <nav className={`${tabKelas.wadah} sm:ml-auto sm:w-auto`}>
          {(
            [
              ["slip", "🧾 Slip gaji"],
              ["komponen", "⚙️ Komponen gaji staf"],
            ] as const
          ).map(([k, l]) => (
            <Link
              key={k}
              href={`/penggajian?${new URLSearchParams({ outlet: outlet.id, bulan, ...(k === "komponen" ? { tab: k } : {}) })}`}
              className={tab === k ? tabKelas.aktif : tabKelas.pasif}
            >
              {l}
            </Link>
          ))}
        </nav>
      </div>

      {msg && (
        <p
          className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}

      {tab === "komponen" ? (
        <section className="space-y-3">
          <p className="rounded-xl bg-matur-50 px-4 py-2.5 text-sm text-kopi-700">
            Isi sekali per staf; dipakai setiap kali gaji dihitung. Uang makan
            dihitung per hari hadir, potongan telat per kejadian, potongan tidak
            masuk per hari tanpa izin.
          </p>
          {staf.length === 0 && (
            <Kosong ikon="👥" judul="Belum ada staf di outlet ini." />
          )}
          {staf.map((x) => (
            <FormKomponen
              key={x.id}
              staf={x}
              bisaUbah={bisaUbah}
              pending={pending}
              onSimpan={(k) => jalankan(() => simpanGajiStaf(x.id, k))}
            />
          ))}
        </section>
      ) : (
        <>
          <section
            className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 shadow-sm ${final ? "border-emerald-200 bg-emerald-50" : "border-matur-100 bg-white"}`}
          >
            <div className="mr-auto min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-bold text-kopi-900">
                {namaBulan(bulan)} · {outlet.nama}
                {!penggajian ? (
                  <Badge>Belum dihitung</Badge>
                ) : final ? (
                  <Badge nada="hijau">✅ Final</Badge>
                ) : (
                  <Badge nada="kuning">📝 Draft</Badge>
                )}
              </p>
              <p className="mt-0.5 text-sm text-stone-600">
                {!penggajian
                  ? "Belum dihitung"
                  : final
                    ? "Tercatat di laporan keuangan"
                    : "Masih bisa diubah"}{" "}
                · {slips.length} slip · total <b>{formatRupiah(total)}</b>
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {slips.length > 0 && (
                <button
                  onClick={() =>
                    pdf(slips, `Slip gaji ${outlet.nama} ${bulan}`)
                  }
                  className="flex-1 rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm font-semibold text-matur-700 hover:bg-matur-50 sm:flex-none"
                >
                  ⬇ Semua slip (PDF)
                </button>
              )}
              {bisaUbah && !final && (
                <button
                  disabled={pending}
                  onClick={() =>
                    jalankan(() => hitungPenggajian(outlet.id, bulan))
                  }
                  className="flex-1 rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-matur-600 disabled:opacity-50 sm:flex-none"
                >
                  {pending
                    ? "…"
                    : penggajian
                      ? "🔄 Hitung ulang dari absensi"
                      : "🧮 Hitung dari absensi"}
                </button>
              )}
              {bisaUbah && penggajian && !final && slips.length > 0 && (
                <button
                  disabled={pending}
                  onClick={() =>
                    confirm(
                      `Finalkan gaji ${namaBulan(bulan)} sebesar ${formatRupiah(total)}? Slip terkunci, staf bisa melihat slipnya, dan total masuk ke Biaya Gaji laporan.`,
                    ) && jalankan(() => finalkanPenggajian(penggajian.id))
                  }
                  className="flex-1 rounded-xl bg-kopi-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-kopi-700 disabled:opacity-50 sm:flex-none"
                >
                  ✅ Finalkan
                </button>
              )}
              {bisaUbah && final && (
                <button
                  disabled={pending}
                  onClick={() =>
                    confirm(
                      "Buka kembali penggajian ini? Biaya gaji di laporan ditarik sampai difinalkan lagi.",
                    ) && jalankan(() => bukaPenggajian(penggajian!.id))
                  }
                  className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 sm:flex-none"
                >
                  Buka lagi
                </button>
              )}
            </div>
          </section>

          {bisaUbah && belumAtur.length > 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              ⚠️ {belumAtur.length} staf belum diisi gaji pokoknya (
              {belumAtur.map((x) => x.nama).join(", ")}).{" "}
              <Link
                href={href({ tab: "komponen" })}
                className="font-semibold underline"
              >
                Atur komponen gaji
              </Link>
            </p>
          )}

          {!penggajian && (
            <Kosong ikon="🧮" judul="Slip bulan ini belum dibuat">
              Tekan “Hitung dari absensi” untuk membuat slip semua staf bulan
              ini. Bisa dihitung ulang kapan saja sebelum final.
            </Kosong>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {slips.map((x) => (
              <KartuSlip
                key={`${x.id}:${JSON.stringify(x.pendapatan)}:${JSON.stringify(x.potongan)}:${x.jam_disetujui}`}
                slip={x}
                terbuka={buka === x.id}
                onBuka={() => setBuka(buka === x.id ? null : x.id)}
                bisaUbah={bisaUbah && !final}
                pending={pending}
                onSetujui={() => jalankan(() => setujuiJamGaji(x.id))}
                onPdf={() => pdf([x], `Slip gaji ${x.nama} ${bulan}`)}
                onSimpan={(p, q) => jalankan(() => ubahSlip(x.id, p, q))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const nf = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const angka = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;

function FormKomponen({
  staf,
  bisaUbah,
  pending,
  onSimpan,
}: {
  staf: { nama: string; peran: string; komponen: KomponenStaf };
  bisaUbah: boolean;
  pending: boolean;
  onSimpan: (k: KomponenStaf) => void;
}) {
  const [k, setK] = useState(staf.komponen);
  const uang = (key: Exclude<keyof Komponen, "aturan">, label: string) => (
    <label className="text-xs text-stone-600">
      {label}
      <input
        disabled={!bisaUbah}
        inputMode="numeric"
        value={k[key] ? nf(Number(k[key])) : ""}
        onChange={(e) => setK({ ...k, [key]: angka(e.target.value) })}
        placeholder="0"
        className="mt-0.5 w-full rounded-xl border border-matur-200 bg-white px-2.5 py-1.5 text-right text-sm tabular-nums text-stone-900 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100 disabled:bg-stone-50"
      />
    </label>
  );
  const a = { ...ATURAN_GAJI, ...k.aturan };
  const aturan = (
    key: Exclude<keyof AturanGaji, "lembur_mode">,
    label: string,
  ) => (
    <label className="text-xs text-stone-600">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-matur-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100 disabled:bg-stone-50"
        type="number"
        step="any"
        disabled={!bisaUbah}
        value={a[key]}
        onChange={(e) =>
          setK({ ...k, aturan: { ...a, [key]: Number(e.target.value) } })
        }
      />
    </label>
  );
  const teks = (key: "bank" | "no_rekening" | "atas_nama", label: string) => (
    <label className="text-xs text-stone-600">
      {label}
      <input
        disabled={!bisaUbah}
        value={k[key] ?? ""}
        onChange={(e) => setK({ ...k, [key]: e.target.value })}
        className="mt-0.5 w-full rounded-xl border border-matur-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100 disabled:bg-stone-50"
      />
    </label>
  );
  return (
    <div className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
      <p className="mb-3 flex flex-wrap items-center gap-2 font-bold text-kopi-900">
        <span className="grid size-8 place-items-center rounded-full bg-matur-100 text-sm text-kopi-700">
          {staf.nama.slice(0, 1).toUpperCase()}
        </span>
        {staf.nama}
        <Badge>{staf.peran}</Badge>
        {!k.gaji_pokok && <Badge nada="kuning">belum diatur</Badge>}
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
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-matur-50 p-3 sm:grid-cols-4">
        <p className="col-span-2 text-xs font-semibold text-matur-800 sm:col-span-4">
          Gaji tetap bulanan · referensi harian{" "}
          {formatRupiah(k.gaji_pokok / a.hari_pembagi)} · per jam{" "}
          {formatRupiah(k.gaji_pokok / a.hari_pembagi / a.jam_normal)}
        </p>
        {aturan("hari_pembagi", "Hari pembagi / bulan")}
        {aturan("jam_normal", "Jam normal / hari")}
        {aturan("istirahat_menit", "Istirahat dipotong / hari (menit)")}
        {aturan(
          "lembur_min_menit",
          "Lembur minimum setelah akhir shift (menit)",
        )}
        {aturan("lembur_tarif", "Tarif lembur / jam (0 = referensi per jam)")}
        {aturan("lembur_pengali", "Pengali tarif lembur")}
        {aturan("pembulatan_menit", "Pembulatan ke bawah (menit)")}
        <label className="text-xs">
          Cara menghitung lembur
          <select
            disabled={!bisaUbah}
            value={a.lembur_mode}
            onChange={(e) =>
              setK({
                ...k,
                aturan: {
                  ...a,
                  lembur_mode: e.target.value as AturanGaji["lembur_mode"],
                },
              })
            }
            className="mt-1 w-full rounded-xl border border-matur-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100 disabled:bg-stone-50"
          >
            <option value="seluruh">
              Seluruh durasi setelah batas minimum tercapai
            </option>
            <option value="selisih">Hanya durasi di atas batas minimum</option>
          </select>
        </label>
      </div>
      {bisaUbah && (
        <div className="mt-2 text-right">
          <button
            disabled={pending}
            onClick={() => onSimpan(k)}
            className="rounded-xl bg-matur-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-matur-600 disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
      )}
    </div>
  );
}

function KartuSlip({
  slip,
  terbuka,
  onBuka,
  bisaUbah,
  pending,
  onPdf,
  onSimpan,
  onSetujui,
}: {
  slip: Slip;
  terbuka: boolean;
  onBuka: () => void;
  bisaUbah: boolean;
  pending: boolean;
  onPdf: () => void;
  onSetujui: () => void;
  onSimpan: (p: Baris[], q: Baris[]) => void;
}) {
  const [tp, setTp] = useState<Baris[]>(
    slip.pendapatan.filter((b) => b.manual),
  );
  const [tq, setTq] = useState<Baris[]>(slip.potongan.filter((b) => b.manual));
  const autoP = slip.pendapatan.filter((b) => !b.manual);
  const autoQ = slip.potongan.filter((b) => !b.manual);
  const total = totalSlip([...autoP, ...tp], [...autoQ, ...tq]);
  const daftar = (
    judul: string,
    auto: Baris[],
    tambah: Baris[],
    set: (x: Baris[]) => void,
    contoh: string,
  ) => (
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
            <input
              value={b.nama}
              onChange={(e) =>
                set(
                  tambah.map((x, j) =>
                    j === i ? { ...x, nama: e.target.value } : x,
                  ),
                )
              }
              placeholder={contoh}
              className="min-w-0 flex-1 rounded-lg border border-matur-200 px-2 py-1 text-sm outline-none focus:border-matur-500"
            />
            <input
              inputMode="numeric"
              value={b.jumlah ? nf(b.jumlah) : ""}
              onChange={(e) =>
                set(
                  tambah.map((x, j) =>
                    j === i ? { ...x, jumlah: angka(e.target.value) } : x,
                  ),
                )
              }
              placeholder="0"
              className="w-28 rounded-lg border border-matur-200 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-matur-500"
            />
            <button
              onClick={() => set(tambah.filter((_, j) => j !== i))}
              className="px-1 text-red-600"
              aria-label="Hapus baris"
            >
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
        <button
          onClick={() =>
            set([...tambah, { nama: "", jumlah: 0, manual: true }])
          }
          className="mt-1 text-xs font-semibold text-matur-700"
        >
          + tambah baris
        </button>
      )}
    </div>
  );
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${terbuka ? "border-matur-300 ring-2 ring-matur-100" : "border-matur-100"}`}
    >
      <button
        onClick={onBuka}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-matur-100 font-bold text-kopi-700">
          {slip.nama.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-kopi-900">{slip.nama}</p>
          <p className="text-xs text-stone-500">
            {slip.jabatan ?? "-"} · {slip.hadir} hadir · {slip.telat}× telat ·{" "}
            {slip.izin} izin · {slip.tidak_absen} tidak absen
          </p>
        </div>
        <span className="text-right">
          <b className="block tabular-nums text-kopi-900">
            {formatRupiah(terbuka ? total : slip.total)}
          </b>
          <span className="text-[11px] text-matur-700">
            {terbuka ? "tutup ▲" : "rincian ▼"}
          </span>
        </span>
      </button>
      {terbuka && (
        <div className="mt-3 border-t border-stone-100 pt-1">
          {slip.hitungan_jam?.aturan && (
            <div className="my-2 rounded-xl bg-matur-50 p-3 text-xs">
              <p>
                Kerja bersih {slip.hitungan_jam.menit_kerja} menit · normal{" "}
                {slip.hitungan_jam.menit_normal} menit · lembur{" "}
                {slip.hitungan_jam.menit_lembur} menit
              </p>
              <p>
                Referensi/hari{" "}
                {formatRupiah(slip.hitungan_jam.referensi_harian)} ·
                referensi/jam {formatRupiah(slip.hitungan_jam.referensi_perjam)}{" "}
                · lembur/jam {formatRupiah(slip.hitungan_jam.tarif_lembur)}
              </p>
              {slip.hitungan_jam.belum_lengkap > 0 && (
                <p className="font-bold text-red-600">
                  {slip.hitungan_jam.belum_lengkap} absensi belum lengkap;
                  perbaiki dan hitung ulang sebelum final.
                </p>
              )}
              {slip.hitungan_jam.tanpa_jadwal > 0 && (
                <p>
                  {slip.hitungan_jam.tanpa_jadwal} kehadiran tanpa jadwal:
                  lembur perlu ditinjau dan jadwal dikoreksi.
                </p>
              )}
              {slip.hitungan_jam.menit_lembur > 0 && (
                <p className="mt-2">
                  {slip.jam_disetujui
                    ? "Hitungan lembur sudah disetujui HRD."
                    : "Menunggu persetujuan HRD sebelum final."}{" "}
                  {bisaUbah && !slip.jam_disetujui && (
                    <button
                      disabled={pending || slip.hitungan_jam.belum_lengkap > 0}
                      onClick={onSetujui}
                      className="rounded-lg bg-kopi-900 px-3 py-2 font-semibold text-white disabled:opacity-50"
                    >
                      Setujui hitungan lembur
                    </button>
                  )}
                </p>
              )}
            </div>
          )}
          {daftar("Pendapatan", autoP, tp, setTp, "mis. Bonus / Lembur")}
          {daftar(
            "Potongan",
            autoQ,
            tq,
            setTq,
            "mis. Potongan lain (kasbon lewat menu Kasbon)",
          )}
          <p className="mt-3 flex justify-between rounded-xl bg-matur-50 px-3 py-2 font-bold text-kopi-900">
            <span>Gaji diterima</span>
            <span className="tabular-nums">{formatRupiah(total)}</span>
          </p>
          <p className="text-[11px] text-stone-400">
            Pendapatan {formatRupiah(jumlahkan([...autoP, ...tp]))} − potongan{" "}
            {formatRupiah(jumlahkan([...autoQ, ...tq]))}
            {slip.rekening && ` · ${slip.rekening}`}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={onPdf}
              className="rounded-xl border border-matur-200 px-3 py-1.5 text-sm font-semibold text-matur-700 hover:bg-matur-50"
            >
              ⬇ Slip PDF
            </button>
            {bisaUbah && (
              <button
                disabled={pending}
                onClick={() => onSimpan(tp, tq)}
                className="rounded-xl bg-matur-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-matur-600 disabled:opacity-50"
              >
                Simpan slip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
