"use client";

import { useActionState, useState, useTransition } from "react";
import { DeleteTwoStepDialog } from "@/components/delete-two-step";
import { Modal } from "@/components/confirm-edit";
import { addAssignment, approveUser, createUser, hapusPengguna, rejectUser, removeAssignment, resetSecret, setUserStatus, type Result } from "@/lib/pengguna-actions";
import { ROLES, type Role } from "@/lib/roles";

type Assign = { id: string; peran: string; outlet_id: string | null };
export type UserRow = {
  id: string;
  nama: string;
  email: string | null;
  no_hp: string | null;
  status: string;
  permintaan: { catatan?: string; jenis?: string } | null;
  created_at: string;
  assignments: Assign[];
};
type Outlet = { id: string; nama: string };

const ROLE_KEYS = Object.keys(ROLES) as Role[];
const isPin = (r: string) => r === "kasir" || r === "barista";
const cls = "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2";

export function UserAdmin({ users, outlets, isOwner, staf = false, meId }: { users: UserRow[]; outlets: Outlet[]; isOwner: boolean; staf?: boolean; meId: string }) {
  // HRD & Admin Gudang hanya bisa memberi peran kasir/barista
  const roleKeys: Role[] = staf ? ["kasir", "barista"] : ROLE_KEYS;
  const bisaBuat = isOwner || staf;
  const [state, action, pending] = useActionState<Result, FormData>(createUser, {});
  const [role, setRole] = useState<Role>("kasir");
  const [msg, setMsg] = useState<Result | null>(null);
  const [removing, setRemoving] = useState<{ a: Assign; nama: string } | null>(null);
  const [resetting, setResetting] = useState<{ u: UserRow; role: Role } | null>(null);
  const [adding, setAdding] = useState<UserRow | null>(null);
  const [hapus, setHapus] = useState<UserRow | null>(null);
  const [busy, start] = useTransition();
  const [q, setQ] = useState("");
  const [buat, setBuat] = useState(false);
  const jumlah = (st: string) => users.filter((u) => u.status === st).length;
  const [tab, setTab] = useState<string>(users.some((u) => u.status === "menunggu") ? "menunggu" : "aktif");
  const aktif = users.filter((u) => u.status === tab);
  const outletName = (id: string | null) => (id ? (outlets.find((o) => o.id === id)?.nama ?? "-") : "Semua Outlet");
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        setRemoving(null);
        setResetting(null);
        setAdding(null);
        setHapus(null);
      }
    });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{staf ? "Akun Kasir & Barista" : "Pengguna & Akses"}</h1>
      {staf && <p className="-mt-4 text-sm text-stone-500">Buat akun kasir/barista, ganti PIN, aktif/nonaktifkan, dan setujui pendaftar karyawan outlet.</p>}
      {bisaBuat && !buat && (
        <button onClick={() => setBuat(true)} className="w-full rounded-xl bg-matur-500 px-4 py-2.5 font-semibold text-white sm:w-auto">
          + Buat akun baru
        </button>
      )}
      {bisaBuat && buat && <form action={action} className="grid gap-3 rounded-2xl border border-matur-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <p className="flex items-center font-bold sm:col-span-2 lg:col-span-5">
          <span className="mr-auto">Buat akun baru</span>
          <button type="button" onClick={() => setBuat(false)} className="text-sm font-normal text-stone-500">Tutup ✕</button>
        </p>
        <label className="text-sm font-medium">
          Nama
          <input name="nama" required className={cls} />
        </label>
        <label className="text-sm font-medium">
          Peran
          <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={cls}>
            {roleKeys.map((r) => (
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

      <nav className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">
          {[
            ["menunggu", "⏳ Menunggu persetujuan"],
            ["aktif", "Aktif"],
            ["nonaktif", "Nonaktif"],
            ["ditolak", "Ditolak"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? "bg-kopi-900 text-white" : "border border-matur-200 bg-white text-kopi-700"}`}
            >
              {l}{" "}
              <span className={`ml-0.5 rounded-full px-1.5 text-xs ${k === "menunggu" && jumlah(k) ? "bg-amber-400 text-kopi-900" : "opacity-70"}`}>{jumlah(k)}</span>
            </button>
          ))}
        </div>
      </nav>

      {tab === "menunggu" ? (
        jumlah("menunggu") ? (
          <Pending users={users.filter((u) => u.status === "menunggu")} outlets={outlets} isOwner={isOwner} roleKeys={roleKeys} busy={busy} onRun={run} />
        ) : (
          <p className="rounded-2xl border border-dashed border-matur-300 bg-white p-6 text-center text-sm text-stone-500">Tidak ada pendaftar yang menunggu persetujuan.</p>
        )
      ) : (
      <>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-bold">Pengguna {tab} ({aktif.length})</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / login…" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm sm:w-64" />
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {aktif
          .filter((u) => !q || `${u.nama} ${u.email ?? ""}`.toLowerCase().includes(q.toLowerCase()))
          .map((u) => (
            <li key={u.id} className={`rounded-2xl border bg-white p-4 ${u.status === "aktif" ? "border-matur-200" : "border-stone-200 opacity-75"}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-matur-100 font-bold text-kopi-700">{u.nama.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {u.nama}
                    {u.id === meId && <span className="ml-1 text-xs font-normal text-stone-500">(Anda)</span>}
                  </p>
                  <p className="truncate text-sm text-stone-500">{u.email?.endsWith("@pin.matur.id") ? `Kode staf: ${u.email.replace("@pin.matur.id", "")}` : u.email}</p>
                </div>
                {u.status !== "aktif" && <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">{u.status}</span>}
              </div>
              <div className="mt-3 rounded-xl bg-stone-50">
                {u.assignments.length === 0 && <p className="px-3 py-2 text-sm text-stone-400">Belum punya peran</p>}
                {u.assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 border-b border-stone-200/70 px-3 py-2 last:border-0">
                    <span className="size-2 shrink-0 rounded-full bg-matur-400" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">{ROLES[a.peran as Role].label}</p>
                      <p className="text-xs text-stone-500">{outletName(a.outlet_id)}</p>
                    </div>
                    <button title="Cabut peran" onClick={() => setRemoving({ a, nama: u.nama })} className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <button onClick={() => setAdding(u)} className="rounded-lg border border-matur-300 py-2 font-medium text-matur-700">
                  + Peran
                </button>
                <button
                  onClick={() => setResetting({ u, role: (u.assignments.find((a) => isPin(a.peran))?.peran ?? "owner") as Role })}
                  className="rounded-lg border border-stone-300 py-2 text-stone-700"
                >
                  {u.email?.endsWith("@pin.matur.id") ? "Ganti PIN" : "Password"}
                </button>
                {u.id !== meId && (u.status === "aktif" || u.status === "nonaktif") ? (
                  <button
                    disabled={busy}
                    onClick={() => run(() => setUserStatus(u.id, u.status === "aktif" ? "nonaktif" : "aktif"))}
                    className={`rounded-lg border py-2 ${u.status === "aktif" ? "border-red-200 text-red-600" : "border-green-300 text-green-700"}`}
                  >
                    {u.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                ) : (
                  <span />
                )}
              </div>
              {isOwner && u.id !== meId && !u.assignments.some((a) => a.peran === "owner") && (
                <button onClick={() => setHapus(u)} className="mt-2 w-full rounded-lg py-1.5 text-xs text-red-600 hover:bg-red-50">
                  🗑 Hapus akun
                </button>
              )}
            </li>
          ))}
      </ul>
      {aktif.length === 0 && <p className="text-center text-sm text-stone-400">Tidak ada pengguna di kategori ini.</p>}
      </>
      )}

      {removing && (
        <DeleteTwoStepDialog
          name={`${ROLES[removing.a.peran as Role].label} ${removing.nama}`}
          onCancel={() => setRemoving(null)}
          onConfirm={() => run(() => removeAssignment(removing.a.id))}
        />
      )}
      {hapus && (
        <DeleteTwoStepDialog name={hapus.nama} onCancel={() => setHapus(null)} onConfirm={() => run(() => hapusPengguna(hapus.id))} />
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
      {adding && <AddRoleDialog user={adding} outlets={outlets} roleKeys={roleKeys} busy={busy} onCancel={() => setAdding(null)} onSave={(r, o) => run(() => addAssignment(adding.id, r, o))} />}
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

function AddRoleDialog({ user, outlets, roleKeys, busy, onCancel, onSave }: { user: UserRow; outlets: Outlet[]; roleKeys: Role[]; busy: boolean; onCancel: () => void; onSave: (r: Role, o: string | null) => void }) {
  const [role, setRole] = useState<Role>(roleKeys.includes("spv") ? "spv" : roleKeys[0]);
  const [outlet, setOutlet] = useState(outlets[0]?.id ?? "");
  return (
    <Modal title={`Tambah peran untuk ${user.nama}`}>
      <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={cls}>
        {roleKeys.map((r) => (
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
  roleKeys,
  busy,
  onRun,
}: {
  users: UserRow[];
  outlets: Outlet[];
  isOwner: boolean;
  roleKeys: Role[];
  busy: boolean;
  onRun: (fn: () => Promise<Result>) => void;
}) {
  if (!users.length) return null;
  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <h2 className="mb-3 font-bold">Pendaftar menunggu persetujuan ({users.length})</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {users.map((u) => (
          <PendingCard key={u.id} u={u} outlets={outlets} isOwner={isOwner} roleKeys={roleKeys} busy={busy} onRun={onRun} />
        ))}
      </div>
    </section>
  );
}

function PendingCard({ u, outlets, isOwner, roleKeys, busy, onRun }: { u: UserRow; outlets: Outlet[]; isOwner: boolean; roleKeys: Role[]; busy: boolean; onRun: (fn: () => Promise<Result>) => void }) {
  const [role, setRole] = useState<Role | "">("");
  const [outlet, setOutlet] = useState("");
  const pilihan = roleKeys.filter((r) => isOwner || r !== "owner");
  return (
    <div className="rounded-xl border bg-white p-3 text-sm">
      <p className="font-semibold">{u.nama}</p>
      <p className="text-stone-600">{u.email}{u.no_hp && ` · ${u.no_hp}`}</p>
      {u.permintaan?.jenis === "staf_outlet" && <span className="mt-1 inline-block rounded-md bg-matur-100 px-2 py-0.5 text-xs font-semibold text-kopi-700">Karyawan outlet (kasir/barista)</span>}
      {u.permintaan?.catatan && <p className="mt-1 text-xs text-stone-500">Keterangan: “{u.permintaan.catatan}”</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-lg border px-2 py-1.5">
          <option value="">— tentukan peran —</option>
          {pilihan.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
        </select>
        {!role ? (
          <span />
        ) : ROLES[role].allOutlets ? (
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
          disabled={busy || !role || (!ROLES[role].allOutlets && !outlet)}
          onClick={() => role && onRun(() => approveUser(u.id, role, outlet || null))}
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
