"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PosScreen } from "@/app/kasir/(terminal)/pos/pos-screen";
import type { ComponentProps } from "react";
import type { TimStatus } from "@/lib/pos-tim";
import { kunciPos, perbaruiPos } from "@/lib/pos-tim-actions";
import {
  bukaPindahBeku,
  hapusSnapshot,
  simpanSnapshot,
} from "@/lib/pos-offline";
/** kunci otomatis setelah 5 menit tanpa sentuhan */
const IDLE_MS = 5 * 60000;
export type PosSnapshot = {
  screen: Omit<ComponentProps<typeof PosScreen>, "izin">;
  status: TimStatus;
  client_at: number;
};
export function PosRuntime({
  initial,
  offlineBoot = false,
}: {
  initial: PosSnapshot;
  offlineBoot?: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial.status);
  const [online, setOnline] = useState(true);
  const [locked, setLocked] = useState("");
  const [storageError, setStorageError] = useState("");
  const [serverNow, setServerNow] = useState(
    Date.parse(initial.status.server_at),
  );
  const anchor = useRef({
    server: Date.parse(initial.status.server_at),
    client: initial.client_at,
    mono: typeof performance !== "undefined" ? performance.now() : 0,
  });
  const last = useRef(Date.now());
  const idleLocked = useRef(false);
  useEffect(() => {
    const pindah = () => {
      idleLocked.current = true;
      setLocked(
        "Admin sedang memindahkan sesi POS. Transaksi baru dihentikan; antrean lama tetap dikirim.",
      );
      void hapusSnapshot().catch(() => {});
    };
    window.addEventListener("matur-pos-beku", pindah);
    const save = async (status: TimStatus) => {
      try {
        await bukaPindahBeku();
        await simpanSnapshot({ ...initial, status, client_at: Date.now() });
        setStorageError("");
      } catch {
        setStorageError(
          "Penyimpanan tablet tidak tersedia. Offline dinonaktifkan; jangan lanjut saat koneksi terputus.",
        );
      }
    };
    const verify = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) return;
      if (idleLocked.current) {
        try {
          await kunciPos();
        } catch {}
        return;
      }
      if (Date.now() - last.current > IDLE_MS) {
        setLocked("POS terkunci karena tidak digunakan selama 5 menit.");
        try {
          await kunciPos();
        } catch {}
        return;
      }
      try {
        const r = await perbaruiPos();
        if (r.data) {
          setS(r.data);
          anchor.current = {
            server: Date.parse(r.data.server_at),
            client: Date.now(),
            mono: performance.now(),
          };
          if (!r.data.boleh)
            setLocked(
              "Sesi perlu diperiksa: tablet, waktu shift, anggota yang masih bertugas, atau PIN.",
            );
          else await save(r.data);
        } else if (r.error) setLocked(r.error);
      } catch {
        /* A network failure keeps the bounded offline lease; it never extends it. */
      }
    };
    const activity = () => {
      last.current = Date.now();
    };
    const tick = setInterval(() => {
      const wall = Date.now() - anchor.current.client;
      setServerNow(anchor.current.server + wall);
      if (wall < -30000)
        setLocked(
          "Jam perangkat berubah. Hubungkan internet dan verifikasi ulang.",
        );
      if (Date.now() - last.current > IDLE_MS && !idleLocked.current) {
        idleLocked.current = true;
        void hapusSnapshot().catch(() => {});
        if (navigator.onLine) void kunciPos().catch(() => {});
        setLocked(
          "POS terkunci setelah tidak digunakan 5 menit. Hubungkan internet untuk memilih PIC shift.",
        );
      }
    }, 1000);
    const timer = setInterval(() => void verify(), 30000);
    window.addEventListener("online", verify);
    window.addEventListener("offline", verify);
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    if (!offlineBoot) void save(initial.status);
    void verify();
    return () => {
      window.removeEventListener("matur-pos-beku", pindah);
      clearInterval(tick);
      clearInterval(timer);
      window.removeEventListener("online", verify);
      window.removeEventListener("offline", verify);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [initial, offlineBoot]);
  const expired =
    !s.izin ||
    serverNow > Date.parse(s.izin.sampai_at) ||
    !s.sesi ||
    serverNow > Date.parse(s.sesi.batas_at);
  if (locked || expired || (!online && !!storageError))
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-2xl border bg-white p-6 text-center">
        <p className="text-3xl">🔒</p>
        <h1 className="text-xl font-bold">POS terkunci</h1>
        <p className="text-sm">
          {locked ||
            (expired
              ? "Batas izin shift/offline berakhir. Transaksi baru dihentikan."
              : storageError)}
        </p>
        <p className="text-xs text-stone-500">
          Antrean yang sudah tersimpan tetap dipertahankan dan akan disinkronkan
          saat koneksi serta akses tersedia.
        </p>
        <button
          onClick={() => {
            if (navigator.onLine) location.href = "/pos";
          }}
          className="rounded-xl bg-kopi-900 px-4 py-3 text-sm text-white"
        >
          Periksa koneksi & pilih PIC shift
        </button>
        <Link href="/kasir/shift" className="block text-sm underline">
          Hitung / tutup kas
        </Link>
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-matur-50 p-3 text-xs">
        <b>{online ? "● Terhubung" : "● Offline · tunai saja"}</b>
        <span className="mr-auto">
          Izin sampai{" "}
          {new Date(s.izin!.sampai_at).toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}{" "}
          WIB
        </span>
        <button
          onClick={async () => {
            idleLocked.current = true;
            void hapusSnapshot().catch(() => {});
            setLocked(
              "POS dikunci. Pilih PIC dari anggota yang masih bertugas untuk melanjutkan.",
            );
            try {
              await kunciPos();
              router.refresh();
            } catch {}
          }}
          className="rounded-lg border bg-white px-3 py-2 font-bold"
        >
          Kunci layar
        </button>
      </div>
      {storageError && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">
          {storageError}
        </p>
      )}
      <PosScreen
        {...initial.screen}
        kasir={s.operator?.nama ?? initial.screen.kasir}
        bisaBayar={s.operator ? s.operator.kasir : true}
        izin={{
          id: s.izin!.id,
          sampai_at: s.izin!.sampai_at,
          server_at: s.server_at,
          client_at: anchor.current.client,
          offlineBoleh: !storageError,
        }}
      />
    </div>
  );
}
