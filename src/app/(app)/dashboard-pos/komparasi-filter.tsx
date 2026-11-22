"use client";

// Pemilih Komparasi: mode (antar outlet / antar periode), outlet A & B, periode A & B. Disimpan di URL.
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const PERIODE: [string, string][] = [
  ["hari", "Hari ini"],
  ["kemarin", "Kemarin"],
  ["7", "7 hari terakhir"],
  ["30", "30 hari terakhir"],
  ["bulan", "Bulan ini"],
  ["bulan_lalu", "Bulan lalu"],
  ["90", "90 hari terakhir"],
  ["kustom", "Pilih tanggal…"],
];
const kotak = "w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm font-semibold text-kopi-900 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";
const WARNA = { a: "#eb6834", b: "#2a78d6" };

export function KomparasiFilter({ outlets, jenis, a, b, p, pd, ps, pb, pbd, pbs }: {
  outlets: { id: string; nama: string }[];
  jenis: "outlet" | "periode";
  a: string; b: string; p: string; pd?: string; ps?: string; pb: string; pbd?: string; pbs?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (ubah: Record<string, string | undefined>) => {
    const q = new URLSearchParams(sp.toString());
    q.set("tab", "komparasi");
    for (const [k, v] of Object.entries(ubah)) (v ? q.set(k, v) : q.delete(k));
    start(() => router.push(`/dashboard-pos?${q.toString()}`, { scroll: false }));
  };
  const Label = ({ warna, children }: { warna?: string; children: React.ReactNode }) => (
    <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-500">
      {warna && <span className="size-2.5 rounded-full" style={{ background: warna }} />}
      {children}
    </span>
  );
  const PilihPeriode = ({ nilai, kunci, dari, sampai, kD, kS, sebelumnya }: { nilai: string; kunci: string; dari?: string; sampai?: string; kD: string; kS: string; sebelumnya?: boolean }) => (
    <div className="space-y-2">
      <select className={kotak} value={nilai} onChange={(e) => set({ [kunci]: e.target.value })}>
        {sebelumnya && <option value="sebelumnya">Periode sebelumnya (panjang sama)</option>}
        {PERIODE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {nilai === "kustom" && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" aria-label="Dari" className={kotak} defaultValue={dari} onChange={(e) => set({ [kD]: e.target.value })} />
          <input type="date" aria-label="Sampai" className={kotak} defaultValue={sampai} onChange={(e) => set({ [kS]: e.target.value })} />
        </div>
      )}
    </div>
  );

  return (
    <section className={`rounded-2xl border border-matur-100 bg-white p-4 shadow-sm transition ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-2xl bg-matur-50 p-1 text-sm font-semibold" role="tablist" aria-label="Jenis komparasi">
          {([["outlet", "🏪 Antar outlet"], ["periode", "🗓️ Antar periode"]] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={jenis === v} onClick={() => set({ km: v })} className={`rounded-xl px-3 py-1.5 ${jenis === v ? "bg-white text-kopi-900 shadow-sm" : "text-stone-500 hover:text-kopi-900"}`}>
              {l}
            </button>
          ))}
        </div>
        {pending && <span className="text-xs font-semibold text-matur-700">⏳ Memuat perbandingan…</span>}
      </div>
      {jenis === "outlet" ? (
        <div className="mt-4 grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_1fr]">
          <label className="block"><Label warna={WARNA.a}>Outlet A</Label>
            <select className={kotak} value={a} onChange={(e) => set({ a: e.target.value, ...(e.target.value === b ? { b: a } : {}) })}>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
          </label>
          <button type="button" title="Tukar outlet" onClick={() => set({ a: b, b: a })} className="mx-auto grid size-10 place-items-center rounded-full bg-gradient-to-br from-matur-400 to-orange-600 text-sm font-black text-white shadow-md hover:scale-105">⇄</button>
          <label className="block"><Label warna={WARNA.b}>Outlet B</Label>
            <select className={kotak} value={b} onChange={(e) => set({ b: e.target.value, ...(e.target.value === a ? { a: b } : {}) })}>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
          </label>
          <div><Label>Periode (sama untuk keduanya)</Label><PilihPeriode nilai={p} kunci="p" dari={pd} sampai={ps} kD="pd" kS="ps" /></div>
        </div>
      ) : (
        <div className="mt-4 grid items-start gap-3 md:grid-cols-3">
          <label className="block"><Label>Outlet</Label>
            <select className={kotak} value={a} onChange={(e) => set({ a: e.target.value })}>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
          </label>
          <div><Label warna={WARNA.a}>Periode A</Label><PilihPeriode nilai={p} kunci="p" dari={pd} sampai={ps} kD="pd" kS="ps" /></div>
          <div><Label warna={WARNA.b}>Periode B</Label><PilihPeriode nilai={pb} kunci="pb" dari={pbd} sampai={pbs} kD="pbd" kS="pbs" sebelumnya /></div>
        </div>
      )}
    </section>
  );
}
