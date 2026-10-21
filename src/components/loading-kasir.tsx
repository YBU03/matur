"use client";
import { DashboardLoading } from "./dashboard-loading";

/** One main logo and a progress indicator while entering the POS. */
export function LoadingKasir({ teks = "Masuk sebagai kasir…" }: { teks?: string }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <DashboardLoading fullScreen label={teks} mascot="/brand/logo-512.png" />
    </div>
  );
}
