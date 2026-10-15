"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { QrisTampil, type QrisOutlet } from "@/components/qris-tampil";
import { formatRupiah } from "@/lib/format";
import {
  batalDraft,
  izinDiskonSpv,
  simpanDraft,
  type Checkout,
  type DraftItem,
  type Receipt,
} from "@/lib/pos-actions";
import {
  bacaAntrean,
  galatJaringan,
  hapusTertunda,
  kirimCheckout,
  simpanTertunda,
} from "@/lib/pos-offline";
import {
  bisaBluetooth,
  cetakBluetooth,
  cetakRawBT,
  diAndroid,
  namaPrinter,
  sambungPrinter,
  susunStruk,
} from "@/lib/printer-bt";

type Varian = {
  id: string;
  grup: string;
  nama: string;
  tambahan_harga: number;
};
export type PosMenu = {
  id: string;
  nama: string;
  kategori_id: string | null;
  harga_langsung: number;
  harga_ojol: number;
  foto_url: string | null;
  varian: Varian[];
};
type Line = { key: string; menu: PosMenu; varian: Varian[]; qty: number };
export type Draft = {
  id: string;
  label: string | null;
  kanal: string;
  tipe: "dine_in" | "take_away";
  pelanggan: string | null;
  meja: string | null;
  diskon: number;
  items: DraftItem[];
  total: number;
  created_at: string;
  nama_pembuat: string | null;
};

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
  (OJOL.has(kanal) ? l.menu.harga_ojol : l.menu.harga_langsung) +
  l.varian.reduce((s, v) => s + v.tambahan_harga, 0);

const num = (s: string) => Number(s.replace(/\D/g, "")) || 0;

type Bayar = { metode: string; nominal: string; diterima: string };

/** Kirim ulang transaksi offline begitu online (server menolak duplikat lewat client_id). */
function useAntreanOffline() {
  const [jumlah, setJumlah] = useState(0);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      bacaAntrean()
        .then((r) => setJumlah(r.length))
        .catch(() => {});
    };
    refresh();
    window.addEventListener("matoer-antrean", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("matoer-antrean", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);
  return {
    jumlah,
    online,
    kirim: false,
    kirimSemua: () => window.dispatchEvent(new Event("pos-sync")),
  };
}

export function PosScreen({
  kategori,
  menus,
  outletNama,
  kasir,
  batasDiskon,
  drafts,
  sesiId,
  qris,
  izin,
}: {
  kategori: { id: string; nama: string }[];
  menus: PosMenu[];
  outletNama: string;
  kasir: string;
  batasDiskon: number;
  drafts: Draft[];
  sesiId: string;
  qris: QrisOutlet | null;
  izin: {
    id: string;
    sampai_at: string;
    server_at: string;
    client_at: number;
    offlineBoleh: boolean;
  };
}) {
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
  const [lihatQris, setLihatQris] = useState<number | null>(null);
  const [diterima, setDiterima] = useState("");
  const [err, setErr] = useState("");
  const [receipt, setReceipt] = useState<{
    r: Receipt;
    lines: Line[];
    kanal: string;
    metode: string;
    offline?: boolean;
  } | null>(null);
  const [pending, start] = useTransition();
  const [split, setSplit] = useState(false);
  const [bayarList, setBayarList] = useState<Bayar[]>([
    { metode: "tunai", nominal: "", diterima: "" },
    { metode: "qris", nominal: "", diterima: "" },
  ]);
  const [mintaSpv, setMintaSpv] = useState(false);
  const antrean = useAntreanOffline();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lihatDraft, setLihatDraft] = useState(false);
  const [info, setInfo] = useState("");

  const price = (l: Pick<Line, "menu" | "varian">) => priceFor(kanal, l);
  const subtotal = cart.reduce((s, l) => s + price(l) * l.qty, 0);
  const total = Math.max(subtotal - num(diskon), 0);
  const shown = useMemo(
    () =>
      menus.filter(
        (m) =>
          (!kat || m.kategori_id === kat) &&
          m.nama.toLowerCase().includes(cari.toLowerCase()),
      ),
    [menus, kat, cari],
  );

  const add = (menu: PosMenu, varian: Varian[]) => {
    const key =
      menu.id +
      ":" +
      varian
        .map((v) => v.id)
        .sort()
        .join(",");
    setCart((c) =>
      c.some((l) => l.key === key)
        ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
        : [...c, { key, menu, varian, qty: 1 }],
    );
  };
  const qtyOf = (menuId: string) =>
    cart.filter((l) => l.menu.id === menuId).reduce((s, l) => s + l.qty, 0);
  const setQty = (key: string, d: number) =>
    setCart((c) =>
      c.flatMap((l) =>
        l.key !== key ? [l] : l.qty + d > 0 ? [{ ...l, qty: l.qty + d }] : [],
      ),
    );

  const persenDiskon = subtotal ? (num(diskon) / subtotal) * 100 : 0;
  const sisaSplit = total - bayarList.reduce((t, b) => t + num(b.nominal), 0);
  const attempt = useRef<{
    fingerprint: string;
    id: string;
    waktu: string;
  } | null>(null);
  const reset = () => {
    attempt.current = null;
    setCart([]);
    setDiskon("");
    setDiterima("");
    setPelanggan("");
    setMeja("");
    setSplit(false);
    setDraftId(null);
    setBayarList([
      { metode: "tunai", nominal: "", diterima: "" },
      { metode: "qris", nominal: "", diterima: "" },
    ]);
  };
  const checkout = (otorisasi?: string) => {
    const waktu = new Date(
      Date.parse(izin.server_at) + Date.now() - izin.client_at,
    );
    if (waktu.getTime() > Date.parse(izin.sampai_at))
      return setErr(
        "Izin POS berakhir. Hubungkan internet dan verifikasi ulang.",
      );
    if (
      !navigator.onLine &&
      (!izin.offlineBoleh ||
        split ||
        metode !== "tunai" ||
        draftId ||
        otorisasi)
    )
      return setErr(
        "Saat offline hanya transaksi tunai biasa yang bisa disimpan. QRIS/split/draft/persetujuan membutuhkan internet.",
      );
    if (persenDiskon > batasDiskon && !otorisasi) return setMintaSpv(true);
    if (split && sisaSplit !== 0)
      return setErr(
        `Pembayaran split belum pas: ${sisaSplit > 0 ? "kurang" : "lebih"} ${formatRupiah(Math.abs(sisaSplit))}`,
      );
    const c: Checkout = {
      client_id: crypto.randomUUID(),
      sesi_id: sesiId,
      izin_id: izin.id,
      waktu_asli: waktu.toISOString(),
      kanal,
      tipe,
      pelanggan,
      meja,
      diskon: num(diskon),
      metode: split ? "split" : metode,
      diterima:
        !split && metode === "tunai" ? num(diterima) || total : undefined,
      pembayaran: split
        ? bayarList
            .filter((b) => num(b.nominal) > 0)
            .map((b) => ({
              metode: b.metode,
              nominal: num(b.nominal),
              diterima:
                b.metode === "tunai"
                  ? num(b.diterima) || num(b.nominal)
                  : undefined,
            }))
        : undefined,
      otorisasi,
      draft_id: draftId ?? undefined,
      items: cart.map((l) => ({
        menu_id: l.menu.id,
        varian_ids: l.varian.map((v) => v.id),
        qty: l.qty,
      })),
    };
    const fingerprint = JSON.stringify({
      ...c,
      client_id: undefined,
      waktu_asli: undefined,
    });
    if (attempt.current?.fingerprint === fingerprint) {
      c.client_id = attempt.current.id;
      c.waktu_asli = attempt.current.waktu;
    } else
      attempt.current = { fingerprint, id: c.client_id, waktu: c.waktu_asli! };
    const durableCash =
      izin.offlineBoleh &&
      !split &&
      c.metode === "tunai" &&
      !draftId &&
      !otorisasi;
    const sementara = `OFF-${c.client_id.slice(0, 8).toUpperCase()}`;
    start(async () => {
      setErr("");
      // Persist before the request: a browser crash or lost response must not lose the stable ID.
      if (durableCash) {
        try {
          await simpanTertunda({
            checkout: c,
            waktu: c.waktu_asli!,
            total,
            nomorSementara: sementara,
          });
        } catch {
          return setErr(
            "Transaksi BELUM tersimpan: penyimpanan tablet gagal/penuh. Hubungi SPV.",
          );
        }
      }
      try {
        const res = await kirimCheckout(c);
        if (res.error || !res.receipt) {
          if (durableCash) await hapusTertunda(c.client_id);
          return setErr(res.error ?? "Gagal menyimpan");
        }
        if (durableCash) {
          try {
            await hapusTertunda(c.client_id);
          } catch {
            /* Safe to replay: the server already has this ID. */
          }
        }
        setReceipt({ r: res.receipt, lines: cart, kanal, metode: c.metode });
      } catch (e) {
        if (!galatJaringan(e)) return setErr("Gagal menyimpan transaksi.");
        // offline: simpan di perangkat, struk tetap bisa diberikan; terkirim otomatis saat online
        if (
          !izin.offlineBoleh ||
          split ||
          c.metode !== "tunai" ||
          draftId ||
          otorisasi
        )
          return setErr(
            "Transaksi ini memerlukan internet. Keranjang tetap tersimpan di layar; coba lagi saat tersambung.",
          );
        try {
          await simpanTertunda({
            checkout: c,
            waktu: c.waktu_asli!,
            total,
            nomorSementara: sementara,
          });
        } catch {
          return setErr(
            "Transaksi BELUM tersimpan: penyimpanan tablet gagal/penuh. Jangan berikan struk berhasil; hubungi SPV.",
          );
        }
        const kembali = c.pembayaran
          ? c.pembayaran.reduce(
              (t, b) =>
                t +
                (b.metode === "tunai"
                  ? (b.diterima ?? b.nominal) - b.nominal
                  : 0),
              0,
            )
          : c.metode === "tunai"
            ? (c.diterima ?? total) - total
            : 0;
        setReceipt({
          r: {
            id: c.client_id,
            nomor: 0,
            subtotal,
            diskon: num(diskon),
            total,
            kembalian: kembali,
          },
          lines: cart,
          kanal,
          metode: c.metode,
          offline: true,
        });
      }
      reset();
    });
  };

  const itemsDraft = (): DraftItem[] =>
    cart.map((l) => ({
      menu_id: l.menu.id,
      varian_ids: l.varian.map((v) => v.id),
      qty: l.qty,
      nama:
        l.menu.nama +
        (l.varian.length ? ` (${l.varian.map((v) => v.nama).join(", ")})` : ""),
      harga: price(l),
    }));
  const simpanSebagaiDraft = () =>
    start(async () => {
      setErr("");
      const label =
        pelanggan ||
        (meja ? `Meja ${meja}` : "") ||
        prompt("Nama/penanda draft (mis. nama pelanggan atau meja):") ||
        "";
      try {
        const r = await simpanDraft({
          id: draftId ?? undefined,
          label,
          kanal,
          tipe,
          pelanggan,
          meja,
          diskon: num(diskon),
          items: itemsDraft(),
          total,
        });
        if (r.error) return setErr(r.error);
        setInfo(
          `💾 Draft “${label || "tanpa nama"}” disimpan. Buka lagi dari tombol Draft saat pelanggan siap bayar.`,
        );
        reset();
      } catch {
        setErr("Simpan draft butuh internet.");
      }
    });
  const lanjutkanDraft = (d: Draft) => {
    const byId = new Map(menus.map((m) => [m.id, m]));
    const hilang: string[] = [];
    const lines: Line[] = [];
    for (const it of d.items) {
      const m = byId.get(it.menu_id);
      if (!m) {
        hilang.push(it.nama);
        continue;
      }
      const varian = m.varian.filter((v) => it.varian_ids.includes(v.id));
      lines.push({
        key:
          m.id +
          ":" +
          varian
            .map((v) => v.id)
            .sort()
            .join(","),
        menu: m,
        varian,
        qty: it.qty,
      });
    }
    setCart(lines);
    setKanal(d.kanal);
    setTipe(d.tipe);
    setPelanggan(d.pelanggan ?? "");
    setMeja(d.meja ?? "");
    setDiskon(d.diskon ? String(d.diskon) : "");
    setDraftId(d.id);
    setLihatDraft(false);
    setInfo(
      hilang.length
        ? `⚠️ Menu tidak tersedia lagi dan dilewati: ${hilang.join(", ")}`
        : `Melanjutkan draft “${d.label ?? "tanpa nama"}”.`,
    );
  };
  const batalkanDraft = (d: Draft) => {
    const alasan = prompt(
      `Batalkan draft “${d.label ?? "tanpa nama"}”? Tulis alasannya:`,
    );
    if (!alasan?.trim()) return;
    start(async () => {
      const r = await batalDraft(d.id, alasan);
      if (r.error) setErr(r.error);
      else if (draftId === d.id) reset();
    });
  };

  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-matur-500 text-white" : "bg-matur-50 text-kopi-700"}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0 space-y-3">
        <div className="flex items-center gap-2 rounded-xl bg-matur-50 px-3 py-1.5 text-sm">
          <span className="mr-auto">
            👥 Tim shift: <b>{kasir}</b>
          </span>
          <Link
            href="/kasir/shift"
            className="rounded-lg border border-matur-300 bg-white px-2.5 py-1 text-xs font-semibold text-kopi-700"
          >
            Hitung / tutup kas tim
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari menu…"
            className="min-w-40 flex-1 rounded-xl border px-3 py-2"
          />
          <button onClick={() => setKat(null)} className={chip(!kat)}>
            Semua
          </button>
          {kategori.map((k) => (
            <button
              key={k.id}
              onClick={() => setKat(k.id)}
              className={chip(kat === k.id)}
            >
              {k.nama}
            </button>
          ))}
        </div>
        {menus.length === 0 && (
          <p className="py-10 text-center text-stone-400">
            Belum ada menu. Tambahkan di Data Master → Menu.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {shown.map((m) => (
            <button
              key={m.id}
              onClick={() => (m.varian.length ? setPicking(m) : add(m, []))}
              className="relative overflow-hidden rounded-2xl border border-matur-200 bg-white text-left shadow-sm transition active:scale-95"
            >
              {m.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto menu dari aset/Storage
                <img
                  src={m.foto_url}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full bg-matur-50 object-cover"
                />
              ) : (
                <div className="grid aspect-square w-full place-items-center bg-matur-50 text-3xl font-black text-matur-300">
                  {m.nama.slice(0, 1)}
                </div>
              )}
              {qtyOf(m.id) > 0 && (
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-matur-500 text-sm font-bold text-white shadow">
                  {qtyOf(m.id)}
                </span>
              )}
              <div className="p-2.5">
                <p className="line-clamp-2 text-sm font-semibold leading-tight">
                  {m.nama}
                </p>
                <p className="mt-0.5 text-sm font-bold text-matur-700">
                  {formatRupiah(
                    OJOL.has(kanal) ? m.harga_ojol : m.harga_langsung,
                  )}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLihatDraft(true)}
            className="rounded-lg border border-matur-300 px-3 py-1.5 text-sm font-semibold text-matur-700"
          >
            📋 Draft{" "}
            {drafts.length > 0 && (
              <span className="ml-1 rounded-full bg-matur-500 px-1.5 text-xs text-white">
                {drafts.length}
              </span>
            )}
          </button>
          {draftId && (
            <span className="truncate text-xs text-amber-700">
              ✏️ dari draft ·{" "}
              <button onClick={reset} className="underline">
                lepas
              </button>
            </span>
          )}
        </div>
        {info && (
          <p
            className="rounded-lg bg-matur-50 px-3 py-2 text-xs text-kopi-900"
            onClick={() => setInfo("")}
          >
            {info}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {KANAL.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setKanal(k)}
              className={chip(kanal === k)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTipe("dine_in")}
            className={chip(tipe === "dine_in")}
          >
            Dine-in
          </button>
          <button
            onClick={() => setTipe("take_away")}
            className={chip(tipe === "take_away")}
          >
            Take away
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={pelanggan}
            onChange={(e) => setPelanggan(e.target.value)}
            placeholder="Nama pelanggan"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={meja}
            onChange={(e) => setMeja(e.target.value)}
            placeholder="No. meja"
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <ul className="max-h-64 divide-y overflow-y-auto">
          {cart.length === 0 && (
            <li className="py-6 text-center text-sm text-stone-400">
              Keranjang kosong
            </li>
          )}
          {cart.map((l) => (
            <li key={l.key} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.menu.nama}</p>
                {l.varian.length > 0 && (
                  <p className="truncate text-xs text-stone-500">
                    {l.varian.map((v) => v.nama).join(", ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => setQty(l.key, -1)}
                className="size-7 rounded-full bg-matur-50"
              >
                −
              </button>
              <span className="w-5 text-center">{l.qty}</span>
              <button
                onClick={() => setQty(l.key, 1)}
                className="size-7 rounded-full bg-matur-50"
              >
                +
              </button>
              <span className="w-20 text-right tabular-nums">
                {formatRupiah(price(l) * l.qty)}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 border-t pt-2 text-sm">
          <Row label="Subtotal" value={formatRupiah(subtotal)} />
          <label className="flex items-center justify-between">
            Diskon (Rp)
            <input
              value={diskon}
              onChange={(e) => setDiskon(e.target.value)}
              inputMode="numeric"
              className="w-28 rounded-lg border px-2 py-1 text-right"
            />
          </label>
          <Row label="Total" value={formatRupiah(total)} bold />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {!split &&
            METODE.map(([k, l]) => (
              <button
                disabled={!antrean.online && k !== "tunai"}
                key={k}
                onClick={() => setMetode(k)}
                className={chip(metode === k)}
              >
                {l}
              </button>
            ))}
          <button
            disabled={!antrean.online}
            onClick={() => setSplit(!split)}
            className={`${chip(split)} ml-auto`}
          >
            {split ? "✕ Satu metode" : "➗ Split bayar"}
          </button>
        </div>
        {!split && metode === "qris" && total > 0 && (
          <button
            onClick={() => setLihatQris(total)}
            disabled={!qris}
            className="w-full rounded-xl border-2 border-sky-500 bg-sky-50 py-2 text-sm font-bold text-sky-700 disabled:opacity-50"
          >
            {qris
              ? `📱 Tampilkan QRIS ${qris.dinamis ? formatRupiah(total) : ""}`
              : "QRIS outlet belum diatur (Pengaturan → QRIS Outlet)"}
          </button>
        )}
        {split &&
          qris &&
          bayarList.some((b) => b.metode === "qris" && num(b.nominal) > 0) && (
            <button
              onClick={() =>
                setLihatQris(
                  bayarList
                    .filter((b) => b.metode === "qris")
                    .reduce((t, b) => t + num(b.nominal), 0),
                )
              }
              className="w-full rounded-xl border-2 border-sky-500 bg-sky-50 py-2 text-sm font-bold text-sky-700"
            >
              📱 Tampilkan QRIS bagian split
            </button>
          )}
        {!split && metode === "tunai" && (
          <label className="flex items-center justify-between text-sm">
            Uang diterima
            <input
              value={diterima}
              onChange={(e) => setDiterima(e.target.value)}
              inputMode="numeric"
              placeholder={String(total)}
              className="w-32 rounded-lg border px-2 py-1 text-right"
            />
          </label>
        )}
        {split && (
          <div className="space-y-1.5 rounded-xl bg-matur-50 p-2 text-sm">
            {bayarList.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1">
                <select
                  value={b.metode}
                  onChange={(e) =>
                    setBayarList(
                      bayarList.map((x, j) =>
                        j === i ? { ...x, metode: e.target.value } : x,
                      ),
                    )
                  }
                  className="rounded-lg border bg-white px-2 py-1"
                >
                  {METODE.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                <input
                  value={b.nominal}
                  onChange={(e) =>
                    setBayarList(
                      bayarList.map((x, j) =>
                        j === i ? { ...x, nominal: e.target.value } : x,
                      ),
                    )
                  }
                  onFocus={() =>
                    !b.nominal &&
                    sisaSplit > 0 &&
                    setBayarList(
                      bayarList.map((x, j) =>
                        j === i ? { ...x, nominal: String(sisaSplit) } : x,
                      ),
                    )
                  }
                  inputMode="numeric"
                  placeholder="nominal"
                  className="w-24 flex-1 rounded-lg border bg-white px-2 py-1 text-right"
                />
                {b.metode === "tunai" && (
                  <input
                    value={b.diterima}
                    onChange={(e) =>
                      setBayarList(
                        bayarList.map((x, j) =>
                          j === i ? { ...x, diterima: e.target.value } : x,
                        ),
                      )
                    }
                    inputMode="numeric"
                    placeholder="diterima"
                    className="w-24 rounded-lg border bg-white px-2 py-1 text-right"
                  />
                )}
                {bayarList.length > 2 && (
                  <button
                    onClick={() =>
                      setBayarList(bayarList.filter((_, j) => j !== i))
                    }
                    className="px-1 text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={() =>
                  setBayarList([
                    ...bayarList,
                    { metode: "debit", nominal: "", diterima: "" },
                  ])
                }
                className="font-semibold text-matur-700"
              >
                + metode lain
              </button>
              <span
                className={
                  sisaSplit === 0
                    ? "font-semibold text-green-700"
                    : "text-amber-700"
                }
              >
                {sisaSplit === 0 ? "✓ pas" : `sisa ${formatRupiah(sisaSplit)}`}
              </span>
            </div>
          </div>
        )}
        {persenDiskon > batasDiskon && (
          <p className="text-xs text-amber-700">
            Diskon {Math.round(persenDiskon)}% melebihi batas {batasDiskon}% —
            perlu PIN SPV saat bayar.
          </p>
        )}
        {antrean.jumlah > 0 && (
          <p className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span>📴 {antrean.jumlah} transaksi offline menunggu terkirim</span>
            <button
              disabled={antrean.kirim}
              onClick={antrean.kirimSemua}
              className="font-semibold underline"
            >
              {antrean.kirim ? "mengirim…" : "kirim sekarang"}
            </button>
          </p>
        )}
        {err && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </p>
        )}
        <button
          disabled={pending || cart.length === 0 || !antrean.online}
          onClick={simpanSebagaiDraft}
          className="w-full rounded-xl border-2 border-matur-300 py-2 text-sm font-semibold text-matur-700 disabled:opacity-40"
        >
          💾 {draftId ? "Perbarui draft" : "Simpan sebagai draft (bayar nanti)"}
        </button>
        <button
          disabled={pending || cart.length === 0}
          onClick={() => checkout()}
          className="w-full rounded-xl bg-matur-500 py-3 text-lg font-bold text-white disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : `Bayar ${formatRupiah(total)}`}
        </button>
      </aside>

      {picking && (
        <VariantPicker
          menu={picking}
          onCancel={() => setPicking(null)}
          onPick={(v) => (add(picking, v), setPicking(null))}
        />
      )}
      {lihatDraft && (
        <Modal title="📋 Pesanan draft">
          <p className="mb-2 text-xs text-stone-500">
            Pesanan yang disimpan dulu dan belum dibayar. Semua draft tercatat
            (siapa membuat, diatau dibatalkan beserta alasannya).
          </p>
          <ul className="max-h-[55vh] divide-y overflow-y-auto">
            {drafts.length === 0 && (
              <li className="py-6 text-center text-sm text-stone-400">
                Tidak ada draft.
              </li>
            )}
            {drafts.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{d.label ?? "Tanpa nama"}</p>
                    <p className="truncate text-xs text-stone-500">
                      {d.items.map((i) => `${i.qty}× ${i.nama}`).join(", ")}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {new Date(d.created_at).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · oleh {d.nama_pembuat ?? "-"}
                    </p>
                  </div>
                  <b className="tabular-nums">{formatRupiah(d.total)}</b>
                </div>
                <div className="mt-1 flex justify-end gap-3 text-xs font-semibold">
                  <button
                    onClick={() => batalkanDraft(d)}
                    className="text-red-600"
                  >
                    Batalkan
                  </button>
                  <button
                    onClick={() => lanjutkanDraft(d)}
                    className="text-matur-700"
                  >
                    Lanjutkan & bayar →
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-right">
            <button
              onClick={() => setLihatDraft(false)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Tutup
            </button>
          </div>
        </Modal>
      )}
      {lihatQris !== null && qris && (
        <Modal title="Scan untuk bayar">
          <div className="space-y-2 text-center">
            <QrisTampil q={qris} nominal={lihatQris} ukuran={300} />
            {qris.nama && <p className="font-semibold">{qris.nama}</p>}
            <p className="text-3xl font-bold tabular-nums">
              {formatRupiah(lihatQris)}
            </p>
            <p className="text-xs text-stone-500">
              {qris.mode === "dinamis"
                ? "Menunggu konfigurasi penyedia. Pembayaran QRIS belum dapat diproses."
                : "Minta pelanggan mengetik nominal di atas. Cek dana masuk sebelum menekan Bayar."}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setLihatQris(null)}
              className="rounded-lg bg-kopi-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Tutup
            </button>
          </div>
        </Modal>
      )}
      {receipt && (
        <ReceiptDialog
          {...receipt}
          outletNama={outletNama}
          kasir={kasir}
          onClose={() => setReceipt(null)}
        />
      )}
      {mintaSpv && (
        <PinSpv
          judul={`Setujui diskon ${Math.round(persenDiskon)}%`}
          onBatal={() => setMintaSpv(false)}
          onOk={async (login, pin) => {
            const r = await izinDiskonSpv(login, pin, persenDiskon);
            if (r.error) return r.error;
            setMintaSpv(false);
            checkout(r.otorisasi);
            return null;
          }}
        />
      )}
    </div>
  );
}

/** Dialog persetujuan SPV di perangkat kasir: kode staf + PIN (atau email + password). Sesi kasir tidak berubah. */
export function PinSpv({
  judul,
  keterangan,
  onOk,
  onBatal,
}: {
  judul: string;
  keterangan?: React.ReactNode;
  onOk: (login: string, pin: string) => Promise<string | null>;
  onBatal: () => void;
}) {
  const [login, setLogin] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title={`🔐 ${judul}`}>
      {keterangan}
      <p className="mb-3 text-sm text-stone-500">
        Minta SPV memasukkan kode staf & PIN (atau email & password).
      </p>
      <div className="space-y-2">
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Kode staf / email SPV"
          autoCapitalize="none"
          className="w-full rounded-lg border px-3 py-2"
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode={login.includes("@") ? "text" : "numeric"}
          placeholder="PIN / password"
          className="w-full rounded-lg border px-3 py-2"
        />
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onBatal}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Batal
        </button>
        <button
          disabled={pending || !login || !pin}
          onClick={() =>
            start(async () => setErr((await onOk(login, pin)) ?? ""))
          }
          className="rounded-lg bg-kopi-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Memeriksa…" : "Setujui"}
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

function VariantPicker({
  menu,
  onPick,
  onCancel,
}: {
  menu: PosMenu;
  onPick: (v: Varian[]) => void;
  onCancel: () => void;
}) {
  const [sel, setSel] = useState<Varian[]>([]);
  const groups = [...new Set(menu.varian.map((v) => v.grup))];
  const toggle = (v: Varian) =>
    setSel((s) =>
      s.some((x) => x.id === v.id)
        ? s.filter((x) => x.id !== v.id)
        : [...s.filter((x) => MULTI.has(v.grup) || x.grup !== v.grup), v],
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
                    {v.tambahan_harga
                      ? ` +${formatRupiah(v.tambahan_harga)}`
                      : ""}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Batal
        </button>
        <button
          onClick={() => onPick(sel)}
          className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Tambah
        </button>
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
  offline,
  outletNama,
  kasir,
  onClose,
}: {
  r: Receipt;
  offline?: boolean;
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
  const labelMetode =
    metode === "split"
      ? "Split"
      : (METODE.find(([k]) => k === metode)?.[1] ?? metode);
  const nomor = offline ? "OFFLINE" : String(r.nomor);
  const [bt, setBt] = useState<string | null>(namaPrinter());
  const [btErr, setBtErr] = useState("");
  const waktu = new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const text = [
    `*${outletNama}* · No. ${nomor}`,
    ...lines.map(
      (l) =>
        `${l.qty}x ${l.menu.nama}${l.varian.length ? ` (${l.varian.map((v) => v.nama).join(", ")})` : ""}  ${formatRupiah(price(l) * l.qty)}`,
    ),
    r.diskon ? `Diskon: ${formatRupiah(-r.diskon)}` : "",
    `Total: ${formatRupiah(r.total)} (${labelMetode})`,
    r.kembalian ? `Kembali: ${formatRupiah(r.kembalian)}` : "",
    "Terima kasih 🙏",
  ].filter(Boolean);
  const dataStruk = () => {
    const lebar = kertas === "58" ? 32 : 48;
    return susunStruk(
      [
        { teks: "RUMA", tengah: true, tebal: true, besar: true },
        { teks: outletNama, tengah: true, tebal: true },
        { teks: waktu, tengah: true },
        {
          teks: `No. ${nomor} - ${KANAL.find(([k]) => k === kanal)?.[1]} - ${kasir}`,
          tengah: true,
        },
        "-".repeat(lebar),
        ...lines.map((l) => ({
          teks: "",
          kiriKanan: [
            `${l.qty}x ${l.menu.nama}${l.varian.length ? ` (${l.varian.map((v) => v.nama).join(", ")})` : ""}`,
            formatRupiah(price(l) * l.qty),
          ] as [string, string],
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
      ],
      lebar,
    );
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
    <Modal title={offline ? "Tersimpan offline" : "Transaksi berhasil"}>
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
        {/* eslint-disable-next-line @next/next/no-img-element -- logo struk */}
        <img
          src="/brand/ruma-logo.png"
          alt="Ruma"
          className="mx-auto mb-1 h-8 w-auto grayscale"
        />
        <p className="text-center font-bold">{outletNama}</p>
        <p className="text-center">{waktu}</p>
        <p className="mb-2 text-center">
          No. {nomor} · {KANAL.find(([k]) => k === kanal)?.[1]} · {kasir}
        </p>
        {lines.map((l) => (
          <div key={l.key} className="flex justify-between gap-2">
            <span>
              {l.qty}x {l.menu.nama}
              {l.varian.length
                ? ` (${l.varian.map((v) => v.nama).join(", ")})`
                : ""}
            </span>
            <span className="shrink-0 whitespace-nowrap">
              {formatRupiah(price(l) * l.qty)}
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
      {btErr && (
        <p className="mt-2 text-center text-xs text-red-600">{btErr}</p>
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
          Pesanan baru
        </button>
      </div>
    </Modal>
  );
}
