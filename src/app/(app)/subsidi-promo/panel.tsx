"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah as rp } from "@/lib/format";
import {
  ringkasSubsidi,
  type TagihanSubsidi,
  type MarketingDiskon,
} from "@/lib/subsidi";
import {
  aksiSubsidi,
  bukaBuktiSubsidi,
  unggahBuktiSubsidi,
} from "@/lib/subsidi-actions";
const input = "w-full rounded-lg border border-matur-200 bg-white p-2 text-sm";
const btn =
  "rounded-lg bg-matur-500 px-3 py-2 font-semibold text-white disabled:opacity-50";
const tanggal = (s: string) =>
  new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
export function SubsidiPanel({
  rows,
  marketing,
  outlets,
  dari,
  sampai,
  outlet,
  error,
}: {
  rows: TagihanSubsidi[];
  marketing: MarketingDiskon[];
  outlets: { id: string; nama: string }[];
  dari: string;
  sampai: string;
  outlet: string;
  error?: string;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<{
    row: TagihanSubsidi;
    aksi: "edit" | "bayar" | "batal";
    payment?: string;
  } | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [buktiUrl, setBuktiUrl] = useState("");
  const request = useRef<string>("");
  const [detail, setDetail] = useState<TagihanSubsidi | null>(null);
  const [nama, setNama] = useState(""),
    [nominal, setNominal] = useState(""),
    [catatan, setCatatan] = useState(""),
    [alasan, setAlasan] = useState(""),
    [tgl, setTgl] = useState(""),
    [refund, setRefund] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [path, setPath] = useState("");
  const [status, setStatus] = useState("semua");
  const totals = ringkasSubsidi(rows);
  const lunas = marketing.filter((r) => r.status === "lunas");
  const filtered = rows.filter(
    (r) =>
      status === "semua" ||
      (status === "sisa"
        ? r.target > r.terbayar
        : status === "lunas"
          ? r.target > 0 && r.target === r.terbayar
          : status === "batal"
            ? r.status_transaksi !== "lunas"
            : r.terbayar > r.target),
  );
  const buka = (
    row: TagihanSubsidi,
    aksi: "edit" | "bayar" | "batal",
    payment?: string,
  ) => {
    setEdit({ row, aksi, payment });
    setDetail(null);
    setErr("");
    setNama(row.nama);
    setNominal(
      String(
        aksi === "edit"
          ? row.nominal
          : Math.max(row.target - row.terbayar, row.terbayar - row.target, 0),
      ),
    );
    setCatatan(aksi === "edit" ? row.catatan : "");
    setAlasan("");
    setTgl(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10));
    setRefund(row.target < row.terbayar);
    setFile(null);
    setPath("");
    request.current = crypto.randomUUID();
  };
  const simpan = () =>
    start(async () => {
      if (!edit) return;
      setErr("");
      try {
        let bukti = path;
        if (edit.aksi === "bayar" && !bukti) {
          if (!file) {
            setErr("Pilih bukti pembayaran/pengembalian.");
            return;
          }
          const fd = new FormData();
          fd.set("file", file);
          const up = await unggahBuktiSubsidi(fd);
          if (up.error || !up.path) {
            setErr(up.error ?? "Unggah gagal");
            return;
          }
          bukti = up.path;
          setPath(bukti);
        }
        const p =
          edit.aksi === "edit"
            ? {
                id: edit.row.id,
                versi: edit.row.versi,
                nama,
                nominal: Number(nominal),
                catatan,
                alasan,
              }
            : edit.aksi === "bayar"
              ? {
                  id: edit.row.id,
                  versi: edit.row.versi,
                  request_id: request.current,
                  jumlah: (refund ? -1 : 1) * Number(nominal),
                  tanggal: tgl,
                  bukti,
                  catatan,
                }
              : { id: edit.payment, versi: edit.row.versi, alasan };
        const r = await aksiSubsidi(edit.aksi, p);
        if (r.error) setErr(r.error);
        else {
          setEdit(null);
          router.refresh();
        }
      } catch {
        setErr(
          "Koneksi terputus. Coba simpan kembali untuk memeriksa permintaan yang sama; muat ulang bila data berubah.",
        );
      }
    });
  const bukaBukti = (p: string) =>
    start(async () => {
      setErr("");
      try {
        const r = await bukaBuktiSubsidi(p);
        if (r.error) setErr(r.error);
        else setBuktiUrl(r.url ?? "");
      } catch {
        setErr("Bukti belum dapat dibuka.");
      }
    });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">
          Diskon, Subsidi & Biaya Marketing
        </h1>
        <p className="text-sm text-stone-600">
          Rekap diskon pelanggan, tanggungan subsidi, dan pembayaran kantor.
        </p>
      </header>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm">
          Dari
          <input
            className={input}
            type="date"
            name="dari"
            defaultValue={dari}
          />
        </label>
        <label className="text-sm">
          Sampai
          <input
            className={input}
            type="date"
            name="sampai"
            defaultValue={sampai}
          />
        </label>
        <label className="text-sm">
          Outlet
          <select className={input} name="outlet" defaultValue={outlet}>
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option value={o.id} key={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <button className={btn}>Tampilkan</button>
      </form>
      {(error || err) && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error || err}
        </p>
      )}
      <section className="space-y-3 rounded-xl border bg-white p-4">
        <h2 className="text-lg font-bold">
          Biaya marketing dari diskon & subsidi
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [
              "Diskon biasa (termasuk manual)",
              lunas.reduce(
                (n, r) => n + Number(r.diskon) - Number(r.subsidi),
                0,
              ),
            ],
            [
              "Subsidi sesuai transaksi",
              lunas.reduce((n, r) => n + Number(r.subsidi), 0),
            ],
            [
              "Total potongan marketing",
              lunas.reduce((n, r) => n + Number(r.diskon), 0),
            ],
          ].map(([label, n]) => (
            <div key={label} className="rounded-lg bg-matur-50 p-3">
              <p className="text-xs">{label}</p>
              <b>{rp(Number(n))}</b>
            </div>
          ))}
        </div>
        <p className="rounded-lg bg-amber-50 p-3 text-xs">
          Potongan marketing sudah mengurangi penjualan POS. Rekap ini tidak
          membebankan biaya kedua pada laba. Subsidi belum dibayar bukan uang
          masuk kasir; pembayaran kantor menyelesaikan tagihan dan tidak membuat
          penjualan baru. Void/hapus dikecualikan dari total.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Tanggal / transaksi",
                  "Outlet / operator",
                  "Promo & menu",
                  "Harga awal",
                  "Diskon biasa",
                  "Subsidi",
                  "Bayar pelanggan",
                  "Status",
                ].map((x) => (
                  <th className="p-2" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {marketing.map((r) => (
                <tr className="border-t align-top" key={r.id}>
                  <td className="p-2">
                    {tanggal(r.waktu)} · #{r.nomor}
                  </td>
                  <td className="p-2">
                    {r.outlet}
                    <p className="text-xs text-stone-500">{r.operator}</p>
                  </td>
                  <td className="p-2">
                    <b>{r.nama}</b>
                    {r.nama_subsidi && (
                      <p className="text-xs">{r.nama_subsidi}</p>
                    )}
                    <details>
                      <summary className="cursor-pointer text-xs underline">
                        Rincian menu & diskon
                      </summary>
                      {r.items.map((i, k) => (
                        <p className="text-xs" key={k}>
                          {i.qty} × {i.nama} · {rp(i.harga)} / item
                        </p>
                      ))}
                      <p className="text-xs">
                        Termasuk diskon manual: {rp(r.manual)}
                      </p>
                      {r.catatan && (
                        <p className="text-xs">Catatan: {r.catatan}</p>
                      )}
                      {r.alasan_void && (
                        <p className="text-xs text-red-700">
                          Alasan void: {r.alasan_void}
                        </p>
                      )}
                    </details>
                  </td>
                  <td className="p-2">{rp(r.subtotal)}</td>
                  <td className="p-2">
                    {rp(Number(r.diskon) - Number(r.subsidi))}
                  </td>
                  <td className="p-2">{rp(r.subsidi)}</td>
                  <td className="p-2">{rp(r.total)}</td>
                  <td className="p-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!marketing.length && (
          <p className="text-sm text-stone-500">
            Belum ada diskon pada periode ini.
          </p>
        )}
      </section>
      <section className="space-y-3 rounded-xl border bg-white p-4">
        <h2 className="text-lg font-bold">Tagihan subsidi kantor</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Tagihan aktif", totals.tagihan],
            ["Pembayaran bersih kantor", totals.dibayar],
            ["Belum dibayar", totals.sisa],
            ["Lebih bayar / perlu pengembalian", totals.lebih],
          ].map(([label, n]) => (
            <div key={label} className="rounded-lg bg-green-50 p-3">
              <p className="text-xs">{label}</p>
              <b>{rp(Number(n))}</b>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-500">
          Periode mengikuti tanggal transaksi, dengan status pembayaran terkini.
          Koreksi tagihan hanya mengubah administrasi subsidi, bukan struk atau
          uang pelanggan. Nama dan nominal awal tetap tersimpan dalam riwayat.
        </p>
        <label className="block max-w-xs text-sm">
          Status
          <select
            className={input}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="semua">Semua</option>
            <option value="sisa">Belum / sebagian dibayar</option>
            <option value="lunas">Lunas</option>
            <option value="batal">Transaksi void / dihapus</option>
            <option value="lebih">Perlu pengembalian</option>
          </select>
        </label>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Tanggal / No.",
                  "Outlet / nama subsidi",
                  "Tagihan",
                  "Dibayar kantor",
                  "Sisa / lebih bayar",
                  "Status",
                  "Aksi",
                ].map((x) => (
                  <th className="p-2" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr className="border-t" key={r.id}>
                  <td className="p-2">
                    {r.tanggal} · #{r.nomor}
                  </td>
                  <td className="p-2">
                    <b>{r.outlet}</b>
                    <p>{r.nama}</p>
                  </td>
                  <td className="p-2">
                    {rp(r.target)}
                    <p className="text-xs text-stone-500">
                      Awal {rp(r.nominal_awal)}
                    </p>
                  </td>
                  <td className="p-2">{rp(r.terbayar)}</td>
                  <td className="p-2">
                    {rp(Math.max(r.target - r.terbayar, 0))}
                    {r.terbayar > r.target && (
                      <p className="text-xs text-red-700">
                        Lebih {rp(r.terbayar - r.target)}
                      </p>
                    )}
                  </td>
                  <td className="p-2">
                    {r.status_transaksi !== "lunas"
                      ? "Void / dihapus"
                      : r.target === r.terbayar
                        ? "Lunas"
                        : r.terbayar > r.target
                          ? "Lebih bayar"
                          : r.terbayar > 0
                            ? "Sebagian"
                            : "Belum dibayar"}
                  </td>
                  <td className="space-x-2 p-2">
                    <button
                      className="underline"
                      disabled={pending}
                      onClick={() => setDetail(r)}
                    >
                      Rincian
                    </button>
                    {r.status_transaksi === "lunas" && (
                      <button
                        className="underline"
                        disabled={pending}
                        onClick={() => buka(r, "edit")}
                      >
                        Edit
                      </button>
                    )}
                    {(r.target > r.terbayar || r.terbayar > 0) && (
                      <button
                        className="underline"
                        disabled={pending}
                        onClick={() => buka(r, "bayar")}
                      >
                        Pembayaran
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <p className="text-sm text-stone-500">
            Tidak ada tagihan sesuai filter.
          </p>
        )}
      </section>
      {detail && (
        <Modal
          scrollable
          wide
          title={`Rincian subsidi · #${detail.nomor}`}
          onClose={() => setDetail(null)}
        >
          <div className="space-y-4 text-sm">
            <p>
              <b>{detail.nama}</b> · {detail.outlet} · {detail.tanggal}
            </p>
            <p>
              Bayar pelanggan {rp(detail.pelanggan_bayar)} · Subsidi awal{" "}
              {rp(detail.nominal_awal)} · Tagihan saat ini {rp(detail.target)}
            </p>
            {detail.items.map((i, k) => (
              <p key={k}>
                {i.qty} × {i.nama} · {rp(i.harga)} / item
              </p>
            ))}
            <p>{detail.catatan}</p>
            <h3 className="font-bold">Riwayat pembayaran / pengembalian</h3>
            {detail.pembayaran.map((p) => (
              <article key={p.id} className="space-y-1 rounded-lg border p-3">
                <p>
                  {p.tanggal} · {p.jumlah < 0 ? "Pengembalian" : "Pembayaran"}{" "}
                  {rp(Math.abs(p.jumlah))} {p.batal_at && " · Dibatalkan"}
                </p>
                <p>{p.catatan}</p>
                {p.alasan_batal && <p>Alasan koreksi: {p.alasan_batal}</p>}
                <button
                  className="mr-3 underline"
                  disabled={pending}
                  onClick={() => bukaBukti(p.bukti)}
                >
                  Lihat bukti
                </button>
                {!p.batal_at && (
                  <button
                    className="underline"
                    disabled={pending}
                    onClick={() => buka(detail, "batal", p.id)}
                  >
                    Koreksi / batalkan catatan
                  </button>
                )}
              </article>
            ))}
            {!detail.pembayaran.length && <p>Belum ada pembayaran kantor.</p>}
            <h3 className="font-bold">Riwayat perubahan</h3>
            {detail.riwayat.map((r, i) => (
              <details key={i} className="rounded-lg border p-2">
                <summary>
                  {tanggal(r.waktu)} · {r.pengguna ?? "Pengguna"} · {r.aksi}
                </summary>
                <p>
                  Alasan:{" "}
                  {String(r.nilai_baru?.alasan ?? r.nilai_baru?.catatan ?? "—")}
                </p>
                {r.nilai_lama?.nominal !== undefined && (
                  <p>
                    Nominal lama {rp(Number(r.nilai_lama.nominal))} →{" "}
                    {rp(Number(r.nilai_baru?.nominal ?? 0))}
                  </p>
                )}
                {r.nilai_lama?.nama !== undefined && (
                  <p>
                    Nama lama: {String(r.nilai_lama.nama)} →{" "}
                    {String(r.nilai_baru?.nama ?? "—")}
                  </p>
                )}
              </details>
            ))}
          </div>
        </Modal>
      )}
      {edit && (
        <Modal
          scrollable
          title={
            edit.aksi === "edit"
              ? "Edit tagihan subsidi"
              : edit.aksi === "bayar"
                ? "Catat pembayaran kantor"
                : "Koreksi catatan pembayaran"
          }
          onClose={() => !pending && setEdit(null)}
        >
          <div className="space-y-3 text-sm">
            <p>
              {edit.row.outlet} · #{edit.row.nomor} · {edit.row.nama}
            </p>
            {edit.aksi === "edit" && (
              <label className="block">
                Nama subsidi
                <input
                  className={input}
                  value={nama}
                  maxLength={120}
                  onChange={(e) => setNama(e.target.value)}
                />
              </label>
            )}
            {edit.aksi !== "batal" && (
              <label className="block">
                Nominal (Rp)
                <input
                  className={input}
                  type="number"
                  min={edit.aksi === "edit" ? 0 : 1}
                  step="1"
                  value={nominal}
                  onChange={(e) => setNominal(e.target.value)}
                />
              </label>
            )}
            {edit.aksi === "bayar" && (
              <>
                <label className="block">
                  Jenis
                  <select
                    className={input}
                    value={refund ? "refund" : "bayar"}
                    onChange={(e) => setRefund(e.target.value === "refund")}
                  >
                    <option value="bayar">Pembayaran kantor</option>
                    <option value="refund">Pengembalian ke kantor</option>
                  </select>
                </label>
                <label className="block">
                  Tanggal
                  <input
                    className={input}
                    type="date"
                    value={tgl}
                    onChange={(e) => setTgl(e.target.value)}
                  />
                </label>
                <label className="block">
                  Bukti (JPG, PNG, PDF · maks. 5 MB)
                  <input
                    className={input}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setPath("");
                    }}
                  />
                </label>
                {path && (
                  <p className="text-xs text-green-700">
                    Bukti sudah diunggah.
                  </p>
                )}
              </>
            )}
            {edit.aksi !== "batal" && (
              <label className="block">
                Catatan
                <input
                  className={input}
                  value={catatan}
                  maxLength={500}
                  onChange={(e) => setCatatan(e.target.value)}
                />
              </label>
            )}
            {edit.aksi !== "bayar" && (
              <label className="block">
                Alasan perubahan (wajib)
                <textarea
                  className={input}
                  value={alasan}
                  maxLength={500}
                  onChange={(e) => setAlasan(e.target.value)}
                />
              </label>
            )}
            <p className="rounded-lg bg-amber-50 p-2 text-xs">
              Koreksi tidak memindahkan uang bank secara otomatis. Riwayat dan
              bukti lama tetap tersimpan. Untuk salah nominal pembayaran,
              batalkan catatannya lalu catat kembali nilai yang benar.
            </p>
            {err && (
              <p role="alert" className="text-red-700">
                {err}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="rounded-lg border px-3 py-2"
                disabled={pending}
                onClick={() => setEdit(null)}
              >
                Batal
              </button>
              <button className={btn} disabled={pending} onClick={simpan}>
                {pending ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {buktiUrl && (
        <Modal title="Bukti pembayaran subsidi" onClose={() => setBuktiUrl("")}>
          <a
            className="font-semibold underline"
            href={buktiUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Buka / unduh bukti
          </a>
          <p className="mt-2 text-xs text-stone-500">
            Tautan berlaku 60 detik. Buka ulang jika kedaluwarsa.
          </p>
        </Modal>
      )}
    </div>
  );
}
