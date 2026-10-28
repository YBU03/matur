"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Kiriman, ItemKiriman } from "@/lib/kiriman";
import type { Kop } from "@/lib/pdf-kop";
import {
  qtyInvoice,
  type IsiDokumen,
  type JenisDokumen,
} from "@/lib/gudang-dokumen-model";
import { ringkasInvoice } from "@/lib/gudang-invoice";
import { aksiEditorGudang } from "@/lib/gudang-editor-actions";
import {
  PengaturanCetakGudang,
  useCetakGudang,
} from "@/components/gudang-cetak";
import { PanelTtd } from "@/components/gudang-ttd";
import { kotakTtdAwal, type KotakTtd } from "@/lib/gudang-ttd";
import {
  PreviewDokumen,
  usePreviewDokumen,
} from "@/components/gudang-dokumen-preview";
import { formatRupiah as rp } from "@/lib/format";
import { Modal } from "@/components/confirm-edit";
const field = "mt-1 block w-full rounded-lg border bg-white p-2";
type Outlet = {
  id: string;
  nama: string;
  alamat: string | null;
  telepon: string | null;
};
export function EditorDokumen({
  jenis,
  k,
  items,
  outlets,
  pt,
  revisi,
}: {
  jenis: JenisDokumen;
  k: Kiriman;
  items: ItemKiriman[];
  outlets: Outlet[];
  pt: Kop;
  revisi: { versi: number; aksi: string; waktu: string }[];
}) {
  const doc = k.dokumen?.find((d) => d.jenis === jenis),
    awal = doc?.isi;
  const [due, setDue] = useState(awal?.jatuh_tempo ?? ""),
    [note, setNote] = useState(awal?.catatan ?? k.catatan ?? ""),
    [phone, setPhone] = useState(
      awal?.telepon_gudang ?? pt.telepon ?? "62 856-9786-5737",
    );
  const [mode, setMode] = useState<IsiDokumen["tagih_mode"]>(
      awal?.tagih_mode ?? "sama",
    ),
    [outlet, setOutlet] = useState(awal?.tagih_outlet ?? ""),
    [nama, setNama] = useState(awal?.identitas?.tagih.nama ?? ""),
    [alamat, setAlamat] = useState(awal?.identitas?.tagih.alamat ?? ""),
    [telp, setTelp] = useState(awal?.identitas?.tagih.telepon ?? "");
  const [baris, setBaris] = useState<IsiDokumen["baris"]>(awal?.baris ?? {}),
    [versi, setVersi] = useState(doc?.versi ?? 0),
    [refresh, setRefresh] = useState(false),
    [msg, setMsg] = useState(""),
    [busy, start] = useTransition(),
    [pdf, setPdf] = usePreviewDokumen(),
    [confirm, setConfirm] = useState(false),
    [ttdPanel, setTtdPanel] = useState(false);
  const [cetak, setCetak] = useCetakGudang(),
    router = useRouter();
  function payload(): IsiDokumen {
    const selected =
      mode === "sama" ? k.outlet : outlets.find((o) => o.id === outlet);
    const unchanged =
      mode === awal?.tagih_mode &&
      (outlet || null) === (awal?.tagih_outlet ?? null) &&
      !refresh;
    const tagih =
      mode === "manual"
        ? { nama, alamat, telepon: telp }
        : unchanged && awal?.identitas?.tagih
          ? awal.identitas.tagih
          : {
              nama: selected?.nama ?? "",
              alamat: selected?.alamat ?? "",
              telepon: selected?.telepon ?? "",
            };
    const company = refresh ? pt : (awal?.identitas?.perusahaan ?? pt);
    return {
      jatuh_tempo: due || null,
      catatan: note,
      telepon_gudang: phone,
      tagih_mode: mode,
      tagih_outlet: outlet || null,
      baris,
      item_basis: Object.fromEntries(
        items.map((i) => [
          i.id,
          { qty: qtyInvoice(k, i), harga: Number(i.harga) },
        ]),
      ),
      identitas: {
        perusahaan: { ...company, telepon: phone },
        kirim:
          !refresh && awal?.identitas?.kirim
            ? awal.identitas.kirim
            : {
                nama: k.outlet?.nama ?? "",
                alamat: k.outlet?.alamat ?? "",
                telepon: k.outlet?.telepon ?? "",
              },
        tagih,
      },
    };
  }
  const lokal = {
      ...k,
      dokumen: [{ jenis, isi: payload(), terbit: null, versi, arsip_at: null }],
    },
    r = ringkasInvoice(lokal, items);
  const inputKey = JSON.stringify([
    due,
    note,
    phone,
    mode,
    outlet,
    nama,
    alamat,
    telp,
    baris,
    refresh,
  ]);
  const [publishedKey, setPublishedKey] = useState<string | null>(
    doc?.terbit && JSON.stringify(doc.terbit) === JSON.stringify(doc.isi)
      ? inputKey
      : null,
  );
  const valid =
    (jenis !== "invoice" || r.valid) &&
    phone.trim().length >= 5 &&
    (!due || due >= k.tanggal) &&
    (mode !== "manual" || nama.trim().length >= 2) &&
    (mode !== "outlet" || !!outlet);
  async function save(aksi: "simpan" | "terbit") {
    const data = payload();
    const a = await aksiEditorGudang("editor_dokumen_gudang", {
      id: k.id,
      jenis,
      aksi,
      versi,
      ...data,
      tagih: data.identitas?.tagih,
      refresh_identitas: refresh,
    });
    if (a.error) throw new Error(a.error);
    if (!a.document) throw new Error("Dokumen belum dapat dimuat. Muat ulang.");
    setVersi(Number(a.data));
    setMsg(
      aksi === "terbit" ? "Versi dokumen diterbitkan." : "Draft tersimpan.",
    );
    if (aksi === "terbit") setPublishedKey(inputKey);
    router.refresh();
    return { versi: Number(a.data), document: a.document };
  }
  function run(aksi: "simpan" | "terbit") {
    if (!valid) {
      setMsg("Periksa isian, diskon/pajak, tujuan tagihan dan total.");
      return;
    }
    start(async () => {
      try {
        await save(aksi);
        setConfirm(false);
      } catch (e) {
        setConfirm(false);
        setMsg(e instanceof Error ? e.message : "Belum tersimpan.");
      }
    });
  }
  function preview(ttd: KotakTtd[]) {
    if (!valid) return;
    start(async () => {
      try {
        const saved = await save("simpan");
        const { cetakDokumen } = await import("../dokumen");
        const current = {
          ...lokal,
          dokumen: [
            {
              ...saved.document,
              terbit: publishedKey === inputKey ? saved.document.terbit : null,
            },
          ],
        };
        setPdf(await cetakDokumen(jenis, current, items, pt, cetak, ttd));
        setTtdPanel(false);
      } catch (e) {
        setTtdPanel(false);
        setMsg(e instanceof Error ? e.message : "Pratinjau gagal dibuat.");
      }
    });
  }
  return (
    <main className="mx-auto max-w-5xl space-y-4">
      {pdf && <PreviewDokumen pdf={pdf} onClose={() => setPdf(null)} />}
      {ttdPanel && (
        <PanelTtd
          judul="Pratinjau dokumen"
          awal={kotakTtdAwal(k, pt)}
          busy={busy}
          onUnduh={preview}
          onTutup={() => setTtdPanel(false)}
        />
      )}
      {confirm && (
        <Modal
          title="Terbitkan revisi dokumen?"
          onClose={() => setConfirm(false)}
        >
          <p className="text-sm">
            Identitas, diskon dan pajak pada versi ini akan dipakai untuk
            dokumen terbit dan laporan. Pergerakan stok tidak berubah.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              disabled={busy}
              onClick={() => setConfirm(false)}
              className="rounded-lg border px-4 py-2"
            >
              Batal
            </button>
            <button
              disabled={busy}
              onClick={() => run("terbit")}
              className="rounded-lg bg-stone-800 px-4 py-2 text-white"
            >
              Ya, Terbitkan
            </button>
          </div>
        </Modal>
      )}
      <Link href="/gudang/kiriman" className="text-sm underline">
        ← Riwayat Kiriman
      </Link>
      <h1 className="text-2xl font-bold">
        Edit {jenis === "invoice" ? "Invoice" : "Surat Jalan"} · {k.nomor}
      </h1>
      <nav className="flex flex-wrap gap-2">
        <Link
          href={"?jenis=invoice"}
          className="rounded-lg border bg-white px-3 py-2"
        >
          Invoice
        </Link>
        <Link
          href={"?jenis=surat-jalan"}
          className="rounded-lg border bg-white px-3 py-2"
        >
          Surat Jalan
        </Link>
        <Link
          href="/gudang/outlet"
          className="rounded-lg border bg-white px-3 py-2"
        >
          Kelola Outlet
        </Link>
      </nav>
      {doc?.arsip_at ? (
        <p className="rounded-xl bg-red-50 p-4 text-red-700">
          Dokumen diarsipkan. Pulihkan melalui{" "}
          <Link href="/gudang/dokumen-arsip" className="underline">
            Arsip Dokumen
          </Link>{" "}
          sebelum mengedit.
        </p>
      ) : (
        <>
          <p className="rounded-xl border bg-amber-50 p-3 text-sm">
            Simpan draft untuk menyimpan isian. Pratinjau menyimpan draft
            sebelum membuat PDF. Terbitkan setelah pemeriksaan agar versi ini
            dipakai pada dokumen utama dan laporan. Perubahan draft tidak
            menimpa versi terbit sebelumnya.
          </p>
          <section className="grid gap-4 rounded-2xl border bg-white p-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Nomor Gudang
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={40}
                className={field}
              />
            </label>
            {jenis === "invoice" && (
              <label className="text-sm font-semibold">
                Jatuh tempo
                <input
                  type="date"
                  min={k.tanggal}
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className={field}
                />
              </label>
            )}
            <label className="text-sm font-semibold sm:col-span-2">
              Catatan
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                className={field}
              />
            </label>
            <div className="text-sm">
              <h2 className="font-bold">Kirim ke (tujuan stok)</h2>
              <p>{payload().identitas?.kirim.nama}</p>
              <p>{payload().identitas?.kirim.alamat || "Alamat belum diisi"}</p>
              <p>Telp: {payload().identitas?.kirim.telepon || "Belum diisi"}</p>
            </div>
            {jenis === "invoice" && (
              <div className="space-y-2 text-sm">
                <label className="font-semibold">
                  Tagih ke
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as typeof mode)}
                    className={field}
                  >
                    <option value="sama">Sama dengan outlet penerima</option>
                    <option value="outlet">Pilih outlet lain</option>
                    <option value="manual">Isi manual</option>
                  </select>
                </label>
                {mode === "outlet" && (
                  <label className="block">
                    Outlet tagihan
                    <select
                      value={outlet}
                      onChange={(e) => setOutlet(e.target.value)}
                      className={field}
                    >
                      <option value="">Pilih outlet</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nama}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {mode === "manual" ? (
                  <>
                    <label className="block">
                      Nama pihak yang ditagih
                      <input
                        value={nama}
                        onChange={(e) => setNama(e.target.value)}
                        maxLength={150}
                        className={field}
                      />
                    </label>
                    <label className="block">
                      Alamat tagihan
                      <textarea
                        value={alamat}
                        onChange={(e) => setAlamat(e.target.value)}
                        maxLength={600}
                        className={field}
                      />
                    </label>
                    <label className="block">
                      Nomor telepon tagihan
                      <input
                        type="tel"
                        value={telp}
                        onChange={(e) => setTelp(e.target.value)}
                        maxLength={40}
                        className={field}
                      />
                    </label>
                  </>
                ) : (
                  <p>
                    {payload().identitas?.tagih.nama}
                    <br />
                    {payload().identitas?.tagih.alamat}
                    <br />
                    Telp: {payload().identitas?.tagih.telepon || "Belum diisi"}
                  </p>
                )}
              </div>
            )}
            <label className="flex gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={refresh}
                onChange={(e) => setRefresh(e.target.checked)}
              />
              Ambil ulang logo, alamat dan kontak terbaru dari master. Identitas
              yang tersimpan tetap dipakai jika tidak dipilih.
            </label>
          </section>
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-stone-50 text-left">
                  <th className="p-3">Barang</th>
                  <th>Qty</th>
                  <th>Harga</th>
                  {jenis === "invoice" && (
                    <>
                      <th>Diskon (Rp)</th>
                      <th>Pajak (Rp)</th>
                    </>
                  )}
                  <th className="p-3 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const b = Math.round(qtyInvoice(k, i) * Number(i.harga)),
                    v = baris[i.id] ?? { diskon: 0, pajak: 0 };
                  return (
                    <tr key={i.id} className="border-t">
                      <td className="p-3">
                        {i.nama}
                        <br />
                        <span className="text-xs text-stone-500">
                          {i.satuan}
                        </span>
                      </td>
                      <td>{qtyInvoice(k, i)}</td>
                      <td>{rp(Number(i.harga))}</td>
                      {jenis === "invoice" &&
                        (["diskon", "pajak"] as const).map((key) => (
                          <td key={key}>
                            <input
                              aria-label={key + " " + i.nama}
                              type="number"
                              min={0}
                              max={key === "diskon" ? b : 1e12}
                              step={1}
                              value={v[key]}
                              onChange={(e) =>
                                setBaris({
                                  ...baris,
                                  [i.id]: {
                                    ...v,
                                    [key]: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-28 rounded-lg border p-2"
                            />
                          </td>
                        ))}
                      <td className="p-3 text-right font-semibold">
                        {rp(
                          b -
                            (jenis === "invoice" ? v.diskon : 0) +
                            (jenis === "invoice" ? v.pajak : 0),
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {jenis === "invoice" && (
            <p className="rounded-xl border bg-white p-4 text-sm">
              Subtotal {rp(r.barang)} − diskon {rp(r.diskon)} + pajak{" "}
              {rp(r.pajak)} + penyesuaian {rp(r.penyesuaian)} ={" "}
              <b>Total {rp(r.total)}</b>
              {!r.valid && (
                <span role="alert" className="block text-red-700">
                  Periksa diskon/pajak: total tidak boleh negatif dan diskon
                  maksimal nilai baris.
                </span>
              )}
            </p>
          )}
          <PengaturanCetakGudang opsi={cetak} onChange={setCetak} />
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || !valid}
              onClick={() => run("simpan")}
              className="rounded-xl border bg-white px-4 py-3 disabled:opacity-50"
            >
              Simpan Draft
            </button>
            <button
              disabled={busy || !valid || !items.length}
              onClick={() => setTtdPanel(true)}
              className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Memproses…" : "Pratinjau Dokumen"}
            </button>
            <button
              disabled={busy || !valid}
              onClick={() => setConfirm(true)}
              className="rounded-xl bg-stone-800 px-4 py-3 text-white disabled:opacity-50"
            >
              Terbitkan Revisi
            </button>
          </div>
        </>
      )}
      {msg && (
        <p role="status" className="rounded-lg border bg-white p-3 text-sm">
          {msg}
        </p>
      )}
      <section className="rounded-xl border bg-white p-4 text-sm">
        <h2 className="font-bold">Riwayat revisi tersimpan</h2>
        {revisi.length ? (
          revisi.map((v) => (
            <p key={v.versi} className="mt-2 border-t pt-2">
              Versi {v.versi} · {v.aksi} ·{" "}
              {new Date(v.waktu).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}
            </p>
          ))
        ) : (
          <p>Belum ada revisi.</p>
        )}
      </section>
    </main>
  );
}
