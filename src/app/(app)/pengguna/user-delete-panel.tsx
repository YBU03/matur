"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { hapusPilihanPengguna } from "@/lib/user-delete-actions";
import {
  MAX_DELETE_USERS,
  bolehHapus,
  targetHapus,
  type DeleteTarget,
  type DeleteOutcome,
} from "@/lib/user-delete";

export type UserSelection = {
  selected: string[];
  toggle: (id: string) => void;
  canSelect: (u: DeleteTarget) => boolean;
};

export function UserDeletePanel({
  visible,
  meId,
  single,
  onCloseSingle,
  selecting,
  setSelecting,
  scope,
  children,
}: {
  visible: DeleteTarget[];
  meId: string;
  single: DeleteTarget | null;
  onCloseSingle: () => void;
  selecting: boolean;
  setSelecting: (v: boolean) => void;
  scope: string;
  children?: (selection: UserSelection) => React.ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [batch, setBatch] = useState<DeleteTarget[] | null>(null);
  const [hasil, setHasil] = useState<DeleteOutcome[] | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const flight = useRef(false);
  useEffect(() => {
    if (!flight.current) setSelected([]);
  }, [scope]);
  const eligible = visible.filter((u) => bolehHapus(u, meId));
  const chosen = eligible.filter((u) => selected.includes(u.id));
  const targets = single ? [single] : batch;
  const close = () => {
    if (flight.current) return;
    setBatch(null);
    onCloseSingle();
    setError("");
  };
  return (
    <>
      <section className="space-y-3 rounded-2xl border border-matur-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={busy}
            onClick={() => {
              setSelecting(!selecting);
              setSelected([]);
              setHasil(null);
            }}
            className="rounded-xl border border-matur-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {selecting ? "Batal memilih" : "Pilih Pengguna"}
          </button>
          {selecting && (
            <>
              <button
                disabled={busy || !eligible.length}
                onClick={() =>
                  setSelected(
                    eligible.slice(0, MAX_DELETE_USERS).map((u) => u.id),
                  )
                }
                className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
              >
                {eligible.length > MAX_DELETE_USERS
                  ? `Pilih ${MAX_DELETE_USERS} pertama hasil filter`
                  : "Pilih semua hasil filter"}
              </button>
              <button
                disabled={busy || !chosen.length}
                onClick={() => setSelected([])}
                className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
              >
                Kosongkan pilihan
              </button>
              <button
                disabled={busy || !chosen.length}
                onClick={() => {
                  setError("");
                  setBatch([...chosen]);
                }}
                className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Hapus terpilih ({chosen.length})
              </button>
            </>
          )}
        </div>
        {selecting && (
          <>
            <p className="text-xs text-stone-500">
              Pilihan mengikuti tab, pencarian, dan outlet saat ini. Ganti
              filter untuk memulai pilihan baru. Maksimal {MAX_DELETE_USERS}{" "}
              akun per proses.
            </p>
            {!children && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {visible.map((u) => {
                  const allowed = bolehHapus(u, meId);
                  const checked = chosen.some((x) => x.id === u.id);
                  return (
                    <li key={u.id}>
                      <label
                        className={`flex h-full items-start gap-3 rounded-xl border p-3 text-sm ${checked ? "border-red-300 bg-red-50" : "border-stone-200"} ${!allowed ? "opacity-60" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={
                            !allowed ||
                            busy ||
                            (!checked && chosen.length >= MAX_DELETE_USERS)
                          }
                          onChange={(e) =>
                            setSelected((xs) =>
                              e.target.checked
                                ? [...new Set([...xs, u.id])]
                                : xs.filter((id) => id !== u.id),
                            )
                          }
                          className="mt-1 accent-red-600"
                        />
                        <span className="min-w-0">
                          <span className="block break-words font-semibold">
                            {u.nama}
                          </span>
                          <span className="block break-all text-xs text-stone-500">
                            {u.email ?? "Tanpa email"}
                          </span>
                          {!allowed && (
                            <span className="block text-xs text-stone-500">
                              {u.id === meId
                                ? "Akun Anda sendiri"
                                : "Akun Owner"}{" "}
                              · tidak dapat dipilih
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {!visible.length && (
              <p className="text-sm text-stone-500">
                Tidak ada pengguna pada hasil filter ini.
              </p>
            )}
          </>
        )}
        {hasil && (
          <div
            role="status"
            className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm"
          >
            <p className="font-bold">
              Hasil penghapusan: {hasil.filter((x) => x.ok).length} berhasil ·{" "}
              {hasil.filter((x) => x.error).length} gagal / belum diproses
            </p>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {hasil.map((r) => (
                <li key={r.id}>
                  <p className="font-semibold">
                    {r.ok ? "✓" : "⚠"} {r.nama}
                  </p>
                  <p className="break-all text-xs text-stone-500">{r.email}</p>
                  <p className={r.error ? "text-red-700" : "text-emerald-700"}>
                    {r.error ?? r.ok}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {children?.({
        selected: chosen.map((u) => u.id),
        canSelect: (u) =>
          bolehHapus(u, meId) &&
          !busy &&
          (!chosen.length ||
            chosen.some((x) => x.id === u.id) ||
            chosen.length < MAX_DELETE_USERS),
        toggle: (id) => {
          if (busy) return;
          setSelecting(true);
          setSelected((xs) =>
            xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id],
          );
        },
      })}
      {targets && (
        <DeleteUsersDialog
          key={targets.map((u) => u.id).join(",")}
          users={targets}
          busy={busy}
          error={error}
          onCancel={close}
          onConfirm={(sure, target) => {
            if (flight.current) return;
            flight.current = true;
            setError("");
            const ids = targets.map((u) => u.id);
            start(async () => {
              try {
                const r = await hapusPilihanPengguna(ids, sure, target);
                if (r.error) setError(r.error);
                else if (r.hasil) {
                  setHasil(r.hasil);
                  setSelected(r.hasil.filter((x) => x.error).map((x) => x.id));
                  setBatch(null);
                  onCloseSingle();
                }
              } catch {
                setError(
                  "Hasil penghapusan belum dapat dipastikan. Muat ulang daftar sebelum mencoba lagi.",
                );
              } finally {
                flight.current = false;
              }
            });
          }}
        />
      )}
    </>
  );
}

function DeleteUsersDialog({
  users,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  users: DeleteTarget[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (sure: string, target: string) => void;
}) {
  const [sure, setSure] = useState("");
  const [target, setTarget] = useState("");
  const expected = targetHapus(users);
  const valid = sure === "Yakin Hapus" && target === expected;
  return (
    <Modal
      title={
        users.length === 1 ? "Hapus pengguna" : `Hapus ${users.length} pengguna`
      }
      onClose={busy ? undefined : onCancel}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) onConfirm(sure, target);
        }}
        className="max-h-[75dvh] space-y-4 overflow-y-auto pr-1"
      >
        <p className="text-sm text-stone-600">
          Akses akun yang dipilih akan dicabut. Akun yang memiliki riwayat
          diarsipkan agar catatan absensi, transaksi, dan penggajian tetap
          tersimpan. Akun tanpa riwayat dapat dihapus permanen.
        </p>
        <ul className="max-h-36 space-y-2 overflow-y-auto rounded-xl bg-stone-50 p-3 text-sm">
          {users.map((u) => (
            <li key={u.id}>
              <p className="break-words font-semibold">{u.nama}</p>
              <p className="break-all text-xs text-stone-500">{u.email}</p>
            </li>
          ))}
        </ul>
        <label className="block text-sm font-medium">
          1. Ketik <strong>Yakin Hapus</strong>
          <input
            value={sure}
            onChange={(e) => setSure(e.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            required
            className="mt-1 w-full rounded-xl border px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          2. Ketik {users.length === 1 ? "nama pengguna" : "konfirmasi jumlah"}:{" "}
          <strong className="break-words">{expected}</strong>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            required
            className="mt-1 w-full rounded-xl border px-3 py-2"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600 motion-reduce:animate-none"
            />
            Memproses {users.length} pengguna…
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50"
          >
            Batal
          </button>
          <button
            disabled={!valid || busy}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Menghapus…" : "Hapus Pengguna"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
