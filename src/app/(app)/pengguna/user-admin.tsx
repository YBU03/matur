"use client";

import { useRouter } from "next/navigation";
import { UsersTable } from "./users-table";
import { UserEditor } from "./user-editor";
import { filterPengguna, type GroupMode } from "@/lib/pengguna-table";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { UserDeletePanel } from "./user-delete-panel";
import { CreateFeedback } from "./create-feedback";
import { DeleteTwoStepDialog } from "@/components/delete-two-step";
import { Modal } from "@/components/confirm-edit";
import {
  addAssignment,
  approveUser,
  createUser,
  rejectUser,
  removeAssignment,
  resetSecret,
  setUserStatus,
  type Result,
} from "@/lib/pengguna-actions";
import { ROLES, type Role } from "@/lib/roles";
import {
  Badge,
  BarisAngka,
  HeaderHalaman,
  KartuAngka,
  isian,
  tabKelas,
  tombolHeaderUtama,
} from "@/components/ui-halaman";

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

export function UserAdmin({
  users,
  outlets,
  isOwner,
  staf = false,
  meId,
}: {
  users: UserRow[];
  outlets: Outlet[];
  isOwner: boolean;
  staf?: boolean;
  meId: string;
}) {
  // HRD & Admin Gudang hanya bisa memberi peran kasir/barista
  const router = useRouter();
  const roleKeys: Role[] = (
    staf ? (["kasir", "barista"] as Role[]) : ROLE_KEYS
  ).filter((r) => r !== "tablet");
  const [groupMode, setGroupMode] = useState<GroupMode>("peran");
  const [roleFilter, setRoleFilter] = useState("");
  const [editor, setEditor] = useState<{
    id: string;
    kind: "detail" | "akses" | "status" | "aksi";
  } | null>(null);
  const [review, setReview] = useState<UserRow | null>(null);
  const bisaBuat = isOwner || staf;
  const [state, setCreateState] = useState<Result>({});
  const [pending, startCreate] = useTransition();
  const creating = useRef(false);
  const [feedback, setFeedback] = useState<"loading" | "success" | null>(null);
  const [role, setRole] = useState<Role>("kasir");
  const [msg, setMsg] = useState<Result | null>(null);
  const [removing, setRemoving] = useState<{ a: Assign; nama: string } | null>(
    null,
  );
  const [resetting, setResetting] = useState<{ u: UserRow; role: Role } | null>(
    null,
  );
  const [adding, setAdding] = useState<UserRow | null>(null);
  const [hapus, setHapus] = useState<UserRow | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [busy, start] = useTransition();
  const [q, setQ] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [buat, setBuat] = useState(false);
  const jumlah = (st: string) => users.filter((u) => u.status === st).length;
  const [tab, setTab] = useState<string>("semua");
  const visibleUsers = filterPengguna(users, {
    status: tab,
    query: q,
    outlet: outletFilter,
    role: roleFilter,
  });
  const hitungPeran = (rs: string[]) =>
    users.filter(
      (u) =>
        u.status === "aktif" && u.assignments.some((a) => rs.includes(a.peran)),
    ).length;
  const outletName = (id: string | null) =>
    id ? (outlets.find((o) => o.id === id)?.nama ?? "-") : "Semua Outlet";
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      let r: Result;
      try {
        r = await fn();
      } catch {
        r = {
          error: "Koneksi terputus. Periksa daftar sebelum mencoba kembali.",
        };
      }
      setMsg(r);
      if (!r.error) {
        setRemoving(null);
        setResetting(null);
        setAdding(null);
        setHapus(null);
        setReview(null);
        router.refresh();
      }
    });

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating.current) return;
    const data = new FormData(event.currentTarget);
    creating.current = true;
    setCreateState({});
    setFeedback("loading");
    startCreate(async () => {
      try {
        const result = await createUser({}, data);
        setCreateState(result);
        if (result.error || !result.ok) {
          setFeedback(null);
        } else {
          setBuat(false);
          setRole("kasir");
          setTab("aktif");
          setQ("");
          setOutletFilter("");
          setFeedback("success");
        }
      } catch {
        setCreateState({
          error:
            "Pembuatan akun belum dapat dikonfirmasi. Periksa koneksi dan daftar pengguna sebelum mencoba lagi.",
        });
        setFeedback(null);
      } finally {
        creating.current = false;
      }
    });
  };

  return (
    <div className="space-y-6">
      <HeaderHalaman
        judul="Pengguna Matoer"
        ikon="👥"
        keterangan={
          staf
            ? "Kelola akun pribadi karyawan dan penugasan outlet. Login POS outlet dikelola terpisah melalui menu Akses Kasir POS Outlet."
            : "Kelola akun, peran, dan akses outlet seluruh tim Matoer."
        }
        aksi={
          bisaBuat && !buat ? (
            <button
              onClick={() => {
                setCreateState({});
                setBuat(true);
              }}
              className={tombolHeaderUtama}
            >
              + Buat akun baru
            </button>
          ) : undefined
        }
      ></HeaderHalaman>

      <BarisAngka>
        <KartuAngka
          label="Total pengguna"
          nilai={users.length}
          ikon="👥"
          sub={`${jumlah("aktif")} aktif`}
        />
        <KartuAngka
          label="Menunggu persetujuan"
          nilai={jumlah("menunggu")}
          ikon="⏳"
          nada="kuning"
          sub={jumlah("menunggu") ? "perlu ditinjau" : "tidak ada antrean"}
        />
        <KartuAngka
          label="Nonaktif / ditolak"
          nilai={jumlah("nonaktif") + jumlah("ditolak")}
          ikon="🚫"
          nada="merah"
          sub={`${jumlah("nonaktif")} nonaktif · ${jumlah("ditolak")} ditolak`}
        />
        <KartuAngka
          label="Staf outlet"
          nilai={hitungPeran(["spv", "kasir", "barista"])}
          ikon="☕"
          nada="biru"
          sub="SPV, kasir & barista"
        />
      </BarisAngka>

      <section className="grid gap-3 rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-medium text-stone-500">
          Cari pengguna
          <input
            aria-label="Cari pengguna"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nama atau email…"
            className={`${cls} w-full`}
          />
        </label>
        <label className="text-xs font-medium text-stone-500">
          Outlet
          <select
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            className={cls}
          >
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-stone-500">
          Peran
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={cls}
          >
            <option value="">Semua peran</option>
            {roleKeys.map((r) => (
              <option key={r} value={r}>
                {ROLES[r].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-stone-500">
          Kelompokkan
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            className={cls}
          >
            <option value="peran">Berdasarkan peran</option>
            <option value="outlet">Berdasarkan outlet</option>
            <option value="semua">Tanpa kelompok</option>
          </select>
        </label>
      </section>
      {bisaBuat && buat && (
        <form
          onSubmit={submitCreate}
          aria-busy={pending}
          className="grid gap-3 rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-5"
        >
          <fieldset disabled={pending} className="contents">
            <p className="flex items-center font-bold text-kopi-900 sm:col-span-2 lg:col-span-5">
              <span className="mr-auto">➕ Buat akun baru</span>
              <button
                type="button"
                onClick={() => setBuat(false)}
                className="rounded-lg px-2 py-1 text-sm font-normal text-stone-500 hover:bg-stone-100"
              >
                Tutup ✕
              </button>
            </p>
            <label className="text-sm font-medium">
              Nama
              <input name="nama" required className={cls} />
            </label>
            <label className="text-sm font-medium">
              Peran
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={cls}
              >
                {roleKeys.map((r) => (
                  <option key={r} value={r}>
                    {ROLES[r].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Email login HP
              <input
                name="login"
                required
                type="email"
                placeholder="nama@email.com"
                className={cls}
              />
            </label>
            <label className="text-sm font-medium">
              Password akun (min. 8 karakter)
              <input
                name="secret"
                required
                type="password"
                minLength={8}
                className={cls}
              />
            </label>
            {isPin(role) && (
              <>
                <label className="text-sm font-medium">
                  Kode staf POS
                  <input
                    name="kode_staf"
                    required
                    minLength={3}
                    maxLength={60}
                    className={cls}
                  />
                </label>
                <label className="text-sm font-medium">
                  PIN POS terpisah
                  <input
                    name="pin_pos"
                    required
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4,6}"
                    className={cls}
                  />
                </label>
              </>
            )}
            <label className="text-sm font-medium">
              Outlet
              <select
                name="outlet"
                disabled={ROLES[role].allOutlets}
                className={cls}
              >
                {ROLES[role].allOutlets ? (
                  <option>Semua Outlet</option>
                ) : (
                  <>
                    {ROLES[role].outletOpsional && (
                      <option value="">Semua outlet</option>
                    )}
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
              <button
                disabled={pending}
                className="rounded-xl bg-matur-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-matur-600 disabled:opacity-60"
              >
                {pending ? "Membuat…" : "+ Buat Akun"}
              </button>
              {state.error && (
                <span role="alert" className="text-sm text-red-600">
                  {state.error}
                </span>
              )}
            </div>
          </fieldset>
        </form>
      )}
      {feedback && (
        <CreateFeedback
          status={feedback}
          message={state.ok}
          onClose={() => setFeedback(null)}
        />
      )}

      {msg && (
        <p
          className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}

      <nav className={tabKelas.wadah}>
        {[
          ["semua", "Semua"],
          ["menunggu", "⏳ Menunggu"],
          ["aktif", "✅ Aktif"],
          ["nonaktif", "🚫 Nonaktif"],
          ["ditolak", "✕ Ditolak"],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k);
              setQ("");
            }}
            className={tab === k ? tabKelas.aktif : tabKelas.pasif}
          >
            {l}{" "}
            <span
              className={`ml-0.5 rounded-full px-1.5 text-xs ${k === "menunggu" && jumlah(k) ? "bg-amber-400 text-kopi-900" : "bg-stone-200/70 text-stone-600"}`}
            >
              {k === "semua" ? users.length : jumlah(k)}
            </span>
          </button>
        ))}
      </nav>

      {isOwner ? (
        <UserDeletePanel
          visible={visibleUsers}
          meId={meId}
          single={hapus}
          onCloseSingle={() => setHapus(null)}
          selecting={selecting}
          setSelecting={setSelecting}
          scope={JSON.stringify([tab, q, outletFilter, roleFilter, groupMode])}
        >
          {(selection) => (
            <UsersTable
              key={JSON.stringify([
                tab,
                q,
                outletFilter,
                roleFilter,
                groupMode,
              ])}
              users={visibleUsers}
              mode={groupMode}
              outletName={outletName}
              selection={selection}
              onOpen={(u, kind) =>
                u.status === "menunggu"
                  ? setReview(u)
                  : setEditor({ id: u.id, kind })
              }
            />
          )}
        </UserDeletePanel>
      ) : (
        <UsersTable
          key={JSON.stringify([tab, q, outletFilter, roleFilter, groupMode])}
          users={visibleUsers}
          mode={groupMode}
          outletName={outletName}
          onOpen={(u, kind) =>
            u.status === "menunggu"
              ? setReview(u)
              : setEditor({ id: u.id, kind })
          }
        />
      )}
      {editor && users.find((u) => u.id === editor.id) && (
        <UserEditor
          key={editor.id + editor.kind}
          user={users.find((u) => u.id === editor.id)!}
          kind={editor.kind}
          roleKeys={roleKeys}
          outlets={outlets}
          isOwner={isOwner}
          staf={staf}
          meId={meId}
          onClose={() => setEditor(null)}
          onSaved={(r) => {
            setMsg(r);
            setEditor(null);
            router.refresh();
          }}
          onAdd={() => {
            setAdding(users.find((u) => u.id === editor.id)!);
            setEditor(null);
          }}
          onRemove={(a) => {
            setRemoving({
              a,
              nama: users.find((u) => u.id === editor.id)!.nama,
            });
            setEditor(null);
          }}
          onReset={() => {
            const u = users.find((u) => u.id === editor.id)!;
            setResetting({
              u,
              role: u.email?.endsWith("@pin.matur.id") ? "barista" : "owner",
            });
            setEditor(null);
          }}
          onDelete={() => {
            setHapus(users.find((u) => u.id === editor.id)!);
            setEditor(null);
          }}
        />
      )}
      {review && (
        <Modal
          title="Tinjau pendaftaran"
          scrollable
          mobileSheet
          onClose={() => !busy && setReview(null)}
        >
          <PendingCard
            u={review}
            outlets={outlets}
            isOwner={isOwner}
            roleKeys={roleKeys}
            busy={busy}
            onRun={run}
          />
        </Modal>
      )}

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
          onSave={(v) =>
            run(() => resetSecret(resetting.u.id, resetting.role, v))
          }
        />
      )}
      {adding && (
        <AddRoleDialog
          user={adding}
          outlets={outlets}
          roleKeys={roleKeys}
          busy={busy}
          error={msg?.error}
          onCancel={() => setAdding(null)}
          onSave={(r, o) => run(() => addAssignment(adding.id, r, o))}
        />
      )}
    </div>
  );
}

function SecretDialog({
  title,
  pin,
  busy,
  onCancel,
  onSave,
}: {
  title: string;
  pin: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <Modal title={title}>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        type="password"
        inputMode={pin ? "numeric" : undefined}
        className={cls}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Batal
        </button>
        <button
          disabled={busy || !v}
          onClick={() => onSave(v)}
          className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Simpan
        </button>
      </div>
    </Modal>
  );
}

function AddRoleDialog({
  user,
  outlets,
  roleKeys,
  busy,
  error,
  onCancel,
  onSave,
}: {
  user: UserRow;
  outlets: Outlet[];
  roleKeys: Role[];
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (r: Role, o: string | null) => void;
}) {
  const [role, setRole] = useState<Role>(
    roleKeys.includes("spv") ? "spv" : roleKeys[0],
  );
  const [outlet, setOutlet] = useState(outlets[0]?.id ?? "");
  return (
    <Modal
      title={`Tambah peran untuk ${user.nama}`}
      scrollable
      mobileSheet
      onClose={() => !busy && onCancel()}
    >
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className={cls}
      >
        {roleKeys.map((r) => (
          <option key={r} value={r}>
            {ROLES[r].label}
          </option>
        ))}
      </select>
      {!ROLES[role].allOutlets && (
        <select
          value={outlet}
          onChange={(e) => setOutlet(e.target.value)}
          className={cls}
        >
          {ROLES[role].outletOpsional && <option value="">Semua outlet</option>}
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Batal
        </button>
        <button
          disabled={busy}
          onClick={() =>
            onSave(role, ROLES[role].allOutlets ? null : outlet || null)
          }
          className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Tambah
        </button>
      </div>
    </Modal>
  );
}

function PendingCard({
  u,
  outlets,
  isOwner,
  roleKeys,
  busy,
  onRun,
}: {
  u: UserRow;
  outlets: Outlet[];
  isOwner: boolean;
  roleKeys: Role[];
  busy: boolean;
  onRun: (fn: () => Promise<Result>) => void;
}) {
  const [role, setRole] = useState<Role | "">("");
  const [outlet, setOutlet] = useState("");
  const pilihan = roleKeys.filter((r) => isOwner || r !== "owner");
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 text-sm shadow-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-kopi-900">
        {u.nama} <Badge nada="kuning">menunggu</Badge>
      </p>
      <p className="text-stone-600">
        {u.email}
        {u.no_hp && ` · ${u.no_hp}`}
      </p>
      {u.permintaan?.jenis === "staf_outlet" && (
        <span className="mt-1 inline-block">
          <Badge>☕ Karyawan outlet (kasir/barista)</Badge>
        </span>
      )}
      {u.permintaan?.catatan && (
        <p className="mt-1 text-xs text-stone-500">
          Keterangan: “{u.permintaan.catatan}”
        </p>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className={isian}
        >
          <option value="">— tentukan peran —</option>
          {pilihan.map((r) => (
            <option key={r} value={r}>
              {ROLES[r].label}
            </option>
          ))}
        </select>
        {!role ? (
          <span />
        ) : ROLES[role].allOutlets ? (
          <span className="self-center text-xs text-stone-500">
            Akses semua outlet
          </span>
        ) : (
          <select
            value={outlet}
            onChange={(e) => setOutlet(e.target.value)}
            className={isian}
          >
            <option value="">
              {ROLES[role].outletOpsional ? "Semua outlet" : "— pilih outlet —"}
            </option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          disabled={
            busy ||
            !role ||
            (!ROLES[role].allOutlets && !ROLES[role].outletOpsional && !outlet)
          }
          onClick={() =>
            role && onRun(() => approveUser(u.id, role, outlet || null))
          }
          className="flex-1 rounded-xl bg-emerald-600 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          Setujui
        </button>
        <button
          disabled={busy}
          onClick={() => onRun(() => rejectUser(u.id))}
          className="rounded-xl border border-red-200 px-4 py-2 font-medium text-red-600 hover:bg-red-50"
        >
          Tolak
        </button>
      </div>
      <p className="mt-1 text-xs text-stone-400">
        Outlet tambahan bisa ditambahkan lewat “+ peran” setelah disetujui.
      </p>
    </div>
  );
}
