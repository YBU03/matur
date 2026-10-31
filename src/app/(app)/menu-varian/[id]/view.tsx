"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChipHeader, HeaderHalaman } from "@/components/ui-halaman";
import { formatRupiah } from "@/lib/format";
import { simpanVarianMenu } from "@/lib/menu-varian-actions";
import { GRUP_OPSI, MULTI_OPSI, SARAN, cekVarian, type GrupOpsi, type KemasanInput, type OpsiInput } from "@/lib/menu-varian";
import { EditorResep } from "@/components/editor-resep";
import { hppResep, marginPersen, nadaMargin, type BahanHpp } from "@/lib/hpp-live";

type ResepDasar = { menu_id: string; bahan_id: string; takaran: number };
const WARNA = { hijau: "bg-emerald-100 text-emerald-800", kuning: "bg-amber-100 text-amber-800", merah: "bg-red-100 text-red-700" };

type Menu = { id: string; nama: string; harga_langsung: number; harga_ojol: number; foto_url: string | null; kategori: string | null };
const rp = (n: number) => (n ? "Rp " + n.toLocaleString("id-ID") : "Rp 0");
const isian = "w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm text-kopi-900 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";
const KET: Record<GrupOpsi, string> = {
  Gula: "Pilih satu: misalnya Normal, Less, No Sugar.",
  Extra: "Boleh dipilih lebih dari satu, dengan harga tambahan.",
  Suhu: "Pilih satu (opsional).",
  Ukuran: "Pilih satu (opsional), bisa dengan harga tambahan.",
};

function InputRp({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <label className="block min-w-0 text-[11px] text-stone-500">
      {label}
      <div className="relative mt-0.5">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">Rp</span>
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString("id-ID") : ""}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(0, 9)) || 0)}
          className={isian + " pl-9 text-right tabular-nums"}
        />
      </div>
    </label>
  );
}

export function VarianMenuView({ menu, kemasan: awalK, opsi: awalO, bahan, resep }: { menu: Menu; kemasan: KemasanInput[]; opsi: OpsiInput[]; bahan: BahanHpp[]; resep: ResepDasar[] }) {
  const peta = new Map(bahan.map((b) => [b.id, b]));
  const resepOf = (id: string) => resep.filter((r) => r.menu_id === id);
  const [resepEdit, setResepEdit] = useState<{ id: string; nama: string; harga_langsung: number; harga_ojol: number } | null>(null);
  const router = useRouter();
  const [busy, start] = useTransition();
  const [kemasan, setKemasan] = useState(awalK);
  const [opsi, setOpsi] = useState(awalO);
  const [lain, setLain] = useState(awalO.some((o) => o.grup === "Suhu" || o.grup === "Ukuran"));
  // pesan sukses dibawa lewat sessionStorage karena halaman dipasang ulang setelah data tersimpan
  const [pesan, setPesan] = useState<{ ok?: string; error?: string } | null>(() => {
    try {
      const ok = sessionStorage.getItem("varian-menu-ok");
      sessionStorage.removeItem("varian-menu-ok");
      return ok ? { ok } : null;
    } catch {
      return null;
    }
  });
  const dirty = JSON.stringify(kemasan) !== JSON.stringify(awalK) || JSON.stringify(opsi) !== JSON.stringify(awalO);
  const ubah = () => setPesan(null);

  const ubahK = (i: number, v: Partial<KemasanInput>) => (ubah(), setKemasan(kemasan.map((k, n) => (n === i ? { ...k, ...v } : k))));
  const tambahK = (nama = "") => (ubah(), setKemasan([...kemasan, { nama, harga_langsung: kemasan.at(-1)?.harga_langsung ?? menu.harga_langsung, harga_ojol: kemasan.at(-1)?.harga_ojol ?? menu.harga_ojol, aktif: true }]));
  const ubahO = (o: OpsiInput, v: Partial<OpsiInput>) => (ubah(), setOpsi(opsi.map((x) => (x === o ? { ...x, ...v } : x))));
  const tambahO = (grup: GrupOpsi, nama = "") => (ubah(), setOpsi([...opsi, { grup, nama, tambahan_harga: 0 }]));

  const simpan = () => {
    const p = { menu_id: menu.id, kemasan: kemasan.map((k) => ({ ...k, nama: k.nama.trim() })), opsi: opsi.map((o) => ({ ...o, nama: o.nama.trim() })) };
    const salah = cekVarian(p);
    if (salah) return setPesan({ error: salah });
    const hilang = awalK.filter((a) => !kemasan.some((k) => k.id === a.id)).map((a) => a.nama);
    if (hilang.length && !window.confirm(`Kemasan ${hilang.join(", ")} akan dihapus dari POS. Riwayat penjualan tetap tersimpan. Lanjutkan?`)) return;
    start(async () => {
      try {
        const r = await simpanVarianMenu(p);
        setPesan(r);
        if (r.ok) {
          try {
            sessionStorage.setItem("varian-menu-ok", r.ok);
          } catch {}
          router.refresh();
        }
      } catch {
        setPesan({ error: "Belum tersimpan. Periksa koneksi lalu coba lagi." });
      }
    });
  };

  const kAktif = kemasan.filter((k) => k.aktif);
  const grupTampil = GRUP_OPSI.filter((g) => g === "Gula" || g === "Extra" || lain);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      <Link href="/master/menu" className="inline-flex text-sm font-semibold text-matur-700 hover:underline">
        ← Daftar Menu
      </Link>
      <HeaderHalaman ikon="🧋" judul={menu.nama} keterangan="Atur kemasan (harga sendiri) dan pilihan seperti Gula/Extra di satu tempat. Pilihan berlaku sama untuk semua kemasan.">
        {menu.kategori && <ChipHeader>🏷️ {menu.kategori}</ChipHeader>}
        <ChipHeader>{kemasan.length ? `${kemasan.length} kemasan` : "Tanpa kemasan"}</ChipHeader>
        <ChipHeader>{opsi.length} pilihan</ChipHeader>
      </HeaderHalaman>

      <section className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-kopi-900">📦 Kemasan & harga</h2>
            <p className="text-xs text-stone-500">Contoh Cup, Hot, Can. Setiap kemasan punya harga dine-in/take away dan ojol sendiri, serta resep & HPP sendiri. Di POS kasir wajib memilih salah satu.</p>
          </div>
          <button type="button" onClick={() => setResepEdit(menu)} className="rounded-xl border border-matur-300 px-3 py-2 text-xs font-semibold text-kopi-800 hover:bg-matur-50">
            🧾 Resep dasar · HPP {formatRupiah(hppResep(resepOf(menu.id), peta))}
          </button>
        </div>
        {!kemasan.length && (
          <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
            Belum ada kemasan: menu dijual dengan harga menu <b>{rp(menu.harga_langsung)}</b> (ojol {rp(menu.harga_ojol)}).
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {kemasan.map((k, i) => (
            <li key={k.id ?? "baru" + i} className={`grid grid-cols-2 items-end gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1.2fr)_1fr_1fr_auto_auto] ${k.aktif ? "border-matur-100 bg-matur-50/40" : "border-stone-200 bg-stone-50 opacity-70"}`}>
              <label className="col-span-2 block text-[11px] text-stone-500 sm:col-span-1">
                Nama kemasan {!k.id && <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] font-bold text-emerald-700">BARU</span>}
                <input value={k.nama} maxLength={40} placeholder="mis. Cup" onChange={(e) => ubahK(i, { nama: e.target.value })} className={isian + " mt-0.5 font-semibold"} />
              </label>
              <InputRp label="Dine-in / Take away" value={k.harga_langsung} onChange={(n) => ubahK(i, { harga_langsung: n })} />
              <InputRp label="Ojol" value={k.harga_ojol} onChange={(n) => ubahK(i, { harga_ojol: n })} />
              <button type="button" role="switch" aria-checked={k.aktif} aria-label={"Aktif " + k.nama} onClick={() => ubahK(i, { aktif: !k.aktif })} className="flex items-center gap-2 rounded-xl px-1 py-2 text-xs font-semibold text-stone-600">
                <span className={`relative h-6 w-10 rounded-full transition ${k.aktif ? "bg-emerald-500" : "bg-stone-300"}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${k.aktif ? "left-[18px]" : "left-0.5"}`} />
                </span>
                {k.aktif ? "Dijual" : "Nonaktif"}
              </button>
              <button type="button" aria-label={"Hapus kemasan " + k.nama} onClick={() => (ubah(), setKemasan(kemasan.filter((_, n) => n !== i)))} className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                ✕ <span className="sm:hidden">Hapus</span>
              </button>
              {k.id && (() => {
                const rows = resepOf(k.id!);
                const h = hppResep(rows, peta);
                const md = marginPersen(k.harga_langsung, h);
                const mo = marginPersen(k.harga_ojol, h);
                return (
                  <div className="col-span-full flex flex-wrap items-center gap-2 border-t border-matur-100 pt-2 text-xs">
                    {rows.length ? (
                      <>
                        <span>
                          HPP <b className="tabular-nums text-kopi-900">{formatRupiah(h)}</b>
                        </span>
                        <span className={`rounded-full px-2 py-0.5 font-bold ${WARNA[nadaMargin(md)]}`}>margin {md}%</span>
                        <span className="text-stone-500">ojol {mo}%</span>
                      </>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">Belum ada resep: stok tidak terpotong</span>
                    )}
                    <button type="button" onClick={() => setResepEdit({ id: k.id!, nama: `${menu.nama} (${k.nama})`, harga_langsung: k.harga_langsung, harga_ojol: k.harga_ojol })} className="ml-auto rounded-lg bg-kopi-900 px-3 py-1.5 font-semibold text-white">
                      🧾 Atur resep
                    </button>
                  </div>
                );
              })()}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {SARAN.Kemasan.filter((n) => !kemasan.some((k) => k.nama.trim().toLowerCase() === n.toLowerCase())).map((n) => (
            <button key={n} type="button" onClick={() => tambahK(n)} className="rounded-full border border-dashed border-matur-300 px-3 py-1.5 text-xs font-semibold text-matur-700 hover:bg-matur-50">
              + {n}
            </button>
          ))}
          <button type="button" onClick={() => tambahK()} className="rounded-full border border-matur-300 bg-white px-3 py-1.5 text-xs font-semibold text-kopi-800 hover:bg-matur-50">
            + Kemasan lain
          </button>
        </div>
        {kemasan.some((k) => !k.id) && <p className="mt-2 text-xs text-stone-500">💡 Kemasan baru menyalin resep dasar sebagai awal. Setelah disimpan, atur bahan tiap kemasan (mis. cup vs can) lewat tombol Atur resep.</p>}
      </section>

      {grupTampil.map((g) => {
        const xs = opsi.filter((o) => o.grup === g);
        return (
          <section key={g} className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-bold text-kopi-900">
              {g === "Gula" ? "🍬" : g === "Extra" ? "➕" : g === "Suhu" ? "🌡️" : "📏"} {g}{" "}
              <span className="text-xs font-normal text-stone-400">{MULTI_OPSI.has(g) ? "· boleh lebih dari satu" : "· pilih satu"}</span>
            </h2>
            <p className="text-xs text-stone-500">{KET[g]}</p>
            <ul className="mt-3 space-y-2">
              {xs.map((o, i) => (
                <li key={g + i} className="grid grid-cols-[minmax(0,1fr)_8.5rem_auto] items-end gap-2">
                  <label className="block min-w-0 text-[11px] text-stone-500">
                    Nama pilihan
                    <input value={o.nama} maxLength={40} onChange={(e) => ubahO(o, { nama: e.target.value })} className={isian + " mt-0.5"} />
                  </label>
                  <InputRp label="Harga tambahan" value={o.tambahan_harga} onChange={(n) => ubahO(o, { tambahan_harga: n })} />
                  <button type="button" aria-label={"Hapus " + o.nama} onClick={() => (ubah(), setOpsi(opsi.filter((x) => x !== o)))} className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {SARAN[g].filter((n) => !xs.some((o) => o.nama.trim().toLowerCase() === n.toLowerCase())).map((n) => (
                <button key={n} type="button" onClick={() => tambahO(g, n)} className="rounded-full border border-dashed border-matur-300 px-3 py-1.5 text-xs font-semibold text-matur-700 hover:bg-matur-50">
                  + {n}
                </button>
              ))}
              <button type="button" onClick={() => tambahO(g)} className="rounded-full border border-matur-300 bg-white px-3 py-1.5 text-xs font-semibold text-kopi-800 hover:bg-matur-50">
                + Lainnya
              </button>
            </div>
          </section>
        );
      })}
      {!lain && (
        <button type="button" onClick={() => setLain(true)} className="w-full rounded-2xl border border-dashed border-matur-200 bg-white/60 py-3 text-sm font-semibold text-matur-700">
          + Tambah grup Suhu / Ukuran
        </button>
      )}

      <section className="rounded-2xl border border-matur-100 bg-matur-50/50 p-4 sm:p-5">
        <h2 className="text-base font-bold text-kopi-900">👀 Tampilan di POS</h2>
        <div className="mt-3 max-w-md rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="font-bold text-kopi-900">{menu.nama}</p>
          {!!kAktif.length && (
            <>
              <p className="mt-2 text-xs font-semibold">Kemasan <span className="font-normal text-red-600">wajib</span></p>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {kAktif.map((k, n) => (
                  <span key={n} className={`rounded-lg border px-2 py-1.5 text-xs ${n === 0 ? "border-matur-500 bg-matur-500 text-white" : "border-stone-200"}`}>
                    <b className="block truncate">{k.nama || "…"}</b>
                    {formatRupiah(k.harga_langsung)}
                  </span>
                ))}
              </div>
            </>
          )}
          {GRUP_OPSI.filter((g) => opsi.some((o) => o.grup === g)).map((g) => (
            <div key={g} className="mt-2">
              <p className="text-xs font-semibold">{g}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {opsi.filter((o) => o.grup === g).map((o, n) => (
                  <span key={n} className="rounded-lg border border-stone-200 px-2 py-1 text-xs">
                    {o.nama || "…"}
                    {o.tambahan_harga ? ` +${formatRupiah(o.tambahan_harga)}` : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!kAktif.length && !opsi.length && <p className="mt-1 text-xs text-stone-500">Langsung masuk keranjang tanpa jendela pilihan.</p>}
        </div>
      </section>

      {resepEdit && (
        <EditorResep key={resepEdit.id} menu={resepEdit} awal={resepOf(resepEdit.id)} bahan={bahan} onTutup={() => setResepEdit(null)} />
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-matur-200 bg-white/95 p-3 backdrop-blur sm:sticky sm:bottom-3 sm:rounded-2xl sm:border sm:shadow-lg">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2">
          <p role="status" className={`mr-auto text-xs ${pesan?.error ? "font-semibold text-red-700" : pesan?.ok ? "text-emerald-700" : dirty ? "font-semibold text-amber-700" : "text-stone-500"}`}>
            {pesan?.error ?? pesan?.ok ?? (dirty ? "● Ada perubahan belum disimpan" : "✓ Tersimpan")}
          </p>
          {dirty && (
            <button type="button" disabled={busy} onClick={() => (setKemasan(awalK), setOpsi(awalO), setPesan(null))} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700">
              Batalkan
            </button>
          )}
          <button type="button" disabled={busy || !dirty} onClick={simpan} className="rounded-xl bg-kopi-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
