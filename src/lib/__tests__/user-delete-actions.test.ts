import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn(), rpc: vi.fn(), from: vi.fn(), revalidate: vi.fn() }));
vi.mock("../session", () => ({ getSession: mocks.session }));
vi.mock("../supabase/server", () => ({ supabaseServer: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { hapusPilihanPengguna } from "../user-delete-actions";
const own = "00000000-0000-4000-8000-000000000001";
const first = "00000000-0000-4000-8000-000000000002";
const second = "00000000-0000-4000-8000-000000000003";
const row = (id: string, nama = "Andi") => ({ id, nama, email: `${id}@test.invalid`, akun_tablet: false, status: "aktif" });
let users: ReturnType<typeof row>[];
let roles: { pengguna_id: string; peran: string }[];
beforeEach(() => {
  vi.clearAllMocks();
  users = [row(first), row(second, "Budi")]; roles = [];
  mocks.session.mockResolvedValue({ userId: own, active: { role: "owner" } });
  mocks.from.mockImplementation((table: string) => ({ select: () => ({ in: async () => ({ data: table === "pengguna" ? users : roles, error: null }) }) }));
  mocks.rpc.mockResolvedValue({ data: "diarsipkan", error: null });
  mocks.db.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
});
describe("hapusPilihanPengguna", () => {
  it("menolak non-owner tanpa mengirim perintah hapus", async () => {
    mocks.session.mockResolvedValue({ userId: own, active: { role: "hrd" } });
    expect((await hapusPilihanPengguna([first], "Yakin Hapus", "Andi")).error).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("menolak konfirmasi pertama salah, ID duplikat, dan batch berlebihan", async () => {
    expect((await hapusPilihanPengguna([first], "yakin hapus", "Andi")).error).toBeTruthy();
    expect((await hapusPilihanPengguna([first, first], "Yakin Hapus", "HAPUS 2 PENGGUNA")).error).toBeTruthy();
    expect((await hapusPilihanPengguna(Array(101).fill(first), "Yakin Hapus", "HAPUS 101 PENGGUNA")).error).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("menolak nama yang sudah berubah dan jumlah yang tidak cocok", async () => {
    expect((await hapusPilihanPengguna([first], "Yakin Hapus", "Nama lama")).error).toBeTruthy();
    expect((await hapusPilihanPengguna([first, second], "Yakin Hapus", "HAPUS 3 PENGGUNA")).error).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("melewati akun sendiri, owner dan perangkat; tidak mengirim RPC untuk akun terlindungi", async () => {
    users = [row(own, "Saya"), row(first), { ...row(second, "Tablet"), akun_tablet: true }];
    roles = [{ pengguna_id: first, peran: "owner" }];
    const r = await hapusPilihanPengguna([own, first, second], "Yakin Hapus", "HAPUS 3 PENGGUNA");
    expect(r.hasil).toHaveLength(3); expect(r.hasil?.every((x) => x.error)).toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("tetap melaporkan hasil parsial dan memproses akun lain yang valid", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Akun berubah menjadi Owner" } }).mockResolvedValueOnce({ data: "diarsipkan", error: null });
    const r = await hapusPilihanPengguna([first, second], "Yakin Hapus", "HAPUS 2 PENGGUNA");
    expect(r.hasil?.[0].error).toBe("Akun berubah menjadi Owner");
    expect(r.hasil?.[1].ok).toContain("riwayat tetap tersimpan");
    expect(mocks.rpc).toHaveBeenCalledTimes(2); expect(mocks.revalidate).toHaveBeenCalledWith("/pengguna");
  });
  it("berhenti pada gangguan koneksi dan menandai sisanya belum diproses", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("network"));
    const r = await hapusPilihanPengguna([first, second], "Yakin Hapus", "HAPUS 2 PENGGUNA");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(r.hasil?.[0].error).toContain("belum dapat dipastikan");
    expect(r.hasil?.[1].error).toContain("Belum diproses");
  });
  it("menggunakan ID yang dikonfirmasi untuk penghapusan tunggal", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "dihapus", error: null });
    const r = await hapusPilihanPengguna([first], "Yakin Hapus", "Andi");
    expect(mocks.rpc).toHaveBeenCalledWith("hapus_pengguna", { p_uid: first });
    expect(r.hasil?.[0].ok).toContain("tanpa riwayat");
  });
});
