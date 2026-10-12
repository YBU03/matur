"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CURRENT_STAGE, type MenuItem } from "@/lib/roles";

export function SideNav({ items }: { items: MenuItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3">
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
            {m.stage > CURRENT_STAGE && <span className="ml-1 text-xs opacity-60">🔒</span>}
          </Link>
        );
      })}
    </nav>
  );
}
