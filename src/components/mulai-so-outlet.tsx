import Link from "next/link";

/** Aksi utama stok outlet: terlihat sebagai tombol untuk membuka form hitung fisik. */
export function MulaiSoOutlet({ href }: { href: string }) {
  return (
    <section className="rounded-2xl border border-matur-200 bg-matur-50 p-4">
      <Link
        href={href}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-matur-700 bg-matur-700 px-4 py-3 text-lg font-bold text-white shadow-sm transition-colors hover:bg-matur-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-matur-700 sm:w-fit sm:px-6"
      >
        <span aria-hidden="true" className="text-2xl">
          📋
        </span>
        <span className="min-w-0 flex-1">Mulai Hitung Stok / SO</span>
        <span aria-hidden="true" className="ml-2 text-2xl">
          →
        </span>
      </Link>
      <p className="mt-2 text-sm leading-relaxed text-kopi-800">
        Klik untuk membuka form dan mengisi hasil hitung stok fisik.
      </p>
    </section>
  );
}
