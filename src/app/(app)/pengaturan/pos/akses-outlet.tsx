"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/confirm-edit";
import { aturAksesOutlet, hapusAksesOutlet } from "@/lib/pos-outlet-actions";
import type { PosHasil } from "@/lib/pos-tim-actions";
export type AksesOutlet = {
  id: string;
  nama: string;
  username: string | null;
  aktif: boolean;
  diubah_at: string | null;
};
type Editor = {
  baru: boolean;
  outletId: string;
  username: string;
  password: string;
  aktif: boolean;
  versi: string | null;
};
const input =
  "mt-1 w-full rounded-xl border bg-white p-2.5 text-sm disabled:opacity-60";
export function AksesOutletPanel({ outlets }: { outlets: AksesOutlet[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [review, setReview] = useState(false);
  const [hapus, setHapus] = useState<AksesOutlet | null>(null);
  const [busy, start] = useTransition();
  const inFlight = useRef(false);
  const [msg, setMsg] = useState<PosHasil>({});
  const [error, setError] = useState("");
  const tersedia = outlets.filter((o) => !o.username);
  const akses = outlets.filter(
    (o) => o.username && (!filter || o.id === filter),
  );
  const nama = outlets.find((o) => o.id === editor?.outletId)?.nama ?? "Outlet";
  const openAdd = () => {
    setMsg({});
    setError("");
    setReview(false);
    setEditor({
      baru: true,
      outletId:
        tersedia.find((o) => o.id === filter)?.id ?? tersedia[0]?.id ?? "",
      username: "",
      password: "",
      aktif: true,
      versi: null,
    });
  };
  const openEdit = (o: AksesOutlet) => {
    setMsg({});
    setError("");
    setReview(false);
    setEditor({
      baru: false,
      outletId: o.id,
      username: o.username ?? "",
      password: "",
      aktif: o.aktif,
      versi: o.diubah_at,
    });
  };
  const close = () => {
    if (inFlight.current) return;
    setEditor(null);
    setHapus(null);
    setReview(false);
    setError("");
  };
  const run = (action: () => Promise<PosHasil>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    start(async () => {
      try {
        const r = await action();
        if (r.error) setError(r.error);
        else {
          setEditor(null);
          setHapus(null);
          setReview(false);
          setMsg(r);
          router.refresh();
        }
      } catch {
        setError(
          "Perubahan belum dapat dikonfirmasi. Periksa koneksi lalu coba lagi.",
        );
      } finally {
        inFlight.current = false;
      }
    });
  };
  return (
    <section className="space-y-4">
      <p className="rounded-xl bg-sky-50 p-4 text-sm">
        Kelola akun kasir POS per outlet. Akun pribadi Pengguna Matoer tetap
        terpisah. Satu outlet memiliki satu akses POS; password disimpan sebagai
        hash.
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm">
          Outlet
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={input}
          >
            <option value="">Semua outlet yang dikelola</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!tersedia.length || busy}
          onClick={openAdd}
          className="rounded-xl bg-kopi-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          + Tambah Akses POS
        </button>
      </div>
      {!tersedia.length && !!outlets.length && (
        <p className="text-xs text-stone-500">
          Semua outlet yang dikelola sudah memiliki akses. Gunakan Edit untuk
          mengubahnya.
        </p>
      )}
      {(msg.ok || msg.error) && (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {akses.map((o) => (
          <article
            key={o.id}
            className="space-y-3 rounded-2xl border bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold">{o.nama}</h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${o.aktif ? "bg-green-50 text-green-800" : "bg-stone-100 text-stone-600"}`}
              >
                {o.aktif ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <dl className="text-sm">
              <dt className="text-xs text-stone-500">Username POS</dt>
              <dd className="break-all font-semibold">{o.username}</dd>
            </dl>
            <p className="text-xs text-stone-500">
              Password disembunyikan · ganti melalui Edit.
            </p>
            <div className="flex gap-2 border-t pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => openEdit(o)}
                className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMsg({});
                  setError("");
                  setHapus(o);
                }}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                Hapus
              </button>
            </div>
          </article>
        ))}
      </div>
      {!akses.length && (
        <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-stone-500">
          {outlets.length
            ? "Belum ada akses POS untuk outlet yang dipilih. Klik Tambah Akses POS untuk membuatnya."
            : "Tidak ada outlet dalam kewenangan akun ini."}
        </div>
      )}
      {editor && (
        <Modal
          title={
            review
              ? "Konfirmasi akses POS"
              : editor.baru
                ? "Tambah Akses POS Outlet"
                : "Edit Akses POS Outlet"
          }
          onClose={busy ? undefined : close}
        >
          {review ? (
            <div className="max-h-[70dvh] space-y-3 overflow-y-auto">
              <p className="text-sm">
                {editor.baru ? "Buat" : "Simpan perubahan"} akses POS untuk{" "}
                <strong>{nama}</strong>?
              </p>
              <dl className="space-y-2 rounded-xl bg-stone-50 p-3 text-sm">
                <div>
                  <dt className="text-stone-500">Username</dt>
                  <dd className="break-all font-semibold">
                    {editor.username.trim().toLowerCase()}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Status</dt>
                  <dd>{editor.aktif ? "Aktif" : "Nonaktif"}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Password</dt>
                  <dd>
                    {editor.password
                      ? editor.baru
                        ? "Password baru disiapkan"
                        : "Akan diganti"
                      : "Tetap menggunakan password sebelumnya"}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-stone-500">
                Setelah akses diubah, perangkat perlu masuk ulang. Modal dan
                riwayat transaksi tetap tersimpan.
              </p>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setReview(false);
                    setError("");
                  }}
                  className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50"
                >
                  Periksa lagi
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      aturAksesOutlet(
                        editor.outletId,
                        editor.username,
                        editor.password,
                        editor.aktif,
                        editor.baru,
                        editor.versi,
                      ),
                    )
                  }
                  className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy
                    ? "Menyimpan…"
                    : editor.baru
                      ? "Ya, Tambah Akses"
                      : "Ya, Simpan Perubahan"}
                </button>
              </div>
            </div>
          ) : (
            <form
              className="max-h-[70dvh] space-y-3 overflow-y-auto"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                setReview(true);
              }}
            >
              <label className="block text-sm">
                Outlet
                {editor.baru ? (
                  <select
                    value={editor.outletId}
                    onChange={(e) =>
                      setEditor({ ...editor, outletId: e.target.value })
                    }
                    required
                    className={input}
                  >
                    <option value="">Pilih outlet</option>
                    {tersedia.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nama}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 font-semibold">{nama}</p>
                )}
              </label>
              <label className="block text-sm">
                Username POS outlet
                <input
                  value={editor.username}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      username: e.target.value.toLowerCase(),
                    })
                  }
                  required
                  pattern="[a-z0-9][a-z0-9._-]{2,49}"
                  maxLength={50}
                  title="3–50 karakter: huruf kecil, angka, titik, garis bawah atau strip"
                  autoCapitalize="none"
                  autoComplete="off"
                  className={input}
                />
              </label>
              <label className="block text-sm">
                {editor.baru
                  ? "Password outlet"
                  : "Password baru · kosongkan jika tetap"}
                <input
                  value={editor.password}
                  onChange={(e) =>
                    setEditor({ ...editor, password: e.target.value })
                  }
                  type="password"
                  minLength={10}
                  maxLength={72}
                  required={editor.baru}
                  autoComplete="new-password"
                  className={input}
                />
              </label>
              <p className="text-xs text-stone-500">
                Password minimal 10 karakter.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editor.aktif}
                  onChange={(e) =>
                    setEditor({ ...editor, aktif: e.target.checked })
                  }
                />
                Aktifkan akses POS outlet
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl border px-4 py-2 text-sm"
                >
                  Batal
                </button>
                <button className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white">
                  Periksa & Lanjutkan
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {hapus && (
        <Modal
          title="Hapus akses POS outlet"
          onClose={busy ? undefined : close}
        >
          <p className="text-sm">
            Yakin ingin menghapus akses POS outlet <strong>{hapus.nama}</strong>
            ?
          </p>
          <p className="mt-2 break-all text-sm text-stone-500">
            Username: <strong>{hapus.username}</strong>
          </p>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Login POS outlet ini akan dicabut. Outlet, akun pribadi barista,
            transaksi, modal kas, dan riwayat serah terima tetap tersimpan.
          </p>
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={busy || !hapus.diubah_at}
              onClick={() =>
                run(() => hapusAksesOutlet(hapus.id, hapus.diubah_at!))
              }
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Menghapus…" : "Ya, Hapus"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
