"use client";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { ROLES, type Role } from "@/lib/roles";
import {
  editAssignment,
  editUserProfile,
  setUserStatus,
  type Result,
} from "@/lib/pengguna-actions";
import type { UserRow } from "./user-admin";
export function UserEditor({
  user,
  kind,
  roleKeys,
  outlets,
  isOwner,
  staf,
  meId,
  onClose,
  onSaved,
  onAdd,
  onRemove,
  onReset,
  onDelete,
}: {
  user: UserRow;
  kind: "detail" | "akses" | "status" | "aksi";
  roleKeys: Role[];
  outlets: { id: string; nama: string }[];
  isOwner: boolean;
  staf: boolean;
  meId: string;
  onClose: () => void;
  onSaved: (r: Result) => void;
  onAdd: () => void;
  onRemove: (a: UserRow["assignments"][number]) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const [section, setSection] = useState(kind === "aksi" ? "detail" : kind);
  const [nama, setNama] = useState(user.nama);
  const [hp, setHp] = useState(user.no_hp ?? "");
  const [selected, setSelected] = useState(user.assignments[0]?.id ?? "");
  const a = user.assignments.find((x) => x.id === selected);
  const [role, setRole] = useState<Role>((a?.peran as Role) ?? "barista");
  const [outlet, setOutlet] = useState(a?.outlet_id ?? "");
  const [status, setStatus] = useState(user.status);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const ownerTarget = user.assignments.some((x) => x.peran === "owner");
  const profileAllowed = !staf && (isOwner || !ownerTarget);
  const accessAllowed =
    !!a &&
    (isOwner || staf) &&
    user.id !== meId &&
    a.peran !== "owner" &&
    (!staf || ["kasir", "barista"].includes(a.peran));
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setMessage("");
      try {
        const r = await fn();
        if (r.error) setMessage(r.error);
        else onSaved(r);
      } catch {
        setMessage(
          "Belum dapat menyimpan. Periksa koneksi lalu coba lagi; input tetap tersimpan.",
        );
      }
    });
  const field =
    "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm focus:border-matur-500 focus:outline-none";
  return (
    <Modal
      title={user.nama}
      scrollable
      mobileSheet
      onClose={() => !busy && onClose()}
    >
      <p className="mb-4 break-all text-xs text-stone-500">
        {user.email ?? "Tanpa email"}
      </p>
      <div className="mb-4 flex gap-1 rounded-xl bg-stone-100 p-1">
        {(
          [
            ["detail", "Profil"],
            ["akses", "Peran & Outlet"],
            ["status", "Status"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            onClick={() => setSection(id)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold ${section === id ? "bg-white text-kopi-900 shadow-sm" : "text-stone-500"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <fieldset disabled={busy} className="space-y-4">
        {section === "detail" && (
          <>
            <label className="block text-sm font-medium">
              Nama
              <input
                className={field}
                value={nama}
                maxLength={120}
                disabled={!profileAllowed}
                onChange={(e) => setNama(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Nomor HP
              <input
                className={field}
                value={hp}
                maxLength={30}
                disabled={!profileAllowed}
                onChange={(e) => setHp(e.target.value)}
              />
            </label>
            <p className="text-xs text-stone-500">
              Terdaftar {new Date(user.created_at).toLocaleDateString("id-ID")}.
              Email login: {user.email ?? "—"}.
            </p>
            {profileAllowed && (
              <button
                type="button"
                disabled={!nama.trim()}
                onClick={() =>
                  run(() =>
                    editUserProfile(
                      user.id,
                      { nama: user.nama, no_hp: user.no_hp },
                      { nama, no_hp: hp },
                    ),
                  )
                }
                className="w-full rounded-xl bg-matur-500 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Menyimpan…" : "✓ Simpan profil"}
              </button>
            )}
          </>
        )}
        {section === "akses" && (
          <>
            <p className="text-xs text-stone-500">
              Pilih akses yang akan diubah. Peran lain milik akun ini tetap
              disimpan.
            </p>
            {user.assignments.length > 0 ? (
              <>
                <label className="block text-sm font-medium">
                  Akses yang diedit
                  <select
                    className={field}
                    value={selected}
                    onChange={(e) => {
                      const x = user.assignments.find(
                        (v) => v.id === e.target.value,
                      )!;
                      setSelected(x.id);
                      setRole(x.peran as Role);
                      setOutlet(x.outlet_id ?? "");
                    }}
                  >
                    {user.assignments.map((x) => (
                      <option key={x.id} value={x.id}>
                        {ROLES[x.peran as Role]?.label ?? x.peran} ·{" "}
                        {x.outlet_id
                          ? (outlets.find((o) => o.id === x.outlet_id)?.nama ??
                            "Outlet tidak tersedia")
                          : "Semua outlet"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Peran
                  <select
                    className={field}
                    disabled={!accessAllowed}
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                  >
                    {[
                      ...new Set([
                        role,
                        ...roleKeys.filter((r) => r !== "tablet"),
                      ]),
                    ].map((r) => (
                      <option key={r} value={r}>
                        {ROLES[r]?.label ?? r}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Outlet
                  <select
                    className={field}
                    disabled={!accessAllowed || ROLES[role].allOutlets}
                    value={ROLES[role].allOutlets ? "" : outlet}
                    onChange={(e) => setOutlet(e.target.value)}
                  >
                    {ROLES[role].allOutlets ? (
                      <option value="">Semua outlet</option>
                    ) : (
                      <>
                        <option value="">
                          {ROLES[role].outletOpsional
                            ? "Semua outlet"
                            : "Pilih outlet"}
                        </option>
                        {outlets.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nama}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </label>
                {accessAllowed ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        !ROLES[role].allOutlets &&
                        !ROLES[role].outletOpsional &&
                        !outlet
                      }
                      className="flex-1 rounded-xl bg-matur-500 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
                      onClick={() =>
                        a &&
                        run(() =>
                          editAssignment(
                            a,
                            role,
                            ROLES[role].allOutlets ? null : outlet || null,
                          ),
                        )
                      }
                    >
                      {busy ? "Menyimpan…" : "✓ Simpan akses"}
                    </button>
                    <button
                      type="button"
                      onClick={() => a && onRemove(a)}
                      className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700"
                    >
                      Cabut akses
                    </button>
                  </div>
                ) : (
                  <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                    Akses ini dilindungi atau di luar kewenangan Anda.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-500">Belum memiliki peran.</p>
            )}
            {(isOwner || staf) && (
              <button
                type="button"
                onClick={onAdd}
                className="w-full rounded-xl border border-matur-200 px-3 py-2 text-sm font-semibold text-matur-700"
              >
                + Tambah akses baru
              </button>
            )}
          </>
        )}
        {section === "status" &&
          (user.status === "aktif" || user.status === "nonaktif" ? (
            <>
              <label className="block text-sm font-medium">
                Status akun
                <select
                  className={field}
                  value={status}
                  disabled={user.id === meId || (!isOwner && ownerTarget)}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </label>
              <p className="text-xs text-stone-500">
                Akun nonaktif tidak dapat mengakses aplikasi. Riwayatnya tetap
                tersimpan.
              </p>
              <button
                type="button"
                disabled={
                  status === user.status ||
                  user.id === meId ||
                  (!isOwner && ownerTarget)
                }
                className="w-full rounded-xl bg-matur-500 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
                onClick={() =>
                  run(() =>
                    setUserStatus(user.id, status as "aktif" | "nonaktif"),
                  )
                }
              >
                {busy ? "Menyimpan…" : "✓ Simpan status"}
              </button>
            </>
          ) : (
            <p className="text-sm text-stone-600">
              Status {user.status}. Persetujuan pendaftaran dikelola melalui
              tombol Tinjau pendaftaran pada daftar pengguna.
            </p>
          ))}
      </fieldset>
      {message && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {message}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-xl border px-3 py-2 text-sm"
        >
          Batal / Tutup
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          className="rounded-xl border px-3 py-2 text-sm"
        >
          {user.email?.endsWith("@pin.matur.id")
            ? "Ganti PIN"
            : "Ganti password"}
        </button>
        {isOwner && user.id !== meId && !ownerTarget && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="ml-auto rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            Hapus akun
          </button>
        )}
      </div>
    </Modal>
  );
}
