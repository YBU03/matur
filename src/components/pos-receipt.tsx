"use client";
import { useEffect, useState } from "react";
import { barisTeks } from "@/lib/struk-pdf";
import { logoStruk } from "@/lib/struk-logo";
import { bayarDariMetode, KOLOM_STRUK, STRUK_BAWAAN, susunBarisStruk, type BayarStruk, type StrukOutlet } from "@/lib/struk";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah } from "@/lib/format";
import type { Receipt } from "@/lib/pos-actions";
import {
  bisaBluetooth,
  cetakBluetooth,
  cetakRawBT,
  diAndroid,
  diAplikasi,
  namaPrinter,
  sambungPrinter,
  susunStruk,
  type BarisStruk,
} from "@/lib/printer-bt";
export type ReceiptLine = {
  key: string;
  nama: string;
  qty: number;
  total: number;
};
const KANAL = [
  ["langsung", "Langsung"],
  ["gofood", "GoFood"],
  ["grabfood", "GrabFood"],
  ["shopeefood", "ShopeeFood"],
  ["tiktok", "TikTok Go"],
  ["ruma_app", "Ruma App"],
  ["tumbler", "Tumbler"],
] as const;
const METODE = [
  ["tunai", "Tunai"],
  ["qris", "QRIS"],
  ["debit", "Debit/Kredit"],
  ["transfer", "Transfer"],
] as const;

// POS-05 (versi awal): struk bisa dicetak dari browser atau dikirim lewat WhatsApp
export function ReceiptDialog({
  r,
  lines,
  kanal,
  metode,
  offline,
  testing = false,
  outletNama,
  kasir,
  onClose,
  waktuTransaksi,
  salinan = false,
  voidAlasan,
  struk,
  bayar,
}: {
  /** isi struk outlet (Pengaturan → Struk); kosong = bawaan */
  struk?: StrukOutlet | null;
  /** rincian pembayaran (split/tunai diterima); kosong = dari metode & kembalian */
  bayar?: BayarStruk[];
  /** waktu transaksi asli (struk salinan dari Riwayat); kosong = sekarang */
  waktuTransaksi?: string;
  /** struk dibuka ulang dari Riwayat: tandai SALINAN, tombol Tutup */
  salinan?: boolean;
  voidAlasan?: string | null;
  r: Receipt;
  offline?: boolean;
  testing?: boolean;
  lines: ReceiptLine[];
  kanal: string;
  metode: string;
  outletNama: string;
  kasir: string;
  onClose: () => void;
}) {
  // ukuran kertas printer thermal, diingat per perangkat kasir
  const [kertas, setKertas] = useState<"58" | "80">(() => {
    try {
      return localStorage.getItem("matoer_kertas") === "80" ? "80" : "58";
    } catch {
      return "58";
    }
  });
  const pilihKertas = (k: "58" | "80") => {
    setKertas(k);
    try {
      localStorage.setItem("matoer_kertas", k);
    } catch {}
  };
  const labelMetode =
    metode === "split"
      ? "Split"
      : (METODE.find(([k]) => k === metode)?.[1] ?? metode);
  const nomor = testing
    ? `TEST-${r.nomor}`
    : offline
      ? "OFFLINE"
      : String(r.nomor);
  const [bt, setBt] = useState<string | null>(namaPrinter());
  const [btErr, setBtErr] = useState("");
  const waktu = (waktuTransaksi ? new Date(waktuTransaksi) : new Date()).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const text = [
    ...(testing ? ["TESTING · BUKAN TRANSAKSI ASLI"] : []),
    `*${outletNama}* · No. ${nomor}`,
    ...lines.map((l) => `${l.qty}x ${l.nama}  ${formatRupiah(l.total)}`),
    r.diskon ? `Diskon: ${formatRupiah(-r.diskon)}` : "",
    `Total: ${formatRupiah(r.total)} (${labelMetode})`,
    r.kembalian ? `Kembali: ${formatRupiah(r.kembalian)}` : "",
    "Terima kasih 🙏",
  ].filter(Boolean);
  const [unduhErr, setUnduhErr] = useState("");
  const isiStruk = struk ?? STRUK_BAWAAN;
  const [logo, setLogo] = useState<Awaited<ReturnType<typeof logoStruk>>>(null);
  useEffect(() => {
    let aktif = true;
    if (isiStruk.tampil_logo) logoStruk(kertas).then((g) => aktif && setLogo(g));
    else setLogo(null);
    return () => {
      aktif = false;
    };
  }, [kertas, isiStruk.tampil_logo]);
  const tglAsli = waktuTransaksi ? new Date(waktuTransaksi) : new Date();
  const barisStruk = (lebar: number): BarisStruk[] => [
    ...(isiStruk.tampil_logo && logo ? [{ teks: "", gambar: logo }] : []),
    ...susunBarisStruk(
      {
        struk: isiStruk,
        waktu: tglAsli,
        nomor: testing || offline ? nomor : r.nomor,
        kanal,
        kasir,
        items: lines.map((l) => ({ nama: l.nama, qty: l.qty, total: l.total })),
        subtotal: r.subtotal || r.total + r.diskon,
        diskon: r.diskon,
        total: r.total,
        bayar: bayar?.length ? bayar : bayarDariMetode(metode === "split" ? "tunai" : metode, r.total, r.kembalian),
        kembalian: r.kembalian,
        cetakUlang: salinan,
        voidAlasan: salinan ? voidAlasan : null,
        testing,
      },
      lebar,
    ),
  ];
  const kolom = KOLOM_STRUK[kertas];
  const dataStruk = () => susunStruk(barisStruk(kolom), kolom);
  const unduhPdf = async () => {
    setUnduhErr("");
    try {
      const [{ buatStrukPdf }, { unduh }] = await Promise.all([import("@/lib/struk-pdf"), import("@/lib/pdf-kop")]);
      unduh(await buatStrukPdf(barisStruk(kolom), kertas), `Struk ${outletNama} #${nomor}${salinan ? " (salinan)" : ""}`);
    } catch {
      setUnduhErr("PDF belum dapat dibuat. Coba lagi.");
    }
  };
  const cetakBt = async () => {
    setBtErr("");
    try {
      if (!namaPrinter()) setBt(await sambungPrinter());
      await cetakBluetooth(dataStruk());
    } catch (e) {
      const m = e instanceof Error ? e.message : "Gagal mencetak.";
      setBtErr(/cancel|chooser/i.test(m) ? "Pemilihan printer dibatalkan." : m);
    }
  };
  return (
    <Modal
      title={
        salinan
          ? `🧾 Struk #${nomor}`
          : testing
            ? "Transaksi testing berhasil"
            : offline
              ? "Tersimpan offline"
              : "Transaksi berhasil"
      }
    >
      {offline && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          📴 Internet terputus. Transaksi disimpan di perangkat ini dan terkirim
          otomatis saat online (nomor struk menyusul).
        </p>
      )}
      <div
        id="struk"
        data-kertas={kertas}
        className="mx-auto w-fit max-w-full overflow-x-auto rounded-xl bg-white p-3 font-mono text-black shadow-inner ring-1 ring-stone-200"
      >
        {isiStruk.tampil_logo && (
          // eslint-disable-next-line @next/next/no-img-element -- logo struk (versi hitam-putih seperti hasil cetak)
          <img src={logo?.dataUrl ?? "/brand/ruma-logo.png"} alt="Logo" className={`mx-auto mb-1 h-auto ${kertas === "58" ? "w-[140px]" : "w-[190px]"} ${logo ? "" : "grayscale"}`} />
        )}
        <div className={kertas === "58" ? "text-[10.5px] leading-[1.35]" : "text-[10px] leading-[1.35]"} style={{ width: `${kolom}ch` }}>
          {barisTeks(barisStruk(kolom), kolom).map((b, i) => (
            <div
              key={i}
              className={`whitespace-pre ${b.tengah ? "text-center" : ""} ${b.tebal ? "font-bold" : ""} ${b.besar ? "text-[1.6em]" : ""}`}
            >
              {b.teks || "\u00a0"}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm">
        <span className="text-stone-500">Kertas:</span>
        {(["58", "80"] as const).map((k) => (
          <button
            key={k}
            onClick={() => pilihKertas(k)}
            className={`rounded-full px-3 py-1 ${kertas === k ? "bg-kopi-900 text-white" : "border"}`}
          >
            {k} mm
          </button>
        ))}
      </div>
      {(btErr || unduhErr) && (
        <p className="mt-2 text-center text-xs text-red-600">{btErr || unduhErr}</p>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text.join("\n"))}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Kirim WhatsApp
        </a>
        {bisaBluetooth() && (
          <button
            onClick={cetakBt}
            className="rounded-lg border px-4 py-2 text-sm"
            title={bt ? `Tersambung: ${bt}` : "Sambungkan printer Bluetooth"}
          >
            🖨 {bt ? "Cetak Bluetooth" : "Printer Bluetooth"}
          </button>
        )}
        {diAndroid() && !bt && !diAplikasi() && (
          <button
            onClick={() => cetakRawBT(dataStruk())}
            className="rounded-lg border px-4 py-2 text-sm"
            title="Cetak lewat aplikasi RawBT (printer Bluetooth klasik)"
          >
            RawBT
          </button>
        )}
        <button onClick={unduhPdf} className="rounded-lg border px-4 py-2 text-sm">
          ⬇ Unduh PDF
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Cetak
        </button>
        <button
          onClick={onClose}
          className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white"
        >
          {salinan ? "Tutup" : "Pesanan baru"}
        </button>
      </div>
    </Modal>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
