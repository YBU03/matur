"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IkonMenu } from "@/components/menu-ikon";

type Nama = NonNullable<Parameters<typeof IkonMenu>[0]["nama"]>;

export function TerminalNav({ items }: { items: readonly { href: string; label: string; ikon?: Nama }[] }) {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 md:rounded-xl md:bg-matur-50 md:p-1" aria-label="Menu POS">
      {items.map((i) => {
        const aktif = path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={aktif ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors sm:flex-row sm:justify-center sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm md:flex-none ${aktif ? "bg-matur-500 text-white shadow-sm" : "text-kopi-700 hover:bg-white"}`}
          >
            {i.ikon && <IkonMenu nama={i.ikon} label={i.label} className="size-[18px]" />}
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
