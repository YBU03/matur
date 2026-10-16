"use client";
import { LogoutButton } from "./logout-button";
export function PosLogout({ label = "Keluar" }: { label?: string }) {
  return (
    <LogoutButton
      pos
      label={label}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
    />
  );
}
