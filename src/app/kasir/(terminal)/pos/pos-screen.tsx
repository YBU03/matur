"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah } from "@/lib/format";
import { bayar, bukaShift, type Receipt } from "@/lib/pos-actions";

type Varian = { id: string; grup: string; nama: string; tambahan_harga: number };
export type PosMenu = { id: string; nama: string; kategori_id: string | null; harga_langsung: number; harga_ojol: number; foto_url: string | null; varian: Varian[] };
type Line = { key: string; menu: PosMenu; varian: Varian[]; qty: number };

// POS-02: kanal penjualan sesuai baris pendapatan di laporan
const KANAL = [
  ["langsung", "Langsung"],
  ["gofood", "GoFood"],
  ["grabfood", "GrabFood"],
  ["shopeefood", "ShopeeFood"],
  ["tiktok", "TikTok Go"],
  ["ruma_app", "Ruma App"],
  ["tumbler", "Tumbler"],
] as const;
const OJOL = new Set(["gofood", "grabfood", "shopeefood", "tiktok"]);
const METODE = [
  ["tunai", "Tunai"],
  ["qris", "QRIS"],
  ["debit", "Debit/Kredit"],
  ["transfer", "Transfer"],
] as const;
const MULTI = new Set(["Extra"]); // grup varian yang boleh dipilih lebih dari satu

const priceFor = (kanal: string, l: Pick<Line, "menu" | "varian">) =>
  (OJOL.has(kanal) ? l.menu.harga_ojol : l.menu.harga_langsung) + l.varian.reduce((s, v) => s + v.tambahan_harga, 0);

const num = (s: string) => Number(s.replace(/\D/g, "")) || 0;

export function OpenShift({ outletNama }: { outletNama: string }) {
  const [modal, setModal] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-matur-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Mulai Shift</h1>
      <p className="mb-4 text-sm text-stone-500">{outletNama} · transaksi baru bisa dilakukan setelah shift dibuka.</p>
      <label className="block text-sm font-medium">
        Modal awal laci
        <input value={modal} onChange={(e) => setModal(e.target.value)} inputMode="numeric" placeholder="200000" className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button
        disabled={pending}
        onClick={() => start(async () => setErr((await bukaShift(num(modal))).error ?? ""))}
        className="mt-4 w-full rounded-xl bg-matur-500 py-3 font-semibold text-white disabled:opacity-60"
      >
        Mulai Shift
      </button>
    </div>
  );
}

export function PosScreen({ kategori, menus, outletNama, kasir }: { kategori: { id: string; nama: string }[]; menus: PosMenu[]; outletNama: string; kasir: string }) {
  const [kat, setKat] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [picking, setPicking] = useState<PosMenu | null>(null);
  const [kanal, setKanal] = useState<string>("langsung");
  const [tipe, setTipe] = useState<"dine_in" | "take_away">("dine_in");
  const [pelanggan, setPelanggan] = useState("");
  const [meja, setMeja] = useState("");
  const [diskon, setDiskon] = useState("");
  const [metode, setMetode] = useState<string>("tunai");
  const [diterima, setDiterima] = useState("");
  const [err, setErr] = useState("");
  const [receipt, setReceipt] = useState<{ r: Receipt; lines: Line[]; kanal: string; metode: string } | null>(null);
  const [pending, start] = useTransition();

  const price = (l: Pick<Line, "menu" | "varian">) => priceFor(kanal, l);
  const subtotal = cart.reduce((s, l) => s + price(l) * l.qty, 0);
  const total = Math.max(subtotal - num(diskon), 0);
  const shown = useMemo(
    () => menus.filter((m) => (!kat || m.kategori_id === kat) && m.nama.toLowerCase().includes(cari.toLowerCase())),
    [menus, kat, cari],
  );

  const add = (menu: PosMenu, varian: Varian[]) => {
    const key = menu.id + ":" + varian.map((v) => v.id).sort().join(",");
    setCart((c) => (c.some((l) => l.key === key) ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)) : [...c, { key, menu, varian, qty: 1 }]));
  };
  const qtyOf = (menuId: string) => cart.filter((l) => l.menu.id === menuId).reduce((s, l) => s + l.qty, 0);
  const setQty = (key: string, d: number) => setCart((c) => c.flatMap((l) => (l.key !== key ? [l] : l.qty + d > 0 ? [{ ...l, qty: l.qty + d }] : [])));

  const checkout = () =>
    start(async () => {
      setErr("");
      const res = await bayar({
        client_id: crypto.randomUUID(),
        kanal,
        tipe,
        pelanggan,
        meja,
        diskon: num(diskon),
        metode,
        diterima: metode === "tunai" ? num(diterima) || total : undefined,
        items: cart.map((l) => ({ menu_id: l.menu.id, varian_ids: l.varian.map((v) => v.id), qty: l.qty })),
      });
      if (res.error || !res.receipt) return setErr(res.error ?? "Gagal menyimpan");
      setReceipt({ r: res.receipt, lines: cart, kanal, metode });
      setCart([]);
      setDiskon("");
      setDiterima("");
      setPelanggan("");
      setMeja("");
    });

  const chip = (active: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-matur-500 text-white" : "bg-matur-50 text-kopi-700"}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari menu…" className="min-w-40 flex-1 rounded-xl border px-3 py-2" />
          <button onClick={() => setKat(null)} className={chip(!kat)}>Semua</button>
          {kategori.map((k) => (
            <button key={k.id} onClick={() => setKat(k.id)} className={chip(kat === k.id)}>{k.nama}</button>
          ))}
        </div>
        {menus.length === 0 && <p className="py-10 text-center text-stone-400">Belum ada menu. Tambahkan di Data Master → Menu.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {shown.map((m) => (
            <button
              key={m.id}
              onClick={() => (m.varian.length ? setPicking(m) : add(m, []))}
              className="relative overflow-hidden rounded-2xl border border-matur-200 bg-white text-left shadow-sm transition active:scale-95"
            >
              {m.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto menu dari aset/Storage
                <img src={m.foto_url} alt="" loading="lazy" className="aspect-square w-full bg-matur-50 object-cover" />
              ) : (
                <div className="grid aspect-square w-full place-items-center bg-matur-50 text-3xl font-black text-matur-300">{m.nama.slice(0, 1)}</div>
              )}
              {qtyOf(m.id) > 0 && (
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-matur-500 text-sm font-bold text-white shadow">{qtyOf(m.id)}</span>
              )}
              <div className="p-2.5">
                <p className="line-clamp-2 text-sm font-semibold leading-tight">{m.nama}</p>
                <p className="mt-0.5 text-sm font-bold text-matur-700">{formatRupiah(OJOL.has(kanal) ? m.harga_ojol : m.harga_langsung)}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4 lg:sticky lg:top-4 lg:self-start">
        <div className="flex flex-wrap gap-1">
          {KANAL.map(([k, l]) => (
            <button key={k} onClick={() => setKanal(k)} className={chip(kanal === k)}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTipe("dine_in")} className={chip(tipe === "dine_in")}>Dine-in</button>
          <button onClick={() => setTipe("take_away")} className={chip(tipe === "take_away")}>Take away</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={pelanggan} onChange={(e) => setPelanggan(e.target.value)} placeholder="Nama pelanggan" className="rounded-lg border px-3 py-2 text-sm" />
          <input value={meja} onChange={(e) => setMeja(e.target.value)} placeholder="No. meja" className="rounded-lg border px-3 py-2 text-sm" />
        </div>

        <ul className="max-h-64 divide-y overflow-y-auto">
          {cart.length === 0 && <li className="py-6 text-center text-sm text-stone-400">Keranjang kosong</li>}
          {cart.map((l) => (
            <li key={l.key} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.menu.nama}</p>
                {l.varian.length > 0 && <p className="truncate text-xs text-stone-500">{l.varian.map((v) => v.nama).join(", ")}</p>}
              </div>
              <button onClick={() => setQty(l.key, -1)} className="size-7 rounded-full bg-matur-50">−</button>
              <span className="w-5 text-center">{l.qty}</span>
              <button onClick={() => setQty(l.key, 1)} className="size-7 rounded-full bg-matur-50">+</button>
              <span className="w-20 text-right tabular-nums">{formatRupiah(price(l) * l.qty)}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 border-t pt-2 text-sm">
          <Row label="Subtotal" value={formatRupiah(subtotal)} />
          <label className="flex items-center justify-between">
            Diskon (Rp)
            <input value={diskon} onChange={(e) => setDiskon(e.target.value)} inputMode="numeric" className="w-28 rounded-lg border px-2 py-1 text-right" />
          </label>
          <Row label="Total" value={formatRupiah(total)} bold />
        </div>
        <div className="flex flex-wrap gap-1">
          {METODE.map(([k, l]) => (
            <button key={k} onClick={() => setMetode(k)} className={chip(metode === k)}>{l}</button>
          ))}
        </div>
        {metode === "tunai" && (
          <label className="flex items-center justify-between text-sm">
            Uang diterima
            <input value={diterima} onChange={(e) => setDiterima(e.target.value)} inputMode="numeric" placeholder={String(total)} className="w-32 rounded-lg border px-2 py-1 text-right" />
          </label>
        )}
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <button
          disabled={pending || cart.length === 0}
          onClick={checkout}
          className="w-full rounded-xl bg-matur-500 py-3 text-lg font-bold text-white disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : `Bayar ${formatRupiah(total)}`}
        </button>
      </aside>

      {picking && <VariantPicker menu={picking} onCancel={() => setPicking(null)} onPick={(v) => (add(picking, v), setPicking(null))} />}
      {receipt && <ReceiptDialog {...receipt} outletNama={outletNama} kasir={kasir} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function VariantPicker({ menu, onPick, onCancel }: { menu: PosMenu; onPick: (v: Varian[]) => void; onCancel: () => void }) {
  const [sel, setSel] = useState<Varian[]>([]);
  const groups = [...new Set(menu.varian.map((v) => v.grup))];
  const toggle = (v: Varian) =>
    setSel((s) =>
      s.some((x) => x.id === v.id) ? s.filter((x) => x.id !== v.id) : [...s.filter((x) => MULTI.has(v.grup) || x.grup !== v.grup), v],
    );
  return (
    <Modal title={menu.nama}>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1 text-sm font-semibold">{g}</p>
            <div className="flex flex-wrap gap-2">
              {menu.varian
                .filter((v) => v.grup === g)
                .map((v) => (
                  <button
                    key={v.id}
                    onClick={() => toggle(v)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${sel.some((x) => x.id === v.id) ? "border-matur-500 bg-matur-500 text-white" : ""}`}
                  >
                    {v.nama}
                    {v.tambahan_harga ? ` +${formatRupiah(v.tambahan_harga)}` : ""}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
        <button onClick={() => onPick(sel)} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white">Tambah</button>
      </div>
    </Modal>
  );
}

// POS-05 (versi awal): struk bisa dicetak dari browser atau dikirim lewat WhatsApp
function ReceiptDialog({
  r,
  lines,
  kanal,
  metode,
  outletNama,
  kasir,
  onClose,
}: {
  r: Receipt;
  lines: Line[];
  kanal: string;
  metode: string;
  outletNama: string;
  kasir: string;
  onClose: () => void;
}) {
  const price = (l: Line) => priceFor(kanal, l);
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
  const waktu = new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const text = [
    `*${outletNama}* · No. ${r.nomor}`,
    ...lines.map((l) => `${l.qty}x ${l.menu.nama}${l.varian.length ? ` (${l.varian.map((v) => v.nama).join(", ")})` : ""}  ${formatRupiah(price(l) * l.qty)}`),
    r.diskon ? `Diskon: ${formatRupiah(-r.diskon)}` : "",
    `Total: ${formatRupiah(r.total)} (${METODE.find(([k]) => k === metode)?.[1]})`,
    r.kembalian ? `Kembali: ${formatRupiah(r.kembalian)}` : "",
    "Terima kasih 🙏",
  ].filter(Boolean);
  return (
    <Modal title="Transaksi berhasil">
      <div id="struk" data-kertas={kertas} className={`mx-auto rounded-xl bg-white p-3 font-mono text-black shadow-inner ${kertas === "58" ? "max-w-[230px] text-[11px]" : "max-w-[310px] text-xs"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo struk */}
        <img src="/brand/ruma-logo.png" alt="Ruma" className="mx-auto mb-1 h-8 w-auto grayscale" />
        <p className="text-center font-bold">{outletNama}</p>
        <p className="text-center">{waktu}</p>
        <p className="mb-2 text-center">No. {r.nomor} · {KANAL.find(([k]) => k === kanal)?.[1]} · {kasir}</p>
        {lines.map((l) => (
          <div key={l.key} className="flex justify-between gap-2">
            <span>{l.qty}x {l.menu.nama}{l.varian.length ? ` (${l.varian.map((v) => v.nama).join(", ")})` : ""}</span>
            <span className="shrink-0 whitespace-nowrap">{formatRupiah(price(l) * l.qty)}</span>
          </div>
        ))}
        <div className="mt-2 border-t border-dashed pt-2">
          {r.diskon > 0 && <Row label="Diskon" value={formatRupiah(-r.diskon)} />}
          <Row label="Total" value={formatRupiah(r.total)} bold />
          <Row label="Bayar" value={METODE.find(([k]) => k === metode)?.[1] ?? metode} />
          {r.kembalian > 0 && <Row label="Kembali" value={formatRupiah(r.kembalian)} />}
        </div>
        <p className="mt-2 border-t border-dashed pt-2 text-center">Terima kasih 🙏</p>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm">
        <span className="text-stone-500">Kertas:</span>
        {(["58", "80"] as const).map((k) => (
          <button key={k} onClick={() => pilihKertas(k)} className={`rounded-full px-3 py-1 ${kertas === k ? "bg-kopi-900 text-white" : "border"}`}>
            {k} mm
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text.join("\n"))}`} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2 text-sm">
          Kirim WhatsApp
        </a>
        <button onClick={() => window.print()} className="rounded-lg border px-4 py-2 text-sm">Cetak</button>
        <button onClick={onClose} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white">Pesanan baru</button>
      </div>
    </Modal>
  );
}
