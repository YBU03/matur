"use client";
import { useState, useTransition } from "react";
import type { TimStatus } from "@/lib/pos-tim";
import { pilihPicOutlet } from "@/lib/pos-outlet-actions";
import { bacaAntrean } from "@/lib/pos-offline";
import { formatRupiah } from "@/lib/format";
export function PosOutletPic({
  status: s,
  outlet,
}: {
  status: TimStatus;
  outlet: string;
}) {
  const [pic, setPic] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const sesi = s.sesi;
  const resume = !!sesi?.kas_harian && pic === (s.pic?.id ?? s.operator?.id);
  const selected = s.roster.find((x) => x.id === pic);
  const sameShift = selected?.shift_id === sesi?.shift_id;
  const handover = !!sesi && (!resume || !sameShift);
  const blocked =
    !!sesi && !sesi.menunggu_reset && (!sesi.perangkat_sama || sesi.legacy);
  return (
    <form
      className="mx-auto my-5 max-w-xl space-y-4 rounded-3xl border bg-white p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          try {
            if (!navigator.onLine) {
              setError(
                "Hubungkan internet untuk membuka atau serah terima kas.",
              );
              return;
            }
            const queue = await bacaAntrean();
            if (queue.some((x) => !sesi || x.checkout.sesi_id === sesi.id)) {
              setError(
                "Sinkronkan seluruh antrean tablet dahulu agar hitungan serah terima tepat.",
              );
              return;
            }
            const r = await pilihPicOutlet(
              pic,
              sesi ? null : Number(f.get("modal")),
              handover ? Number(f.get("fisik")) : null,
              String(f.get("catatan") ?? ""),
            );
            if (r.error) setError(r.error);
            else location.href = "/pos";
          } catch {
            setError("Belum berhasil. Periksa koneksi dan coba lagi.");
          }
        });
      }}
    >
      <h2 className="text-xl font-bold">
        {sesi ? "Lanjutkan / Serah Terima Kas" : "Buka Kas Harian"}
      </h2>
      <p>{outlet}</p>
      <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Anggota sesuai shift terbit yang sudah Clock In dan belum Clock Out dapat dipilih sebagai PIC. S1 ke S2/S3 gunakan serah terima, bukan Tutup Kas Harian.</p>
      {sesi && (
        <p className="rounded-xl bg-matur-50 p-3 text-sm">
          Modal awal {formatRupiah(sesi.modal)} tetap diteruskan. S2/S3 tidak
          memasukkan modal ulang.
        </p>
      )}
      {blocked ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm">
          {sesi.legacy
            ? "Sesi lama perlu ditutup admin dahulu."
            : "Kas aktif pada perangkat lain. Minta admin menggunakan Pindah Perangkat atau Reset Akses."}
        </p>
      ) : (
        <>
          <label className="block text-sm font-semibold">
            Penanggung jawab shift
            <select
              required
              value={pic}
              onChange={(e) => setPic(e.target.value)}
              className="mt-1 w-full rounded-xl border p-3"
            >
              <option value="">Pilih nama yang sudah Clock In</option>
              {s.roster.map((r, i) => (
                <option key={`${r.id}-${r.shift_id}-${i}`} value={r.id}>
                  {r.nama} · {r.shift} · {r.tanggal}
                </option>
              ))}
            </select>
          </label>
          {!s.roster.length && (
            <p className="text-sm text-amber-800">
              Belum ada anggota sesuai jadwal yang sudah Clock In. Absen dahulu
              melalui akun pribadi.
            </p>
          )}
          {selected && (
            <p className="text-sm">
              Tim:{" "}
              {s.roster
                .filter(
                  (x) =>
                    x.shift_id === selected.shift_id &&
                    x.tanggal === selected.tanggal,
                )
                .map((x) => x.nama)
                .join(", ")}
              . Tanggung jawab tim tercatat bersama.
            </p>
          )}
          {!sesi && (
            <label className="block text-sm">
              Modal awal di laci · sekali hari ini
              <input
                name="modal"
                type="number"
                required
                min="0"
                step="1"
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
          )}
          {handover && (
            <>
              <label className="block text-sm">
                Uang fisik yang diterima
                <input
                  name="fisik"
                  type="number"
                  min="0"
                  step="1"
                  required
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>
              <label className="block text-sm">
                Catatan serah terima / selisih
                <textarea
                  name="catatan"
                  maxLength={1000}
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>
              <label className="flex gap-2 text-sm">
                <input type="checkbox" required />
                PIC penerima sudah memeriksa dan menerima uang fisik. Pilihan
                nama ini tercatat atas akses outlet bersama.
              </label>
            </>
          )}
          <button
            disabled={busy || !pic}
            className="w-full rounded-xl bg-matur-500 p-3 font-bold text-white disabled:opacity-50"
          >
            {busy
              ? "Memeriksa…"
              : !sesi
                ? "Mulai Kas Harian"
                : handover
                  ? "Konfirmasi Serah Terima & Lanjutkan"
                  : "Lanjutkan Kasir"}
          </button>
        </>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </form>
  );
}
