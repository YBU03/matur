"use client";
import { useState } from "react";
import type { UserRow } from "./user-admin";
import { ROLES, type Role } from "@/lib/roles";
import { groupPengguna, type GroupMode } from "@/lib/pengguna-table";
import type { UserSelection } from "./user-delete-panel";
const roleLabel = (r: string) => ROLES[r as Role]?.label ?? r;
const statusColor: Record<string, string> = {
  aktif: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  menunggu: "bg-amber-50 text-amber-800 ring-amber-200",
  nonaktif: "bg-stone-100 text-stone-600 ring-stone-200",
  ditolak: "bg-red-50 text-red-700 ring-red-200",
};
export function UsersTable({
  users,
  outletName,
  mode,
  onOpen,
  selection,
}: {
  users: UserRow[];
  outletName: (id: string | null) => string;
  mode: GroupMode;
  onOpen: (u: UserRow, field: "detail" | "akses" | "status" | "aksi") => void;
  selection?: UserSelection;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const size = 15;
  const pages = Math.max(1, Math.ceil(users.length / size));
  const current = Math.min(page, pages);
  const slice = users.slice((current - 1) * size, current * size);
  const groups = groupPengguna(slice, mode, roleLabel, outletName);
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-matur-200 bg-white shadow-[0_8px_32px_-24px_#6b3b13]">
      <div className="flex items-center justify-between gap-2 border-b border-matur-100 px-4 py-3">
        <h2 className="shrink-0 font-bold text-kopi-900">
          Daftar pengguna{" "}
          <span className="ml-1 rounded-full bg-matur-50 px-2 py-0.5 text-xs text-kopi-700">
            {users.length}
          </span>
        </h2>
        <span className="hidden text-xs text-stone-500 sm:inline">
          Klik untuk melihat / mengedit
        </span>
      </div>
      {!users.length && (
        <p className="p-8 text-center text-sm text-stone-500">
          Tidak ada pengguna sesuai filter.
        </p>
      )}
      {groups.map((g) => (
        <div key={g.key} className="border-b border-matur-100 last:border-b-0">
          <button
            type="button"
            aria-expanded={!collapsed.has(g.key)}
            className="flex w-full items-center gap-2 bg-[#fffaf0] px-4 py-3 text-left text-sm font-semibold text-kopi-800 hover:bg-matur-50"
            onClick={() =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(g.key)) next.delete(g.key);
                else next.add(g.key);
                return next;
              })
            }
          >
            <span
              aria-hidden
              className={`text-matur-600 transition-transform motion-reduce:transition-none ${collapsed.has(g.key) ? "" : "rotate-90"}`}
            >
              ▸
            </span>
            {g.label}
            <span className="rounded-full border border-matur-200 bg-white px-2 text-xs text-stone-500">
              {g.users.length}
            </span>
          </button>
          {!collapsed.has(g.key) && (
            <table className="w-full table-fixed text-sm">
              <caption className="sr-only">Pengguna {g.label}</caption>
              <thead className="border-b border-stone-100 bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                <tr>
                  {selection && (
                    <th className="w-10 px-3 py-3">
                      <span className="sr-only">Pilih pengguna</span>
                    </th>
                  )}
                  <th className="px-3 py-3 sm:w-[32%]">Pengguna</th>
                  <th className="hidden w-[24%] px-3 py-3 md:table-cell">
                    Peran
                  </th>
                  <th className="hidden w-[23%] px-3 py-3 lg:table-cell">
                    Outlet
                  </th>
                  <th className="w-24 px-2 py-3">Status</th>
                  <th className="w-12 px-1 py-3">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {g.users.map((u) => {
                  const roles = [...new Set(u.assignments.map((a) => a.peran))];
                  const outletIds = [
                    ...new Set(u.assignments.map((a) => a.outlet_id)),
                  ];
                  const selected = selection?.selected.includes(u.id);
                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors motion-reduce:transition-none hover:bg-matur-50/60 ${selected ? "bg-amber-50/80" : "bg-white"}`}
                    >
                      {selection && (
                        <td className="px-3 py-4 align-top">
                          <input
                            aria-label={`Pilih ${u.nama}`}
                            type="checkbox"
                            checked={!!selected}
                            disabled={!selection.canSelect(u)}
                            onChange={() => selection.toggle(u.id)}
                            className="mt-2 size-4 accent-orange-600"
                          />
                        </td>
                      )}
                      <td className="px-3 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => onOpen(u, "detail")}
                          className="flex w-full min-w-0 items-start gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-matur-500"
                        >
                          <span
                            aria-hidden
                            className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-matur-200 bg-gradient-to-br from-amber-50 to-orange-100 font-bold text-kopi-700 sm:flex"
                          >
                            {u.nama.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block break-words font-semibold text-kopi-900">
                              {u.nama}
                            </span>
                            <span
                              className="hidden truncate text-xs text-stone-500 sm:block"
                              title={u.email ?? ""}
                            >
                              {u.email?.endsWith("@pin.matur.id")
                                ? `Kode: ${u.email.replace("@pin.matur.id", "")}`
                                : (u.email ?? "Tanpa email")}
                            </span>
                            <span className="mt-1 block text-[11px] text-stone-500 md:hidden">
                              {roles.map(roleLabel).join(" · ") ||
                                "Belum ada peran"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="hidden px-3 py-4 align-top md:table-cell">
                        <button
                          type="button"
                          aria-label={`Edit peran ${u.nama}`}
                          onClick={() => onOpen(u, "akses")}
                          className="flex min-h-9 w-full flex-wrap gap-1 rounded-lg text-left hover:bg-matur-50"
                        >
                          {roles.length ? (
                            roles.map((r) => (
                              <span
                                key={r}
                                className="h-fit rounded-md border border-orange-100 bg-orange-50 px-2 py-1 text-[11px] font-medium text-kopi-700"
                              >
                                {roleLabel(r)}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-stone-400">
                              + Atur akses
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="hidden px-3 py-4 align-top lg:table-cell">
                        <button
                          type="button"
                          aria-label={`Edit outlet ${u.nama}`}
                          onClick={() => onOpen(u, "akses")}
                          className="min-h-9 w-full rounded-lg text-left text-xs text-stone-600 hover:bg-matur-50"
                        >
                          {outletIds.map((id) => outletName(id)).join(" · ") ||
                            "Belum ditentukan"}
                        </button>
                      </td>
                      <td className="px-2 py-4 align-top">
                        <button
                          type="button"
                          aria-label={`Edit status ${u.nama}`}
                          onClick={() => onOpen(u, "status")}
                          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${statusColor[u.status] ?? statusColor.nonaktif}`}
                        >
                          <span
                            aria-hidden
                            className="size-1.5 rounded-full bg-current"
                          />
                          {u.status}
                        </button>
                      </td>
                      <td className="px-1 py-3 align-top">
                        <button
                          type="button"
                          aria-label={`Aksi ${u.nama}`}
                          onClick={() => onOpen(u, "aksi")}
                          className="grid size-10 place-items-center rounded-xl text-xl text-stone-500 hover:bg-matur-100"
                        >
                          ⋯
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-matur-100 px-4 py-3 text-xs text-stone-500">
        <span>
          {users.length
            ? `${(current - 1) * size + 1}–${Math.min(current * size, users.length)}`
            : "0"}{" "}
          dari {users.length} pengguna
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Halaman sebelumnya"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            className="size-8 rounded-lg border bg-white disabled:opacity-30"
          >
            ‹
          </button>
          <span className="rounded-lg bg-kopi-900 px-3 py-2 font-semibold text-white">
            {current} / {pages}
          </span>
          <button
            type="button"
            aria-label="Halaman berikutnya"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
            className="size-8 rounded-lg border bg-white disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </footer>
    </section>
  );
}
