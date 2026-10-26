"use client";
import { useRef, useState, useTransition } from "react";
import { Modal } from "./confirm-edit";
import { aturTestingPos } from "@/lib/pos-testing-actions";
export type TestingOutlet = {
  id: string;
  nama: string;
  aktif: boolean;
  versi: string | null;
};
export function PosTestingPanel({ rows }: { rows: TestingOutlet[] }) {
  const [pilih, setPilih] = useState<TestingOutlet | null>(null);
  const [pesan, setPesan] = useState("");
  const [busy, start] = useTransition();
  const flight = useRef(false);
  if (!rows.length) return null;
  return (
    <section className="space-y-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <h2 className="font-bold text-amber-950">Mode Testing POS</h2>
      <p className="text-sm text-amber-900">
        Pilih outlet untuk presentasi atau latihan sementara. Login POS tetap diperlukan, tetapi tidak perlu
        jadwal, Clock In, atau membuka kas. Transaksi latihan tidak masuk omzet,
        stok, setoran, dan laporan asli. Nonaktifkan testing setelah selesai agar POS kembali beroperasi normal.
      </p>
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"
        >
          <span className="font-semibold">
            {r.nama} · {r.aktif ? "Testing aktif" : "Testing nonaktif"}
          </span>
          <button
            disabled={busy}
            onClick={() => {
              setPesan("");
              setPilih(r);
            }}
            className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-bold disabled:opacity-50"
          >
            {r.aktif ? "Nonaktifkan testing" : "Aktifkan testing"}
          </button>
        </div>
      ))}
      {pesan && (
        <p role="status" className="text-sm">
          {pesan}
        </p>
      )}
      {pilih && (
        <Modal
          title="Konfirmasi Mode Testing"
          onClose={busy ? undefined : () => setPilih(null)}
        >
          <p className="text-sm">
            {pilih.aktif ? "Nonaktifkan" : "Aktifkan"} testing untuk{" "}
            <strong>{pilih.nama}</strong>?{" "}
            {pilih.aktif
              ? "Setelah nonaktif, syarat shift dan absensi berlaku kembali."
              : "Semua perangkat POS outlet ini masuk mode latihan. Transaksi asli baru diblokir sampai testing dinonaktifkan. Kas yang sudah ditutup tidak dibuka ulang."}
          </p>
          {pesan && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {pesan}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              disabled={busy}
              onClick={() => setPilih(null)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Batal
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (flight.current) return;
                flight.current = true;
                start(async () => {
                  try {
                    const r = await aturTestingPos(
                      pilih.id,
                      !pilih.aktif,
                      pilih.versi,
                    );
                    if (r.error) setPesan(r.error);
                    else {
                      setPilih(null);
                      setPesan(r.ok ?? "Tersimpan.");
                    }
                  } catch {
                    setPesan(
                      "Belum dapat menyimpan. Periksa koneksi dan muat ulang status.",
                    );
                  } finally {
                    flight.current = false;
                  }
                });
              }}
              className="rounded-lg bg-kopi-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Menyimpan…" : "Ya, lanjutkan"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
