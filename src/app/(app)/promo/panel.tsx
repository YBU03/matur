"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah as rp } from "@/lib/format";
import { simpanPromo } from "@/lib/promo-actions";
import type { Promo, PemakaianPromo, AturanPromo } from "@/lib/promo";
type Opsi = { id: string; nama: string };
const input =
  "w-full rounded-lg border border-matur-200 bg-white p-2 text-sm text-kopi-900";
export function PromoPanel({
  promos,
  outlets,
  menus,
  variants,
  laporan,
  error,
  bisaEdit,
  spv,
  dari,
  sampai,
  outlet,
}: {
  promos: Promo[];
  outlets: Opsi[];
  menus: (Opsi & { kemasan?: string | null })[];
  variants: (Opsi & { menu_id: string; grup: string })[];
  laporan: PemakaianPromo[];
  error?: string;
  bisaEdit: boolean;
  spv: boolean;
  dari: string;
  sampai: string;
  outlet: string;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<Promo | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const baru = (): Promo => ({
    id: "",
    nama: "",
    aktif: false,
    mulai: dari,
    selesai: dari,
    jam_mulai: "00:00",
    jam_selesai: "23:59:59",
    semua_outlet: false,
    outlet_ids: spv ? outlets.map((o) => o.id) : [],
    aturan: [],
    kuota: null,
    per_menu: false,
    bersama: false,
    boleh_manual: false,
    versi: 0,
  });
  const set = (p: Partial<Promo>) =>
    setEdit((x) => (x ? { ...x, ...p } : null));
  const rule = (i: number, p: Partial<AturanPromo>) =>
    set({ aturan: edit!.aturan.map((a, k) => (i === k ? { ...a, ...p } : a)) });
  const simpan = () =>
    start(async () => {
      setErr("");
      try {
        const r = await simpanPromo({ ...edit!, id: edit!.id || undefined });
        if (r.error) setErr(r.error);
        else {
          setEdit(null);
          router.refresh();
        }
      } catch {
        setErr(
          "Koneksi terputus. Muat ulang untuk memeriksa hasil penyimpanan.",
        );
      }
    });
  const aktif = laporan.filter((r) => r.status === "lunas");
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Promo & Diskon</h1>
          <p className="text-sm text-stone-600">
            Atur promo kasir per outlet, menu, periode, dan kuota.
          </p>
        </div>
        {bisaEdit && (
          <button
            className="rounded-lg bg-matur-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
            onClick={() => {
              setErr("");
              setEdit(baru());
            }}
          >
            + Buat promo
          </button>
        )}
      </header>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {promos.map((p) => (
          <article
            key={p.id}
            className="rounded-xl border border-matur-200 bg-white p-4"
          >
            <div className="flex justify-between gap-3">
              <h2 className="font-bold">{p.nama}</h2>
              <span>{p.aktif ? "🟢 Aktif" : "⚪ Nonaktif"}</span>
            </div>
            <p className="text-sm">
              {p.mulai} – {p.selesai} · {p.jam_mulai}–{p.jam_selesai} WIB
            </p>
            <p className="mt-1 text-sm">
              {p.semua_outlet
                ? "Semua outlet (termasuk outlet baru)"
                : outlets
                    .filter((o) => p.outlet_ids.includes(o.id))
                    .map((o) => o.nama)
                    .join(", ")}
            </p>
            <p className="text-sm">
              {p.aturan.length} menu ·{" "}
              {p.kuota
                ? `${p.kuota} item/hari ${p.per_menu ? "per menu" : "gabungan menu"} · ${p.bersama ? "bersama lintas outlet" : "per outlet"}`
                : "Tanpa batas kuota"}
            </p>
            <p className="text-xs text-stone-500">
              {p.boleh_manual
                ? "Boleh ditambah diskon manual sesuai batas SPV"
                : "Tidak digabung diskon manual"}
            </p>
            {bisaEdit && (
              <button
                className="mt-3 rounded-lg border px-3 py-1.5 text-sm font-semibold"
                onClick={() => {
                  setErr("");
                  setEdit(structuredClone(p));
                }}
              >
                Edit pengaturan
              </button>
            )}
          </article>
        ))}
      </div>
      {!promos.length && !error && (
        <p className="rounded-xl border p-4">
          Belum ada promo. Buat pengaturan dan pilih outlet yang akan
          memakainya.
        </p>
      )}
      <section className="space-y-3 rounded-xl border bg-white p-4">
        <h2 className="text-lg font-bold">Pemakaian promo · Accounting</h2>
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Dari
            <input
              className={input}
              type="date"
              name="dari"
              defaultValue={dari}
            />
          </label>
          <label className="text-sm">
            Sampai
            <input
              className={input}
              type="date"
              name="sampai"
              defaultValue={sampai}
            />
          </label>
          <label className="text-sm">
            Outlet
            <select className={input} name="outlet" defaultValue={outlet}>
              {!spv && <option value="">Semua outlet</option>}
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg bg-matur-500 px-4 py-2 font-semibold text-white disabled:opacity-50">
            Tampilkan
          </button>
        </form>
        <p className="text-sm font-semibold">
          {aktif.length} transaksi lunas ·{" "}
          {aktif.reduce((s, r) => s + Number(r.qty), 0)} item promo · Diskon
          promo {rp(aktif.reduce((s, r) => s + Number(r.diskon), 0))}
        </p>
        <p className="text-xs text-stone-500">
          Diskon promo sudah termasuk diskon transaksi pada laporan penjualan.
          Void/hapus tidak masuk total ini. Hari operasional berganti pukul
          03.00 WIB.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Waktu / No.",
                  "Outlet",
                  "Promo",
                  "Item",
                  "Diskon promo",
                  "Total bayar",
                  "Status",
                ].map((x) => (
                  <th className="p-2" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {laporan.map((r) => (
                <tr className="border-t" key={r.id}>
                  <td className="p-2">
                    {new Date(r.waktu).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    / #{r.nomor}
                  </td>
                  <td className="p-2">{r.outlet}</td>
                  <td className="p-2">{r.promo}</td>
                  <td className="p-2">{r.qty}</td>
                  <td className="p-2">{rp(r.diskon)}</td>
                  <td className="p-2">{rp(r.total)}</td>
                  <td className="p-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!laporan.length && (
          <p className="text-sm text-stone-500">
            Belum ada pemakaian pada periode ini.
          </p>
        )}
      </section>
      {edit && (
        <Modal
          scrollable
          wide
          title={edit.id ? "Edit promo" : "Buat promo"}
          onClose={() => !pending && setEdit(null)}
        >
          <div className="space-y-4">
            <label className="block text-sm">
              Nama promo
              <input
                className={input}
                value={edit.nama}
                maxLength={120}
                onChange={(e) => set({ nama: e.target.value })}
              />
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.aktif}
                onChange={(e) => set({ aktif: e.target.checked })}
              />
              Aktifkan promo
            </label>
            <fieldset className="rounded-lg border p-3">
              <legend className="text-sm font-semibold">
                Outlet yang memakai promo
              </legend>
              {!spv && (
                <label className="mb-2 flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={edit.semua_outlet}
                    onChange={(e) => set({ semua_outlet: e.target.checked })}
                  />
                  Semua outlet, termasuk outlet baru
                </label>
              )}
              {!edit.semua_outlet &&
                outlets.map((o) => (
                  <label className="flex gap-2 text-sm" key={o.id}>
                    <input
                      type="checkbox"
                      checked={edit.outlet_ids.includes(o.id)}
                      onChange={(e) =>
                        set({
                          outlet_ids: e.target.checked
                            ? [...edit.outlet_ids, o.id]
                            : edit.outlet_ids.filter((id) => id !== o.id),
                        })
                      }
                    />
                    {o.nama}
                  </label>
                ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              {(["mulai", "selesai", "jam_mulai", "jam_selesai"] as const).map(
                (k) => (
                  <label className="text-sm" key={k}>
                    {
                      {
                        mulai: "Tanggal mulai",
                        selesai: "Tanggal selesai",
                        jam_mulai: "Jam mulai WIB",
                        jam_selesai: "Jam selesai WIB",
                      }[k]
                    }
                    <input
                      className={input}
                      type={k.startsWith("jam") ? "time" : "date"}
                      step={k.startsWith("jam") ? 1 : undefined}
                      value={edit[k]}
                      onChange={(e) => set({ [k]: e.target.value })}
                    />
                  </label>
                ),
              )}
            </div>
            <p className="text-xs text-stone-500">
              Tanggal kalender WIB, rentang jam dalam hari yang sama. Kuota
              harian memakai hari operasional 03.00 WIB.
            </p>
            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="text-sm font-semibold">
                Aturan menu / kemasan
              </legend>
              <p className="text-xs text-stone-500">
                Satu promo per transaksi. Harga akhir berlaku per item termasuk
                tambahan varian. Varian yang dicentang wajib ada; kosong berarti
                semua varian menu tersebut.
              </p>
              {edit.aturan.map((a, i) => (
                <div className="space-y-2 rounded-lg bg-matur-50 p-2" key={i}>
                  <select
                    aria-label="Menu promo"
                    className={input}
                    value={a.menu_id}
                    onChange={(e) =>
                      rule(i, { menu_id: e.target.value, varian_ids: [] })
                    }
                  >
                    <option value="">Pilih menu / kemasan</option>
                    {menus.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.nama}
                        {m.kemasan ? ` · ${m.kemasan}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <select
                      aria-label="Jenis diskon"
                      className={input}
                      value={a.jenis}
                      onChange={(e) =>
                        rule(i, {
                          jenis: e.target.value as AturanPromo["jenis"],
                        })
                      }
                    >
                      <option value="persen">Diskon persen (%)</option>
                      <option value="potongan">Potongan per item (Rp)</option>
                      <option value="harga_akhir">
                        Harga akhir per item (Rp)
                      </option>
                    </select>
                    <input
                      aria-label="Nilai promo"
                      className={input}
                      type="number"
                      min="1"
                      max={a.jenis === "persen" ? 100 : undefined}
                      value={a.nilai || ""}
                      onChange={(e) =>
                        rule(i, { nilai: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variants
                      .filter((v) => v.menu_id === a.menu_id)
                      .map((v) => (
                        <label className="text-xs" key={v.id}>
                          <input
                            type="checkbox"
                            checked={a.varian_ids.includes(v.id)}
                            onChange={(e) =>
                              rule(i, {
                                varian_ids: e.target.checked
                                  ? [...a.varian_ids, v.id]
                                  : a.varian_ids.filter((id) => id !== v.id),
                              })
                            }
                          />{" "}
                          {v.grup}: {v.nama}
                        </label>
                      ))}
                  </div>
                  <button
                    className="text-xs text-red-700"
                    onClick={() =>
                      set({ aturan: edit.aturan.filter((_, k) => k !== i) })
                    }
                  >
                    Hapus aturan
                  </button>
                </div>
              ))}
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={() =>
                  set({
                    aturan: [
                      ...edit.aturan,
                      {
                        menu_id: "",
                        varian_ids: [],
                        jenis: "harga_akhir",
                        nilai: 0,
                      },
                    ],
                  })
                }
              >
                + Menu promo
              </button>
            </fieldset>
            <label className="block text-sm">
              Kuota item per hari (kosong = tanpa batas)
              <input
                className={input}
                type="number"
                min="1"
                value={edit.kuota ?? ""}
                onChange={(e) =>
                  set({ kuota: e.target.value ? Number(e.target.value) : null })
                }
              />
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.per_menu}
                onChange={(e) => set({ per_menu: e.target.checked })}
              />
              Kuota terpisah per menu (jika tidak: gabungan semua menu)
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.bersama}
                onChange={(e) => set({ bersama: e.target.checked })}
              />
              Kuota bersama semua outlet terpilih (jika tidak: per outlet)
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.boleh_manual}
                onChange={(e) => set({ boleh_manual: e.target.checked })}
              />
              Boleh digabung diskon manual (batas persetujuan SPV tetap berlaku)
            </label>
            <p className="rounded-lg bg-amber-50 p-3 text-xs">
              Reservasi yang sudah diterbitkan tetap berlaku maksimal 15 menit.
              Perubahan berlaku saat promo dipilih berikutnya. Void/hapus
              mengembalikan kuota; pemulihan transaksi memeriksa ketersediaan
              kuota lagi. Setiap perubahan dicatat dalam Log Aktivitas.
            </p>
            {err && (
              <p role="alert" className="text-sm text-red-700">
                {err}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                disabled={pending}
                className="rounded-lg border px-4 py-2"
                onClick={() => setEdit(null)}
              >
                Batal
              </button>
              <button
                disabled={pending}
                className="rounded-lg bg-matur-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
                onClick={simpan}
              >
                {pending ? "Menyimpan…" : "Simpan promo"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
