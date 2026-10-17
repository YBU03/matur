"use client";

import { useActionState, useState, useTransition } from "react";
import { DeleteTwoStepDialog } from "@/components/delete-two-step";
import { Modal } from "@/components/confirm-edit";
import { addAssignment, approveUser, createUser, hapusPengguna, rejectUser, removeAssignment, resetSecret, setUserStatus, type Result } from "@/lib/pengguna-actions";
import { ROLES, type Role } from "@/lib/roles";
import { Badge, BarisAngka, ChipHeader, HeaderHalaman, KartuAngka, Kosong, isian, tabKelas, tombolHeaderUtama } from "@/components/ui-halaman";

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
const cls = `mt-1 w-full ${isian}`;

type Nada = "netral" | "hijau" | "kuning" | "merah" | "biru" | "ungu";
const NADA_PERAN: Partial<Record<Role, Nada>> = {
  owner: "ungu",
  manajer_area: "ungu",
  hrd: "biru",
  mitra: "biru",
  finance: "hijau",
  admin_pusat: "hijau",
  admin_gudang: "kuning",
  pic: "kuning",
  spv: "merah",
  pemantau_pos: "biru",
};
const nadaPeran = (r: string): Nada => NADA_PERAN[r as Role] ?? "netral";
const TITIK: Record<Nada, string> = {
  netral: "bg-stone-400",
  hijau: "bg-emerald-500",
  kuning: "bg-amber-500",
  merah: "bg-red-500",
  biru: "bg-sky-500",
  ungu: "bg-violet-500",
};
const NADA_STATUS: Record<string, Nada> = { aktif: "hijau", menunggu: "kuning", nonaktif: "merah", ditolak: "merah" };
const labelPeran = (r: string) => ROLES[r as Role]?.label ?? r;

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
  const [outletFilter,setOutletFilter]=useState("");
  const [buat, setBuat] = useState(false);
  const jumlah = (st: string) => users.filter((u) => u.status === st).length;
  const [tab, setTab] = useState<string>(users.some((u) => u.status === "menunggu") ? "menunggu" : "aktif");
  const aktif = users.filter((u) => u.status === tab && (!outletFilter||u.assignments.some(a=>a.outlet_id===outletFilter)));
  const hitungPeran = (rs: string[]) => users.filter((u) => u.status === "aktif" && u.assignments.some((a) => rs.includes(a.peran))).length;
  const perPeran = ROLE_KEYS.map((r) => [r, hitungPeran([r])] as const).filter(([, n]) => n > 0);
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
      <HeaderHalaman
        judul="Pengguna Matoer"
        ikon="👥"
        keterangan={staf ? "Kelola akun pribadi karyawan dan penugasan outlet. Login POS outlet dikelola terpisah melalui menu Akses Kasir POS Outlet." : "Kelola akun, peran, dan akses outlet seluruh tim Matoer."}
        aksi={
          bisaBuat && !buat ? (
            <button onClick={() => setBuat(true)} className={tombolHeaderUtama}>
              + Buat akun baru
            </button>
          ) : undefined
        }
      >
        {perPeran.map(([r, n]) => (
          <ChipHeader key={r}>
            {labelPeran(r)} · {n}
          </ChipHeader>
        ))}
      </HeaderHalaman>

      <BarisAngka>
        <KartuAngka label="Total pengguna" nilai={users.length} ikon="👥" sub={`${jumlah("aktif")} aktif`} />
        <KartuAngka label="Menunggu persetujuan" nilai={jumlah("menunggu")} ikon="⏳" nada="kuning" sub={jumlah("menunggu") ? "perlu ditinjau" : "tidak ada antrean"} />
        <KartuAngka label="Nonaktif / ditolak" nilai={jumlah("nonaktif") + jumlah("ditolak")} ikon="🚫" nada="merah" sub={`${jumlah("nonaktif")} nonaktif · ${jumlah("ditolak")} ditolak`} />
        <KartuAngka label="Staf outlet" nilai={hitungPeran(["spv", "kasir", "barista"])} ikon="☕" nada="biru" sub="SPV, kasir & barista" />
      </BarisAngka>

      <section className="flex flex-col gap-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2 text-sm font-medium text-stone-600">
          <span className="shrink-0">🏪 Outlet</span>
          <select value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} className={`${isian} w-full sm:w-56`}>
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.nama}</option>
            ))}
          </select>
        </label>
        {tab !== "menunggu" && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Cari nama / login…" className={`${isian} w-full sm:w-64`} />
        )}
      </section>
      {bisaBuat && buat && <form action={action} className="grid gap-3 rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-5">
        <p className="flex items-center font-bold text-kopi-900 sm:col-span-2 lg:col-span-5">
          <span className="mr-auto">➕ Buat akun baru</span>
          <button type="button" onClick={() => setBuat(false)} className="rounded-lg px-2 py-1 text-sm font-normal text-stone-500 hover:bg-stone-100">Tutup ✕</button>
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
          Email login HP
          <input name="login" required type="email" placeholder="nama@email.com" className={cls} />
        </label>
        <label className="text-sm font-medium">
          Password akun (min. 8 karakter)
          <input name="secret" required type="password" minLength={8} className={cls} />
        </label>
        {isPin(role)&&<><label className="text-sm font-medium">Kode staf POS<input name="kode_staf" required minLength={3} maxLength={60} className={cls}/></label><label className="text-sm font-medium">PIN POS terpisah<input name="pin_pos" required type="password" inputMode="numeric" pattern="[0-9]{4,6}" className={cls}/></label></>}
        <label className="text-sm font-medium">
          Outlet
          <select name="outlet" disabled={ROLES[role].allOutlets} className={cls}>
            {ROLES[role].allOutlets ? (
              <option>Semua Outlet</option>
            ) : (
              <>
                {ROLES[role].outletOpsional && <option value="">Semua outlet</option>}
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nama}
                  </option>
                ))}
              </>
            )}
          </select>
        </label>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-5">
          <button disabled={pending} className="rounded-xl bg-matur-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-matur-600 disabled:opacity-60">
            {pending ? "Membuat…" : "+ Buat Akun"}
          </button>
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
          {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        </div>
      </form>}

      {msg && <p className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.error ?? msg.ok}</p>}

      <nav className={tabKelas.wadah}>
        {[
          ["menunggu", "⏳ Menunggu"],
          ["aktif", "✅ Aktif"],
          ["nonaktif", "🚫 Nonaktif"],
          ["ditolak", "✕ Ditolak"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={tab === k ? tabKelas.aktif : tabKelas.pasif}>
            {l}{" "}
            <span className={`ml-0.5 rounded-full px-1.5 text-xs ${k === "menunggu" && jumlah(k) ? "bg-amber-400 text-kopi-900" : "bg-stone-200/70 text-stone-600"}`}>{jumlah(k)}</span>
          </button>
        ))}
      </nav>

      {tab === "menunggu" ? (
        jumlah("menunggu") ? (
          <Pending users={users.filter((u) => u.status === "menunggu")} outlets={outlets} isOwner={isOwner} roleKeys={roleKeys} busy={busy} onRun={run} />
        ) : (
          <Kosong ikon="🎉" judul="Tidak ada pendaftar yang menunggu persetujuan." />
        )
      ) : (
      <>
      <h2 className="flex items-center gap-2 text-base font-bold text-kopi-900">
        Pengguna {tab} <Badge nada={NADA_STATUS[tab] ?? "netral"}>{aktif.length}</Badge>
      </h2>
      <ul className="grid gap-3 lg:grid-cols-2">
        {aktif
          .filter((u) => !q || `${u.nama} ${u.email ?? ""}`.toLowerCase().includes(q.toLowerCase()))
          .map((u) => (
            <li key={u.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${u.status === "aktif" ? "border-matur-100" : "border-stone-200 opacity-80"}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-matur-100 to-matur-200 font-bold text-kopi-700">{u.nama.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-kopi-900">
                    {u.nama}
                    {u.id === meId && <span className="ml-1 text-xs font-normal text-stone-500">(Anda)</span>}
                  </p>
                  <p className="truncate text-sm text-stone-500">{u.email?.endsWith("@pin.matur.id") ? `Kode staf: ${u.email.replace("@pin.matur.id", "")}` : u.email}</p>
                </div>
                <Badge nada={NADA_STATUS[u.status] ?? "netral"}>{u.status}</Badge>
              </div>
              <div className="mt-3 rounded-xl border border-stone-100 bg-stone-50/70">
                {u.assignments.length === 0 && <p className="px-3 py-2 text-sm text-stone-400">Belum punya peran</p>}
                {u.assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 border-b border-stone-200/70 px-3 py-2 last:border-0">
                    <span className={`size-2 shrink-0 rounded-full ${TITIK[nadaPeran(a.peran)]}`} />
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                      <Badge nada={nadaPeran(a.peran)}>{labelPeran(a.peran)}</Badge>
                      <span className="truncate text-xs text-stone-500">🏪 {outletName(a.outlet_id)}</span>
                    </div>
                    <button title="Cabut peran" onClick={() => setRemoving({ a, nama: u.nama })} className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <button onClick={() => setAdding(u)} className="rounded-xl border border-matur-200 py-2 font-semibold text-matur-700 hover:bg-matur-50">
                  + Peran
                </button>
                <button
                  onClick={() => setResetting({ u, role: (u.assignments.find((a) => isPin(a.peran))?.peran ?? "owner") as Role })}
                  className="rounded-xl border border-stone-200 py-2 font-medium text-stone-700 hover:bg-stone-50"
                >
                  {u.email?.endsWith("@pin.matur.id") ? "Ganti PIN" : "Password"}
                </button>
                {u.id !== meId && (u.status === "aktif" || u.status === "nonaktif") ? (
                  <button
                    disabled={busy}
                    onClick={() => run(() => setUserStatus(u.id, u.status === "aktif" ? "nonaktif" : "aktif"))}
                    className={`rounded-xl border py-2 font-medium ${u.status === "aktif" ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                  >
                    {u.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                ) : (
                  <span />
                )}
              </div>
              {isOwner && u.id !== meId && !u.assignments.some((a) => a.peran === "owner") && (
                <button disabled={busy} onClick={() => { setMsg(null); setHapus(u); }} className="mt-3 w-full rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                  Hapus akun
                </button>
              )}
            </li>
          ))}
      </ul>
      {aktif.length === 0 && <Kosong ikon="👤" judul="Tidak ada pengguna di kategori ini." />}
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
        <Modal title="Hapus pengguna" onClose={busy ? undefined : () => setHapus(null)}>
          <p className="text-sm">Yakin ingin menghapus pengguna <strong>{hapus.nama}</strong>?</p>
          <p className="mt-2 text-sm text-stone-500">Akses login pengguna akan dicabut. Riwayat absensi, transaksi, dan penggajian tetap disimpan.</p>
          {msg?.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg.error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button disabled={busy} onClick={() => setHapus(null)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Batal</button>
            <button disabled={busy} onClick={() => start(async () => {
              try {
                const r = await hapusPengguna(hapus.id);
                setMsg(r);
                if (!r.error) setHapus(null);
              } catch { setMsg({ error: "Penghapusan belum dapat dikonfirmasi. Periksa koneksi lalu coba lagi." }); }
            })} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Menghapus…" : "Ya, Hapus"}</button>
          </div>
        </Modal>
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
          {ROLES[role].outletOpsional && <option value="">Semua outlet</option>}
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>{o.nama}</option>
          ))}
        </select>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
        <button disabled={busy} onClick={() => onSave(role, ROLES[role].allOutlets ? null : outlet || null)} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white">Tambah</button>
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
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 font-bold text-kopi-900">⏳ Pendaftar menunggu persetujuan <Badge nada="kuning">{users.length}</Badge></h2>
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
    <div className="rounded-2xl border border-amber-100 bg-white p-4 text-sm shadow-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-kopi-900">{u.nama} <Badge nada="kuning">menunggu</Badge></p>
      <p className="text-stone-600">{u.email}{u.no_hp && ` · ${u.no_hp}`}</p>
      {u.permintaan?.jenis === "staf_outlet" && <span className="mt-1 inline-block"><Badge>☕ Karyawan outlet (kasir/barista)</Badge></span>}
      {u.permintaan?.catatan && <p className="mt-1 text-xs text-stone-500">Keterangan: “{u.permintaan.catatan}”</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={isian}>
          <option value="">— tentukan peran —</option>
          {pilihan.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
        </select>
        {!role ? (
          <span />
        ) : ROLES[role].allOutlets ? (
          <span className="self-center text-xs text-stone-500">Akses semua outlet</span>
        ) : (
          <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={isian}>
            <option value="">{ROLES[role].outletOpsional ? "Semua outlet" : "— pilih outlet —"}</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
          </select>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          disabled={busy || !role || (!ROLES[role].allOutlets && !ROLES[role].outletOpsional && !outlet)}
          onClick={() => role && onRun(() => approveUser(u.id, role, outlet || null))}
          className="flex-1 rounded-xl bg-emerald-600 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          Setujui
        </button>
        <button disabled={busy} onClick={() => onRun(() => rejectUser(u.id))} className="rounded-xl border border-red-200 px-4 py-2 font-medium text-red-600 hover:bg-red-50">
          Tolak
        </button>
      </div>
      <p className="mt-1 text-xs text-stone-400">Outlet tambahan bisa ditambahkan lewat “+ peran” setelah disetujui.</p>
    </div>
  );
}
