"use client";

import Link from "next/link";
import { mulaiMasuk } from "@/components/masuk-overlay";

// tautan biasa (bukan server action) agar sesi dibaca ulang di request baru; tampilkan layar masuk saat ditekan
export function PeranLink({ href, mascot, label, className, children }: { href: string; mascot: string; label: string; className: string; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch={false} onClick={() => mulaiMasuk({ mascot, label: `Menyiapkan dashboard ${label}…` })} className={className}>
      {children}
    </Link>
  );
}
