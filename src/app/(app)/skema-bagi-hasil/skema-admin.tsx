"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { hapusSkema, pilihSkema, simpanSkema, type Result, type Rincian } from "@/lib/skema-actions";

export type Skema = { id: string; nama: string; keterangan: string | null; persen_sedekah: number; rincian: Rincian[] };
type Outlet = { id: string; nama: string; skema_bagi_hasil_id: string | null };
type Form = { id: string | null; nama: string; keterangan: string; persen_sedekah: string; rincian: (Omit<Rincian, "persen"> & { persen: string })[] };

const cls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-matur-500";
const kosong = (): Form => ({
  id: null,
  nama: "",
  keterangan: "",
  persen_sedekah: "2.5",
  rincian: [
    { penerima: "Pengelola", persen: "", pengelola: true },
    { penerima: "", persen: "", pengelola: false },
  ],
});

export function SkemaAdmin({ skema, outlets }: { skema: Skema[]; outlets: Outlet[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, tutup = false) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        if (tutup) setForm(null);
        router.refresh();
      }
    });

  const ubah = (sk: Skema | null, salin = false) => {
    setMsg(null);
    setForm(
      sk
        ? {
            id: salin ? null : sk.id,
            nama: salin ? `${sk.nama} (salinan)` : sk.nama,
            keterangan: sk.keterangan ?? "",
            persen_sedekah: String(sk.persen_sedekah),
            rincian: sk.rincian.map((r) => ({ ...r, persen: String(r.persen) })),
          }
        : kosong(),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Skema Bagi Hasil</h1>
        <button onClick={() => ubah(null)} className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white">
          + Buat skema
        </button>
      </div>
      <p className="-mt-3 text-sm text-stone-500">Pilih skema untuk tiap outlet, atau buat skema sendiri. Laporan yang sudah terbit tidak ikut berubah.</p>
      {msg && !form && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-3 font-bold">Skema per outlet</h2>
        <ul className="divide-y">
          {outlets.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-40 flex-1 font-medium">{o.nama}</span>
              <select
                disabled={pending}
                value={o.skema_bagi_hasil_id ?? ""}
                onChange={(e) => run(() => pilihSkema(o.id, e.target.value || null))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm sm:w-64"
              >
                <option value="">— belum dipilih —</option>
                {skema.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {skema.map((s) => {
          const dipakai = outlets.filter((o) => o.skema_bagi_hasil_id === s.id);
          return (
            <section key={s.id} className="rounded-2xl border border-matur-200 bg-white p-4">
              <h3 className="font-bold">{s.nama}</h3>
              {s.keterangan && <p className="text-xs text-stone-500">{s.keterangan}</p>}
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-stone-100">
                {s.rincian.map((r, i) => (
                  <div key={i} className={r.pengelola ? "bg-kopi-700" : i % 2 ? "bg-matur-300" : "bg-matur-500"} style={{ width: `${r.persen}%` }} title={`${r.penerima} ${r.persen}%`} />
                ))}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {s.rincian.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex-1">
                      {r.penerima} {r.pengelola && <span className="text-xs text-stone-500">(pengelola)</span>}
                      {r.no_rekening && <span className="block text-xs text-stone-500">{r.bank} {r.no_rekening} a.n {r.atas_nama}</span>}
                    </span>
                    <b>{r.persen}%</b>
                  </li>
                ))}
                <li className="flex gap-2 text-xs text-stone-500">
                  <span className="flex-1">Sedekah (dari laba kotor)</span>
                  {String(s.persen_sedekah).replace(".", ",")}%
                </li>
              </ul>
              <p className="mt-2 text-xs text-stone-500">Dipakai: {dipakai.length ? dipakai.map((o) => o.nama).join(", ") : "belum ada outlet"}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <button onClick={() => ubah(s)} className="rounded-lg border border-matur-300 py-1.5 text-matur-700">✏️ Ubah</button>
                <button onClick={() => ubah(s, true)} className="rounded-lg border border-stone-300 py-1.5">Salin</button>
                <button
                  disabled={pending}
                  onClick={() => confirm(`Hapus skema "${s.nama}"?`) && run(() => hapusSkema(s.id))}
                  className="rounded-lg border border-red-200 py-1.5 text-red-600"
                >
                  Hapus
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {form && <SkemaForm form={form} setForm={setForm} pending={pending} msg={msg} onSave={() => run(() => simpanSkema(form.id, { ...form, persen_sedekah: Number(form.persen_sedekah.replace(",", ".")), rincian: form.rincian.map((r) => ({ ...r, persen: Number(r.persen.replace(",", ".")) })) }), true)} />}
    </div>
  );
}

function SkemaForm({ form, setForm, pending, msg, onSave }: { form: Form; setForm: (f: Form | null) => void; pending: boolean; msg: Result | null; onSave: () => void }) {
  const total = Math.round(form.rincian.reduce((s, r) => s + (Number(r.persen.replace(",", ".")) || 0), 0) * 100) / 100;
  const set = (i: number, k: string, v: string | boolean) => setForm({ ...form, rincian: form.rincian.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  return (
    <Modal title={form.id ? "Ubah skema" : "Buat skema"}>
      <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
        <label className="block text-sm font-medium">
          Nama skema
          <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="mis. Kemitraan 60/40" className={`mt-1 ${cls}`} />
        </label>
        <label className="block text-sm font-medium">
          Keterangan
          <input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} className={`mt-1 ${cls}`} />
        </label>
        <label className="block text-sm font-medium">
          Sedekah (% dari laba kotor)
          <input value={form.persen_sedekah} onChange={(e) => setForm({ ...form, persen_sedekah: e.target.value })} inputMode="decimal" className={`mt-1 ${cls}`} />
        </label>
        <p className="pt-1 text-sm font-bold">Penerima bagi hasil (dari laba bersih)</p>
        {form.rincian.map((r, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-stone-200 p-3">
            <div className="flex gap-2">
              <input value={r.penerima} onChange={(e) => set(i, "penerima", e.target.value)} placeholder="Nama penerima" className={cls} />
              <div className="relative w-24 shrink-0">
                <input value={r.persen} onChange={(e) => set(i, "persen", e.target.value)} inputMode="decimal" placeholder="0" className={`${cls} pr-6 text-right`} />
                <span className="absolute right-2 top-2 text-sm text-stone-400">%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input value={r.bank ?? ""} onChange={(e) => set(i, "bank", e.target.value)} placeholder="Bank" className={cls} />
              <input value={r.no_rekening ?? ""} onChange={(e) => set(i, "no_rekening", e.target.value)} placeholder="No. rekening" inputMode="numeric" className={cls} />
              <input value={r.atas_nama ?? ""} onChange={(e) => set(i, "atas_nama", e.target.value)} placeholder="Atas nama" className={cls} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={r.pengelola} onChange={(e) => set(i, "pengelola", e.target.checked)} className="size-4 accent-matur-500" />
                Bagian pengelola
              </label>
              {form.rincian.length > 1 && (
                <button onClick={() => setForm({ ...form, rincian: form.rincian.filter((_, j) => j !== i) })} className="text-red-600">
                  Hapus penerima
                </button>
              )}
            </div>
          </div>
        ))}
        <button onClick={() => setForm({ ...form, rincian: [...form.rincian, { penerima: "", persen: "", pengelola: false }] })} className="w-full rounded-xl border border-dashed border-matur-400 py-2 text-sm text-matur-700">
          + Tambah penerima
        </button>
      </div>
      <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${total === 100 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
        Total: {total}% {total === 100 ? "✓" : "— harus 100%"}
      </p>
      {msg?.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
        <button disabled={pending || total !== 100} onClick={onSave} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </Modal>
  );
}
