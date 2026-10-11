"use client";

import { useActionState, useState, useTransition } from "react";
import { DeleteTwoStepDialog } from "@/components/delete-two-step";
import { Modal } from "@/components/confirm-edit";
import { addAssignment, approveUser, createUser, rejectUser, removeAssignment, resetSecret, setUserStatus, type Result } from "@/lib/pengguna-actions";
import { ROLES, type Role } from "@/lib/roles";

type Assign = { id: string; peran: string; outlet_id: string | null };
export type UserRow = {
  id: string;
  nama: string;
  email: string | null;
  no_hp: string | null;
  status: string;
  permintaan: { peran?: string; outlet?: string; catatan?: string } | null;
  created_at: string;
  assignments: Assign[];
};
type Outlet = { id: string; nama: string };

const ROLE_KEYS = Object.keys(ROLES) as Role[];
const isPin = (r: string) => r === "kasir" || r === "barista";
const cls = "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2";

export function UserAdmin({ users, outlets, isOwner, meId }: { users: UserRow[]; outlets: Outlet[]; isOwner: boolean; meId: string }) {
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
      <Pending users={users.filter((u) => u.status === "menunggu")} outlets={outlets} isOwner={isOwner} busy={busy} onRun={run} />
      {isOwner && <form action={action} className="grid gap-3 rounded-2xl border border-matur-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
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
      </form>}

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
            {users.filter((u) => u.status !== "menunggu").map((u) => (
              <tr key={u.id} className="border-t border-stone-100 align-top">
                <td className="px-3 py-2 font-medium">
                  {u.nama}
                  {u.status !== "aktif" && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">{u.status}</span>}
                </td>
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
                  {u.id !== meId && (u.status === "aktif" || u.status === "nonaktif") && (
                    <button
                      disabled={busy}
                      onClick={() => run(() => setUserStatus(u.id, u.status === "aktif" ? "nonaktif" : "aktif"))}
                      className={`ml-3 hover:underline ${u.status === "aktif" ? "text-red-600" : "text-green-700"}`}
                    >
                      {u.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  )}
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

// Pendaftar mandiri menunggu ACC: admin menentukan peran dan outlet yang boleh dilihat
function Pending({
  users,
  outlets,
  isOwner,
  busy,
  onRun,
}: {
  users: UserRow[];
  outlets: Outlet[];
  isOwner: boolean;
  busy: boolean;
  onRun: (fn: () => Promise<Result>) => void;
}) {
  if (!users.length) return null;
  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <h2 className="mb-3 font-bold">Pendaftar menunggu persetujuan ({users.length})</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {users.map((u) => (
          <PendingCard key={u.id} u={u} outlets={outlets} isOwner={isOwner} busy={busy} onRun={onRun} />
        ))}
      </div>
    </section>
  );
}

function PendingCard({ u, outlets, isOwner, busy, onRun }: { u: UserRow; outlets: Outlet[]; isOwner: boolean; busy: boolean; onRun: (fn: () => Promise<Result>) => void }) {
  const diminta = (u.permintaan?.peran ?? "mitra") as Role;
  const [role, setRole] = useState<Role>(ROLES[diminta] ? diminta : "mitra");
  const cocok = outlets.find((o) => u.permintaan?.outlet && o.nama.toLowerCase().includes(u.permintaan.outlet.toLowerCase()));
  const [outlet, setOutlet] = useState(cocok?.id ?? "");
  const pilihan = ROLE_KEYS.filter((r) => isOwner || r !== "owner");
  return (
    <div className="rounded-xl border bg-white p-3 text-sm">
      <p className="font-semibold">{u.nama}</p>
      <p className="text-stone-600">{u.email}{u.no_hp && ` · ${u.no_hp}`}</p>
      <p className="mt-1 text-xs text-stone-500">
        Mengajukan: <b>{ROLES[diminta]?.label ?? diminta}</b>
        {u.permintaan?.outlet && <> · outlet “{u.permintaan.outlet}”</>}
        {u.permintaan?.catatan && <> · “{u.permintaan.catatan}”</>}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-lg border px-2 py-1.5">
          {pilihan.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
        </select>
        {ROLES[role].allOutlets ? (
          <span className="self-center text-xs text-stone-500">Akses semua outlet</span>
        ) : (
          <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className="rounded-lg border px-2 py-1.5">
            <option value="">— pilih outlet —</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
          </select>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          disabled={busy || (!ROLES[role].allOutlets && !outlet)}
          onClick={() => onRun(() => approveUser(u.id, role, outlet || null))}
          className="flex-1 rounded-lg bg-green-600 py-1.5 font-semibold text-white disabled:opacity-50"
        >
          Setujui
        </button>
        <button disabled={busy} onClick={() => onRun(() => rejectUser(u.id))} className="rounded-lg border border-red-300 px-3 py-1.5 text-red-600">
          Tolak
        </button>
      </div>
      <p className="mt-1 text-xs text-stone-400">Outlet tambahan bisa ditambahkan lewat “+ peran” setelah disetujui.</p>
    </div>
  );
}
