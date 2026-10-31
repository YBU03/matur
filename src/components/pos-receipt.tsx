"use client";
import { useState } from "react";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah } from "@/lib/format";
import type { Receipt } from "@/lib/pos-actions";
import {
  bisaBluetooth,
  cetakBluetooth,
  cetakRawBT,
  diAndroid,
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
}: {
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
  const barisStruk = (lebar: number): BarisStruk[] => [
        ...(salinan ? [{ teks: voidAlasan != null ? "*** VOID - DIBATALKAN ***" : "*** SALINAN ***", tengah: true, tebal: true }] : []),
        ...(voidAlasan ? [{ teks: "Alasan: " + voidAlasan, tengah: true }] : []),
        ...(testing
          ? [
              {
                teks: "TESTING - BUKAN TRANSAKSI ASLI",
                tengah: true,
                tebal: true,
              },
            ]
          : []),
        { teks: "RUMA", tengah: true, tebal: true, besar: true },
        { teks: outletNama, tengah: true, tebal: true },
        { teks: waktu, tengah: true },
        { teks: "NO. ANTREAN", tengah: true },
        { teks: nomor, tengah: true, tebal: true, besar: true },
        {
          teks: `${KANAL.find(([k]) => k === kanal)?.[1]} - ${kasir}`,
          tengah: true,
        },
        "-".repeat(lebar),
        ...lines.map((l) => ({
          teks: "",
          kiriKanan: [`${l.qty}x ${l.nama}`, formatRupiah(l.total)] as [
            string,
            string,
          ],
        })),
        "-".repeat(lebar),
        ...(r.diskon > 0
          ? [
              {
                teks: "",
                kiriKanan: ["Diskon", formatRupiah(-r.diskon)] as [
                  string,
                  string,
                ],
              },
            ]
          : []),
        {
          teks: "",
          tebal: true,
          kiriKanan: ["TOTAL", formatRupiah(r.total)] as [string, string],
        },
        { teks: "", kiriKanan: ["Bayar", labelMetode] as [string, string] },
        ...(r.kembalian > 0
          ? [
              {
                teks: "",
                kiriKanan: ["Kembali", formatRupiah(r.kembalian)] as [
                  string,
                  string,
                ],
              },
            ]
          : []),
        "-".repeat(lebar),
        { teks: "Terima kasih", tengah: true },
      ];
  const dataStruk = () => susunStruk(barisStruk(kertas === "58" ? 32 : 48), kertas === "58" ? 32 : 48);
  const unduhPdf = async () => {
    setUnduhErr("");
    try {
      const [{ buatStrukPdf }, { unduh }] = await Promise.all([import("@/lib/struk-pdf"), import("@/lib/pdf-kop")]);
      unduh(await buatStrukPdf(barisStruk(kertas === "58" ? 32 : 48), kertas), `Struk ${outletNama} #${nomor}${salinan ? " (salinan)" : ""}`);
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
        className={`mx-auto rounded-xl bg-white p-3 font-mono text-black shadow-inner ${kertas === "58" ? "max-w-[230px] text-[11px]" : "max-w-[310px] text-xs"}`}
      >
        {testing && (
          <p className="mb-2 text-center font-bold">
            TESTING · BUKAN TRANSAKSI ASLI
          </p>
        )}
        {salinan && (
          <p className={`mb-2 rounded border-2 border-dashed py-1 text-center font-bold ${voidAlasan != null ? "border-red-500 text-red-600" : "border-stone-400 text-stone-600"}`}>
            {voidAlasan != null ? "VOID · DIBATALKAN" : "SALINAN"}
            {voidAlasan && <span className="block text-[10px] font-normal">Alasan: {voidAlasan}</span>}
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- logo struk */}
        <img
          src="/brand/ruma-logo.png"
          alt="Ruma"
          className="mx-auto mb-1 h-8 w-auto grayscale"
        />
        <p className="text-center font-bold">{outletNama}</p>
        <p className="text-center">{waktu}</p>
        <p className="mt-1 text-center text-[10px] tracking-widest">
          NO. ANTREAN
        </p>
        <p className="text-center text-3xl font-black leading-none">{nomor}</p>
        <p className="mb-2 mt-1 text-center">
          {KANAL.find(([k]) => k === kanal)?.[1]} · {kasir}
        </p>
        {lines.map((l) => (
          <div key={l.key} className="flex justify-between gap-2">
            <span>
              {l.qty}x {l.nama}
            </span>
            <span className="shrink-0 whitespace-nowrap">
              {formatRupiah(l.total)}
            </span>
          </div>
        ))}
        <div className="mt-2 border-t border-dashed pt-2">
          {r.diskon > 0 && (
            <Row label="Diskon" value={formatRupiah(-r.diskon)} />
          )}
          <Row label="Total" value={formatRupiah(r.total)} bold />
          <Row label="Bayar" value={labelMetode} />
          {r.kembalian > 0 && (
            <Row label="Kembali" value={formatRupiah(r.kembalian)} />
          )}
        </div>
        <p className="mt-2 border-t border-dashed pt-2 text-center">
          Terima kasih 🙏
        </p>
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
        {diAndroid() && !bt && (
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
