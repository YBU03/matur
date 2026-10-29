"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

// AKS-05: perubahan tidak langsung tersimpan; tampilkan ringkasan sebelum → sesudah.

export type Change = { field: string; before: string; after: string };

export function diff(
  labels: Record<string, string>,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Change[] {
  return Object.keys(labels)
    .filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""))
    .map((k) => ({
      field: labels[k],
      before: String(before[k] ?? "-"),
      after: String(after[k] ?? "-"),
    }));
}

export function ConfirmEditDialog({
  changes,
  onConfirm,
  onCancel,
}: {
  changes: Change[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="Periksa perubahan">
      {changes.length === 0 ? (
        <p className="text-sm text-stone-500">Tidak ada perubahan.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500">
            <tr>
              <th className="py-1">Kolom</th>
              <th>Sebelum</th>
              <th>Sesudah</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.field} className="border-t">
                <td className="py-2 font-medium">{c.field}</td>
                <td className="text-red-600 line-through">{c.before}</td>
                <td className="font-semibold text-green-700">{c.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Periksa lagi
        </button>
        <button
          onClick={onConfirm}
          disabled={changes.length === 0}
          className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Ya, sudah benar
        </button>
      </div>
    </Modal>
  );
}

export function Modal({
  title,
  children,
  onClose,
  scrollable = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  scrollable?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollable) return;
    const old = document.body.style.overflow;
    const focus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = old;
      focus?.focus();
    };
  }, [scrollable]);
  // Esc menutup modal (bila pemanggil memberi onClose)
  useEffect(() => {
    if (!onClose) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-label={title}
        aria-modal
        className={`w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl ${scrollable ? "max-h-[90dvh] overflow-y-auto overscroll-contain" : ""}`}
        onKeyDown={(e) => {
          if (!scrollable || e.key !== "Tab") return;
          const els = panel.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]",
          );
          if (!els?.length) {
            e.preventDefault();
            return;
          }
          const first = els[0],
            last = els[els.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="mb-3 flex items-start gap-2">
          <h2 className="flex-1 text-lg font-bold">{title}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup jendela"
              className="grid size-9 shrink-0 place-items-center rounded-lg border"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
  return scrollable && typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}
