"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aturAksesOutlet } from "@/lib/pos-outlet-actions";
export type AksesOutlet = {
  id: string;
  nama: string;
  username: string | null;
  aktif: boolean;
  diubah_at: string | null;
};
export function AksesOutletPanel({ outlets }: { outlets: AksesOutlet[] }) {
  const [filter, setFilter] = useState("");
  return (
    <section className="space-y-4">
      <p className="rounded-xl bg-sky-50 p-4 text-sm">
        Akun ini khusus kasir POS outlet. Pengguna Matoer tetap akun pribadi
        untuk absensi, penggajian, penerimaan barang dan setoran. Password
        disimpan sebagai hash dan dapat diganti.
      </p>
      <label className="block text-sm">
        Outlet
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="ml-2 rounded-xl border p-2"
        >
          <option value="">Semua outlet yang dikelola</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        {outlets
          .filter((o) => !filter || o.id === filter)
          .map((o) => (
            <Card key={o.id + o.diubah_at} outlet={o} />
          ))}
      </div>
      {!outlets.length && <p>Tidak ada outlet dalam kewenangan akun ini.</p>}
    </section>
  );
}
function Card({ outlet: o }: { outlet: AksesOutlet }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <form
      className="space-y-3 rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          try {
            const r = await aturAksesOutlet(
              o.id,
              String(f.get("username")),
              String(f.get("password")),
              f.get("aktif") === "on",
            );
            setMsg(r.error ?? r.ok ?? "");
            if (!r.error) router.refresh();
          } catch {
            setMsg("Belum berhasil, periksa koneksi.");
          }
        });
      }}
    >
      <h3 className="font-bold">{o.nama}</h3>
      <p className="text-xs text-stone-500">
        {o.username
          ? o.aktif
            ? "Akses aktif"
            : "Akses nonaktif"
          : "Belum dibuat"}
      </p>
      <label className="block text-sm">
        Username POS outlet
        <input
          name="username"
          required
          defaultValue={o.username ?? ""}
          pattern="[a-z0-9][a-z0-9._-]{2,49}"
          autoCapitalize="none"
          autoComplete="off"
          className="mt-1 w-full rounded-xl border p-2"
        />
      </label>
      <label className="block text-sm">
        {o.username
          ? "Password baru · kosongkan jika tetap"
          : "Password outlet"}
        <input
          name="password"
          type="password"
          minLength={10}
          maxLength={72}
          required={!o.username}
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border p-2"
        />
      </label>
      <label className="flex gap-2 text-sm">
        <input
          name="aktif"
          type="checkbox"
          defaultChecked={o.username ? o.aktif : true}
        />
        Aktifkan akses POS outlet
      </label>
      <button
        disabled={busy}
        className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Menyimpan…" : "Simpan Akses Outlet"}
      </button>
      {msg && (
        <p role="status" className="text-sm">
          {msg}
        </p>
      )}
    </form>
  );
}
