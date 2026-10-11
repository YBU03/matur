"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TerminalNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${path.startsWith(i.href) ? "bg-matur-500 text-white" : "text-kopi-700 hover:bg-matur-50"}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
