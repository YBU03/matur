import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  db: vi.fn(),
  session: vi.fn(),
  active: vi.fn(),
  password: vi.fn(),
  otp: vi.fn(),
  verify: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("../supabase/server", () => ({ supabaseServer: mock.db }));
vi.mock("../session", () => ({
  getSession: mock.session,
  setActive: mock.active,
}));
vi.mock("next/navigation", () => ({ redirect: mock.redirect }));
import { loginAction, otpAction } from "../actions";
function form(token = "secret") {
  const f = new FormData();
  f.set("login", " PERSON@EXAMPLE.COM ");
  f.set("secret", token);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.db.mockResolvedValue({
    auth: {
      signInWithPassword: mock.password,
      signInWithOtp: mock.otp,
      verifyOtp: mock.verify,
    },
  });
  mock.password.mockResolvedValue({ error: null });
  mock.otp.mockResolvedValue({ error: null });
  mock.verify.mockResolvedValue({ error: null });
  mock.session.mockResolvedValue({
    status: "aktif",
    assignments: [{ role: "owner" }],
    active: { role: "owner" },
  });
});
describe("login animation server confirmation", () => {
  it("never returns success or resolves a destination on invalid password", async () => {
    mock.password.mockResolvedValue({ error: { message: "invalid" } });
    expect(await loginAction({}, form())).toEqual({
      error: "Email atau password salah.",
    });
    expect(mock.session).not.toHaveBeenCalled();
    expect(mock.active).not.toHaveBeenCalled();
  });
  it("reports a transport failure without claiming success", async () => {
    mock.password.mockResolvedValue({
      error: { name: "AuthRetryableFetchError" },
    });
    expect(await loginAction({}, form())).toEqual({
      error: "Koneksi terganggu. Silakan coba masuk kembali.",
    });
    expect(mock.session).not.toHaveBeenCalled();
  });
  it.each([
    [null, "/menunggu"],
    [{ status: "nonaktif", assignments: [{ role: "owner" }] }, "/menunggu"],
    [{ status: "aktif", assignments: [] }, "/menunggu"],
    [
      {
        status: "aktif",
        assignments: [{ role: "tablet" }],
        active: { role: "tablet" },
      },
      "/pos",
    ],
    [
      {
        status: "aktif",
        assignments: [{ role: "kasir" }],
        active: { role: "kasir" },
      },
      "/karyawan",
    ],
    [
      {
        status: "aktif",
        assignments: [{ role: "barista" }, { role: "kasir" }],
        active: null,
      },
      "/karyawan",
    ],
    [
      {
        status: "aktif",
        assignments: [{ role: "pemantau_pos" }],
        active: { role: "pemantau_pos" },
      },
      "/pantau-pos",
    ],
    [
      {
        status: "aktif",
        assignments: [{ role: "owner" }],
        active: { role: "owner" },
      },
      "/dashboard",
    ],
    [
      {
        status: "aktif",
        assignments: [{ role: "owner" }, { role: "gudang" }],
        active: null,
      },
      "/pilih-peran",
    ],
  ])("preserves role destination %#", async (session, destination) => {
    mock.session.mockResolvedValue(session);
    expect(await loginAction({}, form())).toEqual({ destination });
    expect(mock.password).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "secret",
    });
    expect(mock.active).toHaveBeenCalledWith(null);
    expect(mock.redirect).not.toHaveBeenCalled();
  });
  it("requesting an OTP is not login success", async () => {
    expect(await otpAction({}, form(""))).toEqual({
      sent: "person@example.com",
    });
    expect(mock.session).not.toHaveBeenCalled();
    expect(mock.verify).not.toHaveBeenCalled();
  });
  it("invalid OTP does not return success", async () => {
    mock.verify.mockResolvedValue({ error: { message: "expired" } });
    expect(await otpAction({}, form("123456"))).toEqual({
      sent: "person@example.com",
      error: "Kode salah atau kedaluwarsa.",
    });
    expect(mock.session).not.toHaveBeenCalled();
  });
  it("verified OTP returns the same server-selected dashboard", async () => {
    expect(await otpAction({}, form("123456"))).toEqual({
      destination: "/dashboard",
    });
    expect(mock.verify).toHaveBeenCalledWith({
      email: "person@example.com",
      token: "123456",
      type: "email",
    });
  });
});
