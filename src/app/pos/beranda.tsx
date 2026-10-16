import Link from "next/link";
import { TombolKunci } from "@/components/tablet-kunci";
import { formatRupiah } from "@/lib/format";
import { PrinterTombol } from "../kasir/(terminal)/printer-tombol";
import { SisaShift } from "./sisa-shift";

export type DataBeranda = {
  operator: string | null;
  outlet: string;
  shift: string | null;
  bukaAt: string | null;
  batasAt: string | null;
  modal: number;
  omzet: number;
  jumlah: number;
  draft: number;
  antrean: number;
  tim: string[];
  terlaris: { nama: string; qty: number }[];
};

function sapaan() {
  const j = Number(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Jakarta",
      hour: "numeric",
      hour12: false,
    }),
  );
  return j < 11
    ? "Selamat pagi"
    : j < 15
      ? "Selamat siang"
      : j < 18
        ? "Selamat sore"
        : "Selamat malam";
}

/** Beranda tablet POS setelah dibuka dengan PIN: ringkasan shift + tombol besar. */
export function BerandaTablet({
  kasir,
  d,
}: {
  kasir: boolean;
  d: DataBeranda;
}) {
  const stat = [
    { label: "Omzet shift", nilai: formatRupiah(d.omzet), ikon: "💰" },
    { label: "Transaksi", nilai: String(d.jumlah), ikon: "🧾" },
    {
      label: "Rata-rata / struk",
      nilai: formatRupiah(d.jumlah ? Math.round(d.omzet / d.jumlah) : 0),
      ikon: "📈",
    },
    { label: "Modal laci", nilai: formatRupiah(d.modal), ikon: "💵" },
  ];
  const tombol: {
    href: string;
    ikon: string;
    label: string;
    ket: string;
    warna: string;
    badge?: number;
  }[] = [
    {
      href: "/kasir/antrean",
      ikon: "📋",
      label: "Antrean",
      ket: "Pesanan untuk barista",
      warna: "from-sky-50 to-white border-sky-200",
      badge: d.antrean,
    },
    {
      href: "/kasir/riwayat?tab=draft",
      ikon: "📝",
      label: "Draft",
      ket: "Pesanan belum dibayar",
      warna: "from-amber-50 to-white border-amber-200",
      badge: d.draft,
    },
    {
      href: "/kasir/riwayat",
      ikon: "🔁",
      label: "Riwayat & Void",
      ket: "Struk hari ini · void PIN SPV",
      warna: "from-violet-50 to-white border-violet-200",
    },
    {
      href: "/kasir/shift",
      ikon: "💵",
      label: "Kas & Pengeluaran",
      ket: "Pengeluaran laci shift",
      warna: "from-emerald-50 to-white border-emerald-200",
    },
    {
      href: "/kasir/shift#endorse",
      ikon: "🎁",
      label: "Produk Endorse",
      ket: "Marketing / barter",
      warna: "from-pink-50 to-white border-pink-200",
    },
    {
      href: "/kasir/stok",
      ikon: "📦",
      label: "Stok",
      ket: "Sisa bahan real-time",
      warna: "from-orange-50 to-white border-orange-200",
    },
  ];
  const kartu =
    "relative flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl border-2 bg-gradient-to-b p-4 text-center shadow-sm transition active:scale-95";
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-matur-500 via-orange-500 to-red-500 p-5 text-white shadow-md">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm opacity-90">
              {d.outlet}
              {d.shift ? ` · Shift ${d.shift}` : ""}
            </p>
            <h1 className="text-2xl font-bold sm:text-3xl">
              {sapaan()}
              {d.operator ? `, ${d.operator.split(" ")[0]}` : ""}! 👋
            </h1>
            {d.tim.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.tim.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          {d.bukaAt && d.batasAt && (
            <SisaShift buka={d.bukaAt} batas={d.batasAt} />
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <p className="text-xs text-stone-500">
              {s.ikon} {s.label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums">{s.nilai}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link
            href="/kasir/pos"
            className="col-span-2 flex min-h-36 items-center justify-center gap-4 rounded-3xl bg-kopi-900 p-5 text-white shadow-md transition active:scale-95 sm:col-span-3"
          >
            <span className="text-5xl">🧾</span>
            <span className="text-left">
              <span className="block text-2xl font-bold">
                {kasir ? "Mulai Transaksi" : "Input Pesanan"}
              </span>
              <span className="block text-sm opacity-80">
                {kasir
                  ? "Buka layar kasir: pesanan & pembayaran"
                  : "Simpan sebagai draft, kasir yang menerima bayar"}
              </span>
            </span>
          </Link>
          {tombol.map((t) => (
            <Link key={t.label} href={t.href} className={`${kartu} ${t.warna}`}>
              {!!t.badge && (
                <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {t.badge}
                </span>
              )}
              <span className="text-4xl">{t.ikon}</span>
              <span className="text-lg font-bold">{t.label}</span>
              <span className="text-xs text-stone-500">{t.ket}</span>
            </Link>
          ))}
          <div className={`${kartu} border-stone-200 from-stone-50 to-white`}>
            <span className="text-4xl">🖨</span>
            <span className="text-lg font-bold">Printer</span>
            <PrinterTombol />
          </div>
          <TombolKunci besar />
          <Link
            href="/kasir/shift#tutup"
            className={`${kartu} border-red-200 from-red-50 to-white`}
          >
            <span className="text-4xl">🏁</span>
            <span className="text-lg font-bold text-red-700">Tutup Shift</span>
            <span className="text-xs text-stone-500">Hitung uang + PIN</span>
          </Link>
        </section>

        <aside className="space-y-3">
          <div className="rounded-3xl border bg-white p-4 shadow-sm">
            <p className="font-bold">🔥 Terlaris shift ini</p>
            {d.terlaris.length ? (
              <ol className="mt-2 space-y-1.5 text-sm">
                {d.terlaris.map((m, i) => (
                  <li key={m.nama} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-matur-100 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{m.nama}</span>
                    <b className="tabular-nums">{m.qty}</b>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-stone-400">
                Belum ada penjualan di shift ini.
              </p>
            )}
          </div>
          <p className="rounded-2xl bg-white/70 p-3 text-xs text-stone-500">
            Layar terkunci otomatis setelah 5 menit tidak disentuh. Buka kembali
            dengan kode staf + PIN anggota tim; operator tercatat di struk &
            riwayat.
          </p>
        </aside>
      </div>
    </main>
  );
}
