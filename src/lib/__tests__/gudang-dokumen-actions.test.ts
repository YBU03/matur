import { beforeEach, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../session", () => ({ getSession: m.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../supabase/server", () => ({
  supabaseServer: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: m.single }) }) }),
    rpc: m.rpc,
    storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
  }),
}));
import { simpanDokumenGudang } from "../gudang-dokumen-actions";
function form() {
  const f = new FormData();
  f.set("alamat", "Jl. Raya Pengalusan No.6, Pengalusan, Purbalingga");
  f.set("versi", "3");
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ active: { role: "admin_gudang" } });
  m.single.mockResolvedValue({
    data: { logo_path: null, versi: 3 },
    error: null,
  });
  m.rpc.mockResolvedValue({ error: null });
  m.upload.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
});
it("uploads a real PNG before saving its new path and address", async () => {
  const f = form();
  f.set(
    "logo",
    new File([readFileSync("public/brand/hazna-logo.png")], "logo.png", {
      type: "image/png",
    }),
  );
  expect(await simpanDokumenGudang(f)).toHaveProperty("ok");
  expect(m.upload).toHaveBeenCalledOnce();
  expect(m.rpc.mock.calls[0][1]).toMatchObject({
    p_alamat: f.get("alamat"),
    p_versi: 3,
    p_logo: expect.stringMatching(/^logo\/.+\.png$/),
  });
});
it("blocks outlet users, stale settings, oversized files and non-images", async () => {
  m.session.mockResolvedValueOnce({ active: { role: "barista" } });
  expect(await simpanDokumenGudang(form())).toHaveProperty("error");
  expect(m.rpc).not.toHaveBeenCalled();
  const stale = form();
  stale.set("versi", "2");
  expect(await simpanDokumenGudang(stale)).toHaveProperty("error");
  const bad = form();
  bad.set(
    "logo",
    new File(["<svg>bad</svg>"], "bad.png", { type: "image/png" }),
  );
  expect(await simpanDokumenGudang(bad)).toHaveProperty("error");
  const big = form();
  big.set("logo", new File([new Uint8Array(2097153)], "large.png"));
  expect(await simpanDokumenGudang(big)).toHaveProperty("error");
  expect(m.upload).not.toHaveBeenCalled();
});
it("cleans an upload if settings changed and supports restoring the default logo", async () => {
  const f = form();
  f.set(
    "logo",
    new File([readFileSync("public/brand/hazna-logo.png")], "logo.png"),
  );
  m.rpc.mockResolvedValueOnce({
    error: { message: "Pengaturan sudah berubah" },
  });
  expect(await simpanDokumenGudang(f)).toHaveProperty("error");
  expect(m.remove).toHaveBeenCalledOnce();
  const reset = form();
  reset.set("bawaan", "on");
  expect(await simpanDokumenGudang(reset)).toHaveProperty("ok");
  expect(m.rpc.mock.calls.at(-1)?.[1].p_logo).toBeNull();
});
