"use client";
export default function JadwalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section
      role="alert"
      className="mx-auto max-w-2xl space-y-3 rounded-2xl border border-red-200 bg-white p-5"
    >
      <h1 className="text-xl font-bold">Jadwal belum bisa dimuat</h1>
      <p className="text-sm">
        Periksa koneksi dan akses outlet, lalu coba kembali. Data jadwal tetap
        tersimpan.
      </p>
      {process.env.NODE_ENV === "development" && (
        <p className="text-sm text-red-700">{error.message}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
      >
        Coba muat ulang
      </button>
    </section>
  );
}
