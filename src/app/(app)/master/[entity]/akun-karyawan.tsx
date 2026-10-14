"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { aturPinKaryawan, buatAkunKaryawan, hubungkanAkun, resetPasswordKaryawan, type Result } from "@/lib/akun-karyawan-actions";

export type KaryawanAkun = { id: string; nama: string; jabatan: string | null; is_spv: boolean; outlet_id: string | null; outlet: string | null; akun: { id: string; email: string; ada_pin: boolean; peran: string[]; status: string } | null };
export type AkunBebas = { id: string; nama: string; email: string; peran: string[] };
const cls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-matur-500";
const tebakPeran = (k: KaryawanAkun) => (k.is_spv ? "spv" : /barista/i.test(k.jabatan ?? "") ? "barista" : "kasir");

// Panel HRD: data karyawan & akun login dijadikan satu. Email+password untuk masuk/absen, PIN untuk mulai shift kasir.
export function AkunKaryawan({ data, bebas }: { data: KaryawanAkun[]; bebas: AkunBebas[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [cari, setCari] = useState("");
  const [buat, setBuat] = useState<{ k: KaryawanAkun; email: string; password: string; pin: string; peran: string; hubung: string } | null>(null);
  const [ubah, setUbah] = useState<{ k: KaryawanAkun; jenis: "pin" | "password"; nilai: string } | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        after?.();
        router.refresh();
      }
    });
  const list = data.filter((k) => !cari || `${k.nama} ${k.akun?.email ?? ""} ${k.outlet ?? ""}`.toLowerCase().includes(cari.toLowerCase()));
  const tanpaAkun = data.filter((k) => !k.akun).length;
  const tanpaPin = data.filter((k) => k.akun && !k.akun.ada_pin).length;

  return (
    <section className="mb-4 rounded-2xl border border-matur-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-bold">🔑 Akun login & PIN kasir</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{tanpaAkun} belum punya akun</span>
        {tanpaPin > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{tanpaPin} belum ada PIN</span>}
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari karyawan / email…" className="w-48 rounded-lg border px-2 py-1 text-sm" />
      </div>
      <p className="mb-2 text-xs text-stone-500">Karyawan masuk aplikasi (absen, jadwal, slip) dengan <b>email & password</b>. Di perangkat kasir outlet, mulai shift cukup pilih nama lalu masukkan <b>PIN</b>.</p>
      {msg && <p className={`mb-2 rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}
      <div className="divide-y">
        {list.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <div className="mr-auto min-w-0">
              <p className="font-semibold">
                {k.nama} <span className="text-xs font-normal text-stone-500">· {k.jabatan ?? "-"} · {k.outlet ?? "tanpa outlet"}</span>
              </p>
              {k.akun ? (
                <p className="text-xs text-stone-600">
                  {k.akun.email.endsWith("@pin.matur.id") ? `kode staf ${k.akun.email.replace("@pin.matur.id", "")}` : k.akun.email} · {k.akun.peran.join(", ").toUpperCase()}
                  {k.akun.status !== "aktif" && <span className="ml-1 text-red-600">(nonaktif)</span>}
                </p>
              ) : (
                <p className="text-xs text-amber-700">Belum punya akun login</p>
              )}
            </div>
            {k.akun ? (
              <>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${k.akun.ada_pin ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{k.akun.ada_pin ? "PIN ✓" : "PIN belum"}</span>
                <button onClick={() => (setMsg(null), setUbah({ k, jenis: "pin", nilai: "" }))} className="rounded-lg border px-2 py-1 text-xs font-semibold">
                  Atur PIN
                </button>
                {!k.akun.email.endsWith("@pin.matur.id") && (
                  <button onClick={() => (setMsg(null), setUbah({ k, jenis: "password", nilai: "" }))} className="rounded-lg border px-2 py-1 text-xs font-semibold">
                    Reset password
                  </button>
                )}
                <button disabled={pending} onClick={() => confirm(`Lepas akun dari ${k.nama}? Akunnya tidak dihapus.`) && run(() => hubungkanAkun(k.id, null))} className="rounded-lg px-2 py-1 text-xs text-stone-500">
                  Lepas
                </button>
              </>
            ) : (
              <button onClick={() => (setMsg(null), setBuat({ k, email: "", password: "", pin: "", peran: tebakPeran(k), hubung: "" }))} className="rounded-lg bg-kopi-900 px-3 py-1.5 text-xs font-semibold text-white">
                + Buat / hubungkan akun
              </button>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="py-3 text-sm text-stone-500">Tidak ada karyawan yang cocok.</p>}
      </div>

      {buat && (
        <Modal title={`Akun untuk ${buat.k.nama}`}>
          <div className="space-y-2 text-sm">
            {bebas.length > 0 && (
              <label className="block">
                Hubungkan ke akun yang sudah ada (opsional)
                <select value={buat.hubung} onChange={(e) => setBuat({ ...buat, hubung: e.target.value })} className={cls}>
                  <option value="">— buat akun baru —</option>
                  {bebas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama} · {a.email} ({a.peran.join(", ")})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!buat.hubung && (
              <>
                <input value={buat.email} onChange={(e) => setBuat({ ...buat, email: e.target.value })} type="email" placeholder="Email karyawan" autoComplete="off" className={cls} />
                <input value={buat.password} onChange={(e) => setBuat({ ...buat, password: e.target.value })} type="password" placeholder="Password awal (min. 8 karakter)" autoComplete="new-password" className={cls} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={buat.pin} onChange={(e) => setBuat({ ...buat, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} type="password" inputMode="numeric" placeholder="PIN shift (4–6 angka)" autoComplete="off" className={cls} />
                  <select value={buat.peran} onChange={(e) => setBuat({ ...buat, peran: e.target.value })} className={cls}>
                    <option value="kasir">Kasir</option>
                    <option value="barista">Barista</option>
                    <option value="spv">SPV</option>
                  </select>
                </div>
                <p className="text-xs text-stone-500">Outlet akun: {buat.k.outlet ?? <b className="text-red-600">isi outlet utama karyawan dulu</b>}. Sampaikan email & password ke karyawan; minta ganti password setelah masuk.</p>
              </>
            )}
          </div>
          {msg?.error && <p className="mt-2 text-sm text-red-600">{msg.error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setBuat(null)} className="rounded-lg border px-4 py-2 text-sm">
              Batal
            </button>
            <button
              disabled={pending}
              onClick={() =>
                run(
                  () => (buat.hubung ? hubungkanAkun(buat.k.id, buat.hubung) : buatAkunKaryawan({ karyawanId: buat.k.id, email: buat.email, password: buat.password, pin: buat.pin, peran: buat.peran, outletId: buat.k.outlet_id ?? "" })),
                  () => setBuat(null),
                )
              }
              className="rounded-lg bg-kopi-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {buat.hubung ? "Hubungkan" : "Buat akun"}
            </button>
          </div>
        </Modal>
      )}

      {ubah && ubah.k.akun && (
        <Modal title={`${ubah.jenis === "pin" ? "PIN shift" : "Password"} · ${ubah.k.nama}`}>
          <input
            value={ubah.nilai}
            onChange={(e) => setUbah({ ...ubah, nilai: ubah.jenis === "pin" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value })}
            type="password"
            inputMode={ubah.jenis === "pin" ? "numeric" : undefined}
            autoComplete="new-password"
            placeholder={ubah.jenis === "pin" ? "PIN baru 4–6 angka" : "Password baru min. 8 karakter"}
            className={cls}
          />
          {ubah.jenis === "pin" && ubah.k.akun.email.endsWith("@pin.matur.id") && <p className="mt-1 text-xs text-stone-500">Akun kode staf: PIN ini hanya untuk mulai shift. PIN login tetap diatur dari menu Pengguna.</p>}
          {msg?.error && <p className="mt-2 text-sm text-red-600">{msg.error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setUbah(null)} className="rounded-lg border px-4 py-2 text-sm">
              Batal
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => (ubah.jenis === "pin" ? aturPinKaryawan(ubah.k.akun!.id, ubah.nilai) : resetPasswordKaryawan(ubah.k.akun!.id, ubah.nilai)), () => setUbah(null))}
              className="rounded-lg bg-kopi-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
