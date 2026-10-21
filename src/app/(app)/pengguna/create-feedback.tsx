"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export function CreateFeedback({
  status,
  message,
  onClose,
}: {
  status: "loading" | "success";
  message?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={title}
      aria-busy={status === "loading"}
      onCancel={(e) => {
        e.preventDefault();
        if (status === "success") onClose();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-3xl border border-matur-100 bg-white p-8 text-center text-kopi-900 shadow-2xl backdrop:bg-black/40"
    >
      <div
        key={status}
        className="account-feedback space-y-4"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status === "loading" ? (
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-matur-50">
            <svg
              aria-hidden="true"
              viewBox="0 0 48 48"
              className="size-12 animate-spin text-matur-500 motion-reduce:animate-none"
              fill="none"
            >
              <circle
                cx="24"
                cy="24"
                r="19"
                stroke="currentColor"
                strokeWidth="4"
                opacity=".2"
              />
              <path
                d="M24 5a19 19 0 0 1 19 19"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : (
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <svg
              aria-hidden="true"
              viewBox="0 0 48 48"
              className="size-12"
              fill="none"
            >
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="3"
                opacity=".25"
              />
              <path
                className="account-feedback-check"
                pathLength="1"
                d="m14 24 7 7 14-15"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
        <h2 id={title} className="text-xl font-bold">
          {status === "loading"
            ? "Sedang membuat akun…"
            : "Akun berhasil ditambahkan"}
        </h2>
        <p className="text-sm text-stone-500">
          {status === "loading"
            ? "Mohon tunggu sebentar sampai proses selesai."
            : message}
        </p>
      </div>
      {status === "success" && (
        <button
          autoFocus
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-matur-500 px-4 py-2.5 font-semibold text-white hover:bg-matur-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matur-500"
        >
          Selesai
        </button>
      )}
    </dialog>,
    document.body,
  );
}
