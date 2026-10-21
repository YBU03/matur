"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import {
  MAX_DELETE_USERS,
  targetHapus,
  type DeleteBatchResult,
  type DeleteOutcome,
} from "./user-delete";

export async function hapusPilihanPengguna(
  ids: string[],
  yakin: string,
  target: string,
): Promise<DeleteBatchResult> {
  const session = await getSession();
  if (session?.active?.role !== "owner")
    return { error: "Hanya Owner yang bisa menghapus pengguna." };
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > MAX_DELETE_USERS ||
    ids.some(
      (id) =>
        typeof id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        ),
    ) ||
    new Set(ids).size !== ids.length
  )
    return { error: `Pilih 1–${MAX_DELETE_USERS} pengguna berbeda.` };
  if (yakin !== "Yakin Hapus")
    return { error: "Ketik Yakin Hapus dengan tepat." };
  const db = await supabaseServer();
  const [{ data: users, error: ue }, { data: assignments, error: ae }] =
    await Promise.all([
      db
        .from("pengguna")
        .select("id,nama,email,akun_tablet,status")
        .in("id", ids),
      db.from("penugasan").select("pengguna_id,peran").in("pengguna_id", ids),
    ]);
  if (ue || ae)
    return {
      error:
        "Daftar pengguna belum dapat diperiksa. Muat ulang lalu coba lagi.",
    };
  const rows = users ?? [];
  if (ids.length === 1 && !rows.length)
    return { error: "Pengguna sudah tidak ada. Muat ulang daftar." };
  if (
    target !==
    targetHapus(
      ids.map((id) => ({ nama: rows.find((u) => u.id === id)?.nama ?? "" })),
    )
  )
    return {
      error:
        "Konfirmasi nama atau jumlah tidak cocok. Periksa kembali daftar pengguna.",
    };
  const hasil: DeleteOutcome[] = [];
  for (const [index, id] of ids.entries()) {
    const user = rows.find((u) => u.id === id);
    const item = {
      id,
      nama: user?.nama ?? "Pengguna tidak ditemukan",
      email: user?.email ?? null,
    };
    if (!user || user.status === "dihapus") {
      hasil.push({
        ...item,
        error: "Pengguna sudah dihapus atau tidak ditemukan.",
      });
      continue;
    }
    if (
      id === session.userId ||
      user.akun_tablet ||
      assignments?.some((a) => a.pengguna_id === id && a.peran === "owner")
    ) {
      hasil.push({
        ...item,
        error:
          "Akun sendiri, Owner, dan akun perangkat POS tidak bisa dihapus melalui menu ini.",
      });
      continue;
    }
    try {
      const { data, error } = await db.rpc("hapus_pengguna", { p_uid: id });
      if (error) hasil.push({ ...item, error: error.message });
      else if (data === "dihapus" || data === "diarsipkan")
        hasil.push({
          ...item,
          ok:
            data === "dihapus"
              ? "Dihapus permanen (tanpa riwayat)."
              : "Dihapus dari daftar; riwayat tetap tersimpan.",
        });
      else
        hasil.push({
          ...item,
          error:
            "Hasil belum dapat dipastikan. Muat ulang daftar sebelum mencoba lagi.",
        });
    } catch {
      hasil.push({
        ...item,
        error:
          "Hasil belum dapat dipastikan karena koneksi terputus. Muat ulang daftar sebelum mencoba lagi.",
      });
      for (const remaining of ids.slice(index + 1)) {
        const u = rows.find((row) => row.id === remaining);
        hasil.push({
          id: remaining,
          nama: u?.nama ?? "Pengguna tidak ditemukan",
          email: u?.email ?? null,
          error: "Belum diproses karena koneksi terputus.",
        });
      }
      break;
    }
  }
  revalidatePath("/pengguna");
  return { hasil };
}
