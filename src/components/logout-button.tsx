"use client";

import { logoutAction } from "@/lib/actions";

// Tombol keluar di pojok kanan atas; minta konfirmasi agar tidak terpencet tak sengaja
export function LogoutButton() {
  return (
    <form action={logoutAction} onSubmit={(e) => !confirm("Keluar dari Matoer?") && e.preventDefault()}>
      <button className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" aria-label="Keluar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Keluar
      </button>
    </form>
  );
}
