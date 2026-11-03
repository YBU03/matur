"use client";

import { Modal } from "./confirm-edit";

// Hapus data: cukup konfirmasi Ya/Tidak (atas permintaan pemilik, tanpa ketik nama).
// Data masuk tempat sampah 30 hari dan bisa dipulihkan admin (AKS-07).
export function DeleteTwoStepDialog({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="Hapus data?" onClose={onCancel} tutupLuar>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-xl" aria-hidden>
          ⚠️
        </span>
        <p className="text-sm text-stone-600">
          Hapus <b className="text-kopi-900">{name}</b>? Data dipindahkan ke tempat sampah dan masih bisa dipulihkan admin dalam 30 hari.
        </p>
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-stone-200 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50">
          Batal
        </button>
        <button type="button" autoFocus onClick={onConfirm} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700">
          Ya, hapus
        </button>
      </div>
    </Modal>
  );
}
