"use client";

import { useState } from "react";
import { ConfirmEditDialog, diff } from "@/components/confirm-edit";
import { DeleteTwoStepDialog } from "@/components/delete-two-step";

const LABELS = { nama: "Nama Outlet", investasi: "Investasi Awal" };
const INITIAL = { nama: "Ruma Kopiaksa", investasi: "135000000" };

export default function KomponenDemo() {
  const [saved, setSaved] = useState(INITIAL);
  const [draft, setDraft] = useState(INITIAL);
  const [dialog, setDialog] = useState<"edit" | "hapus" | null>(null);
  const [msg, setMsg] = useState("");

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Contoh komponen standar</h1>
      {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => (
        <label key={k} className="block text-sm font-medium">
          {LABELS[k]}
          <input
            value={draft[k]}
            onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2"
          />
        </label>
      ))}
      <div className="flex gap-2">
        <button onClick={() => setDialog("edit")} className="rounded-xl bg-matur-500 px-4 py-2 font-semibold text-white">
          Simpan
        </button>
        <button onClick={() => setDialog("hapus")} className="rounded-xl border border-red-300 px-4 py-2 text-red-600">
          Hapus
        </button>
      </div>
      {msg && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}

      {dialog === "edit" && (
        <ConfirmEditDialog
          changes={diff(LABELS, saved, draft)}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setSaved(draft);
            setDialog(null);
            setMsg("Perubahan tersimpan dan tercatat di log aktivitas.");
          }}
        />
      )}
      {dialog === "hapus" && (
        <DeleteTwoStepDialog
          name={saved.nama}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            setMsg(`"${saved.nama}" dipindahkan ke tempat sampah (30 hari).`);
          }}
        />
      )}
    </div>
  );
}
