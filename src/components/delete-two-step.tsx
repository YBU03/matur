"use client";

import { useState } from "react";
import { Modal } from "./confirm-edit";

// AKS-06: hapus 2 tahap — ketik nama data persis, lalu ketik "Yakin Hapus".
// Data masuk tempat sampah 30 hari (AKS-07).

export function DeleteTwoStepDialog({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typedName, setTypedName] = useState("");
  const [typedSure, setTypedSure] = useState("");
  const ok = typedName === name && typedSure === "Yakin Hapus";

  return (
    <Modal title="Hapus data">
      <p className="text-sm text-stone-600">
        Data akan dipindahkan ke tempat sampah dan bisa dipulihkan admin dalam 30 hari.
      </p>
      <label className="mt-4 block text-sm">
        1. Ketik nama data: <b className="select-none">{name}</b>
        <input value={typedName} onChange={(e) => setTypedName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="mt-3 block text-sm">
        2. Ketik <b>Yakin Hapus</b>
        <input value={typedSure} onChange={(e) => setTypedSure(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">
          Batal
        </button>
        <button onClick={onConfirm} disabled={!ok} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Hapus
        </button>
      </div>
    </Modal>
  );
}
