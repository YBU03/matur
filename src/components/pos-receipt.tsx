"use client";
import { autoPrintSekali } from "@/lib/auto-print";
import { LABEL_METODE_BAYAR } from "@/lib/metode-bayar";
import { useEffect, useRef, useState } from "react";
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
// POS-05 (versi awal): struk bisa dicetak dari browser atau dikirim lewat WhatsApp
export function ReceiptDialog({
  r,
  lines,
  kanal,
  metode,
  offline,
  testing = false,
  autoPrint = false,
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
  autoPrint?: boolean;
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
      : (LABEL_METODE_BAYAR[metode] ?? metode);
  const nomor = testing
    ? `TEST-${r.nomor}`
    : offline
      ? "OFFLINE"
      : String(r.nomor);
  const [bt, setBt] = useState<string | null>(namaPrinter());
  // tutup otomatis setelah transaksi baru (bukan salinan Riwayat); berhenti bila kasir menyentuh jendela
  const otomatis = !salinan;
  const [lamaTutup, setLamaTutup] = useState(() => {
    try {
      const v = localStorage.getItem("matoer_tutup_struk");
      return v === null ? 8 : Math.max(0, Number(v) || 0);
    } catch {
      return 8;
    }
  });
  const [sisa, setSisa] = useState(lamaTutup);
  const [jeda, setJeda] = useState(false);
  const [printBusy,setPrintBusy] = useState(autoPrint&&!salinan);
  const [printStatus,setPrintStatus] = useState("");
  const jalanOtomatis = otomatis && lamaTutup > 0 && !jeda && !printBusy;
  const tutupRef = useRef(onClose);
  tutupRef.current = onClose;
  useEffect(() => {
    if (!jalanOtomatis) return;
    if (sisa <= 0) {
      tutupRef.current();
      return;
    }
    const t = setTimeout(() => setSisa((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [jalanOtomatis, sisa]);
  const gantiTutup = () => {
    const v = lamaTutup > 0 ? 0 : 8;
    setLamaTutup(v);
    setSisa(v);
    setJeda(false);
    try {
      localStorage.setItem("matoer_tutup_struk", String(v));
    } catch {}
  };
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
  const [logoReady,setLogoReady] = useState(!isiStruk.tampil_logo);
  useEffect(() => {
    let aktif = true;
    setLogoReady(!isiStruk.tampil_logo);
    if (isiStruk.tampil_logo) logoStruk(kertas).then((g) => {if(aktif)setLogo(g);}).catch(()=>{if(aktif)setLogo(null);}).finally(()=>{if(aktif)setLogoReady(true);});
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
    setPrintBusy(true);setJeda(true);
    setBtErr("");
    try {
      if (!namaPrinter()) setBt(await sambungPrinter());
      await cetakBluetooth(dataStruk());
    } catch (e) {
      const m = e instanceof Error ? e.message : "Gagal mencetak.";
      setBtErr(/cancel|chooser/i.test(m) ? "Pemilihan printer dibatalkan." : m);
    } finally {setPrintBusy(false);}
  };
  useEffect(()=>{
    if(!autoPrint||salinan||!logoReady)return;
    let live=true;setPrintBusy(true);
    void autoPrintSekali(`${testing?"demo":"pos"}:${r.id}`,async()=>{
      if(namaPrinter()){await cetakBluetooth(dataStruk());return 'sent';}
      if(diAplikasi())throw Error('Pilih printer di menu Printer terlebih dahulu. Transaksi sudah tersimpan.');
      // Browser menampilkan dialog print; tidak mengklaim kertas benar-benar keluar.
      window.print();return 'dialog';
    }).then(result=>{if(!live)return;setPrintBusy(false);if(result.status==='failed'){setBtErr(`${result.error} Jika struk belum keluar, gunakan Cetak manual.`);setJeda(true);}else setPrintStatus(result.status==='sent'?'Struk dikirim ke printer. Jika belum keluar, gunakan Cetak manual.':result.status==='dialog'?'Dialog cetak dibuka. Jika dibatalkan atau struk belum keluar, gunakan Cetak manual.':'Cetak otomatis sudah pernah dicoba. Gunakan Cetak manual bila struk belum keluar.');});
    return()=>{live=false;};
  // Isi struk sudah dibekukan pada receipt; pergantian kertas/re-render tidak mencetak ulang.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[autoPrint,salinan,logoReady,r.id,testing]);
  return (
    <Modal
      onClose={onClose}
      tutupLuar
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
      <div onPointerDownCapture={() => setJeda(true)} onKeyDownCapture={() => setJeda(true)}>
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
      {otomatis && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-stone-500">
          {jalanOtomatis ? (
            <span>
              ⏱ Tertutup otomatis dalam <b className="tabular-nums text-kopi-900">{sisa}</b> detik · ketuk jendela untuk menahan
            </span>
          ) : (
            <span>{lamaTutup > 0 ? "⏸ Tutup otomatis ditahan" : "Tutup otomatis mati"} · ketuk area gelap untuk menutup</span>
          )}
          <button type="button" onClick={gantiTutup} className="rounded-full border px-2 py-0.5 font-semibold text-kopi-700 hover:bg-stone-50">
            {lamaTutup > 0 ? "Matikan" : "Nyalakan (8 dtk)"}
          </button>
        </div>
      )}
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
      {(printBusy || printStatus) && <p role="status" className="mt-2 text-center text-xs text-stone-600">{printBusy ? "Mengirim struk ke printer…" : printStatus}</p>}
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
            disabled={printBusy} onClick={cetakBt}
            className="rounded-lg border px-4 py-2 text-sm"
            title={bt ? `Tersambung: ${bt}` : "Sambungkan printer Bluetooth"}
          >
            🖨 {bt ? "Cetak Bluetooth" : "Printer Bluetooth"}
          </button>
        )}
        {diAndroid() && !bt && !diAplikasi() && (
          <button
            disabled={printBusy} onClick={() => cetakRawBT(dataStruk())}
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
          disabled={printBusy} onClick={() => {setJeda(true);window.print();}}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Cetak manual
        </button>
        <button
          onClick={onClose}
          className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white"
        >
          {salinan ? "Tutup" : jalanOtomatis ? `Pesanan baru (${sisa})` : "Pesanan baru"}
        </button>
      </div>
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
