"use client";
import { useState } from "react";
import { unggahBukti } from "@/lib/operasional-actions";
export function BuktiOperasional({
  jenis,
  outlet,
  onChange,
  label,
}: {
  jenis: "kiriman" | "setoran";
  outlet: string;
  onChange: (path: string) => void;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          setMsg("");
          onChange("");
          try {
            const d = new FormData();
            d.set("jenis", jenis);
            d.set("outlet", outlet);
            d.set("file", f);
            const r = await unggahBukti(d);
            setMsg(r.error ?? "Bukti siap disimpan bersama pencatatan.");
            if (r.path) onChange(r.path);
          } catch {
            setMsg("Unggah gagal. Coba lagi.");
          } finally {
            setBusy(false);
          }
        }}
        className="mt-1 block w-full rounded-lg border bg-white p-2 text-xs"
      />
      <span role="status" className="mt-1 block text-xs text-stone-600">
        {busy ? "Mengunggah foto…" : msg}
      </span>
    </label>
  );
}
