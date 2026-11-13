import { it, expect } from "vitest";
import {
  filterPengguna,
  groupPengguna,
  type TableUser,
} from "../pengguna-table";
const users: TableUser[] = [
  {
    id: "1",
    nama: "Andi",
    email: "andi@test.id",
    status: "aktif",
    assignments: [
      { peran: "barista", outlet_id: "a" },
      { peran: "kasir", outlet_id: "a" },
    ],
  },
  {
    id: "2",
    nama: "Sakti",
    email: null,
    status: "nonaktif",
    assignments: [
      { peran: "barista", outlet_id: "a" },
      { peran: "barista", outlet_id: "b" },
    ],
  },
  {
    id: "3",
    nama: "Admin",
    email: "admin@test.id",
    status: "aktif",
    assignments: [{ peran: "hrd", outlet_id: null }],
  },
  {
    id: "4",
    nama: "Pendaftar",
    email: "baru@test.id",
    status: "menunggu",
    assignments: [],
  },
];
it("groups by role without duplicating multi-role users", () => {
  const groups = groupPengguna(
    users,
    "peran",
    (r) => r,
    (o) => o ?? "Semua",
  );
  expect(
    groups
      .flatMap((g) => g.users)
      .map((u) => u.id)
      .sort(),
  ).toEqual(["1", "2", "3", "4"]);
  expect(groups.find((g) => g.key === "multi")?.users.map((u) => u.id)).toEqual(
    ["1"],
  );
});
it("outlet grouping handles multiple outlets, global access and missing access", () => {
  const groups = groupPengguna(
    users,
    "outlet",
    (r) => r,
    (o) => o ?? "Semua",
  );
  expect(groups.find((g) => g.key === "a")?.users.map((u) => u.id)).toEqual([
    "1",
  ]);
  expect(groups.find((g) => g.key === "multi")?.users.map((u) => u.id)).toEqual(
    ["2"],
  );
  expect(groups.find((g) => g.key === "*")?.users.map((u) => u.id)).toEqual([
    "3",
  ]);
  expect(
    groups.find((g) => g.key === "kosong")?.users.map((u) => u.id),
  ).toEqual(["4"]);
});
it("status, outlet, role and search filters compose without duplication", () => {
  expect(
    filterPengguna(users, {
      status: "semua",
      outlet: "a",
      role: "kasir",
      query: "ANDI test",
    }).map((u) => u.id),
  ).toEqual(["1"]);
  expect(
    filterPengguna(users, {
      status: "aktif",
      outlet: "b",
      role: "",
      query: "",
    }),
  ).toEqual([]);
  expect(
    filterPengguna(users, {
      status: "menunggu",
      outlet: "",
      role: "",
      query: "baru",
    }).map((u) => u.id),
  ).toEqual(["4"]);
  expect(
    groupPengguna(
      users,
      "semua",
      (r) => r,
      (o) => o ?? "Semua",
    ),
  ).toHaveLength(1);
});

it("barista outlet sections include new outlets and all statuses without duplicate rows", async () => {
  const { groupBaristaByOutlet } = await import("../pengguna-table");
  const barista = (id: string, outlet: string | null, status = "aktif"): TableUser => ({
    id, nama: id, email: null, status, assignments: [{ peran: "barista", outlet_id: outlet }],
  });
  const rows = [barista("UHB", "uhb"), barista("Kominot", "kominot", "nonaktif"),
    barista("Cabang baru", "new"), barista("Belum ditempatkan", null),
    { ...barista("Lintas outlet", "uhb"), assignments: [
      { peran: "barista", outlet_id: "uhb" }, { peran: "barista", outlet_id: "kominot" },
      { peran: "barista", outlet_id: "uhb" },
    ] }];
  const groups = groupBaristaByOutlet(rows, (id) => ({uhb:"Ruma UHB",kominot:"Ruma Kominot",new:"Outlet Baru"})[id!]!);
  expect(groups.map((g) => g.label)).toEqual(["Beberapa outlet", "Belum ditetapkan outlet", "Outlet Baru", "Ruma Kominot", "Ruma UHB"]);
  expect(groups.flatMap((g) => g.users).map((u) => u.id).sort()).toEqual(rows.map((u) => u.id).sort());
  expect(groups.find((g) => g.key === "kominot")?.users[0].status).toBe("nonaktif");
});

it("orders outlet groups before pagination and keeps every user exactly once", async () => {
  const { orderPenggunaForTable, groupPengguna } = await import("../pengguna-table");
  const rows: TableUser[] = Array.from({length: 32}, (_, i) => ({
    id: String(i), nama: `Barista ${i}`, email: null, status: "aktif",
    assignments: [{peran: "barista", outlet_id: i % 2 ? "uhb" : "kominot"}],
  }));
  const ordered = orderPenggunaForTable(rows, "peran", (r) => r, (id) => id!);
  expect(ordered.slice(0,16).every((u) => u.assignments[0].outlet_id === "kominot")).toBe(true);
  expect(ordered.slice(16).every((u) => u.assignments[0].outlet_id === "uhb")).toBe(true);
  expect(new Set(ordered.map((u) => u.id)).size).toBe(32);
  expect(groupPengguna(ordered.slice(15,30), "peran", (r) => r, (id) => id!)[0].users).toHaveLength(15);
  expect(rows[1].assignments[0].outlet_id).toBe("uhb");
});

it("keeps multi-role accounts in Multi Peran and preserves filter modes", async () => {
  const { orderPenggunaForTable } = await import("../pengguna-table");
  for (const mode of ["peran", "outlet", "semua"] as const) {
    const ordered = orderPenggunaForTable(users, mode, (r) => r, (id) => id ?? "Semua");
    expect(ordered.map((u) => u.id).sort()).toEqual(["1", "2", "3", "4"]);
  }
  expect(groupPengguna(users, "peran", (r) => r, (id) => id ?? "Semua").find((g) => g.key === "multi")?.users[0].id).toBe("1");
});
