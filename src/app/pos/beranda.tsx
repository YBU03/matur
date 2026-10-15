import Link from "next/link";
import { TombolKunci } from "@/components/tablet-kunci";
import { PrinterTombol } from "../kasir/(terminal)/printer-tombol";

/** Tombol besar beranda tablet POS setelah dibuka dengan PIN. */
export function BerandaTablet({ kasir }: { kasir: boolean }) {
  const tombol: { href: string; ikon: string; label: string; ket: string }[] = [
    {
      href: "/kasir/pos",
      ikon: "🧾",
      label: kasir ? "Kasir" : "Input Pesanan",
      ket: kasir ? "Pesanan & pembayaran" : "Simpan sebagai draft",
    },
    {
      href: "/kasir/antrean",
      ikon: "📋",
      label: "Antrean",
      ket: "Pesanan untuk barista",
    },
    {
      href: "/kasir/riwayat?tab=draft",
      ikon: "📝",
      label: "Draft",
      ket: "Pesanan belum dibayar",
    },
    {
      href: "/kasir/riwayat",
      ikon: "🔁",
      label: "Riwayat & Void",
      ket: "Struk hari ini · void PIN SPV",
    },
    {
      href: "/kasir/shift",
      ikon: "💵",
      label: "Kas & Pengeluaran",
      ket: "Pengeluaran laci shift",
    },
    {
      href: "/kasir/shift#endorse",
      ikon: "🎁",
      label: "Produk Endorse",
      ket: "Marketing / barter",
    },
    {
      href: "/kasir/stok",
      ikon: "📦",
      label: "Stok",
      ket: "Sisa bahan real-time",
    },
  ];
  const kartu =
    "flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-stone-200 bg-white p-4 text-center shadow-sm active:scale-95";
  return (
    <main className="mx-auto max-w-5xl p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tombol.map((t) => (
          <Link key={t.label} href={t.href} className={kartu}>
            <span className="text-4xl">{t.ikon}</span>
            <span className="text-lg font-bold">{t.label}</span>
            <span className="text-xs text-stone-500">{t.ket}</span>
          </Link>
        ))}
        <div className={kartu}>
          <span className="text-4xl">🖨</span>
          <span className="text-lg font-bold">Printer</span>
          <PrinterTombol />
        </div>
        <TombolKunci besar />
        <Link
          href="/kasir/shift#tutup"
          className={`${kartu} border-red-200 bg-red-50`}
        >
          <span className="text-4xl">🏁</span>
          <span className="text-lg font-bold text-red-700">Tutup Shift</span>
          <span className="text-xs text-stone-500">Hitung uang + PIN</span>
        </Link>
      </div>
      <p className="mt-4 text-center text-xs text-stone-500">
        Layar terkunci otomatis setelah 5 menit tidak disentuh. Buka kembali
        dengan PIN anggota tim mana pun; operator tercatat di struk & riwayat.
      </p>
    </main>
  );
}
