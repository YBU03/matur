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
