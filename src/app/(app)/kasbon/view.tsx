"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatRupiah as rp } from "@/lib/format";
import { catatKasbon, type Result } from "@/lib/operasional-actions";
import {
  Badge,
  BarisAngka,
  ChipHeader,
  HeaderHalaman,
  KartuAngka,
  Kosong,
  isian,
  tabel,
  tombolHeader,
} from "@/components/ui-halaman";
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
  const css = `mt-1 w-full ${isian}`;
  const totalCair = rows.reduce((n, x) => n + x.jumlah, 0);
  const totalBayar = rows.reduce((n, x) => n + x.terbayar, 0);
  const totalSisa = rows.reduce((n, x) => n + x.jumlah - x.terbayar, 0);
  const aktif = rows.filter((x) => x.jumlah - x.terbayar > 0).length;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <HeaderHalaman
        judul="Kasbon & Cicilan Gaji"
        ikon="🤝"
        keterangan="Catat kasbon yang sudah dicairkan. Hitung ulang gaji untuk memasukkan cicilan. Saldo berkurang saat penggajian final; draft hanya mencadangkan cicilan."
        aksi={
          <Link className={tombolHeader} href={`/penggajian?outlet=${outlet.id}`}>
            💰 Buka penggajian
          </Link>
        }
      >
        <ChipHeader>🏪 {outlet.nama}</ChipHeader>
        <ChipHeader>{rows.length} kasbon tercatat</ChipHeader>
      </HeaderHalaman>
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-stone-600">
        Outlet
        <select
          value={outlet.id}
          onChange={(e) => router.push(`/kasbon?outlet=${e.target.value}`)}
          className={`${isian} w-full sm:w-auto`}
        >
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
      </label>
      {(msg.error || msg.ok) && (
        <p
          role="status"
          className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}
      <BarisAngka>
        <KartuAngka label="Total dicairkan" nilai={rp(totalCair)} ikon="💸" nada="biru" sub={`${rows.length} pencairan`} />
        <KartuAngka label="Terbayar dari gaji final" nilai={rp(totalBayar)} ikon="✅" nada="hijau" />
        <KartuAngka label="Sisa kasbon" nilai={rp(totalSisa)} ikon="⏳" nada={totalSisa > 0 ? "kuning" : "hijau"} />
        <KartuAngka label="Kasbon aktif" nilai={aktif} ikon="👤" nada="netral" sub={`${rows.length - aktif} lunas`} />
      </BarisAngka>
      {boleh && (
        <form
          className="grid gap-3 rounded-2xl border border-matur-100 bg-white p-4 text-sm shadow-sm sm:grid-cols-2 sm:p-5"
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
          <h2 className="text-base font-bold text-kopi-900 sm:col-span-2">➕ Catat pencairan kasbon</h2>
          <label className="font-medium text-stone-700">
            Staf
            <select className={css} name="staf" required>
              {staf.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="font-medium text-stone-700">
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
          <label className="font-medium text-stone-700">
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
          <label className="font-medium text-stone-700">
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
          <label className="font-medium text-stone-700 sm:col-span-2">
            Catatan pencairan / referensi bukti
            <input className={css} name="catatan" minLength={3} required />
          </label>
          <button
            disabled={pending || !staf.length}
            className="rounded-xl bg-matur-500 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-matur-600 disabled:opacity-50 sm:w-fit"
          >
            Simpan pencairan
          </button>
        </form>
      )}
      <section className="space-y-2">
        <h2 className="text-base font-bold text-kopi-900">Riwayat kasbon</h2>
        {rows.length ? (
          <div className={tabel.bungkus}>
            <table className={tabel.tabel}>
              <thead className={tabel.kepala}>
                <tr>
                  {[
                    "Staf / tanggal",
                    "Dicairkan",
                    "Cicilan/bulan",
                    "Terbayar",
                    "Sisa",
                    "Dicadangkan draft",
                    "Status",
                    "Catatan",
                  ].map((l, i) => (
                    <th key={l} className={`${tabel.th} ${i >= 1 && i <= 5 ? "text-right" : ""}`}>
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => {
                  const sisa = x.jumlah - x.terbayar;
                  return (
                    <tr key={x.id} className={tabel.baris}>
                      <td className={tabel.td}>
                        <p className="font-semibold text-kopi-900">{x.nama}</p>
                        <p className="text-xs text-stone-500">{x.tanggal}</p>
                      </td>
                      {[x.jumlah, x.cicilan, x.terbayar, sisa, x.draft].map(
                        (n, i) => (
                          <td
                            key={i}
                            className={`${tabel.td} whitespace-nowrap text-right tabular-nums ${i === 3 && n > 0 ? "font-bold text-amber-700" : ""}`}
                          >
                            {rp(n)}
                          </td>
                        ),
                      )}
                      <td className={tabel.td}>
                        {sisa <= 0 ? (
                          <Badge nada="hijau">Lunas</Badge>
                        ) : x.draft > 0 ? (
                          <Badge nada="biru">Dicadangkan</Badge>
                        ) : (
                          <Badge nada="kuning">Aktif</Badge>
                        )}
                      </td>
                      <td className={`${tabel.td} min-w-40 text-stone-600`}>
                        {x.catatan}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Kosong ikon="🤝" judul="Belum ada pencairan kasbon tercatat." />
        )}
      </section>
    </div>
  );
}
