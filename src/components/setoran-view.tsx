"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah as rp } from "@/lib/format";
import {
  buatSetoran,
  verifikasiSetoran,
  koreksiRekonsiliasi,
  type Result,
} from "@/lib/operasional-actions";
import { BuktiOperasional } from "./bukti-operasional";
export type HariSetoran = {
  tanggal: string;
  tunai: number;
  qris: number;
  non_tunai: number;
  pengeluaran_laci: number;
  pengeluaran_pusat: number;
  modal_ditahan: number;
  koreksi: number;
  alasan: string | null;
  seharusnya: number;
  disetujui: number;
  menunggu: number;
  sisa: number;
};
export type Setoran = {
  perpindahan_id?: string | null;
  id: string;
  cara: string;
  waktu: string;
  penyetor_nama: string;
  pengambil: string | null;
  penanggung_jawab: string;
  tujuan: string;
  bukti_path: string;
  catatan: string | null;
  status: string;
  alasan_verifikasi: string | null;
  diverifikasi_at: string | null;
  alokasi_setoran: { tanggal: string; jumlah: number }[];
};
const input = "w-full rounded-lg border border-stone-300 bg-white p-2 text-sm";
const waktu = (s: string) =>
  new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
export function SetoranView({
  outlet,
  outlets,
  dari,
  sampai,
  nama,
  finance,
  base,
  hari,
  riwayat,
  urls,
  error,
  sesi,
}: {
  outlet: { id: string; nama: string };
  outlets: { id: string; nama: string }[];
  dari: string;
  sampai: string;
  nama: string;
  finance: boolean;
  base: string;
  hari: HariSetoran[];
  riwayat: Setoran[];
  urls: Record<string, string>;
  error?: string;
  sesi: { id: string; nama_kasir: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result>({});
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [foto, setFoto] = useState("");
  const [client, setClient] = useState(() => crypto.randomUUID());
  const [sumber, setSumber] = useState("");
  const [cara, setCara] = useState("tunai");
  const [filter, setFilter] = useState({ outlet: outlet.id, dari, sampai });
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      try {
        const r = await fn();
        setMsg(r);
        if (!r.error) router.refresh();
      } catch {
        setMsg({
          error: "Pencatatan gagal. Coba lagi dengan formulir yang sama.",
        });
      }
    });
  const rincian = hari
    .filter((h) => Number(nilai[h.tanggal]) > 0)
    .map((h) => ({ tanggal: h.tanggal, jumlah: Number(nilai[h.tanggal]) }));
  const total = rincian.reduce((s, x) => s + x.jumlah, 0);
  const jumlah = (k: keyof HariSetoran) =>
    hari.reduce((s, h) => s + Number(h[k] ?? 0), 0);
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Setoran & Rekonsiliasi Omzet</h1>
        <p className="text-sm text-stone-500">
          {outlet.nama} · Rincian per tanggal omzet, penyerahan uang, dan
          pemeriksaan Akunting.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`${base}?${new URLSearchParams(filter)}`);
        }}
        className="grid gap-2 sm:grid-cols-4"
      >
        <label>
          Outlet
          <select
            className={input}
            value={filter.outlet}
            onChange={(e) => setFilter({ ...filter, outlet: e.target.value })}
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dari tanggal
          <input
            type="date"
            required
            className={input}
            value={filter.dari}
            onChange={(e) => setFilter({ ...filter, dari: e.target.value })}
          />
        </label>
        <label>
          Sampai tanggal
          <input
            type="date"
            required
            className={input}
            value={filter.sampai}
            onChange={(e) => setFilter({ ...filter, sampai: e.target.value })}
          />
        </label>
        <button className="self-end rounded-lg bg-kopi-900 p-2 text-white">
          Tampilkan (maks. 93 hari)
        </button>
      </form>
      {(error || msg.error || msg.ok) && (
        <p
          role="status"
          className={`rounded-xl p-3 ${error || msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}
        >
          {error ?? msg.error ?? msg.ok}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["POS tunai", jumlah("tunai")],
          ["Terverifikasi", jumlah("disetujui")],
          ["Sedang diajukan", jumlah("menunggu")],
          ["Sisa / selisih", jumlah("sisa")],
        ].map(([l, n]) => (
          <div key={l} className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-stone-500">{l}</p>
            <b className="text-xl">{rp(Number(n))}</b>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (!foto || !total)
            return setMsg({
              error: "Isi nominal per tanggal dan unggah bukti.",
            });
          run(async () => {
            const r = await buatSetoran({
              client_id: client,
              outlet_id: outlet.id,
              cara,
              ...(sumber.startsWith("ganti:")
                ? { pengganti_id: sumber.slice(6) }
                : sumber
                  ? { sesi_kas_id: sumber }
                  : {}),
              waktu: new Date(String(fd.get("waktu")) + "+07:00").toISOString(),
              pengambil: String(fd.get("pengambil") ?? ""),
              penanggung_jawab: String(fd.get("pic")),
              tujuan: String(fd.get("tujuan")),
              bukti_path: foto,
              catatan: String(fd.get("catatan")),
              rincian,
            });
            if (!r.error) {
              setSumber("");
              setNilai({});
              setFoto("");
              setClient(crypto.randomUUID());
            }
            return r;
          });
        }}
        className="space-y-4 rounded-2xl border bg-white p-4"
      >
        <h2 className="font-bold">Rincian omzet & nominal yang disetor</h2>
        <p className="text-xs text-stone-500">
          Kas disetor = tunai POS − pengeluaran laci − modal ditahan + koreksi.
          QRIS/non tunai dicocokkan terpisah. Setoran bisa sebagian; pengajuan
          menunggu ikut mengurangi sisa.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-right text-xs">
            <thead>
              <tr>
                {[
                  "Tanggal omzet",
                  "POS tunai",
                  "QRIS",
                  "Non tunai lain",
                  "Keluar laci",
                  "Modal ditahan",
                  "Koreksi",
                  "Wajib setor",
                  "Disetujui",
                  "Menunggu",
                  "Sisa / selisih",
                  "Setor sekarang",
                ].map((x) => (
                  <th key={x} className="p-2">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hari.map((h) => (
                <tr key={h.tanggal} className="border-t">
                  <td className="p-2">{h.tanggal}</td>
                  {(
                    [
                      "tunai",
                      "qris",
                      "non_tunai",
                      "pengeluaran_laci",
                      "modal_ditahan",
                      "koreksi",
                      "seharusnya",
                      "disetujui",
                      "menunggu",
                      "sisa",
                    ] as const
                  ).map((k) => (
                    <td
                      key={k}
                      className={`p-2 ${k === "sisa" && h.sisa < 0 ? "font-bold text-red-600" : ""}`}
                    >
                      {rp(h[k])}
                    </td>
                  ))}
                  <td>
                    <input
                      aria-label={`Nominal setoran ${h.tanggal}`}
                      type="number"
                      min="0"
                      step="1"
                      max={Math.max(0, h.sisa)}
                      disabled={h.sisa <= 0 || pending}
                      value={nilai[h.tanggal] ?? ""}
                      onChange={(e) =>
                        setNilai({ ...nilai, [h.tanggal]: e.target.value })
                      }
                      className="w-32 rounded-lg border p-2"
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="font-bold">Penyerahan / transfer · {rp(total)}</h2>
        <p className="text-sm">
          Staf yang menyerahkan/mengirim: <b>{nama}</b>
        </p>
        <label className="block text-sm">
          Sumber uang / perbaikan bukti
          <select
            className={input}
            value={sumber}
            onChange={(e) => setSumber(e.target.value)}
          >
            <option value="">Uang di luar laci shift aktif</option>
            {sesi.map((x) => (
              <option key={x.id} value={x.id}>
                Laci tim · {x.nama_kasir}
              </option>
            ))}
            {riwayat
              .filter((x) => x.status === "ditolak" && x.perpindahan_id)
              .map((x) => (
                <option key={x.id} value={`ganti:${x.id}`}>
                  Perbaiki bukti uang yang sudah diserahkan · {waktu(x.waktu)}
                </option>
              ))}
          </select>
        </label>
        <p className="text-xs text-stone-500">
          Pilih laci tim jika uang diambil dari kas shift aktif: sisa laci
          langsung berkurang meskipun bukti belum disetujui. Jika bukti ditolak,
          gunakan perbaikan bukti dengan nominal sama agar uang tidak terpotong
          dua kali.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Cara penyerahan
            <select
              value={cara}
              onChange={(e) => {
                setCara(e.target.value);
                setFoto("");
              }}
              className={input}
            >
              <option value="tunai">Tunai diambil petugas</option>
              <option value="transfer">Transfer uang tunai ke rekening</option>
            </select>
          </label>
          <label>
            Waktu penyerahan / transfer (WIB)
            <input
              className={input}
              name="waktu"
              type="datetime-local"
              required
            />
          </label>
          {cara === "tunai" && (
            <label>
              Nama orang yang mengambil
              <input
                className={input}
                name="pengambil"
                required
                minLength={3}
              />
            </label>
          )}
          <label>
            Penanggung jawab
            <input className={input} name="pic" required minLength={3} />
          </label>
          <label>
            {cara === "tunai"
              ? "Tujuan penyerahan / penerima pusat"
              : "Bank, rekening tujuan, dan atas nama"}
            <input className={input} name="tujuan" required minLength={3} />
          </label>
          <BuktiOperasional
            key={`${cara}:${client}`}
            jenis="setoran"
            outlet={outlet.id}
            onChange={setFoto}
            label={
              cara === "tunai"
                ? "Foto orang yang mengambil (wajib)"
                : "Bukti transfer (wajib)"
            }
          />
          <label className="sm:col-span-2">
            Catatan
            <textarea className={input} name="catatan" />
          </label>
        </div>
        <button
          disabled={pending || !foto || !total || !!error}
          className="rounded-xl bg-matur-500 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Menyimpan…" : "Ajukan setoran"}
        </button>
      </form>
      {finance && (
        <details className="rounded-2xl border bg-white p-4">
          <summary className="cursor-pointer font-bold">
            Penyesuaian catatan harian oleh Akunting
          </summary>
          <p className="my-2 text-xs text-stone-500">
            Isi nilai modal ditahan dan koreksi akhir untuk tanggal ini. Nilai
            menggantikan penyesuaian sebelumnya; alasan tercatat di log
            aktivitas. Gunakan koreksi untuk saldo awal atau perbedaan yang
            sudah diperiksa.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() =>
                koreksiRekonsiliasi(
                  outlet.id,
                  String(fd.get("tanggal")),
                  Number(fd.get("modal")),
                  Number(fd.get("koreksi")),
                  String(fd.get("alasan")),
                ),
              );
            }}
            className="grid gap-2 sm:grid-cols-4"
          >
            <label>
              Tanggal
              <input
                name="tanggal"
                type="date"
                defaultValue={sampai}
                required
                className={input}
              />
            </label>
            <label>
              Modal ditahan (nilai akhir)
              <input
                name="modal"
                type="number"
                min="0"
                step="1"
                required
                className={input}
              />
            </label>
            <label>
              Koreksi kas (+/−, nilai akhir)
              <input
                name="koreksi"
                type="number"
                step="1"
                required
                className={input}
              />
            </label>
            <label>
              Alasan
              <input name="alasan" minLength={3} required className={input} />
            </label>
            <button
              disabled={pending}
              className="rounded-lg bg-kopi-900 p-2 text-white"
            >
              Simpan penyesuaian
            </button>
          </form>
          {hari
            .filter((h) => h.alasan)
            .map((h) => (
              <p key={h.tanggal} className="mt-2 text-xs">
                {h.tanggal}: modal {rp(h.modal_ditahan)}, koreksi{" "}
                {rp(h.koreksi)} · {h.alasan}
              </p>
            ))}
        </details>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Riwayat penyerahan (100 terbaru)</h2>
        {!riwayat.length && (
          <p className="text-sm text-stone-500">
            Belum ada setoran yang diajukan.
          </p>
        )}
        {riwayat.map((s) => (
          <article
            key={s.id}
            className="space-y-2 rounded-2xl border bg-white p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <b>
                {s.cara === "tunai" ? "Tunai diambil" : "Transfer"} ·{" "}
                {rp(
                  s.alokasi_setoran.reduce((n, a) => n + Number(a.jumlah), 0),
                )}
              </b>
              <span className="rounded-full bg-matur-50 px-3 py-1 text-xs font-bold">
                {s.status}
              </span>
            </div>
            <p className="text-sm">
              {waktu(s.waktu)} WIB · diserahkan/dikirim {s.penyetor_nama}
              {s.pengambil && ` · diambil ${s.pengambil}`} · PJ{" "}
              {s.penanggung_jawab} · tujuan {s.tujuan}
            </p>
            <p className="text-xs">
              {s.alokasi_setoran
                .map((a) => `${a.tanggal}: ${rp(a.jumlah)}`)
                .join(" · ")}
            </p>
            {s.catatan && <p className="text-sm">{s.catatan}</p>}
            {urls[s.bukti_path] && (
              <a
                href={urls[s.bukti_path]}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm font-semibold text-matur-700 underline"
              >
                Lihat {s.cara === "tunai" ? "foto pengambil" : "bukti transfer"}
              </a>
            )}
            {s.alasan_verifikasi && (
              <p className="text-sm">
                Catatan Akunting: {s.alasan_verifikasi}
                {s.diverifikasi_at && ` · ${waktu(s.diverifikasi_at)} WIB`}
              </p>
            )}
            {finance && s.status === "menunggu" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  run(() =>
                    verifikasiSetoran(
                      s.id,
                      fd.get("keputusan") === "setuju",
                      String(fd.get("alasan")),
                    ),
                  );
                }}
                className="flex flex-wrap gap-2"
              >
                <input
                  name="alasan"
                  placeholder="Hasil pencocokan POS / catatan harian / bukti"
                  minLength={3}
                  required
                  className={`${input} flex-1`}
                />
                <select
                  name="keputusan"
                  className="rounded-lg border p-2 text-sm"
                >
                  <option value="setuju">Setujui</option>
                  <option value="tolak">Tolak / perlu koreksi</option>
                </select>
                <button
                  disabled={pending}
                  className="rounded-lg bg-kopi-900 px-3 py-2 text-sm text-white"
                >
                  Simpan pemeriksaan
                </button>
              </form>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
