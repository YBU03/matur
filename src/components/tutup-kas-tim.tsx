"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah as rp } from "@/lib/format";
import { bacaAntrean } from "@/lib/pos-offline";
import { tutupKasOutlet } from "@/lib/pos-outlet-actions";
import { tutupPos, type PosHasil } from "@/lib/pos-tim-actions";
export type KasTim = {
  kas_harian?: boolean;
  pindah_menunggu?: number;
  id: string;
  nama: string;
  modal: number;
  tunai: number;
  non_tunai: number;
  laci: number;
  keluar: number;
  seharusnya: number;
  ditutup_at: string | null;
  rekap_status: string;
  pending: number;
  aktual: number | null;
  selisih: number | null;
};
export function TutupKasTim({ kas }: { kas: KasTim }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<PosHasil>({});
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border bg-white p-5">
      <h2 className="font-bold">Kas tim · {kas.nama}</h2>
      {!!kas.pindah_menunggu && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {kas.pindah_menunggu} perangkat asal belum melaporkan antrean bersih.
          Rekap tetap sementara sampai sinkronisasi selesai, termasuk setelah
          sesi ditutup.
        </p>
      )}
      <p className="mt-1 text-sm text-stone-500">
        Uang fisik mencakup modal yang masih ada. Setoran ke pusat dicatat
        terpisah melalui dashboard karyawan.
      </p>
      <dl className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Modal", kas.modal],
          ["Penjualan tunai", kas.tunai],
          ["Non tunai", kas.non_tunai],
          ["Pengeluaran laci", kas.laci],
          ["Sudah diserahkan", kas.keluar],
          ["Sisa uang seharusnya", kas.seharusnya],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-stone-500">{label}</dt>
            <dd className="font-semibold">{rp(Number(value))}</dd>
          </div>
        ))}
      </dl>
      {kas.ditutup_at ? (
        <p className="rounded-xl bg-green-50 p-3 text-sm">
          Sesi ditutup · {kas.rekap_status} · uang fisik{" "}
          {rp(Number(kas.aktual))} · selisih {rp(Number(kas.selisih))}
          {kas.pending > 0 &&
            ` · ${kas.pending} transaksi menunggu sinkronisasi`}
        </p>
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              try {
                if (!navigator.onLine) {
                  setMsg({ error: "Hubungkan internet untuk menutup kas." });
                  return;
                }
                const antrean = await bacaAntrean();
                const ids = antrean
                  .filter((x) => x.checkout.sesi_id === kas.id)
                  .map((x) => x.checkout.client_id);
                const r = kas.kas_harian
                  ? await tutupKasOutlet(
                      kas.id,
                      Number(f.get("aktual")),
                      String(f.get("catatan")),
                      ids,
                    )
                  : await tutupPos(
                      kas.id,
                      String(f.get("kode")),
                      String(f.get("pin")),
                      Number(f.get("aktual")),
                      String(f.get("catatan")),
                      ids,
                    );
                setMsg(r);
                if (!r.error) router.refresh();
              } catch {
                setMsg({
                  error:
                    "Kas belum ditutup. Periksa koneksi dan penyimpanan tablet, lalu coba kembali.",
                });
              }
            });
          }}
        >
          <label className="text-sm">
            Uang fisik tersisa termasuk modal
            <input
              name="aktual"
              type="number"
              min="0"
              step="1"
              required
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          {!kas.kas_harian && (
            <>
              <label className="text-sm">
                Kode staf penutup
                <input
                  name="kode"
                  required
                  autoComplete="off"
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
              <label className="text-sm">
                PIN anggota tim / SPV
                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  required
                  autoComplete="off"
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
            </>
          )}
          <label className="text-sm">
            Catatan selisih / transaksi tertunda
            <textarea
              name="catatan"
              maxLength={1000}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <p className="text-xs text-stone-500 sm:col-span-2">
            Jika ada transaksi offline, rekap tetap sementara sampai semuanya
            tersinkron. Selisih tidak otomatis memotong gaji tim.
          </p>
          {kas.kas_harian && (
            <label className="flex gap-2 text-sm sm:col-span-2">
              <input type="checkbox" required />
              Ini penutupan terakhir hari ini. Untuk S1 ke S2/S3, gunakan serah
              terima dari beranda POS.
            </label>
          )}
          <button
            disabled={busy}
            className="rounded-xl bg-kopi-900 p-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Memeriksa…" : "Hitung dan tutup kas hari ini"}
          </button>
        </form>
      )}
      {(msg.error || msg.ok) && (
        <p
          role="status"
          className={`mt-3 rounded-lg p-3 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}
    </section>
  );
}
