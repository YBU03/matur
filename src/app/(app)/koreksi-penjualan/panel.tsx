"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/confirm-edit";
import {
  rincianPenjualan,
  simpanPenjualan,
} from "@/lib/koreksi-penjualan-actions";
import {
  totalKoreksi,
  type PreviewPenjualan,
  type PermintaanPenjualan,
  type RincianPenjualan,
  type TransaksiKoreksi,
} from "@/lib/koreksi-penjualan";
import { formatRupiah as rp } from "@/lib/format";
type Shift = {
  id: string;
  tanggal_shift: string;
  nama_kasir: string | null;
  setoran: number | null;
  seharusnya: number | null;
  selisih: number | null;
};
const methods = [
  "tunai",
  "qris",
  "debit",
  "transfer",
  "gofood",
  "grabfood",
  "shopeefood",
  "tiktok",
  "ruma_app",
  "shopeepay",
];
const channels = [
  "langsung",
  "gofood",
  "grabfood",
  "shopeefood",
  "tiktok",
  "ruma_app",
];
export function KoreksiPenjualan({
  outlets,
  outlet,
  dari,
  sampai,
  sales,
  menus,
  shifts,
  error,
}: {
  outlets: { id: string; nama: string }[];
  outlet: string;
  dari: string;
  sampai: string;
  sales: TransaksiKoreksi[];
  menus: {
    id: string;
    nama: string;
    harga_langsung: number;
    harga_ojol: number;
  }[];
  shifts: Shift[];
  error?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pesan, setPesan] = useState(error ?? "");
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState("lunas");
  const [form, setForm] = useState<PermintaanPenjualan>();
  const [detail, setDetail] = useState<RincianPenjualan>();
  const [menuCari, setMenuCari] = useState("");
  const [preview, setPreview] = useState<PreviewPenjualan>();
  const update = (p: Partial<PermintaanPenjualan>) => {
    setPreview(undefined);
    setForm((f) => f && { ...f, ...p, request_id: crypto.randomUUID() });
  };
  const buka = (id: string, aksi: "edit" | "hapus" | "pulihkan") =>
    start(async () => {
      try {
        const r = await rincianPenjualan(id);
        if (!r.data) {
          setPesan(r.error ?? "Gagal memuat");
          return;
        }
        setPreview(undefined);
        setDetail(r.data);
        const t = r.data.transaksi;
        setForm({
          request_id: crypto.randomUUID(),
          aksi,
          outlet_id: outlet,
          id,
          sidik: r.data.sidik,
          sesi_id: t.sesi_kas_id,
          tanggal: shifts.find((s) => s.id === t.sesi_kas_id)?.tanggal_shift,
          kanal: t.kanal,
          metode: r.data.bayar[0]?.metode,
          diskon: t.diskon,
          items: r.data.items,
          alasan: "",
        });
        setPesan("");
      } catch {
        setPesan("Gagal memuat. Coba lagi.");
      }
    });
  const tambah = () => {
    setPreview(undefined);
    setDetail(undefined);
    setForm({
      request_id: crypto.randomUUID(),
      aksi: "tambah",
      outlet_id: outlet,
      sesi_id: shifts[0]?.id,
      tanggal: shifts[0]?.tanggal_shift,
      jam: "21:00",
      jam_pasti: false,
      kanal: "langsung",
      metode: "tunai",
      diskon: 0,
      items: [],
      alasan: "",
    });
    setPesan("");
  };
  const tampil = sales.filter(
    (t) =>
      (status === "semua" || t.status === status) &&
      `${t.nomor} ${t.kanal} ${t.total}`
        .toLowerCase()
        .includes(cari.toLowerCase()),
  );
  const input = "block w-full rounded border border-stone-300 p-2";
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-bold">Koreksi Penjualan</h1>
      <p className="text-sm text-stone-600">
        Tambah penjualan tertinggal, edit menu/jumlah/harga/pembayaran, atau
        pindahkan ke tempat sampah. Semua perubahan memerlukan alasan dan
        menyimpan riwayat. Setoran aktual tidak diubah otomatis.
      </p>
      <form className="flex flex-wrap items-end gap-3">
        <label>
          Outlet
          <select name="outlet" defaultValue={outlet} className={input}>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dari
          <input
            name="dari"
            type="date"
            defaultValue={dari}
            required
            className={input}
          />
        </label>
        <label>
          Sampai
          <input
            name="sampai"
            type="date"
            defaultValue={sampai}
            required
            className={input}
          />
        </label>
        <button className="rounded border p-2">Tampilkan</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending || !shifts.length}
          onClick={tambah}
          className="rounded bg-kopi-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          + Tambah penjualan susulan
        </button>
        <Link
          className="rounded border p-2"
          href={`/catatan-harian?outlet=${outlet}&bulan=${dari.slice(0, 7)}`}
        >
          Catatan Harian & rekonsiliasi kas
        </Link>
        <Link className="rounded border p-2" href="/laporan-pos/transaksi">
          Laporan & ekspor penjualan
        </Link>
      </div>
      {!shifts.length && (
        <p className="text-amber-800">
          Belum ada shift tertutup dalam periode ini. Pilih tanggal transaksi
          asli.
        </p>
      )}
      {pesan && (
        <p role="status" className="rounded bg-amber-50 p-3">
          {pesan}
        </p>
      )}
      <div className="flex gap-2">
        <input
          aria-label="Cari transaksi"
          placeholder="Cari nomor, kanal, nominal…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          className={input}
        />
        <select
          aria-label="Status transaksi"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={input}
        >
          <option value="lunas">Lunas</option>
          <option value="dihapus">Tempat sampah</option>
          <option value="semua">Semua</option>
        </select>
      </div>
      <p>
        {tampil.length} catatan · Total lunas{" "}
        {rp(
          tampil
            .filter((t) => t.status === "lunas")
            .reduce((n, t) => n + t.total, 0),
        )}
        {sales.length === 1000 &&
          " · Batas 1.000 baris, perkecil periode untuk melihat semua"}
      </p>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Waktu WIB", "No.", "Kanal", "Total", "Status", "Tindakan"].map(
                (x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {tampil.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3">
                  {new Date(t.created_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}
                  {t.koreksi_penjualan?.jam_pasti === false && (
                    <span className="block text-xs text-amber-800">
                      Jam perkiraan · penjualan susulan
                    </span>
                  )}
                </td>
                <td>#{t.nomor}</td>
                <td>{t.kanal}</td>
                <td>{rp(t.total)}</td>
                <td>{t.status}</td>
                <td className="space-x-2 p-2">
                  {t.status === "lunas" ? (
                    <>
                      <button
                        disabled={pending}
                        className="rounded border p-2"
                        onClick={() => buka(t.id, "edit")}
                      >
                        Edit & riwayat
                      </button>
                      <button
                        disabled={pending}
                        className="rounded border border-red-300 p-2 text-red-800"
                        onClick={() => buka(t.id, "hapus")}
                      >
                        Hapus
                      </button>
                    </>
                  ) : (
                    t.status === "dihapus" && (
                      <button
                        disabled={pending}
                        className="rounded border p-2"
                        onClick={() => buka(t.id, "pulihkan")}
                      >
                        Pulihkan
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal
          title={`${form.aksi === "tambah" ? "Tambah penjualan susulan" : form.aksi === "edit" ? "Edit penjualan" : form.aksi === "hapus" ? "Hapus ke tempat sampah" : "Pulihkan penjualan"}`}
          scrollable
          onClose={() => !pending && setForm(undefined)}
        >
          <form
            className="space-y-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                try {
                  const r = await simpanPenjualan({
                    ...form,
                    pratinjau: !preview,
                    sidik_preview: preview?.sidik_preview,
                  });
                  setPesan(r.error ?? (preview ? r.ok : "") ?? "");
                  if (!r.error) {
                    if (preview) {
                      setForm(undefined);
                      setPreview(undefined);
                      router.refresh();
                    } else setPreview(r.data);
                  } else setPreview(undefined);
                } catch {
                  setPesan(
                    "Koneksi terputus. Kirim ulang data yang sama untuk memeriksa hasil; permintaan tidak digandakan.",
                  );
                }
              });
            }}
          >
            {pesan && (
              <p role="alert" className="rounded bg-amber-50 p-2">
                {pesan}
              </p>
            )}
            {form.aksi === "tambah" && (
              <>
                <label className="block">
                  Shift / tanggal transaksi
                  <select
                    required
                    className={input}
                    value={form.sesi_id}
                    disabled={pending}
                    onChange={(e) =>
                      update({
                        sesi_id: e.target.value,
                        tanggal: shifts.find((s) => s.id === e.target.value)
                          ?.tanggal_shift,
                      })
                    }
                  >
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.tanggal_shift} · {s.nama_kasir}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Jam WIB
                  <input
                    type="time"
                    required
                    value={form.jam}
                    disabled={pending}
                    onChange={(e) => update({ jam: e.target.value })}
                    className={input}
                  />
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={form.jam_pasti}
                    disabled={pending}
                    onChange={(e) => update({ jam_pasti: e.target.checked })}
                  />
                  Jam pasti berdasarkan bukti (kosongkan jika perkiraan)
                </label>
              </>
            )}
            {(form.aksi === "tambah" || form.aksi === "edit") && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    Kanal
                    <select
                      value={form.kanal}
                      disabled={pending}
                      className={input}
                      onChange={(e) => update({ kanal: e.target.value })}
                    >
                      {channels.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Metode pembayaran
                    <select
                      value={form.metode}
                      disabled={pending}
                      className={input}
                      onChange={(e) => update({ metode: e.target.value })}
                    >
                      {methods.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  Cari menu
                  <input
                    placeholder="Ketik nama menu…"
                    value={menuCari}
                    disabled={pending}
                    className={input}
                    onChange={(e) => setMenuCari(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Tambah menu"
                  className={input}
                  disabled={pending}
                  value=""
                  onChange={(e) => {
                    const m = menus.find((m) => m.id === e.target.value);
                    if (m)
                      update({
                        items: [
                          ...(form.items ?? []),
                          {
                            menu_id: m.id,
                            nama: m.nama,
                            qty: 1,
                            harga:
                              form.kanal === "langsung"
                                ? m.harga_langsung
                                : m.harga_ojol,
                            varian_ids: [],
                          },
                        ],
                      });
                  }}
                >
                  <option value="">+ Pilih menu untuk ditambahkan</option>
                  {menus
                    .filter((m) =>
                      m.nama.toLowerCase().includes(menuCari.toLowerCase()),
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-stone-500">
                  Harga diisi sesuai bukti. HPP item lama dipertahankan; item
                  baru memakai resep/HPP saat dicatat. Stok yang sudah dihitung
                  ulang melalui SO tidak dikurangi lagi. Varian item lama tetap
                  dipertahankan.
                </p>
                {(form.items ?? []).map((i, n) => (
                  <div
                    key={`${i.id ?? i.menu_id}-${n}`}
                    className="rounded border p-2"
                  >
                    <b>
                      {i.nama ?? menus.find((m) => m.id === i.menu_id)?.nama}
                    </b>
                    <div className="grid grid-cols-2 gap-2">
                      <label>
                        Jumlah
                        <input
                          type="number"
                          required
                          min="1"
                          max="1000"
                          value={i.qty}
                          disabled={pending}
                          className={input}
                          onChange={(e) =>
                            update({
                              items: form.items?.map((x, j) =>
                                j === n
                                  ? { ...x, qty: Number(e.target.value) }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Harga satuan
                        <input
                          type="number"
                          required
                          min="0"
                          max="100000000"
                          value={i.harga}
                          disabled={pending}
                          className={input}
                          onChange={(e) =>
                            update({
                              items: form.items?.map((x, j) =>
                                j === n
                                  ? { ...x, harga: Number(e.target.value) }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                    <p>{rp(i.qty * i.harga)}</p>
                    <button
                      type="button"
                      disabled={pending}
                      className="text-red-700 underline"
                      onClick={() =>
                        update({ items: form.items?.filter((_, j) => j !== n) })
                      }
                    >
                      Hapus baris
                    </button>
                  </div>
                ))}
                <label className="block">
                  Diskon total transaksi
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.diskon}
                    disabled={pending}
                    className={input}
                    onChange={(e) => update({ diskon: Number(e.target.value) })}
                  />
                </label>
                <p className="text-lg font-bold">
                  Total {rp(totalKoreksi(form.items ?? [], form.diskon))}
                  {detail && ` · sebelumnya ${rp(detail.transaksi.total)}`}
                </p>
              </>
            )}
            {form.aksi === "hapus" && (
              <p>
                Transaksi #{detail?.transaksi.nomor} senilai{" "}
                {rp(detail?.transaksi.total ?? 0)} akan dikeluarkan dari omzet
                dan pembayaran. Data tetap tersimpan dan bisa dipulihkan.
              </p>
            )}
            <p className="rounded bg-sky-50 p-2">
              Kas seharusnya dihitung ulang. Setoran aktual tetap: penjualan
              tunai susulan bisa menimbulkan selisih sampai bukti setoran
              dicocokkan. Laporan bulanan yang sudah diterbitkan perlu ditinjau
              kembali.
            </p>
            <label className="block">
              Alasan / sumber bukti
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={form.alasan}
                disabled={pending}
                className={input}
                onChange={(e) => update({ alasan: e.target.value })}
              />
            </label>
            {detail && (
              <details>
                <summary>Riwayat perubahan ({detail.riwayat.length})</summary>
                {detail.riwayat.map((r, i) => (
                  <div key={i} className="my-2 rounded border p-2">
                    {new Date(r.waktu).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    · {r.nama} · {r.aksi} · {r.baru?.alasan}
                    {r.lama?.transaksi && (
                      <p>
                        Sebelum: {rp(r.lama.transaksi.total)} ·{" "}
                        {r.lama.transaksi.kanal} · {r.lama.transaksi.status}
                      </p>
                    )}
                    {r.baru?.data?.transaksi && (
                      <p>
                        Sesudah: {rp(r.baru.data.transaksi.total)} ·{" "}
                        {r.baru.data.transaksi.kanal} ·{" "}
                        {r.baru.data.transaksi.status}
                      </p>
                    )}
                    {r.lama?.items && (
                      <p className="text-xs">
                        Item sebelumnya:{" "}
                        {r.lama.items
                          .map((x) => `${x.qty} × ${x.nama}: ${rp(x.harga)}`)
                          .join("; ")}
                      </p>
                    )}
                    {r.baru?.data?.items && (
                      <p className="text-xs">
                        Item sesudah:{" "}
                        {r.baru.data.items
                          .map((x) => `${x.qty} × ${x.nama}: ${rp(x.harga)}`)
                          .join("; ")}
                      </p>
                    )}
                  </div>
                ))}
              </details>
            )}
            {preview && (
              <div className="rounded border border-sky-300 bg-sky-50 p-3">
                <b>Pratinjau — belum disimpan</b>
                <p>
                  Kas seharusnya {rp(preview.kas_sebelum.seharusnya)} →{" "}
                  {rp(preview.kas_sesudah.seharusnya)}
                </p>
                <p>
                  Setoran aktual tetap{" "}
                  {preview.kas_sesudah.setoran === null
                    ? "belum dihitung"
                    : rp(preview.kas_sesudah.setoran)}
                </p>
                <p>
                  Selisih{" "}
                  {preview.kas_sesudah.selisih === null
                    ? "belum dihitung"
                    : rp(preview.kas_sesudah.selisih)}
                </p>
                {preview.stok_dilewati_so.length > 0 && (
                  <p>
                    {preview.stok_dilewati_so.length} bahan sudah tercakup SO;
                    saldo stok kini dipertahankan.
                  </p>
                )}
              </div>
            )}
            <button
              disabled={
                pending ||
                !form.alasan.trim() ||
                ((form.aksi === "edit" || form.aksi === "tambah") &&
                  !form.items?.length)
              }
              className="rounded bg-kopi-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {pending
                ? "Memproses…"
                : preview
                  ? "Konfirmasi & simpan perubahan"
                  : "Lihat pratinjau perubahan"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
