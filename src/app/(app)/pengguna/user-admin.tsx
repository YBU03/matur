"use client";

import { useActionState, useState, useTransition } from "react";
import { DeleteTwoStepDialog } from "@/components/delete-two-step";
import { Modal } from "@/components/confirm-edit";
import { addAssignment, createUser, removeAssignment, resetSecret, type Result } from "@/lib/pengguna-actions";
import { ROLES, type Role } from "@/lib/roles";

type Assign = { id: string; peran: string; outlet_id: string | null };
export type UserRow = { id: string; nama: string; email: string | null; aktif: boolean; assignments: Assign[] };
type Outlet = { id: string; nama: string };

const ROLE_KEYS = Object.keys(ROLES) as Role[];
const isPin = (r: string) => r === "kasir" || r === "barista";
const cls = "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2";

export function UserAdmin({ users, outlets }: { users: UserRow[]; outlets: Outlet[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(createUser, {});
  const [role, setRole] = useState<Role>("kasir");
  const [msg, setMsg] = useState<Result | null>(null);
  const [removing, setRemoving] = useState<{ a: Assign; nama: string } | null>(null);
  const [resetting, setResetting] = useState<{ u: UserRow; role: Role } | null>(null);
  const [adding, setAdding] = useState<UserRow | null>(null);
  const [busy, start] = useTransition();
  const outletName = (id: string | null) => (id ? (outlets.find((o) => o.id === id)?.nama ?? "-") : "Semua Outlet");
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        setRemoving(null);
        setResetting(null);
        setAdding(null);
      }
    });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pengguna & Akses</h1>
      <form action={action} className="grid gap-3 rounded-2xl border border-matur-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium">
          Nama
          <input name="nama" required className={cls} />
        </label>
        <label className="text-sm font-medium">
          Peran
          <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={cls}>
            {ROLE_KEYS.map((r) => (
              <option key={r} value={r}>
                {ROLES[r].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {isPin(role) ? "Kode staf" : "Email"}
          <input name="login" required type={isPin(role) ? "text" : "email"} placeholder={isPin(role) ? "kasir2" : "nama@email.com"} className={cls} />
        </label>
        <label className="text-sm font-medium">
          {isPin(role) ? "PIN (4–6 digit)" : "Password (min. 8)"}
          <input name="secret" required type="password" inputMode={isPin(role) ? "numeric" : undefined} className={cls} />
        </label>
        <label className="text-sm font-medium">
          Outlet
          <select name="outlet" disabled={ROLES[role].allOutlets} className={cls}>
            {ROLES[role].allOutlets ? (
              <option>Semua Outlet</option>
            ) : (
              outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-5">
          <button disabled={pending} className="rounded-xl bg-matur-500 px-4 py-2 font-semibold text-white disabled:opacity-60">
            {pending ? "Membuat…" : "+ Buat Akun"}
          </button>
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
          {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        </div>
      </form>

      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}

      <div className="overflow-x-auto rounded-2xl border border-matur-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-matur-50 text-left text-kopi-700">
            <tr>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Login</th>
              <th className="px-3 py-2">Peran & Outlet</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-stone-100 align-top">
                <td className="px-3 py-2 font-medium">{u.nama}</td>
                <td className="px-3 py-2 text-stone-600">{u.email?.replace("@pin.matur.id", " (PIN)")}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.assignments.map((a) => (
                      <span key={a.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white ${ROLES[a.peran as Role].accent}`}>
                        {ROLES[a.peran as Role].label} · {outletName(a.outlet_id)}
                        <button title="Cabut peran" onClick={() => setRemoving({ a, nama: u.nama })} className="ml-1 opacity-80 hover:opacity-100">
                          ×
                        </button>
                      </span>
                    ))}
                    <button onClick={() => setAdding(u)} className="rounded-full border border-dashed px-2 py-0.5 text-xs text-stone-500">
                      + peran
                    </button>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    onClick={() => setResetting({ u, role: (u.assignments.find((a) => isPin(a.peran))?.peran ?? "owner") as Role })}
                    className="text-matur-700 hover:underline"
                  >
                    {u.email?.endsWith("@pin.matur.id") ? "Ganti PIN" : "Ganti password"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {removing && (
        <DeleteTwoStepDialog
          name={`${ROLES[removing.a.peran as Role].label} ${removing.nama}`}
          onCancel={() => setRemoving(null)}
          onConfirm={() => run(() => removeAssignment(removing.a.id))}
        />
      )}
      {resetting && (
        <SecretDialog
          title={`${isPin(resetting.role) ? "PIN" : "Password"} baru untuk ${resetting.u.nama}`}
          pin={isPin(resetting.role)}
          busy={busy}
          onCancel={() => setResetting(null)}
          onSave={(v) => run(() => resetSecret(resetting.u.id, resetting.role, v))}
        />
      )}
      {adding && <AddRoleDialog user={adding} outlets={outlets} busy={busy} onCancel={() => setAdding(null)} onSave={(r, o) => run(() => addAssignment(adding.id, r, o))} />}
    </div>
  );
}

function SecretDialog({ title, pin, busy, onCancel, onSave }: { title: string; pin: boolean; busy: boolean; onCancel: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <Modal title={title}>
      <input value={v} onChange={(e) => setV(e.target.value)} type="password" inputMode={pin ? "numeric" : undefined} className={cls} />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
        <button disabled={busy || !v} onClick={() => onSave(v)} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Simpan</button>
      </div>
    </Modal>
  );
}

function AddRoleDialog({ user, outlets, busy, onCancel, onSave }: { user: UserRow; outlets: Outlet[]; busy: boolean; onCancel: () => void; onSave: (r: Role, o: string | null) => void }) {
  const [role, setRole] = useState<Role>("spv");
  const [outlet, setOutlet] = useState(outlets[0]?.id ?? "");
  return (
    <Modal title={`Tambah peran untuk ${user.nama}`}>
      <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={cls}>
        {ROLE_KEYS.map((r) => (
          <option key={r} value={r}>{ROLES[r].label}</option>
        ))}
      </select>
      {!ROLES[role].allOutlets && (
        <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={cls}>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>{o.nama}</option>
          ))}
        </select>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
        <button disabled={busy} onClick={() => onSave(role, ROLES[role].allOutlets ? null : outlet)} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white">Tambah</button>
      </div>
    </Modal>
  );
}
