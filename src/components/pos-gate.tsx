"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TimStatus } from "@/lib/pos-tim";
import { bukaPos, mintaTablet, type PosHasil } from "@/lib/pos-tim-actions";
export function PosGate({
  status: s,
  outlet,
  namaSaya,
  saya,
  tablet = false,
}: {
  status: TimStatus;
  outlet: string;
  namaSaya: string;
  saya: string;
  /** tablet outlet terpasang: tanpa tautan ke ruang karyawan */
  tablet?: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<PosHasil>({});
  const [slot, setSlot] = useState(() => {
    const x = s.roster.find((r) => r.id === saya) ?? s.roster[0];
    return x ? `${x.shift_id}|${x.tanggal}` : "";
  });
  const roster = s.roster.filter((r) => `${r.shift_id}|${r.tanggal}` === slot);
  const [anggota, setAnggota] = useState<string[]>(
    s.roster
      .filter((r) => `${r.shift_id}|${r.tanggal}` === slot)
      .map((r) => r.id),
  );
  const cls = "mt-1 w-full rounded-xl border p-3 text-sm";
  const run = (f: () => Promise<PosHasil>) =>
    start(async () => {
      try {
        const r = await f();
        setMsg(r);
        if (!r.error) router.refresh();
      } catch {
        setMsg({ error: "Koneksi terputus. Coba lagi saat online." });
      }
    });
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-2 text-2xl font-bold">
          {tablet && s.sesi && s.sesi.perangkat_sama && !s.sesi.legacy
            ? "Buka kunci dengan PIN"
            : "POS masih terkunci"}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {outlet} · {namaSaya}
        </p>
      </div>
      {!s.device ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => mintaTablet(String(f.get("nama"))));
          }}
        >
          <p className="text-sm">
            Perangkat ini belum didaftarkan. POS hanya dapat dibuka di tablet
            outlet yang disetujui HRD/Admin Gudang.
          </p>
          <label className="block text-sm">
            Nama tablet outlet
            <input
              className={cls}
              required
              minLength={3}
              name="nama"
              placeholder="Contoh: Tablet Kasir Usman Janatin"
            />
          </label>
          <button
            disabled={busy}
            className="w-full rounded-xl bg-kopi-900 p-3 font-bold text-white"
          >
            Ajukan Tablet Outlet
          </button>
        </form>
      ) : s.device.status !== "aktif" ? (
        <div className="space-y-3 rounded-xl bg-amber-50 p-4 text-sm">
          <b>
            {s.device.nama} · {s.device.status}
          </b>
          <p>
            ID permintaan: {s.device.id.slice(0, 8)}. Hubungi admin untuk
            pemeriksaan perangkat fisik dan persetujuan.
          </p>
          <button
            disabled={busy}
            onClick={() => router.refresh()}
            className="rounded-lg border bg-white p-2"
          >
            Periksa persetujuan
          </button>
        </div>
      ) : s.sesi && (!s.sesi.perangkat_sama || s.sesi.legacy) ? (
        <div className="rounded-xl bg-amber-50 p-4 text-sm">
          <b>Sudah ada sesi kas terbuka</b>
          <p>
            {s.sesi.nama}.{" "}
            {s.sesi.legacy
              ? "Sesi lama perlu ditutup oleh SPV/Owner terlebih dahulu, tanpa menghapus riwayat."
              : "Lanjutkan pada tablet yang membuka sesi tersebut. Tidak boleh membuka sesi kas kedua."}
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              bukaPos(
                String(f.get("kode")),
                String(f.get("pin")),
                Number(f.get("modal") ?? 0),
                anggota,
              ),
            );
          }}
          className="space-y-3"
        >
          <p className="rounded-xl bg-matur-50 p-3 text-sm">
            Tablet disetujui: <b>{s.device.nama}</b>. Gunakan kode staf dan PIN
            dari HRD/Admin Gudang.{" "}
            {s.sesi
              ? "Anggota tim yang masih bertugas (termasuk barista) bisa membuka kunci; pembayaran hanya oleh anggota berakses kasir."
              : "Clock In dahulu di HP masing-masing. Pembuka shift wajib memiliki akses kasir dan menghitung modal laci."}
          </p>
          {s.sesi && (
            <p className="rounded-xl bg-stone-50 p-3 text-sm">
              Lanjutkan sesi <b>{s.sesi.nama}</b>. PIN harus milik anggota yang
              masih bertugas; bila jam berakhir, minta perpanjangan SPV.{" "}
              <Link href="/kasir/shift" className="font-bold underline">
                Hitung/tutup kas
              </Link>
            </p>
          )}
          <label className="block text-sm font-semibold">
            Kode staf
            <input
              name="kode"
              required
              autoCapitalize="none"
              autoComplete="off"
              className={cls}
            />
          </label>
          <label className="block text-sm font-semibold">
            PIN POS
            <input
              name="pin"
              required
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{4,6}"
              className={cls}
            />
          </label>
          {!s.sesi && (
            <>
              <label className="block text-sm font-semibold">
                Shift tim
                <select
                  value={slot}
                  required
                  onChange={(e) => {
                    setSlot(e.target.value);
                    setAnggota(
                      s.roster
                        .filter(
                          (r) =>
                            `${r.shift_id}|${r.tanggal}` === e.target.value,
                        )
                        .map((r) => r.id),
                    );
                  }}
                  className={cls}
                >
                  <option value="">Pilih shift yang sudah diabsen</option>
                  {[
                    ...new Map(
                      s.roster.map((r) => [`${r.shift_id}|${r.tanggal}`, r]),
                    ).entries(),
                  ].map(([key, r]) => (
                    <option key={key} value={key}>
                      {r.shift} · {r.tanggal}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="space-y-2 rounded-xl border p-3">
                <legend className="text-sm font-bold">
                  Konfirmasi anggota yang sudah hadir
                </legend>
                {roster.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={anggota.includes(r.id)}
                      onChange={(e) =>
                        setAnggota(
                          e.target.checked
                            ? [...anggota, r.id]
                            : anggota.filter((x) => x !== r.id),
                        )
                      }
                    />
                    {r.nama}
                    {r.kasir ? " · akses kasir" : ""}
                  </label>
                ))}
                {!roster.length && (
                  <p className="text-sm text-amber-700">
                    Belum ada kehadiran dengan jadwal terbit. Absen dan periksa
                    jadwal terlebih dahulu.
                  </p>
                )}
              </fieldset>
              <label className="block text-sm font-semibold">
                Modal awal uang fisik di laci
                <input
                  name="modal"
                  type="number"
                  min="0"
                  step="1"
                  required
                  className={cls}
                />
              </label>
            </>
          )}
          <button
            disabled={busy || (!s.sesi && !anggota.length)}
            className="w-full rounded-xl bg-matur-500 p-3 font-bold text-white disabled:opacity-40"
          >
            {busy
              ? "Memeriksa…"
              : s.sesi
                ? "Buka kembali sesi tim"
                : "Buka POS Tim"}
          </button>
        </form>
      )}
      {(msg.error || msg.ok) && (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}
      {!tablet && (
        <Link
          href="/karyawan"
          className="block text-center text-sm font-semibold underline"
        >
          Kembali ke Dashboard & Absen
        </Link>
      )}
    </div>
  );
}
