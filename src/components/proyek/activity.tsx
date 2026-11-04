"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { ProyekLoading } from "./loading";

const Activity = createContext<((id: string, label: string | null) => void) | null>(null);

export function ProyekActivity({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Record<string, string>>({});
  const report = useCallback((id: string, label: string | null) => {
    setTasks(previous => {
      if (previous[id] === label || (!label && !(id in previous))) return previous;
      const next = { ...previous };
      if (label) next[id] = label; else delete next[id];
      return next;
    });
  }, []);
  const label = Object.values(tasks)[0];
  return <Activity.Provider value={report}>{children}{label && <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex justify-center px-4"><ProyekLoading compact label={label} /></div>}</Activity.Provider>;
}

// Observe real existing pending/busy state; no timer or fabricated progress.
export function useProyekBusy(pending: boolean, label = "Sedang memproses data proyek…") {
  const report = useContext(Activity);
  const id = useId();
  useEffect(() => {
    if (!pending || !report) return;
    report(id, label);
    return () => report(id, null);
  }, [pending, report, id, label]);
}

export function useProyekTransition(): ReturnType<typeof useTransition> {
  const transition = useTransition();
  useProyekBusy(transition[0]);
  return transition;
}
