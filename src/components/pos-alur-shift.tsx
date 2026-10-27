"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TimStatus } from "@/lib/pos-tim";
import type { CatatanShift, LaporanShift } from "@/lib/pos-alur";
import { teksLaporanShift } from "@/lib/pos-alur";
import { ambilLaporanShift, prosesAlurShift } from "@/lib/pos-alur-actions";
import { bacaAntrean } from "@/lib/pos-offline";
import { formatRupiah } from "@/lib/format";
// nilai nol tetap "Rp 0" di layar kasir (formatRupiah menampilkan "Rp -")
const rp = (n: number) => (n ? formatRupiah(n) : "Rp 0");
import { KartuPetugas, Langkah, PapanAngka, PosMulaiShift } from "./pos-mulai-shift";
const input = "mt-1 block w-full rounded-xl border bg-white p-3";
export function PosAlurShift({
  status: s,
  outlet,
  kelola = false,
}: {
  status: TimStatus;
  outlet: string;
  kelola?: boolean;
}) {
  const router = useRouter();
  const sh = s.shift_aktif;
  const sesi = s.sesi!.id;
  const [open, setOpen] = useState(!sh || !s.boleh);
  const [aksi, setAksi] = useState<"mulai" | "serah" | "tutup">(
    sh ? "serah" : "mulai",
  );
  const [pic, setPic] = useState(""),
    [pin, setPin] = useState(""),
    [modal] = useState(""),
    [aktual, setAktual] = useState(""),
    [catatan, setCatatan] = useState(""),
    [alasan, setAlasan] = useState(""),
    [laporan, setLaporan] = useState<CatatanShift>(sh?.laporan ?? {});
  const [msg, setMsg] = useState(""),
    [rekap, setRekap] = useState<LaporanShift | null>(null),
    [ditutup, setDitutup] = useState(false),
    [busy, start] = useTransition();
  const request = useRef<string | null>(null);
  const [langkah, setLangkah] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !sh || !s.boleh || ditutup) return;
    const before = document.activeElement as HTMLElement | null;
    const el = dialog.current;
    el?.querySelector<HTMLElement>("button,input,textarea")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpen(false);
      if (e.key === "Tab" && el) {
        const items = Array.from(
          el.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input:not([disabled]),textarea,summary,a[href]",
          ),
        ).filter((x) => x.offsetParent !== null);
        const a = items[0],
          b = items.at(-1);
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b?.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = prior;
      before?.focus();
    };
  }, [open, sh, busy, ditutup, s.boleh]);
  const key = "matoer-shift-draft:" + sesi + ":" + (sh?.id ?? "awal");
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(key);
      if (v) {
        const d = JSON.parse(v);
        setAktual(d.aktual ?? "");
        setCatatan(d.catatan ?? "");
        setLaporan(d.laporan ?? sh?.laporan ?? {});
      }
    } catch {
      /* Form tetap tersedia tanpa penyimpanan lokal. */
    }
  }, [key, sh?.laporan]);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify({ aktual, catatan, laporan }));
    } catch {
      /* Server draft tetap bisa disimpan melalui tombol. */
    }
  }, [key, aktual, catatan, laporan]);
  const load = () =>
    start(async () => {
      try {
        const r = await ambilLaporanShift(sesi);
        if (r.error) setMsg(r.error);
        else setRekap(r.data!);
      } catch {
        setMsg("Ringkasan belum termuat. Periksa koneksi lalu coba lagi.");
      }
    });
  const pilih = s.pilihan ?? [];
  const terpilih = pilih.find((p) => p.id === pic);
  const lanjut = !!sh && !s.boleh;
  const tutup = aksi === "tutup";
  const h = rekap?.shifts.find((x) => x.id === sh?.id) ?? sh;
  async function kirim(draft = false) {
    if (!navigator.onLine) {
      setMsg(
        "Hubungkan internet untuk menyimpan serah terima. Transaksi tunai offline tetap tersimpan.",
      );
      return;
    }
    start(async () => {
      try {
        request.current ??= crypto.randomUUID();
        const pending = (await bacaAntrean().catch(() => []))
          .filter((x) => x.checkout.sesi_id === sesi)
          .map((x) => x.checkout.client_id);
        const r = await prosesAlurShift({
          request_id: draft ? crypto.randomUUID() : request.current,
          shift_id: sh?.id ?? null,
          aksi: draft ? "draft" : lanjut ? "lanjut" : aksi,
          pic_id: pic || null,
          pin,
          modal: modal === "" ? null : Number(modal),
          aktual: aktual === "" ? null : Number(aktual),
          catatan,
          alasan,
          laporan,
          pending,
        });
        if (r.error) {
          setMsg(r.error);
          return;
        }
        setPin("");
        setMsg(draft ? "Draft laporan tersimpan." : "Berhasil disimpan.");
        request.current = null;
        if (!draft) {
          try {
            sessionStorage.removeItem(key);
          } catch {}
          if (tutup) {
            const report = await ambilLaporanShift(sesi);
            if (report.data) setRekap(report.data);
            setDitutup(true);
          } else {
            router.refresh();
            setOpen(false);
          }
        }
      } catch {
        setMsg(
          "Belum ada konfirmasi server. Data isian dipertahankan; coba lagi untuk memeriksa hasilnya.",
        );
      }
    });
  }
  // mulai shift & lanjut kas berjalan: layar bertahap (petugas → PIN → modal → mulai)
  if (!sh || lanjut) return <PosMulaiShift pilihan={pilih} outlet={outlet} sesiBerjalan={lanjut ? sh : null} />;
  if (sh && !kelola && s.boleh) return null;
  // serah terima & tutup operasional: bertahap (aksi → ringkasan → hitung fisik → penerima & PIN / catatan → konfirmasi)
  const daftar = tutup ? ["Ringkasan", "Hitung uang", "Catatan", "Tutup"] : ["Ringkasan", "Hitung uang", "Penerima", "PIN"];
  const selisih = aktual === "" || !h ? null : Number(aktual) - h.seharusnya;
  const butuhCatatan = selisih !== null && selisih !== 0;
  const ke = (n: number) => {
    setMsg("");
    setLangkah(n);
  };
  const keluar = () => {
    setOpen(false);
    setLangkah(0);
    setMsg("");
  };
  const dialogAktif = sh && s.boleh && open && !ditutup;
  const lanjutBtn = "flex-1 rounded-2xl bg-kopi-900 py-4 text-lg font-extrabold text-white transition active:scale-[.98] disabled:opacity-40";
  const kembaliBtn = "rounded-2xl border border-stone-200 bg-white px-5 py-4 font-bold text-stone-700";
  return (
    <div
      ref={dialog}
      role={dialogAktif ? "dialog" : undefined}
      aria-modal={dialogAktif ? true : undefined}
      aria-label={sh && open ? "Ringkasan dan serah terima shift" : undefined}
      className={dialogAktif ? "fixed inset-0 z-50 overflow-y-auto bg-kopi-950/60 p-3 backdrop-blur-sm sm:p-8" : ""}
    >
      <section className="pos-muncul mx-auto max-w-3xl space-y-5 rounded-[2rem] bg-white p-5 shadow-[0_24px_60px_rgba(58,31,11,0.18)] sm:p-7">
        {/* kartu shift aktif (gaya kartu bank) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-kopi-900 via-kopi-800 to-matur-700 p-5 text-white">
          <span className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10" aria-hidden />
          <div className="relative flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">🏪 {outlet}</p>
              <h1 className="mt-1 text-2xl font-extrabold">{ditutup ? "Operasional selesai ✅" : "Kas & serah terima"}</h1>
              {sh && (
                <p className="mt-1 text-sm text-white/85">
                  {sh.nama} · {sh.label} · mulai{" "}
                  {new Date(sh.mulai_at).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            {sh && !open && !ditutup && (
              <button
                type="button"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-kopi-900 shadow-sm"
                onClick={() => {
                  setOpen(true);
                  setLangkah(0);
                  load();
                }}
              >
                Selesai & serah terima ›
              </button>
            )}
          </div>
          {sh && (
            <div className="relative mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-3 sm:grid-cols-4">
              {[
                ["Kas awal", sh.awal],
                ["Tunai", h?.tunai],
                ["Non tunai", h?.non_tunai],
                ["Seharusnya di laci", h?.seharusnya],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-[11px] text-white/65">{k}</p>
                  <p className="font-extrabold tabular-nums">{rp(Number(v ?? 0))}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {open && !ditutup && sh && (
          <div className="space-y-5">
            {langkah > 0 && <Langkah aktif={langkah - 1} daftar={daftar} />}

            {/* 0. pilih aksi */}
            {langkah === 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { k: "serah" as const, ikon: "🔁", j: "Serah terima petugas", t: "Hitung uang laci, serahkan ke petugas berikutnya. Uang fisik jadi saldo awalnya." },
                  { k: "tutup" as const, ikon: "🌙", j: "Tutup operasional hari ini", t: "Petugas terakhir: hitung uang, catat stok & order, laporan harian." },
                ].map((x) => (
                  <button
                    key={x.k}
                    type="button"
                    onClick={() => {
                      setAksi(x.k);
                      ke(1);
                    }}
                    className="flex flex-col items-start gap-2 rounded-3xl border-2 border-stone-100 bg-white p-5 text-left shadow-sm transition hover:border-matur-300 active:scale-[.98]"
                  >
                    <span className="grid size-12 place-items-center rounded-2xl bg-matur-50 text-2xl">{x.ikon}</span>
                    <span className="text-lg font-extrabold text-kopi-900">{x.j}</span>
                    <span className="text-sm text-stone-500">{x.t}</span>
                  </button>
                ))}
                <button type="button" onClick={keluar} className="text-sm font-semibold text-stone-500 underline sm:col-span-2">
                  Batal, kembali ke kasir
                </button>
              </div>
            )}

            {/* 1. ringkasan */}
            {langkah === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    ["Kas awal diterima", h?.awal, "🏁"],
                    ["Penjualan tunai", h?.tunai, "💵"],
                    ["Non tunai", h?.non_tunai, "📲"],
                    ["Pengeluaran laci", h?.pengeluaran, "🧾"],
                    ["Uang diserahkan", h?.keluar, "🤝"],
                  ].map(([k, v, i]) => (
                    <div key={String(k)} className="rounded-2xl bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">
                        {i} {k}
                      </p>
                      <p className="font-extrabold tabular-nums text-kopi-900">{rp(Number(v ?? 0))}</p>
                    </div>
                  ))}
                  <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                    <p className="text-xs font-semibold text-emerald-800">✅ Seharusnya di laci</p>
                    <p className="text-lg font-black tabular-nums text-emerald-900">{rp(Number(h?.seharusnya ?? 0))}</p>
                  </div>
                </div>
                <p className="text-xs text-stone-500">
                  Dari transaksi yang sudah tersinkron. Transaksi offline yang menyusul memperbarui rekap shift asal.{" "}
                  <button type="button" disabled={busy} onClick={load} className="font-semibold text-matur-700 underline">
                    {busy ? "Memuat…" : "Perbarui"}
                  </button>
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => ke(0)} className={kembaliBtn}>
                    ←
                  </button>
                  <button type="button" onClick={() => ke(2)} className={lanjutBtn}>
                    Hitung uang laci →
                  </button>
                </div>
              </div>
            )}

            {/* 2. hitung uang fisik */}
            {langkah === 2 && (
              <div className="space-y-4">
                <div className="rounded-3xl bg-stone-50 p-5 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Uang fisik di laci (termasuk modal)</p>
                  <p className="mt-1 text-4xl font-black tabular-nums text-kopi-900">{aktual === "" ? "Rp 0" : rp(Number(aktual))}</p>
                  {selisih !== null && (
                    <p className={`mx-auto mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold ${selisih === 0 ? "bg-emerald-100 text-emerald-800" : selisih < 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                      {selisih === 0 ? "✓ Sesuai" : `${selisih < 0 ? "Kurang" : "Lebih"} ${rp(Math.abs(selisih))}`}
                    </p>
                  )}
                </div>
                {h && (
                  <div className="flex justify-center">
                    <button type="button" onClick={() => setAktual(String(h.seharusnya))} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-kopi-900 ring-1 ring-matur-200 active:scale-95">
                      Isi sesuai: {rp(h.seharusnya)}
                    </button>
                  </div>
                )}
                <PapanAngka
                  onAngka={(d) => aktual.length < 12 && setAktual((aktual === "0" ? "" : aktual) + d)}
                  onHapus={() => setAktual(aktual.slice(0, -1))}
                  kiriBawah={{ label: "000", aksi: () => aktual && aktual.length < 10 && setAktual(aktual + "000") }}
                />
                {butuhCatatan && (
                  <label className="block text-sm font-semibold text-kopi-900">
                    Catatan selisih (wajib)
                    <textarea
                      className={input}
                      rows={2}
                      maxLength={1000}
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      placeholder="Contoh: kembalian kurang Rp 5.000"
                    />
                  </label>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => ke(1)} className={kembaliBtn}>
                    ←
                  </button>
                  <button type="button" disabled={aktual === "" || (butuhCatatan && catatan.trim().length < 3)} onClick={() => ke(3)} className={lanjutBtn}>
                    Lanjut →
                  </button>
                </div>
                {!tutup && <p className="text-center text-xs text-stone-500">Uang fisik ini menjadi saldo awal petugas berikutnya. Modal tidak diinput ulang.</p>}
              </div>
            )}

            {/* 3. serah: pilih penerima */}
            {langkah === 3 && !tutup && (
              <div className="space-y-4">
                <p className="text-center text-lg font-extrabold text-kopi-900">Siapa petugas berikutnya?</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {pilih.map((p) => (
                    <KartuPetugas key={p.id} p={p} aktif={pic === p.id} onPilih={() => setPic(p.id)} />
                  ))}
                </div>
                {!pilih.length && <p className="rounded-xl bg-amber-50 p-3 text-sm">Belum ada staf aktif di outlet ini. Tambahkan penugasan staf melalui HRD.</p>}
                {terpilih && !terpilih.terjadwal && (
                  <label className="block text-sm font-semibold text-amber-900">
                    Alasan petugas pengganti
                    <input className={input} minLength={3} maxLength={500} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Contoh: menggantikan rekan yang berhalangan" />
                  </label>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => ke(2)} className={kembaliBtn}>
                    ←
                  </button>
                  <button type="button" disabled={!pic || (!!terpilih && !terpilih.terjadwal && alasan.trim().length < 3)} onClick={() => ke(4)} className={lanjutBtn}>
                    Lanjut →
                  </button>
                </div>
              </div>
            )}

            {/* 4. serah: PIN & konfirmasi */}
            {langkah === 4 && !tutup && terpilih && (
              <div className="space-y-4">
                <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-2xl bg-matur-50 p-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-kopi-900">{sh.nama}</span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums">{rp(Number(aktual || 0))} →</span>
                  <span className="min-w-0 truncate text-right font-semibold text-kopi-900">{terpilih.nama}</span>
                </div>
                <p className="text-center font-bold text-kopi-900">Masukkan PIN outlet</p>
                <div className="flex justify-center gap-3" aria-label={`${pin.length} angka PIN diisi`}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} className={`size-4 rounded-full transition ${i < pin.length ? "scale-110 bg-kopi-900" : "bg-stone-200"} ${i >= 4 && i >= pin.length ? "opacity-40" : ""}`} />
                  ))}
                </div>
                <PapanAngka
                  onAngka={(d) => {
                    setMsg("");
                    if (pin.length < 6) setPin(pin + d);
                  }}
                  onHapus={() => setPin(pin.slice(0, -1))}
                  kiriBawah={{ label: "←", aksi: () => ke(3) }}
                />
                <button
                  type="button"
                  disabled={busy || pin.length < 4}
                  onClick={() => void kirim()}
                  className="mx-auto block w-full max-w-xs rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 py-4 text-lg font-extrabold text-white shadow-lg shadow-emerald-500/30 disabled:opacity-40"
                >
                  {busy ? "Menyimpan…" : "🤝 Serahkan ke " + terpilih.nama.split(" ")[0]}
                </button>
              </div>
            )}

            {/* 3. tutup: catatan laporan */}
            {langkah === 3 && tutup && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-kopi-900">
                  📲 Non tunai aktual hari ini (opsional)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    className={input}
                    value={laporan.non_tunai_aktual ?? ""}
                    onChange={(e) => setLaporan({ ...laporan, non_tunai_aktual: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </label>
                {[
                  ["stok", "📦 Stok akhir fisik & catatan pinjam"],
                  ["barang", "🚚 Barang datang"],
                  ["order", "🛒 Kebutuhan order"],
                ].map(([k, label]) => (
                  <label key={k} className="block text-sm font-semibold text-kopi-900">
                    {label}
                    <textarea className={input} maxLength={6000} rows={2} value={laporan[k as keyof CatatanShift] ?? ""} onChange={(e) => setLaporan({ ...laporan, [k]: e.target.value })} />
                  </label>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => ke(2)} className={kembaliBtn}>
                    ←
                  </button>
                  <button type="button" disabled={busy} onClick={() => void kirim(true)} className="rounded-2xl border border-matur-200 bg-white px-4 py-4 text-sm font-bold text-kopi-800">
                    💾 Simpan draft
                  </button>
                  <button type="button" onClick={() => ke(4)} className={lanjutBtn}>
                    Lanjut →
                  </button>
                </div>
              </div>
            )}

            {/* 4. tutup: konfirmasi */}
            {langkah === 4 && tutup && (
              <div className="space-y-4">
                <div className="mx-auto max-w-md space-y-2 rounded-3xl bg-stone-50 p-5 text-sm">
                  <p className="text-center text-lg font-extrabold text-kopi-900">🌙 Tutup operasional hari ini?</p>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Uang fisik laci</span>
                    <b className="tabular-nums">{rp(Number(aktual || 0))}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Seharusnya</span>
                    <b className="tabular-nums">{rp(Number(h?.seharusnya ?? 0))}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Selisih</span>
                    <b className={selisih ? "text-red-700" : "text-emerald-700"}>{selisih ? rp(selisih) : "✓ Sesuai"}</b>
                  </div>
                  <p className="pt-1 text-xs text-stone-500">Setelah ditutup, laporan harian siap disalin atau dikirim ke WhatsApp.</p>
                </div>
                <div className="mx-auto flex max-w-md gap-2">
                  <button type="button" disabled={busy} onClick={() => ke(3)} className={kembaliBtn}>
                    ←
                  </button>
                  <button type="button" disabled={busy} onClick={() => void kirim()} className="flex-1 rounded-2xl bg-gradient-to-r from-kopi-900 to-kopi-700 py-4 text-lg font-extrabold text-white shadow-lg disabled:opacity-50">
                    {busy ? "Menutup…" : "🌙 Tutup operasional"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {msg && (
          <p role="status" className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${/berhasil|tersimpan|disalin/i.test(msg) ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {msg}
          </p>
        )}

        {rekap && ditutup && (
          <div className="space-y-3 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="font-extrabold text-kopi-900">📋 Laporan harian</p>
            {rekap.sementara && <p className="text-sm text-amber-800">Rekap sementara: masih ada antrean atau perangkat yang belum melaporkan sinkronisasi terbaru.</p>}
            <textarea aria-label="Isi laporan" readOnly className="min-h-64 w-full rounded-2xl border border-emerald-100 bg-white p-3 text-xs" value={teksLaporanShift(rekap)} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-bold text-kopi-900"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(teksLaporanShift(rekap));
                    setMsg("Laporan disalin.");
                  } catch {
                    setMsg("Salin teks laporan dari kolom di atas.");
                  }
                }}
              >
                📋 Salin laporan
              </button>
              <a className="rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white" href={"https://wa.me/?text=" + encodeURIComponent(teksLaporanShift(rekap))} target="_blank" rel="noreferrer">
                💬 Kirim WhatsApp
              </a>
              <Link href="/kasir/pos" className="ml-auto rounded-2xl border border-stone-200 bg-white px-4 py-3 font-bold text-stone-700" onClick={() => router.refresh()}>
                Kembali ke POS
              </Link>
            </div>
            <p className="text-xs text-stone-500">Membuka WhatsApp tidak mengubah status kas. Data tersimpan walaupun laporan belum dikirim.</p>
          </div>
        )}
      </section>
    </div>
  );
}
