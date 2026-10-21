"use client";
import { useEffect, useState } from "react";
import { SimulasiPos } from "@/app/(app)/pengaturan/pos/simulasi/view";
import { cekTestingPos } from "@/lib/pos-testing-actions";
import type { SimMenu } from "@/lib/pos-simulasi";
export function TestingKasir({
  menu,
  outletNama,
}: {
  menu: SimMenu[];
  outletNama: string;
}) {
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const check = async () => {
      if (pending || disposed) return;
      pending = true;
      try {
        const active = await cekTestingPos();
        if (disposed) return;
        if (!active) window.location.replace("/pos");
        else setError("");
      } catch {
        if (!disposed)
          setError(
            "Status testing belum dapat diperbarui. Hubungkan internet untuk memeriksa status terbaru.",
          );
      } finally {
        pending = false;
      }
    };
    const timer = window.setInterval(() => {
      void check();
    }, 15_000);
    const visible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return (
    <>
      {error && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          {error}
        </p>
      )}
      <SimulasiPos menu={menu} cetak outletNama={outletNama} />
    </>
  );
}
