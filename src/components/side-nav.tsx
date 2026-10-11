"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "@/lib/roles";

export function SideNav({ items }: { items: MenuItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 lg:flex-col">
      {items.map((m) => {
        const active = path === m.href || path.startsWith(m.href + "/");
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-matur-500 text-white" : "text-kopi-700 hover:bg-matur-50"
            }`}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
