"use client";
import { useState } from "react";
import { bacaAntrean, hapusSnapshot } from "@/lib/pos-offline";
import { kasirLogoutAction } from "@/lib/actions";
export function PosLogout() {
  const [error, setError] = useState("");
  return (
    <div>
      <button
        onClick={async () => {
          try {
            if ((await bacaAntrean()).length)
              return setError("Sinkronkan transaksi tertunda sebelum keluar.");
            if (!navigator.onLine)
              return setError("Hubungkan internet sebelum keluar.");
            await hapusSnapshot();
            await kasirLogoutAction();
          } catch (e) {
            if (String(e).includes("NEXT_REDIRECT")) throw e;
            setError("Periksa koneksi dan antrean sebelum keluar.");
          }
        }}
        className="rounded-lg px-3 py-2 text-sm text-red-600"
      >
        Keluar
      </button>
      {error && (
        <p role="alert" className="max-w-64 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
