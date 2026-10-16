"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { logoutAction, kasirLogoutAction } from "@/lib/actions";
import { bacaAntrean, hapusSnapshot } from "@/lib/pos-offline";

/** Shared logout experience; POS keeps its durable queue safeguards and outlet redirect. */
export function LogoutButton({
  label = "Keluar",
  className,
  pos = false,
}: {
  label?: string;
  className?: string;
  pos?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
        }
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        {label}
      </button>
      {open &&
        createPortal(
          <LogoutDialog pos={pos} onCancel={() => setOpen(false)} />,
          document.body,
        )}
    </>
  );
}
function LogoutDialog({
  pos,
  onCancel,
}: {
  pos: boolean;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    const originalFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    cancel.current?.focus();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      originalFocus?.focus();
    };
  }, []);
  async function checkQueue() {
    if (!pos) return;
    if (!navigator.onLine)
      throw new Error("Hubungkan internet sebelum keluar dari POS.");
    if ((await bacaAntrean()).length)
      throw new Error(
        "Sinkronkan transaksi tertunda sebelum keluar. Data antrean tetap tersimpan di perangkat ini.",
      );
  }
  async function confirmLogout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await checkQueue();
      setThanks(true);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      await new Promise((resolve) => setTimeout(resolve, reduced ? 450 : 1100));
      // Recheck after the farewell in case another tab queued a transaction meanwhile.
      await checkQueue();
      if (pos) {
        await hapusSnapshot();
        await kasirLogoutAction();
      } else await logoutAction();
    } catch (e) {
      if (String(e).includes("NEXT_REDIRECT")) throw e;
      setThanks(false);
      setError(
        e instanceof Error &&
          /Hubungkan internet|Sinkronkan transaksi/.test(e.message)
          ? e.message
          : "Belum berhasil keluar. Periksa koneksi lalu coba lagi.",
      );
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="logout-title"
      aria-describedby="logout-description"
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!inFlight.current) onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !inFlight.current) onCancel();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-[2rem] border border-amber-100 bg-[#fffaf2] p-0 text-kopi-900 shadow-2xl backdrop:bg-stone-950/45 backdrop:backdrop-blur-sm"
      data-logout
    >
      <div className="logout-card relative overflow-hidden p-6 text-center sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 size-80 -translate-x-1/2 rounded-full bg-amber-200/40 blur-3xl"
        />
        <div
          className={`logout-mascot relative mx-auto aspect-square w-52 max-w-full sm:w-60 ${thanks ? "logout-goodbye" : ""}`}
        >
          <Image
            src="/mascot/logout.png"
            alt="Maskot Matoer berpamitan di depan pintu"
            width={1254}
            height={1254}
            priority
            sizes="240px"
            className="size-full object-contain"
          />
        </div>
        <div aria-live="polite" aria-atomic="true" className="relative">
          <p className="mb-2 text-[11px] font-bold tracking-[0.24em] text-amber-700">
            MATOER
          </p>
          <h2 id="logout-title" className="text-2xl font-extrabold">
            {thanks ? "Maturnuwun" : "Mau keluar dari Matoer?"}
          </h2>
          <p
            id="logout-description"
            className="mt-2 text-sm leading-relaxed text-stone-600"
          >
            {thanks
              ? "Sampai jumpa lagi. Hati-hati di jalan, ya!"
              : pos
                ? "Sampai jumpa lagi! Keluar akun tidak menutup kas harian outlet."
                : "Sudah selesai untuk sekarang? Kamu bisa masuk lagi kapan saja."}
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="relative mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {thanks ? (
          <div
            role="status"
            className="relative mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-amber-800"
          >
            <span
              className="logout-spinner size-4 rounded-full border-2 border-amber-200 border-t-amber-700"
              aria-hidden="true"
            />
            Sedang keluar…
          </div>
        ) : (
          <div className="relative mt-6 grid grid-cols-2 gap-3">
            <button
              ref={cancel}
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm font-semibold hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50"
            >
              Tetap di sini
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmLogout()}
              className="rounded-xl bg-kopi-900 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-kopi-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50"
            >
              {busy ? "Memeriksa…" : "Ya, Keluar"}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
