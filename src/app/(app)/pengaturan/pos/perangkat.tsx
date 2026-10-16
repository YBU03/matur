"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  aturTablet,
  resetAksesPos,
  batalPindahPos,
  mintaPindahPos,
  selesaikanPindahPos,
  type PosHasil,
} from "@/lib/pos-tim-actions";
import type { PanelData } from "./view";
export type Pindah = {
  id: string;
  sesi_id: string;
  asal_nama: string;
  tujuan_nama: string;
  admin_nama: string;
  alasan: string;
  diminta_at: string;
  aman_at: string;
  bersih_at: string | null;
  selesai_at: string | null;
  batal_at: string | null;
  risiko_diakui: boolean;
};
const wib = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    : "Belum tercatat";
const input = "mt-1 w-full rounded-xl border bg-white p-2.5 text-sm";
export function PerangkatPanel({ data: d }: { data: PanelData }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<PosHasil>({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const r = setInterval(() => router.refresh(), 15000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [router]);
  const run = (f: () => Promise<PosHasil>) =>
    start(async () => {
      try {
        const r = await f();
        setMsg(r);
        if (!r.error) router.refresh();
      } catch {
        setMsg({
          error:
            "Perubahan belum dapat dikonfirmasi. Periksa koneksi lalu coba lagi.",
        });
      }
    });
  const nama = (id: string) =>
    d.outlets.find((x) => x.id === id)?.nama ?? "Outlet";
  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-sky-50 p-4 text-sm">
        <b>Pindah perangkat tetap satu shift dan satu sesi kas.</b>
        <p className="mt-1">
          Modal, tim, transaksi, akun outlet tetap sama. Perangkat lama
          dihentikan saat terhubung; jika offline, proses menunggu batas izin
          lamanya agar dua perangkat tidak berjualan bersamaan.
        </p>
        <Link
          href="/pengaturan/pos/simulasi"
          className="mt-3 inline-block rounded-xl bg-kopi-900 px-4 py-2 font-bold text-white"
        >
          Coba simulasi POS · tanpa mengubah data asli
        </Link>
      </div>
      {(msg.error || msg.ok) && (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}
      <form
        className="space-y-3 rounded-2xl border border-amber-300 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (
            confirm(
              "Reset ikatan perangkat? Transaksi, modal dan sesi tim tetap ada. Perangkat pertama yang login dengan PIN valid akan mengambil sesi tersebut.",
            )
          )
            run(() =>
              resetAksesPos(
                String(f.get("outlet")) || null,
                String(f.get("alasan")),
              ),
            );
        }}
      >
        <h2 className="font-bold">Reset akses POS yang tersangkut</h2>
        <p className="text-xs text-stone-500">
          Gunakan setelah izin offline lama habis. Membatalkan permintaan pindah
          yang belum selesai, mengaktifkan perangkat, dan melepas ikatan sesi
          tim. Jadwal, absensi, kode/PIN, modal dan transaksi tetap berlaku.
        </p>
        <select name="outlet" aria-label="Outlet reset" className={input}>
          <option value="">Semua outlet</option>
          {d.outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
        <input
          name="alasan"
          minLength={5}
          required
          placeholder="Alasan reset akses"
          aria-label="Alasan reset akses"
          className={input}
        />
        <button
          disabled={busy}
          className="rounded-xl border px-4 py-2 text-sm font-bold"
        >
          Reset akses perangkat
        </button>
      </form>
      <h2 className="text-lg font-bold">Perangkat & petugas POS</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {d.devices.map((v) => (
          <article
            key={v.id}
            className="space-y-3 rounded-2xl border bg-white p-4"
          >
            <div className="flex justify-between gap-2">
              <b>{v.nama}</b>
              <span
                className={`rounded-full px-3 py-1 text-xs ${v.status === "aktif" ? "bg-green-50 text-green-800" : "bg-stone-100"}`}
              >
                {v.status}
              </span>
            </div>
            <p className="text-sm">
              {nama(v.outlet_id)} · {v.mode === "antrean" ? "Antrean" : "Kasir"}{" "}
              · ID {v.id.slice(0, 8)}
            </p>
            <p className="break-all text-xs text-stone-500">
              {v.info_perangkat ??
                "Info browser tersedia setelah perangkat terhubung kembali."}
            </p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-stone-500">
                  Terakhir login POS oleh
                </dt>
                <dd className="font-semibold">
                  {v.login_nama ?? "Belum tercatat"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">
                  Operator PIN terakhir
                </dt>
                <dd className="font-semibold">
                  {v.operator_nama ?? "Belum membuka POS"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Pembuka shift aktif</dt>
                <dd>
                  {v.pembuka_nama ?? "Tidak ada sesi aktif di perangkat ini"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Waktu login</dt>
                <dd>{wib(v.login_at)}</dd>
              </div>
            </dl>
            <p className="text-xs text-stone-500">
              Terakhir terhubung: {wib(v.terlihat_at)}. Antrean terakhir:{" "}
              {v.antrean_jumlah ?? "belum diketahui"}
              {v.antrean_at && ` (${wib(v.antrean_at)})`}. Informasi ini bukan
              jaminan perangkat masih online.
            </p>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  confirm(
                    `${v.status === "aktif" ? "Nonaktifkan" : "Aktifkan"} akses ${v.nama}? Riwayat dan data kas tetap disimpan.`,
                  )
                )
                  run(() =>
                    aturTablet(
                      v.id,
                      v.status !== "aktif",
                      String(f.get("alasan")),
                    ),
                  );
              }}
            >
              <input
                name="alasan"
                aria-label={`Alasan akses ${v.nama}`}
                required
                minLength={3}
                placeholder="Alasan perubahan akses"
                className="min-w-40 flex-1 rounded-xl border p-2 text-sm"
              />
              <button
                disabled={busy}
                className="rounded-xl border px-3 py-2 text-sm font-semibold"
              >
                {v.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </form>
          </article>
        ))}
      </div>
      <h2 className="text-lg font-bold">Pindahkan sesi ke perangkat ini</h2>
      {d.sessions
        .filter((s) => !s.ditutup_at)
        .map((s) => {
          const pending = (d.pindah ?? []).find(
            (r) => r.sesi_id === s.id && !r.selesai_at && !r.batal_at,
          );
          const asal = d.devices.find((v) => v.id === s.perangkat_id);
          return (
            <article
              key={s.id}
              className="space-y-3 rounded-2xl border bg-white p-4"
            >
              <b>
                {nama(s.outlet_id)} · {s.nama}
              </b>
              <p className="text-sm">
                Pembuka: {s.pembuka_nama ?? "Belum tercatat"} · perangkat:{" "}
                {asal?.nama ??
                  (s.legacy
                    ? "Sesi lama"
                    : "Menunggu login setelah reset")}{" "}
                · mulai {wib(s.buka_at)}
              </p>
              {s.legacy ? (
                <p className="text-sm text-amber-800">
                  Sesi skema lama perlu pemeriksaan Owner/SPV. Untuk mencoba POS
                  tanpa menyentuh sesi ini, gunakan Simulasi POS di atas.
                </p>
              ) : !s.perangkat_id ? (
                <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
                  Reset berhasil. Buka{" "}
                  <Link href="/pos" className="font-bold underline">
                    POS di perangkat ini
                  </Link>{" "}
                  lalu masukkan kode staf dan PIN yang sama. Sesi dan modal
                  diteruskan otomatis.
                </p>
              ) : pending ? (
                <>
                  <p className="rounded-xl bg-amber-50 p-3 text-sm">
                    Tujuan: <b>{pending.tujuan_nama}</b>.{" "}
                    {pending.bersih_at
                      ? "Perangkat asal sudah mengunci dan melaporkan antrean bersih."
                      : now < Date.parse(pending.aman_at)
                        ? `Menunggu izin offline lama berakhir sampai ${wib(pending.aman_at)} (${Math.max(0, Math.ceil((Date.parse(pending.aman_at) - now) / 1000))} detik), atau konfirmasi antrean bersih dari perangkat asal.`
                        : "Izin offline lama sudah berakhir. Antrean yang belum diketahui tetap perlu diperiksa; bukti transaksi lama tidak dihapus."}
                  </p>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      if (
                        confirm(
                          "Lanjutkan sesi kas yang sama pada perangkat ini? Akses transaksi baru dari perangkat lama akan dicabut.",
                        )
                      )
                        run(() =>
                          selesaikanPindahPos(
                            pending.id,
                            f.get("akui") === "on",
                          ),
                        );
                    }}
                  >
                    {!pending.bersih_at && (
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" name="akui" required />
                        <span>
                          Saya memahami antrean perangkat lama belum dapat
                          dipastikan. Saya akan memeriksa sinkronisasinya dan
                          tidak menghapus data perangkat lama.
                        </span>
                      </label>
                    )}
                    <button
                      disabled={
                        busy ||
                        (!pending.bersih_at &&
                          now < Date.parse(pending.aman_at))
                      }
                      className="rounded-xl bg-kopi-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Selesaikan pindah ke perangkat ini
                    </button>
                  </form>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const alasan = prompt(
                        "Alasan membatalkan perpindahan (minimal 5 karakter):",
                      );
                      if (alasan && alasan.trim().length >= 5)
                        run(() => batalPindahPos(pending.id, alasan));
                    }}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Batalkan permintaan pindah
                  </button>
                </>
              ) : (
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      confirm(
                        "Kunci POS lama untuk proses pindah? Shift tidak ditutup. Setelah siap, selesaikan perpindahan dari browser ini.",
                      )
                    )
                      run(() =>
                        mintaPindahPos(
                          s.id,
                          String(f.get("nama")),
                          String(f.get("alasan")),
                        ),
                      );
                  }}
                >
                  <label className="text-sm">
                    Nama perangkat ini
                    <input
                      className={input}
                      name="nama"
                      required
                      minLength={3}
                      maxLength={100}
                      placeholder="Contoh: Laptop Admin / Tablet kasir 2"
                    />
                  </label>
                  <label className="text-sm">
                    Alasan pindah
                    <input
                      className={input}
                      name="alasan"
                      required
                      minLength={5}
                      maxLength={1000}
                      placeholder="Contoh: Tablet lama kehabisan baterai"
                    />
                  </label>
                  <button
                    disabled={busy}
                    className="rounded-xl bg-kopi-900 px-4 py-3 text-sm font-bold text-white"
                  >
                    Pindahkan POS ke perangkat ini
                  </button>
                </form>
              )}
            </article>
          );
        })}
      {!d.sessions.some((s) => !s.ditutup_at) && (
        <p className="text-sm text-stone-500">Tidak ada sesi kas aktif.</p>
      )}
      <h2 className="text-lg font-bold">Riwayat perpindahan</h2>
      {(d.pindah ?? []).map((r) => (
        <article key={r.id} className="rounded-xl border bg-white p-3 text-sm">
          <b>
            {r.asal_nama} → {r.tujuan_nama}
          </b>
          <p>
            Diminta {r.admin_nama} · {wib(r.diminta_at)} ·{" "}
            {r.batal_at
              ? `dibatalkan ${wib(r.batal_at)}`
              : r.selesai_at
                ? `selesai ${wib(r.selesai_at)}`
                : "menunggu penyelesaian"}
          </p>
          <p className="text-stone-500">
            {r.alasan}
            {r.risiko_diakui &&
              !r.bersih_at &&
              " · Antrean lama perlu pemeriksaan lanjutan"}
          </p>
        </article>
      ))}
    </section>
  );
}
