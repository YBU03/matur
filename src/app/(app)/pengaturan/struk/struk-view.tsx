"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChipHeader, HeaderHalaman, Kartu, isian, tabKelas, tombolAksi } from "@/components/ui-halaman";
import { barisTeks } from "@/lib/struk-pdf";
import { logoStruk } from "@/lib/struk-logo";
import { KOLOM_STRUK, susunBarisStruk, type StrukOutlet } from "@/lib/struk";
import { simpanStruk, type Result } from "@/lib/struk-actions";
import type { GambarStruk } from "@/lib/printer-bt";

type OutletStruk = { id: string; nama: string; struk: StrukOutlet; diubah: string | null };

const CONTOH = [
  { nama: "Mochaccino", qty: 1, total: 24000 },
  { nama: "Black Coffee", qty: 1, total: 15000 },
  { nama: "Iced Kopi Susu Keluarga", qty: 1, total: 23000 },
];

export function StrukView({ outlets }: { outlets: OutletStruk[] }) {
  const [aktif, setAktif] = useState(outlets[0]?.id ?? "");
  const o = outlets.find((x) => x.id === aktif);
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <HeaderHalaman judul="Pengaturan Struk" ikon="🧾" keterangan="Isi struk POS per outlet: logo, nama, alamat, telepon, instagram, password wifi, tagline. Bisa diubah kapan saja, berlaku untuk struk berikutnya.">
        <ChipHeader>🏪 {outlets.length} outlet</ChipHeader>
      </HeaderHalaman>
      <nav className={tabKelas.wadah} aria-label="Pilih outlet">
        {outlets.map((x) => (
          <button key={x.id} type="button" onClick={() => setAktif(x.id)} className={x.id === aktif ? tabKelas.aktif : tabKelas.pasif} aria-pressed={x.id === aktif}>
            {x.nama}
          </button>
        ))}
      </nav>
      {o ? <Editor key={o.id} o={o} /> : <p className="text-sm text-stone-500">Belum ada outlet.</p>}
    </div>
  );
}

function Editor({ o }: { o: OutletStruk }) {
  const router = useRouter();
  const [v, setV] = useState<StrukOutlet>(o.struk);
  const [kertas, setKertas] = useState<"58" | "80">("58");
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const [logo, setLogo] = useState<GambarStruk | null>(null);
  useEffect(() => {
    logoStruk(kertas).then(setLogo);
  }, [kertas]);
  const berubah = JSON.stringify(v) !== JSON.stringify(o.struk);
  const kolom = KOLOM_STRUK[kertas];
  const baris = barisTeks(
    susunBarisStruk(
      { struk: v, waktu: new Date(), nomor: 3, kanal: "langsung", kasir: "Maya", items: CONTOH, subtotal: 62000, diskon: 0, total: 62000, bayar: [{ metode: "qris", nominal: 62000 }], kembalian: 0 },
      kolom,
    ),
    kolom,
  );
  const ubah = (k: keyof StrukOutlet) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const label = "block text-xs font-medium text-stone-500";
  const field = (k: keyof StrukOutlet, judul: string, contoh: string, maks: number, bantuan?: string) => (
    <label className={label}>
      {judul}
      <input value={String(v[k])} onChange={ubah(k)} maxLength={maks} placeholder={contoh} className={`${isian} mt-0.5 block w-full`} />
      {bantuan && <span className="mt-0.5 block text-[11px] text-stone-400">{bantuan}</span>}
    </label>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Kartu judul="Kepala struk" keterangan="Bagian paling atas struk.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-matur-100 bg-matur-50/40 p-3 text-sm font-medium sm:col-span-2">
              <input type="checkbox" checked={v.tampil_logo} onChange={(e) => setV({ ...v, tampil_logo: e.target.checked })} className="size-4 accent-matur-500" />
              Cetak logo RUMA di atas struk
              <span className="ml-auto text-[11px] font-normal text-stone-500">cetak sedikit lebih lama di printer murah</span>
            </label>
            {field("judul", "Nama di bawah logo", "RUMA", 40)}
            {field("telepon", "Telepon", "085869288356", 40)}
            <label className={`${label} sm:col-span-2`}>
              Alamat
              <textarea value={v.alamat} onChange={ubah("alamat")} maxLength={200} rows={2} placeholder="Jl. Komisaris Noto Sumarsono No.23, Purbalingga Kidul" className={`${isian} mt-0.5 block w-full`} />
            </label>
          </div>
        </Kartu>
        <Kartu judul="Kaki struk" keterangan="Bagian bawah setelah total & pembayaran. Kosongkan isian yang tidak ingin dicetak.">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("instagram", "Instagram", "di.rumakopi", 60)}
            {field("wifi", "Password wifi", "keluargaruma", 60)}
            {field("tagline", "Tagline", "tempat ngopi, tempat pulang", 80)}
            {field("hashtag", "Hashtag", "#RUMAKOPI", 60)}
            <label className={`${label} sm:col-span-2`}>
              Catatan tambahan (opsional, boleh beberapa baris)
              <textarea value={v.catatan} onChange={ubah("catatan")} maxLength={300} rows={2} placeholder="mis. Terima kasih, sampai jumpa lagi" className={`${isian} mt-0.5 block w-full`} />
            </label>
          </div>
        </Kartu>
        {msg && <p role="status" className={`rounded-xl px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{msg.error ?? msg.ok}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || !berubah}
            onClick={() =>
              start(async () => {
                setMsg(null);
                const r = await simpanStruk(o.id, v);
                setMsg(r);
                if (!r.error) router.refresh();
              })
            }
            className={`${tombolAksi.utama} px-5 py-2.5 text-sm`}
          >
            {pending ? "Menyimpan…" : "💾 Simpan struk"}
          </button>
          {berubah && (
            <button type="button" onClick={() => setV(o.struk)} className={tombolAksi.netral}>
              Batalkan perubahan
            </button>
          )}
          {o.diubah && <span className="text-xs text-stone-500">Terakhir diubah {new Date(o.diubah).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}</span>}
        </div>
      </div>
      <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-kopi-900">Pratinjau struk</p>
          <div className="flex gap-1 text-xs">
            {(["58", "80"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKertas(k)} className={`rounded-full px-3 py-1 ${kertas === k ? "bg-kopi-900 text-white" : "border bg-white"}`}>
                {k} mm
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl bg-stone-200 p-4">
          <div className="mx-auto w-fit bg-white p-3 font-mono text-black shadow">
            {v.tampil_logo && (
              // eslint-disable-next-line @next/next/no-img-element -- pratinjau logo hitam-putih
              <img src={logo?.dataUrl ?? "/brand/ruma-logo.png"} alt="Logo" className={`mx-auto mb-1 h-auto ${kertas === "58" ? "w-[140px]" : "w-[190px]"}`} />
            )}
            <div className="text-[10.5px] leading-[1.35]" style={{ width: `${kolom}ch` }}>
              {baris.map((b, i) => (
                <div key={i} className={`whitespace-pre ${b.tengah ? "text-center" : ""} ${b.tebal ? "font-bold" : ""}`}>
                  {b.teks || " "}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-stone-500">Contoh transaksi. Tanggal, nomor order, kasir, menu, dan pembayaran mengikuti transaksi asli.</p>
      </aside>
    </div>
  );
}
