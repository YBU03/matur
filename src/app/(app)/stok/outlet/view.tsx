"use client";
import { PETUNJUK_DESIMAL_BAHAN, jumlahBahanTertulis } from "@/lib/keterangan-jumlah-bahan";
import Link from "next/link";
import { minta } from "@/components/dialog-tanya";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  bacaLaporanStok,
  bukaFotoStok,
  fotoStokOutlet,
  perintahStokOutlet,
} from "@/lib/stok-outlet-actions";
import {
  LABEL_GERAK,
  QTY_STOK,
  type BahanOutlet,
  type LaporanStokOutlet,
  type PermintaanStok,
  type TransferStok,
} from "@/lib/stok-outlet";
const inp =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";
const btn =
  "rounded-lg border border-matur-300 px-3 py-2 text-sm font-semibold disabled:opacity-50";
const nf = (n: number) => QTY_STOK.format(Number(n));
type Props = {
  stok: { outlet_id: string | null; bahan_id: string; jumlah: number }[];
  tujuanOutlets: { id: string; nama: string }[];
  outlets: { id: string; nama: string }[];
  outlet: string | null;
  awal: string;
  akhir: string;
  hari: string;
  bahan: BahanOutlet[];
  pengaturan: {
    outlet_id: string;
    bahan_id: string;
    aktif: boolean;
    minimum: number;
  }[];
  data: LaporanStokOutlet;
  permintaan: PermintaanStok[];
  transfer: TransferStok[];
  kelola: boolean;
  pusat: boolean;
  bahanPilih: string | null;
  tabAwal?: string;
};
export function StokOutletView(p: Props) {
  const router = useRouter();
  const [tab, setTab] = useState(
    ["kelola", "laporan", "restock", "transfer"].includes(p.tabAwal ?? "")
      ? p.tabAwal!
      : "kelola",
  );
  const [cari, setCari] = useState("");
  const [nonaktif, setNonaktif] = useState(false);
  const [pending, start] = useTransition();
  const [pesan, setPesan] = useState("");
  const [error, setError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [events, setEvents] = useState(p.data.riwayat);
  const [lanjut, setLanjut] = useState(p.data.lanjut);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const req = useRef<{ payload: string; id: string } | null>(null);
  const [form, setForm] = useState<null | {
    aksi: string;
    bahan: string;
    jumlah: string;
    minimum: string;
    aktif: boolean;
    alasan: string;
    tujuan: string;
  }>(null);
  const [items, setItems] = useState<{ bahan_id: string; jumlah: string }[]>(
    [],
  );
  const [file, setFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const formOpen = !!form;
  useEffect(() => {
    if (formOpen) dialogRef.current?.showModal();
  }, [formOpen]);
  useEffect(() => {
    setEvents(p.data.riwayat);
    setLanjut(p.data.lanjut);
  }, [p.data]);
  const url = (patch: Record<string, string>) =>
    "/stok/outlet?" +
    new URLSearchParams({
      outlet: p.outlet ?? "semua",
      awal: p.awal,
      akhir: p.akhir,
      ...(p.bahanPilih ? { bahan: p.bahanPilih } : {}),
      tab,
      ...patch,
    });
  const nama = (id: string) =>
    [...p.outlets, ...p.tujuanOutlets].find((o) => o.id === id)?.nama ??
    "Outlet";
  const active = (b: string) =>
    p.pengaturan.find((c) => c.outlet_id === p.outlet && c.bahan_id === b)
      ?.aktif ?? true;
  const semua = p.bahan.map((b) => {
    const r = p.stok.find(
      (r) => r.outlet_id === p.outlet && r.bahan_id === b.id,
    );
    const cfg = p.pengaturan.find(
      (c) => c.outlet_id === p.outlet && c.bahan_id === b.id,
    );
    return {
      ...b,
      jumlah: Number(r?.jumlah ?? 0),
      minimum: Number(cfg?.minimum ?? b.stok_min),
      aktif: cfg?.aktif ?? true,
    };
  });
  const rows = semua.filter(
    (b) =>
      (nonaktif || b.aktif) &&
      b.nama.toLowerCase().includes(cari.toLowerCase()),
  );
  const pilihBahan = p.bahan.filter(
    (b) => active(b.id) && b.nama.toLowerCase().includes(cari.toLowerCase()),
  );
  const buka = (aksi: string, bahan = "") => {
    const b = semua.find((b) => b.id === bahan);
    setForm({
      aksi,
      bahan,
      jumlah: "",
      minimum: String(b?.minimum ?? 0),
      aktif: b?.aktif ?? true,
      alasan: "",
      tujuan: p.tujuanOutlets.find((o) => o.id !== p.outlet)?.id ?? "",
    });
    setItems([]);
    setFile(null);
    setPhoto("");
    setError("");
    req.current = null;
  };
  const run = (payload: Record<string, unknown>, selesai?: () => void) =>
    start(async () => {
      setError("");
      setPesan("");
      try {
        const raw = JSON.stringify(payload);
        if (req.current?.payload !== raw)
          req.current = { payload: raw, id: crypto.randomUUID() };
        const r = await perintahStokOutlet({
          ...payload,
          request_id: req.current.id,
        });
        if (r.error) {
          setError(r.error);
          return;
        }
        setPesan(r.ok ?? "Tersimpan");
        req.current = null;
        selesai?.();
        router.refresh();
      } catch {
        setError(
          "Jawaban server belum pasti. Coba lagi dengan isian yang sama; identitas penyimpanan tetap digunakan agar tidak dobel.",
        );
      }
    });
  const simpan = async () => {
    if (!form || !p.outlet || uploading || pending) return;
    setUploading(true);
    try {
      let path = photo;
      if (file && !path) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("outlet", p.outlet);
        const r = await fotoStokOutlet(fd);
        if (r.error) {
          setError(r.error);
          return;
        }
        path = r.path ?? "";
        setPhoto(path);
      }
      const b = semua.find((b) => b.id === form.bahan);
      run(
        {
          aksi: form.aksi,
          outlet_id: p.outlet,
          bahan_id: form.bahan || undefined,
          alasan: form.alasan,
          jumlah: Number(form.jumlah),
          minimum: Number(form.minimum),
          aktif: form.aktif,
          stok_sebelum: b?.jumlah,
          tujuan: form.tujuan || undefined,
          foto: path,
          items: items.map((i) => ({
            bahan_id: i.bahan_id,
            jumlah: Number(i.jumlah),
          })),
        },
        () => setForm(null),
      );
    } catch {
      setError("Foto belum berhasil diunggah. Coba lagi.");
    } finally {
      setUploading(false);
    }
  };
  const lagi = async () => {
    const last = events.at(-1);
    if (!last) return;
    setExportBusy(true);
    try {
      const r = await bacaLaporanStok({
        outlet: p.outlet,
        awal: p.awal,
        akhir: p.akhir,
        bahan: p.bahanPilih,
        batas: p.data.dibaca_at,
        waktu: last.created_at,
        id: last.id,
      });
      if (r.error || !r.data) {
        setError(r.error ?? "Tidak dapat memuat");
        return;
      }
      setEvents([...events, ...r.data.riwayat]);
      setLanjut(r.data.lanjut);
    } finally {
      setExportBusy(false);
    }
  };
  const ekspor = async (jenis: "pdf" | "excel") => {
    setExportBusy(true);
    setError("");
    try {
      const all = [...p.data.riwayat];
      let more = p.data.lanjut;
      while (more) {
        setPesan(`Menyiapkan ekspor: ${all.length} mutasi terbaca…`);
        const last = all.at(-1);
        if (!last) throw Error("Riwayat tidak lengkap");
        const r = await bacaLaporanStok({
          outlet: p.outlet,
          awal: p.awal,
          akhir: p.akhir,
          bahan: p.bahanPilih,
          batas: p.data.dibaca_at,
          waktu: last.created_at,
          id: last.id,
        });
        if (r.error || !r.data) throw Error(r.error ?? "Riwayat belum lengkap");
        if (r.data.lanjut && !r.data.riwayat.length)
          throw Error("Halaman riwayat tidak lengkap");
        all.push(...r.data.riwayat);
        more = r.data.lanjut;
      }
      const { eksporStokOutlet } = await import("@/lib/stok-outlet-ekspor");
      await eksporStokOutlet(
        jenis,
        p.data,
        all,
        `${p.awal} sd ${p.akhir}`,
        p.outlet ? nama(p.outlet) : "Semua outlet yang diizinkan",
      );
      setPesan(
        `Ekspor selesai: ${p.data.ringkasan.length} bahan/lokasi dan ${all.length} mutasi.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Ekspor gagal; tidak ada laporan sebagian yang diunduh",
      );
    } finally {
      setExportBusy(false);
    }
  };
  const action = async (aksi: string, id: string) => {
    const alasan = await minta(
      "Tulis alasan / catatan tindakan (minimal 3 huruf)",
      { judul: "Konfirmasi stok outlet", wajib: true, ya: "Lanjutkan" },
    );
    if (alasan && alasan.trim().length >= 3)
      run({ aksi, id, alasan: alasan.trim() });
  };
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Kelola Stok Outlet</h1>
        <p className="text-sm text-stone-600">
          Stok, restock, transfer dan penggunaan bahan per outlet. Outlet baru
          otomatis tersedia dari master outlet.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <label>
          Outlet
          <select
            className={inp}
            value={p.outlet ?? "semua"}
            onChange={(e) =>
              router.push(url({ outlet: e.target.value, bahan: "" }))
            }
          >
            {p.outlets.length > 1 && (
              <option value="semua">Semua outlet (laporan)</option>
            )}
            {p.outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <Link
          className={btn}
          href={p.outlet ? `/stok?outlet=${p.outlet}` : "/stok"}
        >
          Input SO / hitung fisik
        </Link>
        <Link className={btn} href="/stok-realtime">
          Stok Real-time
        </Link>
        {p.pusat && (
          <Link className={btn} href="/master/bahan">
            Master Bahan
          </Link>
        )}
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Panel stok">
        {[
          ["kelola", "Bahan & Stok"],
          ["laporan", "Penggunaan & Kartu Bahan"],
          ["restock", "Permintaan Restock"],
          ["transfer", "Transfer Outlet"],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`${btn} ${tab === k ? "bg-kopi-900 text-white" : "bg-white"}`}
          >
            {l}
          </button>
        ))}
      </nav>
      {pesan && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm">
          {pesan}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {tab === "kelola" &&
        (!p.outlet ? (
          <p>Pilih satu outlet untuk mengelola bahan dan stok.</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["Bahan aktif", semua.filter((b) => b.aktif).length],
                [
                  "Stok menipis / habis",
                  semua.filter((b) => b.aktif && b.jumlah <= b.minimum).length,
                ],
                [
                  "Perlu cek SO (periode laporan)",
                  p.data.ringkasan.filter((r) => Number(r.so) !== 0).length,
                ],
              ].map(([label, n]) => (
                <div key={label} className="rounded-xl border bg-white p-4">
                  <p className="text-sm text-stone-500">{label}</p>
                  <b className="text-2xl">{n}</b>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex-1">
                Cari bahan
                <input
                  className={inp}
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  placeholder="Ketik nama bahan…"
                />
              </label>
              <label className="self-end p-2">
                <input
                  type="checkbox"
                  checked={nonaktif}
                  onChange={(e) => setNonaktif(e.target.checked)}
                />{" "}
                Tampilkan nonaktif
              </label>
              {p.kelola && (
                <button className={btn} onClick={() => buka("setelan")}>
                  + Tambah / aktifkan bahan outlet
                </button>
              )}
            </div>
            <p className="text-xs text-stone-500">
              Bahan master yang belum diatur tetap aktif mengikuti sistem lama.
              Nonaktif hanya menyembunyikan dari pengelolaan baru; riwayat,
              resep POS, kiriman yang berjalan, dan SO tidak dihapus.
            </p>
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-matur-50">
                  <tr>
                    {[
                      "Bahan",
                      "Stok saat ini",
                      "Minimum outlet",
                      "Status",
                      "Tindakan",
                    ].map((x) => (
                      <th key={x} className="p-3 text-left">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="p-3 font-semibold">{b.nama}</td>
                      <td>
                        {nf(b.jumlah)} {b.satuan_pakai}
                      </td>
                      <td>
                        {nf(b.minimum)} {b.satuan_pakai}
                      </td>
                      <td>
                        {!b.aktif
                          ? "Nonaktif"
                          : b.jumlah <= 0
                            ? "Habis / perlu cek"
                            : b.jumlah <= b.minimum
                              ? "Menipis"
                              : "Cukup"}
                      </td>
                      <td className="flex flex-wrap gap-1 p-2">
                        <Link
                          className={btn}
                          href={url({ bahan: b.id, tab: "laporan" })}
                        >
                          Kartu bahan
                          {p.data.ringkasan.some(
                            (r) => r.bahan_id === b.id && Number(r.so) !== 0,
                          )
                            ? " ⚠ SO"
                            : ""}
                        </Link>
                        {p.kelola && (
                          <>
                            <button
                              className={btn}
                              onClick={() => buka("setelan", b.id)}
                            >
                              Atur / nonaktifkan
                            </button>
                            <button
                              className={btn}
                              onClick={() => buka("koreksi", b.id)}
                            >
                              Koreksi stok
                            </button>
                            <button
                              className={btn}
                              onClick={() => buka("waste", b.id)}
                            >
                              Waste
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="p-5">Tidak ada bahan yang cocok.</p>
              )}
            </div>
          </>
        ))}
      {tab === "laporan" && (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              router.push(
                url({
                  awal: String(f.get("awal")),
                  akhir: String(f.get("akhir")),
                  bahan: String(f.get("bahan")),
                  tab: "laporan",
                }),
              );
            }}
          >
            <label>
              Dari
              <input
                className={inp}
                type="date"
                name="awal"
                required
                max={p.hari}
                defaultValue={p.awal}
              />
            </label>
            <label>
              Sampai
              <input
                className={inp}
                type="date"
                name="akhir"
                required
                max={p.hari}
                defaultValue={p.akhir}
              />
            </label>
            <label>
              Bahan
              <select
                className={inp}
                name="bahan"
                defaultValue={p.bahanPilih ?? ""}
              >
                <option value="">Semua bahan</option>
                {p.bahan.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nama}
                  </option>
                ))}
              </select>
            </label>
            <button className={btn}>Terapkan</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {[
              ["Hari ini", 0],
              ["Kemarin", 1],
              ["7 hari terakhir", 6],
              ["30 hari terakhir", 29],
            ].map(([l, n]) => {
              const date = new Date(Date.parse(p.hari) - Number(n) * 86400000)
                .toISOString()
                .slice(0, 10);
              return (
                <Link
                  className={btn}
                  key={l}
                  href={url({
                    awal: date,
                    akhir: l === "Kemarin" ? date : p.hari,
                    tab: "laporan",
                  })}
                >
                  {l}
                </Link>
              );
            })}
            <Link
              className={btn}
              href={url({
                awal: p.hari.slice(0, 7) + "-01",
                akhir: p.hari,
                tab: "laporan",
              })}
            >
              Bulan ini
            </Link>
            <button
              className={btn}
              disabled={exportBusy}
              onClick={() => ekspor("pdf")}
            >
              Ekspor PDF
            </button>
            <button
              className={btn}
              disabled={exportBusy}
              onClick={() => ekspor("excel")}
            >
              Ekspor Excel
            </button>
          </div>
          <p className="rounded-lg bg-stone-50 p-3 text-sm">{PETUNJUK_DESIMAL_BAHAN} Kolom Masuk adalah penerimaan; Pemakaian resep POS adalah penggunaan teoritis; SO adalah penyesuaian hasil hitung fisik.</p>
          <p className="rounded-lg bg-sky-50 p-3 text-sm">
            Hari operasional mengikuti tutup buku outlet. Saldo awal/akhir
            direkonstruksi dari stok sekarang dan mutasi tersimpan. Pemakaian
            POS adalah hitungan resep, bukan pengukuran fisik. Riwayat tersedia
            sejak{" "}
            {p.data.awal_riwayat
              ? new Date(p.data.awal_riwayat).toLocaleDateString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })
              : "belum ada mutasi"}
            .
          </p>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-matur-50">
                <tr>
                  {[
                    "Outlet / bahan",
                    "Satuan",
                    "Awal",
                    "Masuk",
                    "Resep POS",
                    "Void kembali",
                    "Waste",
                    "Marketing",
                    "SO +/-",
                    "Koreksi +/-",
                    "Keluar lain",
                    "Akhir",
                  ].map((l) => (
                    <th className="p-2 text-left" key={l}>
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.data.ringkasan.map((r) => (
                  <tr key={r.outlet_id + r.bahan_id} className="border-t">
                    <td className="p-2">
                      <Link
                        href={url({
                          outlet: r.outlet_id,
                          bahan: r.bahan_id,
                          tab: "laporan",
                        })}
                        className="underline"
                      >
                        {r.outlet} · {r.nama}
                      </Link>
                    </td>
                    <td>{r.satuan}</td>
                    {(
                      [
                        "awal",
                        "masuk",
                        "pakai",
                        "kembali",
                        "waste",
                        "marketing",
                        "so",
                        "koreksi",
                        "keluar_lain",
                        "akhir",
                      ] as const
                    ).map((k) => (
                      <td
                        key={k}
                        className={`p-2 text-right ${k === "so" && Number(r.so) !== 0 ? "bg-amber-50 font-bold" : ""}`}
                      >
                        {nf(r[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.data.ringkasan.some((r) => Number(r.so) !== 0) && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm">
              ⚠ Ada penyesuaian SO. Buka kartu bahan lalu lihat mutasi SO,
              petugas dan waktunya. Untuk perbaikan stok saat ini gunakan
              Koreksi stok atau SO baru; riwayat lama tetap disimpan.
            </p>
          )}
          <h2 className="font-bold">
            Kartu riwayat bahan{" "}
            {p.bahanPilih
              ? "· " +
                (p.bahan.find((b) => b.id === p.bahanPilih)?.nama ??
                  "Bahan arsip")
              : ""}
          </h2>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {[
                    "Waktu WIB",
                    "Outlet / bahan",
                    "Pergerakan",
                    "Jumlah",
                    "Petugas / catatan",
                  ].map((l) => (
                    <th className="p-2 text-left" key={l}>
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">
                      {new Date(r.created_at).toLocaleString("id-ID", {
                        timeZone: "Asia/Jakarta",
                      })}
                    </td>
                    <td>
                      {r.outlet} · {r.nama}
                    </td>
                    <td>{LABEL_GERAK[r.jenis] ?? r.jenis}</td>
                    <td>
                      {nf(r.jumlah)} {r.satuan}
                    </td>
                    <td className="p-2">
                      {r.petugas ?? "Sistem"} · {r.keterangan ?? "-"}
                      {r.ref_id && (
                        <span className="block text-xs text-stone-400">
                          Ref: {r.ref_id}
                        </span>
                      )}
                      {r.foto && (
                        <button
                          className={btn}
                          onClick={async () => {
                            const w = window.open("about:blank", "_blank");
                            const x = await bukaFotoStok(r.foto!);
                            if (x.url && w) {
                              w.opener = null;
                              w.location.href = x.url;
                            } else {
                              w?.close();
                              setError(
                                x.error ??
                                  "Izinkan jendela baru untuk melihat foto",
                              );
                            }
                          }}
                        >
                          Lihat foto
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!events.length && (
              <p className="p-4">Belum ada mutasi pada periode ini.</p>
            )}
          </div>
          {lanjut && (
            <button className={btn} disabled={exportBusy} onClick={lagi}>
              Muat riwayat berikutnya
            </button>
          )}
          {!!p.data.setelan?.length && (
            <section className="rounded-xl border bg-white p-4">
              <h2 className="font-bold">
                Riwayat pengaturan bahan (100 terbaru pada periode ini)
              </h2>
              <ul className="divide-y text-sm">
                {p.data.setelan.map((r, i) => (
                  <li className="py-2" key={r.created_at + i}>
                    {new Date(r.created_at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    · {r.outlet} · {r.nama}: minimum {nf(r.minimum)},{" "}
                    {r.aktif ? "aktif" : "nonaktif"} · {r.petugas} · {r.alasan}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {tab === "restock" && (
        <>
          <div className="flex flex-wrap gap-2">
            <h2 className="mr-auto font-bold">Permintaan restock</h2>
            {p.kelola && p.outlet && (
              <button className={btn} onClick={() => buka("restock")}>
                + Minta restock
              </button>
            )}
          </div>
          <p className="text-sm text-stone-500">
            Permintaan tidak menambah stok. Gudang memproses menjadi draft
            kiriman; stok bertambah melalui penerimaan kiriman yang sudah ada.
            Menampilkan 100 permintaan terbaru dalam cakupan akses.
          </p>
          {p.permintaan
            .filter((r) => !p.outlet || r.outlet_id === p.outlet)
            .map((r) => (
              <article
                className="space-y-2 rounded-xl border bg-white p-4"
                key={r.id}
              >
                <b>
                  {nama(r.outlet_id)} ·{" "}
                  {r.kiriman?.status === "draft"
                    ? "diproses · draft kiriman"
                    : (r.kiriman?.status ?? r.status)}
                </b>
                <p className="text-xs">
                  {new Date(r.created_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  · {r.id}
                </p>
                <p>
                  {r.items
                    .map((i) => `${i.nama}: ${nf(i.jumlah)} ${i.satuan}`)
                    .join(" · ")}
                </p>
                <p className="text-sm text-stone-600">{r.catatan}</p>
                <div className="flex gap-2">
                  {r.kiriman_id && (
                    <Link
                      className={btn}
                      href={
                        p.pusat
                          ? `/gudang/kiriman/${r.kiriman_id}`
                          : "/operasional/kiriman"
                      }
                    >
                      Buka kiriman {r.kiriman?.nomor}
                    </Link>
                  )}
                  {r.status === "diminta" && (
                    <>
                      {p.pusat && (
                        <button
                          className={btn}
                          disabled={pending}
                          onClick={() => action("proses_restock", r.id)}
                        >
                          Proses jadi draft kiriman
                        </button>
                      )}
                      {p.kelola && (
                        <button
                          className={btn}
                          disabled={pending}
                          onClick={() => action("batal_restock", r.id)}
                        >
                          Batalkan
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
        </>
      )}
      {tab === "transfer" && (
        <>
          <div className="flex gap-2">
            <h2 className="mr-auto font-bold">Transfer antar-outlet</h2>
            {p.kelola && p.outlet && (
              <button className={btn} onClick={() => buka("transfer")}>
                + Ajukan transfer
              </button>
            )}
          </div>
          <p className="rounded-lg bg-sky-50 p-3 text-sm">
            Stok asal berkurang dan tujuan bertambah bersama-sama setelah
            penerimaan dikonfirmasi. Transfer menunggu belum mengubah stok. Jika
            stok asal tidak cukup saat konfirmasi, tidak ada stok yang
            dipindahkan.
          </p>
          {p.transfer
            .filter(
              (r) => !p.outlet || r.asal === p.outlet || r.tujuan === p.outlet,
            )
            .map((r) => (
              <article
                key={r.id}
                className="space-y-2 rounded-xl border bg-white p-4"
              >
                <b>
                  {nama(r.asal)} → {nama(r.tujuan)} · {r.status}
                </b>
                <p>
                  {r.items
                    .map((i) => `${i.nama}: ${nf(i.jumlah)} ${i.satuan}`)
                    .join(" · ")}
                </p>
                <p className="text-sm">{r.catatan}</p>
                <p className="text-xs text-stone-500">
                  {new Date(r.created_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  · {r.id}
                </p>
                {r.status === "menunggu" && p.kelola && (
                  <div className="flex gap-2">
                    {(p.pusat || p.outlet === r.tujuan) && (
                      <button
                        className={btn}
                        disabled={pending}
                        onClick={() => action("terima_transfer", r.id)}
                      >
                        Konfirmasi diterima
                      </button>
                    )}
                    <button
                      className={btn}
                      disabled={pending}
                      onClick={() => action("batal_transfer", r.id)}
                    >
                      Batalkan / tolak
                    </button>
                  </div>
                )}
              </article>
            ))}
        </>
      )}
      {form && (
        <dialog
          ref={dialogRef}
          aria-label="Form stok outlet"
          onCancel={(e) => {
            e.preventDefault();
            if (!pending && !uploading) setForm(null);
          }}
          className="m-auto w-full max-w-xl rounded-2xl bg-transparent p-0 backdrop:bg-black/40"
        >
          <form
            className="max-h-[90dvh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void simpan();
            }}
          >
            <fieldset disabled={pending || uploading} className="space-y-3">
              <h2 className="text-lg font-bold">
                {
                  (
                    {
                      setelan: "Atur bahan outlet",
                      koreksi: "Koreksi jumlah stok",
                      waste: "Catat waste / rusak / kedaluwarsa",
                      restock: "Permintaan restock",
                      transfer: "Transfer antar-outlet",
                    } as Record<string, string>
                  )[form.aksi]
                }{" "}
                · {p.outlet && nama(p.outlet)}
              </h2>
              {["setelan", "koreksi", "waste"].includes(form.aksi) && (
                <label className="block">
                  Bahan
                  <select
                    className={inp}
                    required
                    value={form.bahan}
                    onChange={(e) => {
                      const b = semua.find((b) => b.id === e.target.value);
                      setForm({
                        ...form,
                        bahan: e.target.value,
                        minimum: String(b?.minimum ?? 0),
                        aktif: b?.aktif ?? true,
                      });
                    }}
                  >
                    <option value="">Pilih bahan master</option>
                    {p.bahan.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nama} ({b.satuan_pakai})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">{PETUNJUK_DESIMAL_BAHAN} Form ini memakai satuan pakai yang tertera pada pilihan bahan.</p>
              {form.aksi === "setelan" ? (
                <>
                  <label className="block">
                    Stok minimum (
                    {p.bahan.find((b) => b.id === form.bahan)?.satuan_pakai})
                    <input
                      className={inp}
                      type="number"
                      required
                      min="0"
                      max="1000000000"
                      step="0.001"
                      value={form.minimum}
                      onChange={(e) =>
                        setForm({ ...form, minimum: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.aktif}
                      onChange={(e) =>
                        setForm({ ...form, aktif: e.target.checked })
                      }
                    />{" "}
                    Aktif di panel outlet ini
                  </label>
                  <p className="text-xs">
                    Nonaktif tidak menghapus stok, riwayat, resep POS atau SO.
                  </p>
                </>
              ) : ["koreksi", "waste"].includes(form.aksi) ? (
                <>
                  <p>
                    Stok saat ini:{" "}
                    {nf(semua.find((b) => b.id === form.bahan)?.jumlah ?? 0)}{" "}
                    {p.bahan.find((b) => b.id === form.bahan)?.satuan_pakai}
                  </p>
                  <label className="block">
                    {form.aksi === "koreksi"
                      ? "Jumlah stok yang benar (mengganti jumlah sekarang)"
                      : "Jumlah terbuang (mengurangi stok)"}
                    <input
                      className={inp}
                      type="number"
                      min={form.aksi === "waste" ? "0.001" : "0"}
                      max="1000000000"
                      step="0.001"
                      required
                      value={form.jumlah}
                      onChange={(e) =>
                        setForm({ ...form, jumlah: e.target.value })
                      }
                    />
                  </label>
                  {form.jumlah.trim() && Number.isFinite(Number(form.jumlah)) && <p className="text-sm font-medium">{form.aksi === "koreksi" ? "Total stok pengganti" : "Jumlah terbuang"}: {jumlahBahanTertulis(Number(form.jumlah), p.bahan.find(b => b.id === form.bahan)?.satuan_pakai ?? "")}</p>}
                  {form.aksi === "waste" && (
                    <label className="block">
                      Foto opsional (maks. 5 MB)
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          setFile(e.target.files?.[0] ?? null);
                          setPhoto("");
                        }}
                      />
                    </label>
                  )}
                </>
              ) : (
                <>
                  {form.aksi === "transfer" && (
                    <label className="block">
                      Outlet tujuan
                      <select
                        className={inp}
                        required
                        value={form.tujuan}
                        onChange={(e) =>
                          setForm({ ...form, tujuan: e.target.value })
                        }
                      >
                        <option value="">Pilih tujuan</option>
                        {p.tujuanOutlets
                          .filter((o) => o.id !== p.outlet)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.nama}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <label className="block">
                    Cari bahan
                    <input
                      className={inp}
                      value={cari}
                      onChange={(e) => setCari(e.target.value)}
                      placeholder="Ketik nama bahan…"
                    />
                  </label>
                  <select
                    className={inp}
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        setItems([
                          ...items,
                          { bahan_id: e.target.value, jumlah: "" },
                        ]);
                    }}
                  >
                    <option value="">+ Pilih bahan</option>
                    {pilihBahan
                      .filter((b) => !items.some((i) => i.bahan_id === b.id))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nama} ({b.satuan_pakai})
                        </option>
                      ))}
                  </select>
                  {items.map((it, n) => (
                    <div
                      key={it.bahan_id}
                      className="grid grid-cols-[1fr_120px_auto] items-center gap-2"
                    >
                      <span>
                        {p.bahan.find((b) => b.id === it.bahan_id)?.nama} (
                        {
                          p.bahan.find((b) => b.id === it.bahan_id)
                            ?.satuan_pakai
                        }
                        )
                      </span>
                      <input
                        aria-label="Jumlah bahan"
                        className={inp}
                        type="number"
                        required
                        min="0.001"
                        max="1000000000"
                        step="0.001"
                        value={it.jumlah}
                        onChange={(e) =>
                          setItems(
                            items.map((x, i) =>
                              i === n ? { ...x, jumlah: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={btn}
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== n))
                        }
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </>
              )}
              <label className="block">
                Alasan / catatan
                <textarea
                  className={inp}
                  required
                  minLength={3}
                  maxLength={1000}
                  value={form.alasan}
                  onChange={(e) => setForm({ ...form, alasan: e.target.value })}
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={btn}
                  disabled={pending}
                  onClick={() => setForm(null)}
                >
                  Batal
                </button>
                <button
                  className={`${btn} bg-kopi-900 text-white`}
                  disabled={
                    pending ||
                    uploading ||
                    (["restock", "transfer"].includes(form.aksi) &&
                      !items.length)
                  }
                >
                  {pending || uploading ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </fieldset>
          </form>
        </dialog>
      )}
    </div>
  );
}
