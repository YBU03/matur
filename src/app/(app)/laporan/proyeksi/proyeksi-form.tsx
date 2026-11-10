"use client";
import { tanya } from "@/components/dialog-tanya";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { formatRupiah, formatTanggal } from "@/lib/format";
import {
  BARIS_PENDAPATAN,
  hitung,
  namaBulan,
  PENDAPATAN_LAIN,
  type Laporan,
  type Proyeksi,
  type Transfer,
} from "@/lib/laporan";
import { hapusDraftLaporan, simpanInternal, setujuiMitra } from "@/lib/laporan-actions";
import { JadwalBuka } from "./jadwal-buka";
import {
  pulihkanIsian,
  keWibInput,
  dariWibInput,
  type IsianLaporan,
  type DraftInternal,
} from "@/lib/laporan-internal";
import type { Rincian } from "@/lib/skema-actions";

type Props = {
  draft: DraftInternal | null;
  sumberPilih?: "otomatis" | "manual";
  abaikanDraft?: boolean;
  /** titipan terjual bulan ini (cheesecake & dessert) */
  titipan?: {
    nama: string;
    produsen: string;
    terjual: number;
    harga: number;
    tagihan: number;
  }[];
  outlets: { id: string; nama: string }[];
  outletId: string;
  bulan: string;
  sim: boolean;
  bolehSim: boolean;
  proy: Proyeksi;
  sebelum: Laporan | null;
  sudahTerbit: string | null;
  kategori: string[];
  skema: { nama: string; persen_sedekah: number; rincian: Rincian[] } | null;
  perjanjian: {
    modal: number;
    sewa: number;
    mitra: string | null;
    bank: string | null;
    no_rekening: string | null;
    atas_nama: string | null;
  } | null;
  penutupan: {
    ojol: Record<string, number>;
    koreksi_lain: number | null;
    persediaan_akhir: number | null;
    catatan: string | null;
  } | null;
  karyawan: string[];
  penandatangan: { nama: string | null; jabatan: string | null };
  namaOutlet: string;
};

const cls =
  "w-full rounded-lg border border-stone-300 px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-matur-500";
/** Tagihan titipan per produsen; bila total diubah manual & tidak cocok lagi, dicatat satu baris "Titipan (disesuaikan)". */
function rincianTitipan(
  xs: { produsen: string; tagihan: number }[],
  total: number,
) {
  const per = new Map<string, number>();
  for (const x of xs)
    per.set(
      x.produsen || "-",
      (per.get(x.produsen || "-") ?? 0) + Number(x.tagihan),
    );
  const r = [...per].map(([produsen, jumlah]) => ({
    produsen,
    jumlah: Math.round(jumlah),
  }));
  return r.reduce((t, x) => t + x.jumlah, 0) === total
    ? r
    : total
      ? [{ produsen: "Titipan (disesuaikan)", jumlah: total }]
      : [];
}
const n = (v: string) => Math.round(Number(v.replace(/[^\d-]/g, "")) || 0);

export function ProyeksiForm(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [ganti, setGanti] = useState(false);
  const [lihatHarian, setLihatHarian] = useState(false);
  const periode = `${p.bulan}-01`;
  const sewaAuto = (nama: string) =>
    /sewa/i.test(nama) && p.perjanjian?.sewa ? p.perjanjian.sewa : 0;

  const sumber = p.sumberPilih ?? p.draft?.sumber ?? "otomatis";
  const manual = sumber !== "otomatis";
  const [versi, setVersi] = useState(p.draft?.updated_at ?? null);
  const [buka, setBuka] = useState(keWibInput(p.draft?.buka_at ?? null));
  const [alasan, setAlasan] = useState(p.draft?.alasan ?? "");
  const awal: IsianLaporan = {
    pend: Object.fromEntries(
      BARIS_PENDAPATAN.map(([k]) => [
        k,
        String(manual ? 0 : Math.round(p.proy?.pendapatan?.[k] ?? 0)),
      ]),
    ),
    beban: Object.fromEntries(
      p.kategori.map((k) => [
        k,
        String(
          manual
            ? 0
            : (p.proy?.beban?.find((b) => b.nama === k)?.jumlah ?? sewaAuto(k)),
        ),
      ]),
    ),
    stok: {
      awal: String(p.sebelum?.persediaan_akhir ?? 0),
      pembelian: String(manual ? 0 : (p.proy?.pembelian ?? 0)),
      akhir: String(
        manual
          ? 0
          : (p.penutupan?.persediaan_akhir ??
              p.proy?.opname?.nilai ??
              p.proy?.persediaan_akhir_sistem ??
              0),
      ),
      titipan: String(
        manual
          ? 0
          : (p.titipan ?? []).reduce((t, x) => t + Number(x.tagihan), 0),
      ),
    },
    info: {
      nama_outlet: p.namaOutlet,
      mitra: p.sebelum?.mitra ?? p.perjanjian?.mitra ?? "",
      pj: p.sebelum?.pj_laporan ?? "",
      karyawan: p.karyawan.join("\n"),
      terbit: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10),
      catatan: p.penutupan?.catatan ?? "",
      modal: "",
      persen: "",
      sedekah: "",
      diskon: "",
    },
    ojol: Object.fromEntries(
      ["gofood", "grabfood", "shopeefood"].map((k) => [
        k,
        manual
          ? ""
          : p.penutupan?.ojol?.[k] !== undefined
            ? String(p.penutupan.ojol[k])
            : "",
      ]),
    ),
    koreksi: String(
      manual
        ? 0
        : (p.penutupan?.koreksi_lain ?? Math.round(p.proy?.diskon ?? 0)),
    ),
  };
  const [baseline] = useState(awal);
  const [initial] = useState(() => {
    if (p.abaikanDraft || (p.sumberPilih && p.sumberPilih !== p.draft?.sumber))
      return awal;
    if (p.draft?.snapshot && !p.draft.isian?.stok) {
      const x = p.draft.snapshot;
      return {
        ...awal,
        pend: Object.fromEntries(
          BARIS_PENDAPATAN.map(([k, label]) => [
            k,
            String(x.pendapatan.find((v) => v.nama === label)?.jumlah ?? 0),
          ]),
        ),
        beban: Object.fromEntries(
          [...new Set([...p.kategori, ...x.beban.map((b) => b.nama)])].map(
            (k) => [k, String(x.beban.find((b) => b.nama === k)?.jumlah ?? 0)],
          ),
        ),
        stok: {
          awal: String(x.persediaan_awal),
          akhir: String(x.persediaan_akhir),
          pembelian: String(x.pembelian),
          titipan: String(x.tagihan_titipan ?? 0),
        },
        info: {
          nama_outlet: x.nama_outlet,
          mitra: x.mitra ?? "",
          pj: x.pj_laporan ?? "",
          karyawan: x.karyawan.join("\n"),
          terbit: x.tgl_terbit ?? periode,
          catatan: x.catatan ?? "",
          modal: String(x.modal_awal),
          persen: String(x.persen_sedekah),
          sedekah: String(x.sedekah),
          diskon: String(x.diskon),
        },
        koreksi: String(
          x.pendapatan.find((v) => v.nama === PENDAPATAN_LAIN)?.jumlah ?? 0,
        ),
      };
    }
    return pulihkanIsian(awal, p.draft);
  });
  const [manualData, setManualData] = useState(() => {
    const old =
      manual && p.draft?.sumber !== "otomatis" && !p.abaikanDraft
        ? p.draft
        : null;
    return (
      old?.isian?.manual ?? {
        pendapatan:
          old?.snapshot?.pendapatan ??
          BARIS_PENDAPATAN.map(([, nama]) => ({ nama, jumlah: 0 })),
        bagi_hasil: old?.snapshot?.bagi_hasil ?? [],
        transfer: old?.snapshot?.transfer ?? [],
      }
    );
  });
  const [pend, setPend] = useState(initial.pend);
  const [beban, setBeban] = useState(initial.beban);
  const [stok, setStok] = useState(initial.stok);
  const [info, setInfo] = useState(initial.info);
  const [ojol, setOjol] = useState(initial.ojol);
  const [koreksi, setKoreksi] = useState(initial.koreksi);
  const [draftMsg, setDraftMsg] = useState("");
  const kategori = [...new Set([...p.kategori, ...Object.keys(beban)])];
  const selisihOjol = (["gofood", "grabfood", "shopeefood"] as const).reduce(
    (t, k) => t + (ojol[k] === "" ? 0 : n(ojol[k]) - n(pend[k])),
    0,
  );
  const lain = selisihOjol + n(koreksi);
  const persenSedekah = info.persen
    ? Number(info.persen)
    : Number(
        manual && p.draft?.snapshot
          ? p.draft.snapshot.persen_sedekah
          : (p.skema?.persen_sedekah ?? 2.5),
      );
  const modalAwal = info.modal
    ? n(info.modal)
    : manual && p.draft?.snapshot
      ? p.draft.snapshot.modal_awal
      : (p.sebelum?.modal_awal ?? p.perjanjian?.modal ?? 0);

  // susun laporan dari isian, lalu hitung (sama persis dengan halaman laporan resmi)
  const l = useMemo(() => {
    const pendapatan = [
      ...BARIS_PENDAPATAN.map(([k, nama]) => ({ nama, jumlah: n(pend[k]) })),
      { nama: PENDAPATAN_LAIN, jumlah: lain },
    ];
    const bebanRows = kategori.map((k) => ({
      nama: k,
      jumlah: n(beban[k] ?? "0"),
    }));
    const base: Laporan = {
      id: "",
      outlet_id: p.outletId,
      periode,
      nama_outlet: info.nama_outlet,
      mitra: info.mitra || null,
      pj_laporan: info.pj || null,
      karyawan: info.karyawan
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      modal_awal: modalAwal,
      persediaan_awal: n(stok.awal),
      pembelian: n(stok.pembelian),
      tagihan_titipan: n(stok.titipan),
      rincian_titipan: rincianTitipan(p.titipan ?? [], n(stok.titipan)),
      persediaan_akhir: n(stok.akhir),
      pendapatan,
      diskon: info.diskon
        ? n(info.diskon)
        : manual
          ? Number(p.draft?.snapshot?.diskon ?? 0)
          : Math.round(p.proy?.diskon ?? 0),
      persen_sedekah: persenSedekah,
      sedekah: 0,
      beban: bebanRows,
      bagi_hasil: [],
      transfer: [],
      tgl_terbit: info.terbit,
      kota_terbit: "Purbalingga",
      penandatangan: p.penandatangan.nama,
      jabatan_penandatangan: p.penandatangan.jabatan,
      catatan: info.catatan || null,
      laba_bersih: null,
    };
    if (manual) base.pendapatan = manualData.pendapatan;
    const lk = hitung(base).labaKotor;
    base.sedekah = Math.max(0, Math.round((lk * persenSedekah) / 100));
    if (info.sedekah) base.sedekah = n(info.sedekah);
    const lb = hitung(base).labaBersih;
    base.bagi_hasil = (p.skema?.rincian ?? []).map((r) => ({
      nama: r.penerima,
      persen: r.persen,
      jumlah: Math.round((Math.max(lb, 0) * r.persen) / 100),
    }));
    const sewa = bebanRows.find((b) => /sewa/i.test(b.nama))?.jumlah ?? 0;
    const sewaLama = p.sebelum?.transfer.find((t) =>
      /sewa/i.test(t.keterangan),
    );
    base.transfer = [
      ...(p.skema?.rincian ?? [])
        .filter((r) => !r.pengelola)
        .map(
          (r): Transfer => ({
            keterangan: `Bagi hasil ${r.penerima}`,
            jumlah:
              base.bagi_hasil.find((b) => b.nama === r.penerima)?.jumlah ?? 0,
            bank: r.bank ?? null,
            no_rekening: r.no_rekening ?? null,
            atas_nama: r.atas_nama ?? null,
          }),
        ),
      ...(sewa
        ? [
            {
              keterangan: "Sewa",
              jumlah: sewa,
              bank: p.perjanjian?.bank ?? sewaLama?.bank ?? null,
              no_rekening:
                p.perjanjian?.no_rekening ?? sewaLama?.no_rekening ?? null,
              atas_nama: p.perjanjian?.atas_nama ?? sewaLama?.atas_nama ?? null,
            },
          ]
        : []),
    ];
    if (manual) {
      base.bagi_hasil = manualData.bagi_hasil;
      base.transfer = manualData.transfer;
    }
    return base;
  }, [
    pend,
    beban,
    stok,
    info,
    p,
    periode,
    persenSedekah,
    modalAwal,
    lain,
    manual,
    manualData,
  ]);
  const h = hitung(l);

  const pindah = (q: Record<string, string>) =>
    router.push(
      `/laporan/proyeksi?${new URLSearchParams({ outlet: p.outletId, bulan: p.bulan, ...(p.sim ? { sim: "1" } : {}), ...q })}`,
    );
  const salvar = async () => {
    setErr("");
    setDraftMsg("");
    const buka_at = dariWibInput(buka);
    if (buka && !buka_at) {
      setErr("Tanggal/jam buka tidak valid.");
      return null;
    }
    const isian = {
      pend,
      beban,
      stok,
      info,
      ojol,
      koreksi,
      ...(manual ? { manual: manualData } : {}),
    };
    const berubah =
      JSON.stringify({ pend, beban, stok, ojol, koreksi }) !==
      JSON.stringify({
        pend: baseline.pend,
        beban: baseline.beban,
        stok: baseline.stok,
        ojol: baseline.ojol,
        koreksi: baseline.koreksi,
      });
    if (
      (berubah ||
        manual ||
        info.modal ||
        info.persen ||
        info.sedekah ||
        info.diskon) &&
      !alasan.trim()
    ) {
      setErr("Isi keterangan sumber / alasan koreksi sebelum menyimpan.");
      return null;
    }
    const r = await simpanInternal({
      outlet_id: p.outletId,
      periode,
      sumber,
      isian,
      baseline,
      snapshot: l,
      alasan,
      buka_at,
      versi,
    });
    if (r.error) {
      setErr(r.error);
      return null;
    }
    setVersi(r.versi ?? null);
    setDraftMsg("Laporan internal tersimpan. Belum dibagikan ke Mitra.");
    return r.versi ?? null;
  };
  const simpanDraft = () =>
    start(async () => {
      try {
        await salvar();
      } catch {
        setErr("Gagal menyimpan. Periksa koneksi dan coba lagi.");
      }
    });
  const terbit = () =>
    start(async () => {
      try {
        if (!buka) {
          setErr("Tentukan tanggal dan jam pembukaan untuk Mitra.");
          return;
        }
        const v = await salvar();
        if (!v) return;
        const r = await setujuiMitra(p.outletId, periode, v, ganti);
        if (r.error) {
          setErr(r.error);
          return;
        }
        router.push(`/laporan/${r.id}`);
      } catch {
        setErr(
          "Gagal menyetujui laporan. Periksa koneksi dan muat ulang sebelum mencoba kembali.",
        );
      }
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/laporan" className="text-sm text-matur-700">
        ← Laporan Keuangan
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Laporan Internal Bulanan</h1>
        <p className="text-sm text-stone-500">
          Penjualan dari kasir POS, pembelian bahan dari kiriman gudang yang
          diterima, dan biaya dari input harian — terhitung otomatis.
        </p>
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-matur-200 bg-white p-3">
        <select
          aria-label="Outlet laporan"
          value={p.outletId}
          onChange={(e) => pindah({ outlet: e.target.value })}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {p.outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
        <input
          type="month"
          aria-label="Bulan laporan"
          value={p.bulan}
          onChange={(e) => e.target.value && pindah({ bulan: e.target.value })}
          className="rounded-lg border px-3 py-2 text-sm"
        />
        {p.bolehSim && (
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.sim}
              onChange={(e) => pindah({ sim: e.target.checked ? "1" : "" })}
              className="accent-matur-500"
            />
            Coba dengan data simulasi
          </label>
        )}
      </section>
      <button
        type="button"
        onClick={async () =>
          (await tanya(
            "Muat ulang data operasional terbaru? Simpan perubahan lebih dahulu.",
          )) && router.refresh()
        }
        className="text-sm font-semibold text-matur-700 underline"
      >
        ↻ Muat ulang data terbaru
      </button>
      {p.sim && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Memakai data simulasi — hanya untuk mencoba, tidak bisa diterbitkan.
        </p>
      )}
      {p.sudahTerbit && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Versi resmi {namaBulan(periode)} sudah tersimpan. Perubahan di sini
          tetap internal sampai disetujui kembali.{" "}
          <Link
            href={`/laporan/${p.sudahTerbit}`}
            className="font-semibold underline"
          >
            Lihat laporan
          </Link>
        </p>
      )}

      <section className="space-y-3 rounded-2xl border border-matur-200 bg-matur-50 p-4">
        <label className="block text-sm font-semibold">
          Sumber laporan
          <select
            aria-label="Sumber laporan"
            value={manual ? "manual" : "otomatis"}
            onChange={async (e) =>
              (await tanya(
                "Ganti sumber? Perubahan yang belum disimpan akan dilepas.",
              )) && pindah({ sumber: e.target.value })
            }
            className="mt-1 w-full rounded-lg border bg-white p-2"
          >
            <option value="otomatis">Otomatis + koreksi internal</option>
            <option value="manual">
              Manual / hasil impor (angka pengganti)
            </option>
          </select>
        </label>
        <p className="text-sm">
          {manual
            ? "Angka manual menjadi nilai laporan, tidak ditambahkan lagi ke transaksi POS. Impor Excel tersedia di daftar laporan."
            : "Data POS dan operasional dibaca ulang saat halaman dibuka. Koreksi tersimpan sebagai selisih; tidak menambah transaksi baru."}
        </p>
        <button
          type="button"
          className="text-sm font-semibold text-matur-700 underline"
          onClick={async () =>
            (await tanya(
              "Kembali ke angka otomatis terbaru? Simpan untuk mengganti koreksi draft; versi resmi tetap aman.",
            )) && pindah({ sumber: "otomatis", reset: "1" })
          }
        >
          Gunakan ulang data otomatis
        </button>
      </section>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Transaksi POS", String(p.proy?.jumlah_transaksi ?? 0)],
          ["Total penjualan", formatRupiah(h.totalPenjualan)],
          ["Laba kotor", formatRupiah(h.labaKotor)],
          ["Laba bersih", formatRupiah(h.labaBersih)],
        ].map(([k, v]) => (
          <div
            key={k}
            className="rounded-2xl border border-matur-200 bg-white p-3"
          >
            <p className="text-xs text-stone-500">{k}</p>
            <p className="font-bold">{v}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <button
          onClick={() => setLihatHarian(!lihatHarian)}
          className="flex w-full items-center font-bold"
        >
          <span className="mr-auto">Rekap harian otomatis</span>
          <span className="text-sm text-matur-700">
            {lihatHarian ? "tutup ▴" : "lihat ▾"}
          </span>
        </button>
        {lihatHarian && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-stone-500">
                <tr>
                  <th className="py-1">Tanggal</th>
                  <th className="text-right">Trx</th>
                  <th className="text-right">Penjualan</th>
                  <th className="text-right">Diskon</th>
                  <th className="text-right">Pembelian bahan</th>
                  <th className="text-right">Biaya</th>
                </tr>
              </thead>
              <tbody>
                {(p.proy?.harian ?? []).map((d) => (
                  <tr key={d.tanggal} className="border-t">
                    <td className="py-1">
                      {formatTanggal(d.tanggal.slice(0, 10))}
                    </td>
                    <td className="text-right">{d.transaksi}</td>
                    <td className="text-right tabular-nums">
                      {formatRupiah(d.penjualan)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatRupiah(d.diskon)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatRupiah(d.pembelian)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatRupiah(d.biaya)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!p.sebelum && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Laporan bulan sebelumnya belum tersedia. Periksa persediaan awal
          sebelum memfinalkan; angka awal belum otomatis terkonfirmasi.
        </p>
      )}
      <section className="space-y-1 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-1 rounded-lg bg-matur-100 px-3 py-1.5 text-sm font-bold uppercase">
          Harga Pokok Penjualan
        </h2>
        <Baris k="Persediaan awal (akhir bulan lalu)">
          <Angka
            v={stok.awal}
            onChange={(v) => setStok({ ...stok, awal: v })}
            auto={!!p.sebelum}
          />
        </Baris>
        <Baris k="Pembelian bahan baku">
          <Angka
            v={stok.pembelian}
            onChange={(v) => setStok({ ...stok, pembelian: v })}
            auto={!manual}
          />
        </Baris>
        <Baris k="Tagihan titipan produsen (yang terjual)">
          <Angka
            v={stok.titipan}
            onChange={(v) => setStok({ ...stok, titipan: v })}
            auto={!manual && (p.titipan ?? []).length > 0}
          />
        </Baris>
        {(p.titipan ?? []).length > 0 && (
          <p className="pl-3 text-xs text-stone-500">
            {p
              .titipan!.map(
                (x) => `${x.nama} ${x.terjual} pcs × ${formatRupiah(x.harga)}`,
              )
              .join(" · ")}{" "}
            (produsen:{" "}
            {[...new Set(p.titipan!.map((x) => x.produsen))].join(", ")}). Yang
            dibebankan hanya yang terjual.
          </p>
        )}
        <Baris k="Persediaan akhir (isi dengan hasil opname)">
          <Angka
            v={stok.akhir}
            onChange={(v) => setStok({ ...stok, akhir: v })}
          />
        </Baris>
        <p className="text-xs text-stone-500">
          Pembelian = kiriman gudang ({p.proy?.jumlah_kiriman ?? 0}×{" "}
          {formatRupiah(p.proy?.pembelian_rincian?.kiriman_gudang ?? 0)})
          {Object.entries(p.proy?.pembelian_rincian ?? {})
            .filter(([k]) => k !== "kiriman_gudang")
            .map(([k, v]) => ` + ${k} ${formatRupiah(Number(v))}`)
            .join("")}
          .{" "}
          {p.proy?.opname ? (
            <>
              Persediaan akhir dari opname{" "}
              {formatTanggal(p.proy.opname.tanggal)} (
              {formatRupiah(p.proy.opname.nilai)}).
            </>
          ) : (
            <>
              Belum ada opname bulan ini —{" "}
              <Link href="/stok" className="text-matur-700 underline">
                lakukan opname
              </Link>{" "}
              (perkiraan sistem{" "}
              {formatRupiah(p.proy?.persediaan_akhir_sistem ?? 0)}).
            </>
          )}
        </p>
        <Baris k="Harga pokok penjualan" tebal>
          <span className="tabular-nums">{formatRupiah(h.hpp)}</span>
        </Baris>
      </section>

      <section className="space-y-1 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-1 rounded-lg bg-matur-100 px-3 py-1.5 text-sm font-bold uppercase">
          Pendapatan
        </h2>
        {manual ? (
          <div className="space-y-2">
            {manualData.pendapatan.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  aria-label={`Nama pendapatan ${i + 1}`}
                  value={r.nama}
                  onChange={(e) =>
                    setManualData({
                      ...manualData,
                      pendapatan: manualData.pendapatan.map((x, j) =>
                        j === i ? { ...x, nama: e.target.value } : x,
                      ),
                    })
                  }
                  className="min-w-0 flex-1 rounded-lg border p-2 text-sm"
                />
                <Angka
                  label={`Nominal pendapatan ${i + 1}`}
                  v={String(Number(r.jumlah))}
                  onChange={(v) =>
                    setManualData({
                      ...manualData,
                      pendapatan: manualData.pendapatan.map((x, j) =>
                        j === i ? { ...x, jumlah: n(v) } : x,
                      ),
                    })
                  }
                />
                <button
                  aria-label={`Hapus pendapatan ${i + 1}`}
                  onClick={() =>
                    setManualData({
                      ...manualData,
                      pendapatan: manualData.pendapatan.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="text-sm font-semibold text-matur-700 underline"
              onClick={() =>
                setManualData({
                  ...manualData,
                  pendapatan: [
                    ...manualData.pendapatan,
                    { nama: "Pendapatan tambahan", jumlah: 0 },
                  ],
                })
              }
            >
              ＋ Baris pendapatan
            </button>
          </div>
        ) : (
          <>
            {BARIS_PENDAPATAN.map(([k, nama]) => (
              <Baris key={k} k={nama}>
                <Angka
                  v={pend[k]}
                  onChange={(v) => setPend({ ...pend, [k]: v })}
                  auto={!manual}
                />
              </Baris>
            ))}
            <div className="my-2 space-y-1 rounded-xl bg-blue-50 p-3">
              <p className="text-sm font-semibold text-blue-900">
                Cocok ojol (angka asli dari aplikasi)
              </p>
              {(
                [
                  ["gofood", "GoFood"],
                  ["grabfood", "GrabFood"],
                  ["shopeefood", "ShopeeFood"],
                ] as const
              ).map(([k, l]) => (
                <Baris
                  key={k}
                  k={`${l} menurut aplikasi${ojol[k] !== "" ? ` (selisih ${formatRupiah(n(ojol[k]) - n(pend[k]))})` : ""}`}
                >
                  <Angka
                    v={ojol[k]}
                    onChange={(v) => setOjol({ ...ojol, [k]: v })}
                  />
                </Baris>
              ))}
              <Baris k="Koreksi lain (format Ruma: discount dikembalikan)">
                <Angka v={koreksi} onChange={setKoreksi} />
              </Baris>
            </div>
            <Baris k={PENDAPATAN_LAIN}>
              <span className="text-sm font-semibold tabular-nums">
                {formatRupiah(lain)}
              </span>
            </Baris>
          </>
        )}
        <Baris k="Discount">
          <span className="text-sm tabular-nums">
            {formatRupiah(-l.diskon)}
          </span>
        </Baris>
        <Baris k="Total penjualan" tebal>
          <span className="tabular-nums">{formatRupiah(h.totalPenjualan)}</span>
        </Baris>
      </section>

      <section className="space-y-1 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-1 rounded-lg bg-matur-100 px-3 py-1.5 text-sm font-bold uppercase">
          Beban operasional
        </h2>
        <p className="text-xs text-stone-500">
          {manual
            ? "Input manual; daftar kategori dari menu"
            : "Terisi otomatis dari menu"}{" "}
          <Link
            href="/master/biaya_outlet"
            className="text-matur-700 underline"
          >
            Biaya Operasional
          </Link>
          {p.perjanjian?.sewa
            ? " · sewa dari perjanjian bila belum diinput"
            : ""}
          .
        </p>
        <Baris
          k={`Sedekah ${String(persenSedekah).replace(".", ",")}% dari laba kotor`}
        >
          <span className="text-sm tabular-nums">
            {formatRupiah(l.sedekah)}
          </span>
        </Baris>
        {kategori.map((k) => (
          <Baris key={k} k={k}>
            <Angka
              v={beban[k] ?? "0"}
              onChange={(v) => setBeban({ ...beban, [k]: v })}
              auto={
                !manual &&
                (!!p.proy?.beban?.some((b) => b.nama === k) ||
                  (!!sewaAuto(k) && !p.proy?.beban?.some((b) => b.nama === k)))
              }
            />
          </Baris>
        ))}
        <Baris k="Total beban operasional" tebal>
          <span className="tabular-nums">{formatRupiah(h.totalBeban)}</span>
        </Baris>
        <Baris k="Laba bersih" tebal>
          <span className="tabular-nums">{formatRupiah(h.labaBersih)}</span>
        </Baris>
      </section>

      <section className="space-y-1 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-1 rounded-lg bg-matur-100 px-3 py-1.5 text-sm font-bold uppercase">
          Sharing profit · {p.skema?.nama ?? "skema belum dipilih"}
        </h2>
        {!p.skema && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Outlet ini belum punya skema bagi hasil.{" "}
            <Link href="/skema-bagi-hasil" className="font-semibold underline">
              Pilih skema
            </Link>
          </p>
        )}
        {manual ? (
          <div className="space-y-3">
            <p className="text-xs text-stone-600">
              Pembagian dan transfer manual mengikuti file/isian, tidak dihitung
              ulang diam-diam. Periksa nominal sebelum disetujui.
            </p>
            {manualData.bagi_hasil.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <input
                  aria-label={`Penerima bagi hasil ${i + 1}`}
                  value={r.nama}
                  onChange={(e) =>
                    setManualData({
                      ...manualData,
                      bagi_hasil: manualData.bagi_hasil.map((x, j) =>
                        j === i ? { ...x, nama: e.target.value } : x,
                      ),
                    })
                  }
                  className="min-w-0 rounded border p-2 text-sm"
                />
                <input
                  aria-label={`Persen bagi hasil ${i + 1}`}
                  type="number"
                  value={r.persen}
                  onChange={(e) =>
                    setManualData({
                      ...manualData,
                      bagi_hasil: manualData.bagi_hasil.map((x, j) =>
                        j === i ? { ...x, persen: Number(e.target.value) } : x,
                      ),
                    })
                  }
                  className="min-w-0 rounded border p-2 text-sm"
                />
                <Angka
                  label={`Nominal bagi hasil ${i + 1}`}
                  v={String(Number(r.jumlah))}
                  onChange={(v) =>
                    setManualData({
                      ...manualData,
                      bagi_hasil: manualData.bagi_hasil.map((x, j) =>
                        j === i ? { ...x, jumlah: n(v) } : x,
                      ),
                    })
                  }
                />
                <button
                  className="text-sm text-red-700"
                  onClick={() =>
                    setManualData({
                      ...manualData,
                      bagi_hasil: manualData.bagi_hasil.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                >
                  Hapus penerima
                </button>
              </div>
            ))}
            <button
              className="text-sm text-matur-700 underline"
              onClick={() =>
                setManualData({
                  ...manualData,
                  bagi_hasil: [
                    ...manualData.bagi_hasil,
                    { nama: "Penerima", persen: 0, jumlah: 0 },
                  ],
                })
              }
            >
              ＋ Bagi hasil manual
            </button>
            <h3 className="text-sm font-semibold">Penerimaan transfer</h3>
            {manualData.transfer.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-2 gap-2 rounded-xl bg-matur-50 p-3"
              >
                {(
                  ["keterangan", "bank", "no_rekening", "atas_nama"] as const
                ).map((k) => (
                  <label key={k} className="text-xs">
                    {k.replaceAll("_", " ")}
                    <input
                      value={r[k] ?? ""}
                      onChange={(e) =>
                        setManualData({
                          ...manualData,
                          transfer: manualData.transfer.map((x, j) =>
                            j === i ? { ...x, [k]: e.target.value } : x,
                          ),
                        })
                      }
                      className="mt-1 w-full min-w-0 rounded border p-2 text-sm"
                    />
                  </label>
                ))}
                <Angka
                  label={`Nominal transfer ${i + 1}`}
                  v={String(Number(r.jumlah))}
                  onChange={(v) =>
                    setManualData({
                      ...manualData,
                      transfer: manualData.transfer.map((x, j) =>
                        j === i ? { ...x, jumlah: n(v) } : x,
                      ),
                    })
                  }
                />
                <button
                  className="text-sm text-red-700"
                  onClick={() =>
                    setManualData({
                      ...manualData,
                      transfer: manualData.transfer.filter((_, j) => j !== i),
                    })
                  }
                >
                  Hapus transfer
                </button>
              </div>
            ))}
            <button
              className="text-sm text-matur-700 underline"
              onClick={() =>
                setManualData({
                  ...manualData,
                  transfer: [
                    ...manualData.transfer,
                    {
                      keterangan: "Transfer",
                      jumlah: 0,
                      bank: null,
                      no_rekening: null,
                      atas_nama: null,
                    },
                  ],
                })
              }
            >
              ＋ Transfer manual
            </button>
          </div>
        ) : (
          <>
            {l.bagi_hasil.map((b) => (
              <Baris key={b.nama} k={`${b.nama} ${b.persen}%`}>
                <span className="tabular-nums">{formatRupiah(b.jumlah)}</span>
              </Baris>
            ))}
            {l.transfer.length > 0 && (
              <p className="text-xs text-stone-500">
                Transfer:{" "}
                {l.transfer
                  .map((t) => `${t.keterangan} ${formatRupiah(t.jumlah)}`)
                  .join(" · ")}
              </p>
            )}
          </>
        )}
      </section>

      <section className="grid gap-3 rounded-2xl border border-matur-200 bg-white p-4 sm:grid-cols-2">
        {(
          [
            ["nama_outlet", "Nama outlet di laporan"],
            ["mitra", "Mitra"],
            ["pj", "Penanggung jawab laporan"],
            ["terbit", "Tanggal terbit"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="text-sm font-medium">
            {label}
            <input
              type={k === "terbit" ? "date" : "text"}
              value={info[k]}
              onChange={(e) => setInfo({ ...info, [k]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        ))}
        {(
          [
            ["modal", "Modal awal"],
            ["persen", "Persentase sedekah"],
            ["sedekah", "Nominal sedekah (kosong = hitung otomatis)"],
            ["diskon", "Diskon (kosong = sumber otomatis)"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="text-sm font-medium">
            {label}
            <input
              aria-label={label}
              value={info[k] ?? ""}
              inputMode="decimal"
              onChange={(e) => setInfo({ ...info, [k]: e.target.value })}
              className="mt-1 w-full rounded-lg border p-2"
              placeholder="Ikuti perhitungan sumber"
            />
          </label>
        ))}
        <div className="text-sm font-medium sm:col-span-2">
          <label htmlFor="laporan-karyawan">
            Karyawan · otomatis dari jadwal / kehadiran periode ini (bisa
            diedit)
          </label>
          <button
            type="button"
            className="ml-2 text-xs text-matur-700 underline"
            onClick={() =>
              setInfo({ ...info, karyawan: p.karyawan.join("\n") })
            }
          >
            Ambil ulang daftar otomatis
          </button>
          <textarea
            id="laporan-karyawan"
            rows={4}
            value={info.karyawan}
            onChange={(e) => setInfo({ ...info, karyawan: e.target.value })}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="text-sm font-medium sm:col-span-2">
          Catatan (opsional)
          <input
            value={info.catatan}
            onChange={(e) => setInfo({ ...info, catatan: e.target.value })}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="font-bold">Pemeriksaan internal & akses Mitra</h2>
        {versi && (
          <Link
            className="inline-block text-sm font-semibold text-matur-700 underline"
            href={`/laporan/internal?outlet=${p.outletId}&bulan=${p.bulan}`}
          >
            Preview laporan tersimpan · PDF / Excel →
          </Link>
        )}
        <label className="block text-sm">
          Keterangan sumber / alasan koreksi
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            maxLength={1000}
            className="mt-1 w-full rounded-lg border p-2"
            placeholder="Contoh: koreksi biaya sesuai nota atau sumber file laporan"
          />
        </label>
        <JadwalBuka
          value={buka}
          onChange={setBuka}
          status={
            p.sudahTerbit && p.draft?.buka_at && Date.parse(p.draft.buka_at) <= Date.now()
              ? { teks: "Sudah terbit", warna: "bg-emerald-100 text-emerald-800" }
              : p.sudahTerbit
                ? { teks: "Disetujui · terbuka sesuai jadwal", warna: "bg-sky-100 text-sky-800" }
                : buka
                  ? { teks: "Terjadwal · menunggu persetujuan", warna: "bg-amber-100 text-amber-800" }
                  : { teks: "Belum dijadwalkan", warna: "bg-stone-100 text-stone-600" }
          }
        />
        <p className="text-xs text-stone-600">
          Simpan Internal hanya menyimpan pekerjaan Accounting. Mitra melihat
          periode terkunci dan jadwalnya. Isi serta PDF/Excel terbuka setelah
          versi resmi disetujui dan waktu buka tercapai.
        </p>
        {p.sudahTerbit && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ganti}
              onChange={(e) => setGanti(e.target.checked)}
            />
            Saya sudah memeriksa dan menyetujui revisi versi resmi yang lama.
          </label>
        )}
        {err && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {err}
          </p>
        )}
        {draftMsg && (
          <p
            role="status"
            className="rounded-lg bg-green-50 p-3 text-sm text-green-800"
          >
            {draftMsg}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            disabled={pending || p.sim}
            onClick={simpanDraft}
            className="rounded-xl border-2 border-matur-500 bg-white p-3 font-semibold text-matur-700 disabled:opacity-50"
          >
            {pending ? "Menyimpan…" : "💾 Simpan Internal"}
          </button>
          <button
            disabled={
              pending ||
              p.sim ||
              (!p.skema && !manual) ||
              (!!p.sudahTerbit && !ganti)
            }
            onClick={async () =>
              (await tanya(
                `Setujui laporan ${info.nama_outlet} ${namaBulan(periode)} untuk Mitra sesuai jadwal buka? Pastikan angka sudah diperiksa.`,
              )) && terbit()
            }
            className="rounded-xl bg-matur-700 p-3 font-semibold text-white disabled:opacity-50"
          >
            Setujui Terbit ke Mitra
          </button>
        </div>
        {versi && !p.sim && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2">
            <p className="text-xs text-red-900">
              Hasil impor/draft tidak sesuai? Hapus draft lalu impor ulang. {p.sudahTerbit ? "Laporan yang sudah terbit ke Mitra tetap aman." : ""}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (!(await tanya(`Hapus draft laporan ${info.nama_outlet} ${namaBulan(periode)}? Isi draft disimpan di log dan bisa dipulihkan. ${p.sudahTerbit ? "Laporan resmi untuk Mitra tidak ikut terhapus." : ""}`))) return;
                start(async () => {
                  const r = await hapusDraftLaporan(p.outletId, periode, versi);
                  if (r.error) return setErr(r.error);
                  setVersi(null);
                  setDraftMsg(r.ok ?? "");
                  pindah({ sumber: "otomatis", reset: "1" });
                });
              }}
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              🗑 Hapus draft
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Angka({
  v,
  onChange,
  auto,
  label,
}: {
  label?: string;
  v: string;
  onChange: (s: string) => void;
  auto?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      {auto && (
        <span className="rounded bg-green-100 px-1.5 text-[10px] font-semibold leading-4 text-green-800">
          otomatis
        </span>
      )}
      <input
        aria-label={label}
        value={v}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        className={`${cls} w-32 sm:w-40`}
      />
    </div>
  );
}

function Baris({
  k,
  children,
  tebal,
}: {
  k: string;
  children: React.ReactNode;
  tebal?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 py-1 text-sm ${tebal ? "border-t-2 border-kopi-900 font-bold" : ""}`}
    >
      <span className="min-w-0 flex-1">{k}</span>
      {children}
    </label>
  );
}
