"use client";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TimStatus } from "@/lib/pos-tim";
import type { CatatanShift, LaporanShift, PilihanShift } from "@/lib/pos-alur";
import { teksLaporanShift } from "@/lib/pos-alur";
import { ambilLaporanShift, prosesAlurShift } from "@/lib/pos-alur-actions";
import { bacaAntrean } from "@/lib/pos-offline";
import { formatRupiah as rp } from "@/lib/format";
const input = "mt-1 block w-full rounded-xl border bg-white p-3";
const button =
  "rounded-xl bg-kopi-900 px-4 py-3 font-semibold text-white disabled:opacity-50";
function Avatar({ p }: { p: PilihanShift }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      unoptimized
      src={!failed && p.foto_url ? p.foto_url : "/mascot/kasir-pos.webp"}
      alt=""
      width={72}
      height={72}
      onError={() => setFailed(true)}
      className="mx-auto h-16 w-16 rounded-full bg-amber-100 object-cover"
    />
  );
}
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
    [modal, setModal] = useState(""),
    [aktual, setAktual] = useState(""),
    [catatan, setCatatan] = useState(""),
    [alasan, setAlasan] = useState(""),
    [laporan, setLaporan] = useState<CatatanShift>(sh?.laporan ?? {});
  const [msg, setMsg] = useState(""),
    [rekap, setRekap] = useState<LaporanShift | null>(null),
    [ditutup, setDitutup] = useState(false),
    [busy, start] = useTransition();
  const request = useRef<string | null>(null);
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
  if (sh && !kelola && s.boleh) return null;
  return (
    <div
      ref={dialog}
      role={sh && s.boleh && open && !ditutup ? "dialog" : undefined}
      aria-modal={sh && s.boleh && open && !ditutup ? true : undefined}
      aria-label={sh && open ? "Ringkasan dan serah terima shift" : undefined}
      className={
        sh && s.boleh && open && !ditutup
          ? "fixed inset-0 z-50 overflow-y-auto bg-kopi-950/50 p-3 sm:p-8"
          : ""
      }
    >
      <section className="mx-auto max-w-3xl space-y-4 rounded-3xl border border-amber-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-stone-500">{outlet}</p>
            <h1 className="text-xl font-bold">
              {ditutup
                ? "Operasional selesai"
                : lanjut
                  ? "Lanjutkan shift berjalan"
                  : sh
                    ? "Kas & serah terima"
                    : "Pilih petugas kasir"}
            </h1>
            {sh && (
              <p className="text-sm">
                {sh.nama} · {sh.label}
              </p>
            )}
          </div>
          {sh && !open && !ditutup && (
            <button
              type="button"
              className={button}
              onClick={() => {
                setOpen(true);
                load();
              }}
            >
              Selesai & serah terima shift
            </button>
          )}
        </div>
        {!open && !ditutup && sh && (
          <p className="text-sm">
            Kas awal diterima {rp(sh.awal)} · mulai{" "}
            {new Date(sh.mulai_at).toLocaleTimeString("id-ID", {
              timeZone: "Asia/Jakarta",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Modal awal tidak diinput ulang.
          </p>
        )}
        {open && !ditutup && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void kirim();
            }}
          >
            {sh && !lanjut && (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={!tutup}
                    onClick={() => setAksi("serah")}
                    className={`rounded-xl border px-3 py-2 ${!tutup ? "bg-amber-100" : ""}`}
                  >
                    Serah terima petugas
                  </button>
                  <button
                    type="button"
                    aria-pressed={tutup}
                    onClick={() => setAksi("tutup")}
                    className={`rounded-xl border px-3 py-2 ${tutup ? "bg-amber-100" : ""}`}
                  >
                    Tutup operasional hari ini
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-amber-50 p-4">
                  {[
                    ["Kas awal diterima", h?.awal],
                    ["Penjualan tunai", h?.tunai],
                    ["Non tunai", h?.non_tunai],
                    ["Pengeluaran laci", h?.pengeluaran],
                    ["Uang diserahkan", h?.keluar],
                    ["Uang seharusnya", h?.seharusnya],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <p className="text-xs text-stone-600">{k}</p>
                      <b>{rp(Number(v ?? 0))}</b>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-stone-500">
                  Ringkasan shift ini berasal dari transaksi yang sudah
                  tersinkron. Transaksi offline yang menyusul memperbarui rekap
                  shift asal.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className="text-sm font-semibold underline"
                  onClick={load}
                >
                  Perbarui & lihat rincian
                </button>
                <label className="block text-sm">
                  Uang fisik laci termasuk modal
                  <input
                    className={input}
                    type="number"
                    min="0"
                    max="1000000000000"
                    step="1"
                    required
                    value={aktual}
                    onChange={(e) => setAktual(e.target.value)}
                  />
                </label>
                {aktual !== "" && h && (
                  <p
                    role="status"
                    className={`rounded-xl p-3 text-sm font-semibold ${Number(aktual) === h.seharusnya ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}
                  >
                    {Number(aktual) === h.seharusnya
                      ? "Sesuai"
                      : `${Number(aktual) < h.seharusnya ? "Kurang" : "Lebih"} ${rp(Math.abs(Number(aktual) - h.seharusnya))}`}
                    {!tutup
                      ? " · Uang fisik ini menjadi saldo awal petugas berikutnya."
                      : ""}
                  </p>
                )}
                <label className="block text-sm">
                  Catatan selisih / serah terima
                  <textarea
                    className={input}
                    required={aktual !== "" && Number(aktual) !== h?.seharusnya}
                    minLength={
                      aktual !== "" && Number(aktual) !== h?.seharusnya
                        ? 3
                        : undefined
                    }
                    maxLength={1000}
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                  />
                </label>
              </>
            )}
            {!tutup && (
              <>
                {!lanjut && (
                  <fieldset>
                    <legend className="mb-2 font-semibold">
                      {sh ? "Petugas penerima" : "Petugas bertugas"}
                    </legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {pilih.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          aria-pressed={pic === p.id}
                          onClick={() => setPic(p.id)}
                          className={`space-y-1 rounded-2xl border p-3 text-center ${pic === p.id ? "border-amber-500 bg-amber-50" : "bg-white"}`}
                        >
                          <Avatar p={p} />
                          <span className="block text-sm font-bold">
                            {p.nama}
                          </span>
                          <span className="block text-xs text-stone-500">
                            {p.terjadwal ? p.label : "Staf pengganti"}
                          </span>
                        </button>
                      ))}
                    </div>
                    {!pilih.length && (
                      <p className="rounded-xl bg-amber-50 p-3 text-sm">
                        Belum ada staf aktif yang ditugaskan ke outlet ini.
                        Tambahkan penugasan staf melalui HRD. Mode langsung
                        tetap dapat dipilih admin untuk kas berikutnya.
                      </p>
                    )}
                  </fieldset>
                )}
                {!lanjut && terpilih && !terpilih.terjadwal && (
                  <label className="block text-sm">
                    Alasan petugas pengganti
                    <input
                      className={input}
                      required
                      minLength={3}
                      maxLength={500}
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                      placeholder="Contoh: menggantikan rekan yang berhalangan"
                    />
                  </label>
                )}
                <label className="block text-sm">
                  PIN outlet
                  <input
                    className={input}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    pattern="[0-9]{4,6}"
                    required
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </label>
              </>
            )}
            {!sh && (
              <label className="block text-sm">
                Modal awal laci
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="1"
                  max="1000000000000"
                  required
                  value={modal}
                  onChange={(e) => setModal(e.target.value)}
                />
              </label>
            )}
            {sh && !lanjut && (
              <details className="rounded-2xl border p-3" open={tutup}>
                <summary className="cursor-pointer font-semibold">
                  Catatan laporan harian
                </summary>
                <div className="mt-3 space-y-3">
                  <label className="block text-sm">
                    Non tunai aktual (harian, opsional)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={input}
                      value={laporan.non_tunai_aktual ?? ""}
                      onChange={(e) =>
                        setLaporan({
                          ...laporan,
                          non_tunai_aktual:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  {[
                    ["stok", "Stok akhir fisik & catatan pinjam"],
                    ["barang", "Catatan barang datang"],
                    ["order", "Kebutuhan order"],
                  ].map(([k, label]) => (
                    <label key={k} className="block text-sm">
                      {label}
                      <textarea
                        className={input}
                        maxLength={6000}
                        rows={3}
                        value={laporan[k as keyof CatatanShift] ?? ""}
                        onChange={(e) =>
                          setLaporan({ ...laporan, [k]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-xl border px-4 py-2 text-sm"
                    onClick={() => void kirim(true)}
                  >
                    Simpan draft laporan
                  </button>
                </div>
              </details>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy || (!lanjut && !tutup && !pic)}
                className={button}
              >
                {busy
                  ? "Memproses…"
                  : lanjut
                    ? "Lanjutkan shift berjalan"
                    : !sh
                      ? "Mulai shift"
                      : tutup
                        ? "Konfirmasi hitungan & tutup hari"
                        : "Konfirmasi & lanjut petugas berikutnya"}
              </button>
              {sh && !lanjut && (
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Kembali
                </button>
              )}
            </div>
          </form>
        )}
        {msg && (
          <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">
            {msg}
          </p>
        )}
        {rekap && (
          <details className="rounded-2xl border p-3" open={ditutup}>
            <summary className="cursor-pointer font-semibold">
              Rincian & laporan WhatsApp
            </summary>
            {rekap.sementara && (
              <p className="my-2 text-sm text-amber-800">
                Rekap sementara: masih ada antrean atau perangkat yang belum
                melaporkan sinkronisasi terbaru.
              </p>
            )}
            <textarea
              aria-label="Isi laporan"
              readOnly
              className="my-3 min-h-72 w-full rounded-xl border p-3 text-xs"
              value={teksLaporanShift(rekap)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border px-3 py-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      teksLaporanShift(rekap),
                    );
                    setMsg("Laporan disalin.");
                  } catch {
                    setMsg("Salin teks laporan dari kolom di atas.");
                  }
                }}
              >
                Salin laporan
              </button>
              <a
                className={button}
                href={
                  "https://wa.me/?text=" +
                  encodeURIComponent(teksLaporanShift(rekap))
                }
                target="_blank"
                rel="noreferrer"
              >
                Kirim WhatsApp
              </a>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Membuka WhatsApp tidak mengubah status kas. Data tersimpan
              walaupun laporan belum dikirim.
            </p>
          </details>
        )}
        {ditutup && (
          <Link
            href="/kasir/pos"
            className="inline-block rounded-xl border p-3"
            onClick={() => router.refresh()}
          >
            Kembali ke POS
          </Link>
        )}
      </section>
    </div>
  );
}
