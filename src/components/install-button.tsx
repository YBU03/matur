"use client";

import { useEffect, useState } from "react";
import { Modal } from "./confirm-edit";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Tombol "Pasang Aplikasi" (PWA). Android/Chrome memakai dialog bawaan; iPhone diberi petunjuk. */
export function InstallButton({ className = "" }: { className?: string }) {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(true); // sembunyikan sampai dicek di browser
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  const click = async () => {
    if (!prompt) return setHelp(true);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  return (
    <>
      <button
        onClick={click}
        className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-matur-400 to-matur-600 px-3 py-2 text-sm font-bold text-white shadow ${className}`}
      >
        📲 Pasang Aplikasi
      </button>
      {help && (
        <Modal title="Pasang di iPhone / iPad">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Buka halaman ini di <b>Safari</b>.</li>
            <li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li>
            <li>Pilih <b>Tambahkan ke Layar Utama</b>, lalu ketuk <b>Tambah</b>.</li>
          </ol>
          <div className="mt-4 text-right">
            <button onClick={() => setHelp(false)} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white">Mengerti</button>
          </div>
        </Modal>
      )}
    </>
  );
}
