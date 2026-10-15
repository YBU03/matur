import "server-only";
import { notFound } from "next/navigation";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
export async function konteksOperasional(
  jenis: "kiriman" | "setoran" | "kasbon",
  selected?: string,
) {
  const s = await getSession();
  if (!s?.active) notFound();
  const roles =
    jenis === "kiriman"
      ? [
          "owner",
          "admin_pusat",
          "admin_gudang",
          "finance",
          "kasir",
          "barista",
          "spv",
        ]
      : jenis === "kasbon"
        ? ["owner", "hrd", "finance"]
        : ["owner", "admin_pusat", "finance", "kasir", "barista", "spv"];
  if (!roles.includes(s.active.role)) notFound();
  const db = await supabaseServer();
  const { data, error } = await db
    .from("outlet")
    .select("id,nama")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("nama");
  if (error) throw new Error("Outlet tidak dapat dimuat.");
  const terbatas = ["kasir", "barista", "spv"].includes(s.active.role);
  const outlets = terbatas
    ? (data ?? []).filter((o) => o.id === s.active!.outletId)
    : (data ?? []);
  const outlet = outlets.find((o) => o.id === selected) ?? outlets[0];
  if (!outlet) notFound();
  return { s, db, outlets, outlet };
}
export async function buktiUrls(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  paths: (string | null)[],
) {
  const keys = [...new Set(paths.filter((x): x is string => !!x))];
  if (!keys.length) return {};
  const { data, error } = await db.storage
    .from("operasional-bukti")
    .createSignedUrls(keys, 900);
  if (error) throw new Error("Bukti belum dapat dibuka.");
  return Object.fromEntries(
    (data ?? [])
      .filter((x) => x.path && x.signedUrl)
      .map((x) => [x.path!, x.signedUrl!]),
  );
}
