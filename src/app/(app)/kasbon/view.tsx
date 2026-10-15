"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatRupiah as rp } from "@/lib/format";
import { catatKasbon, type Result } from "@/lib/operasional-actions";
export function KasbonView({
  outlet,
  outlets,
  staf,
  rows,
  boleh,
}: {
  outlet: { id: string; nama: string };
  outlets: { id: string; nama: string }[];
  staf: { id: string; nama: string }[];
  rows: {
    id: string;
    nama: string;
    tanggal: string;
    jumlah: number;
    cicilan: number;
    catatan: string;
    terbayar: number;
    draft: number;
  }[];
  boleh: boolean;
}) {
  const router = useRouter();
  const [client, setClient] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result>({});
  const css = "mt-1 w-full rounded-lg border p-2 text-sm";
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">Kasbon & Cicilan Gaji</h1>
      <p className="text-sm text-stone-500">
        Catat kasbon yang sudah dicairkan. Hitung ulang gaji untuk memasukkan
        cicilan. Saldo berkurang saat penggajian final; draft hanya mencadangkan
        cicilan.
      </p>
      <div className="flex gap-3">
        <select
          value={outlet.id}
          onChange={(e) => router.push(`/kasbon?outlet=${e.target.value}`)}
          className="rounded-lg border p-2"
        >
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
        <Link
          className="p-2 font-semibold underline"
          href={`/penggajian?outlet=${outlet.id}`}
        >
          Buka penggajian
        </Link>
      </div>
      {(msg.error || msg.ok) && (
        <p
          role="status"
          className={`rounded-lg p-3 ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total dicairkan", rows.reduce((n, x) => n + x.jumlah, 0)],
          [
            "Terbayar dari gaji final",
            rows.reduce((n, x) => n + x.terbayar, 0),
          ],
          ["Sisa kasbon", rows.reduce((n, x) => n + x.jumlah - x.terbayar, 0)],
        ].map(([l, n]) => (
          <div key={l} className="rounded-2xl border bg-white p-4">
            <p className="text-sm text-stone-500">{l}</p>
            <b>{rp(Number(n))}</b>
          </div>
        ))}
      </div>
      {boleh && (
        <form
          className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const form = e.currentTarget;
            start(async () => {
              try {
                const r = await catatKasbon(
                  outlet.id,
                  String(fd.get("staf")),
                  String(fd.get("tanggal")),
                  Number(fd.get("jumlah")),
                  Number(fd.get("cicilan")),
                  String(fd.get("catatan")),
                  client,
                );
                setMsg(r);
                if (!r.error) {
                  form.reset();
                  setClient(crypto.randomUUID());
                  router.refresh();
                }
              } catch {
                setMsg({ error: "Kasbon gagal disimpan." });
              }
            });
          }}
        >
          <h2 className="font-bold sm:col-span-2">Catat pencairan kasbon</h2>
          <label>
            Staf
            <select className={css} name="staf" required>
              {staf.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.nama}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tanggal pencairan
            <input
              className={css}
              name="tanggal"
              type="date"
              required
              defaultValue={new Date(Date.now() + 7 * 3600000)
                .toISOString()
                .slice(0, 10)}
            />
          </label>
          <label>
            Nominal kasbon
            <input
              className={css}
              name="jumlah"
              type="number"
              required
              min="1"
              step="1"
            />
          </label>
          <label>
            Cicilan per bulan
            <input
              className={css}
              name="cicilan"
              type="number"
              required
              min="1"
              step="1"
            />
          </label>
          <label className="sm:col-span-2">
            Catatan pencairan / referensi bukti
            <input className={css} name="catatan" minLength={3} required />
          </label>
          <button
            disabled={pending || !staf.length}
            className="rounded-lg bg-matur-500 p-2 font-semibold text-white disabled:opacity-50"
          >
            Simpan pencairan
          </button>
        </form>
      )}
      <section className="overflow-x-auto rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-bold">Riwayat kasbon</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Staf / tanggal",
                "Dicairkan",
                "Cicilan/bulan",
                "Terbayar",
                "Sisa",
                "Dicadangkan draft",
                "Catatan",
              ].map((l) => (
                <th key={l} className="p-2">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} className="border-t">
                <td className="p-2">
                  {x.nama}
                  <br />
                  {x.tanggal}
                </td>
                {[
                  x.jumlah,
                  x.cicilan,
                  x.terbayar,
                  x.jumlah - x.terbayar,
                  x.draft,
                ].map((n, i) => (
                  <td key={i} className="p-2">
                    {rp(n)}
                  </td>
                ))}
                <td>{x.catatan}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="py-4 text-sm text-stone-500">
            Belum ada pencairan kasbon tercatat.
          </p>
        )}
      </section>
    </div>
  );
}
