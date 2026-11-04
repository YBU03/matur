"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ProyekLoading } from "@/components/proyek/loading";

type Tab = { key: string; label: string; count?: number };

export function ProyekTabs({ proyekId, active, tabs, children }: { proyekId: string; active: string; tabs: Tab[]; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState(active);
  return <>
    <nav aria-label="Tab proyek pembangunan" className="sticky top-14 z-20 -mx-4 overflow-x-auto bg-matur-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
      <div className="flex w-max gap-1.5">
        {tabs.map(tab => <Link key={tab.key} href={`/proyek/${proyekId}?tab=${tab.key}`} scroll={false}
          aria-current={tab.key === active ? "page" : undefined}
          aria-disabled={pending || undefined}
          onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (pending || tab.key === active) return;
            setTarget(tab.key);
            start(() => router.push(`/proyek/${proyekId}?tab=${tab.key}`, { scroll: false }));
          }}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matur-500 ${tab.key === (pending ? target : active) ? "bg-kopi-900 text-white" : "border border-matur-200 bg-white text-kopi-700"} ${pending ? "cursor-wait" : ""}`}>
          {tab.label}{!!tab.count && <span className="ml-1 rounded-full bg-amber-300 px-1.5 text-xs text-kopi-900">{tab.count}</span>}
        </Link>)}
      </div>
    </nav>
    <div aria-busy={pending} className="relative min-h-[280px]">
      {pending && <div className="absolute inset-0 z-10 bg-matur-50"><ProyekLoading /></div>}
      <div className="space-y-4" hidden={pending}>{children}</div>
    </div>
  </>;
}
