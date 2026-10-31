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
