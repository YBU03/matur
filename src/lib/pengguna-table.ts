export type GroupMode = "peran" | "outlet" | "semua";
export type TableUser = {
  id: string;
  nama: string;
  email: string | null;
  status: string;
  assignments: { peran: string; outlet_id: string | null }[];
};
export function filterPengguna<T extends TableUser>(
  users: T[],
  f: { status: string; query: string; outlet: string; role: string },
) {
  const words = f.query
    .toLocaleLowerCase("id-ID")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return users.filter(
    (u) =>
      (f.status === "semua" || u.status === f.status) &&
      (!f.outlet || u.assignments.some((a) => a.outlet_id === f.outlet)) &&
      (!f.role || u.assignments.some((a) => a.peran === f.role)) &&
      words.every((w) =>
        `${u.nama} ${u.email ?? ""}`.toLocaleLowerCase("id-ID").includes(w),
      ),
  );
}
export function groupPengguna<T extends TableUser>(
  users: T[],
  mode: GroupMode,
  roleLabel: (v: string) => string,
  outletLabel: (v: string | null) => string,
) {
  const groups = new Map<string, { key: string; label: string; users: T[] }>();
  for (const u of users) {
    const values = [
      ...new Set(
        u.assignments.map((a) =>
          mode === "peran" ? a.peran : (a.outlet_id ?? "*"),
        ),
      ),
    ].sort();
    const key =
      mode === "semua"
        ? "semua"
        : values.length > 1
          ? "multi"
          : (values[0] ?? "kosong");
    const label =
      mode === "semua"
        ? "Semua pengguna"
        : key === "multi"
          ? mode === "peran"
            ? "Multi Peran"
            : "Beberapa Outlet"
          : key === "kosong"
            ? "Belum ada akses"
            : mode === "peran"
              ? roleLabel(key)
              : outletLabel(key === "*" ? null : key);
    if (!groups.has(key)) groups.set(key, { key, label, users: [] });
    groups.get(key)!.users.push(u);
  }
  return [...groups.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "id"),
  );
}

/** One row per barista, including unassigned and multi-outlet staff. */
export function groupBaristaByOutlet<T extends TableUser>(
  users: T[], outletLabel: (id: string | null) => string,
) {
  const groups = new Map<string, { key: string; label: string; users: T[] }>();
  for (const user of users) {
    const ids = [...new Set(user.assignments
      .filter((a) => a.peran === "barista" && a.outlet_id)
      .map((a) => a.outlet_id as string))];
    const key = ids.length > 1 ? "multi" : ids[0] ?? "unassigned";
    const label = key === "multi" ? "Beberapa outlet"
      : key === "unassigned" ? "Belum ditetapkan outlet" : outletLabel(key);
    if (!groups.has(key)) groups.set(key, { key, label, users: [] });
    groups.get(key)!.users.push(user);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "id"));
}

/** Group before pagination so outlet sections stay contiguous on later pages. */
export function orderPenggunaForTable<T extends TableUser>(
  users: T[], mode: GroupMode, roleLabel: (id: string) => string,
  outletLabel: (id: string | null) => string,
) {
  return groupPengguna(users, mode, roleLabel, outletLabel).flatMap((group) =>
    mode === "peran" && group.key === "barista"
      ? groupBaristaByOutlet(group.users, outletLabel).flatMap((outlet) => outlet.users)
      : group.users,
  );
}
