"use client";

import { useEffect } from "react";
import { DashboardLoading } from "./dashboard-loading";

/**
 * Pengganti `redirect()` di dalam layout. Redirect dari layout saat navigasi sisi-klien
 * (mis. router.replace setelah login) membuat halaman kosong di Next 15; komponen ini
 * menampilkan layar loading lalu memuat halaman tujuan secara penuh.
 */
export function Alihkan({ ke, label = "Sedang menyiapkan halaman…" }: { ke: string; label?: string }) {
  useEffect(() => {
    window.location.replace(ke);
  }, [ke]);
  return <DashboardLoading fullScreen label={label} />;
}
