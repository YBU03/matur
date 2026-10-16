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
import { Badge, Kartu, Kosong, isian } from "@/components/ui-halaman";
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
const input = `mt-1 w-full ${isian}`;
const tombolUtama =
  "rounded-xl bg-kopi-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-kopi-700 disabled:opacity-40";
const tombolGaris =
  "rounded-xl border border-matur-200 bg-white px-4 py-2 text-sm font-semibold text-kopi-900 hover:bg-matur-50 disabled:opacity-50";
const nadaStatus = (v: string) =>
  v === "aktif"
    ? "hijau"
    : v === "menunggu"
      ? "kuning"
      : ["dicabut", "nonaktif"].includes(v)
        ? "merah"
        : "netral";
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
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-950">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-lg shadow-sm">
          🔄
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <b>Pindah perangkat tetap satu shift dan satu sesi kas.</b>
          <p className="mt-1">
            Modal, tim, transaksi, akun outlet tetap sama. Perangkat lama
            dihentikan saat terhubung; jika offline, proses menunggu batas izin
            lamanya agar dua perangkat tidak berjualan bersamaan.
          </p>
          <Link
            href="/pengaturan/pos/simulasi"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-kopi-900 px-4 py-2 font-bold text-white shadow-sm hover:bg-kopi-700"
          >
            🧪 Coba simulasi POS · tanpa mengubah data asli
          </Link>
        </div>
      </div>
      {(msg.error || msg.ok) && (
        <p
          role="status"
          className={`rounded-xl border p-3 text-sm font-medium ${msg.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {msg.error ? "⚠️ " : "✅ "}
          {msg.error ?? msg.ok}
        </p>
      )}
      <form
        className="space-y-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm sm:p-5"
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
        <h2 className="text-base font-bold text-kopi-900">
          🛟 Reset akses POS yang tersangkut
        </h2>
        <p className="text-xs text-stone-600">
          Gunakan setelah izin offline lama habis. Membatalkan permintaan pindah
          yang belum selesai, mengaktifkan perangkat, dan melepas ikatan sesi
          tim. Jadwal, absensi, kode/PIN, modal dan transaksi tetap berlaku.
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
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
        </div>
        <button
          disabled={busy}
          className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-50 disabled:opacity-50"
        >
          Reset akses perangkat
        </button>
      </form>
      <h2 className="text-lg font-bold text-kopi-900">
        📱 Perangkat & petugas POS
      </h2>
      {!d.devices.length && (
        <Kosong ikon="📱" judul="Belum ada perangkat POS terdaftar" />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {d.devices.map((v) => (
          <article
            key={v.id}
            className="space-y-3 rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <b className="min-w-0 break-words text-kopi-900">{v.nama}</b>
              <Badge nada={nadaStatus(v.status)}>{v.status}</Badge>
            </div>
            <p className="text-sm text-stone-700">
              {nama(v.outlet_id)} · {v.mode === "antrean" ? "Antrean" : "Kasir"}{" "}
              · ID {v.id.slice(0, 8)}
            </p>
            <p className="break-all text-xs text-stone-500">
              {v.info_perangkat ??
                "Info browser tersedia setelah perangkat terhubung kembali."}
            </p>
            <dl className="grid gap-3 rounded-xl bg-stone-50 p-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-stone-500">
                  Terakhir login POS oleh
                </dt>
                <dd className="font-semibold text-kopi-900">
                  {v.login_nama ?? "Belum tercatat"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">
                  Operator PIN terakhir
                </dt>
                <dd className="font-semibold text-kopi-900">
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
                className={`min-w-0 flex-1 basis-40 ${isian}`}
              />
              <button
                disabled={busy}
                className={
                  v.status === "aktif"
                    ? "rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    : tombolGaris
                }
              >
                {v.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </form>
          </article>
        ))}
      </div>
      <h2 className="text-lg font-bold text-kopi-900">
        🔀 Pindahkan sesi ke perangkat ini
      </h2>
      {d.sessions
        .filter((s) => !s.ditutup_at)
        .map((s) => {
          const pending = (d.pindah ?? []).find(
            (r) => r.sesi_id === s.id && !r.selesai_at && !r.batal_at,
          );
          const asal = d.devices.find((v) => v.id === s.perangkat_id);
          return (
            <Kartu
              key={s.id}
              className="space-y-3"
              judul={`${nama(s.outlet_id)} · ${s.nama}`}
              aksi={
                pending ? (
                  <Badge nada="kuning">Menunggu pindah</Badge>
                ) : s.legacy ? (
                  <Badge nada="ungu">Skema lama</Badge>
                ) : (
                  <Badge nada="hijau">● Kas buka</Badge>
                )
              }
            >
              <p className="text-sm text-stone-700">
                Pembuka: {s.pembuka_nama ?? "Belum tercatat"} · perangkat:{" "}
                {asal?.nama ??
                  (s.legacy
                    ? "Sesi lama"
                    : "Menunggu login setelah reset")}{" "}
                · mulai {wib(s.buka_at)}
              </p>
              {s.legacy ? (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  Sesi skema lama perlu pemeriksaan Owner/SPV. Untuk mencoba POS
                  tanpa menyentuh sesi ini, gunakan Simulasi POS di atas.
                </p>
              ) : !s.perangkat_id ? (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  Reset berhasil. Buka{" "}
                  <Link href="/pos" className="font-bold underline">
                    POS di perangkat ini
                  </Link>{" "}
                  lalu masukkan kode staf dan PIN yang sama. Sesi dan modal
                  diteruskan otomatis.
                </p>
              ) : pending ? (
                <>
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    ⏳ Tujuan: <b>{pending.tujuan_nama}</b>.{" "}
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
                      <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-white p-3 text-sm">
                        <input
                          type="checkbox"
                          name="akui"
                          required
                          className="mt-0.5 accent-matur-600"
                        />
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
                      className={tombolUtama}
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
                    className={tombolGaris}
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
                  <label className="text-sm font-medium text-stone-700">
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
                  <label className="text-sm font-medium text-stone-700">
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
                    className={`sm:col-span-2 sm:justify-self-start ${tombolUtama}`}
                  >
                    Pindahkan POS ke perangkat ini
                  </button>
                </form>
              )}
            </Kartu>
          );
        })}
      {!d.sessions.some((s) => !s.ditutup_at) && (
        <Kosong ikon="💤" judul="Tidak ada sesi kas aktif" />
      )}
      <h2 className="text-lg font-bold text-kopi-900">
        🕘 Riwayat perpindahan
      </h2>
      {(d.pindah ?? []).length ? (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-matur-100 bg-white shadow-sm">
          {(d.pindah ?? []).map((r) => (
            <li key={r.id} className="space-y-1 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-kopi-900">
                  {r.asal_nama} <span className="text-stone-400">→</span>{" "}
                  {r.tujuan_nama}
                </b>
                {r.batal_at ? (
                  <Badge nada="merah">Dibatalkan</Badge>
                ) : r.selesai_at ? (
                  <Badge nada="hijau">Selesai</Badge>
                ) : (
                  <Badge nada="kuning">Menunggu penyelesaian</Badge>
                )}
              </div>
              <p className="text-xs text-stone-500">
                Diminta {r.admin_nama} · {wib(r.diminta_at)}
                {r.batal_at
                  ? ` · dibatalkan ${wib(r.batal_at)}`
                  : r.selesai_at
                    ? ` · selesai ${wib(r.selesai_at)}`
                    : ""}
              </p>
              <p className="text-stone-600">
                {r.alasan}
                {r.risiko_diakui && !r.bersih_at && (
                  <>
                    {" "}
                    <Badge nada="kuning">
                      Antrean lama perlu pemeriksaan lanjutan
                    </Badge>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Kosong ikon="🕘" judul="Belum ada riwayat perpindahan" />
      )}
    </section>
  );
}
