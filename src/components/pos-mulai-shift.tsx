"use client";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PilihanShift, ShiftBaru } from "@/lib/pos-alur";
import { cekPinAlurShift, prosesAlurShift } from "@/lib/pos-alur-actions";
import { formatRupiah as rp } from "@/lib/format";

// Layar mulai shift bertahap (tablet): Pilih petugas → PIN outlet (langsung dicek) → Modal awal → Mulai shift.
// Kas sudah berjalan (perangkat baru / login ulang): cukup PIN untuk melanjutkan.

export function FotoPetugas({ p, besar = false }: { p: { nama: string; foto_url?: string }; besar?: boolean }) {
  const [gagal, setGagal] = useState(false);
  const ukuran = besar ? "size-24" : "size-20";
  return (
    <Image
      unoptimized
      src={!gagal && p.foto_url ? p.foto_url : "/mascot/kasir-pos.webp"}
      alt=""
      width={96}
      height={96}
      onError={() => setGagal(true)}
      className={`${ukuran} rounded-full bg-amber-100 object-cover`}
    />
  );
}

/** Kartu petugas: foto bulat besar, cincin + centang saat dipilih, badge terjadwal/pengganti. */
export function KartuPetugas({ p, aktif, onPilih }: { p: PilihanShift; aktif: boolean; onPilih: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onPilih}
      className={`group relative flex flex-col items-center gap-2 rounded-3xl border-2 bg-white p-4 text-center shadow-sm transition active:scale-[.97] ${aktif ? "border-matur-500 bg-matur-50 shadow-md" : "border-transparent hover:border-matur-200"}`}
    >
      <span className={`relative rounded-full p-1 ${aktif ? "bg-gradient-to-br from-matur-400 to-orange-600" : "bg-stone-100 group-hover:bg-matur-100"}`}>
        <FotoPetugas p={p} besar />
        {aktif && (
          <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-emerald-500 text-base font-black text-white ring-4 ring-white" aria-hidden>
            ✓
          </span>
        )}
      </span>
      <span className="block text-base font-extrabold text-kopi-900">{p.nama}</span>
      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${p.terjadwal ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
        {p.terjadwal ? p.label : "Pengganti"}
      </span>
    </button>
  );
}

function Langkah({ aktif, daftar }: { aktif: number; daftar: string[] }) {
  return (
    <ol className="flex items-center justify-center gap-2" aria-label="Langkah">
      {daftar.map((l, i) => (
        <li key={l} className="flex items-center gap-2">
          <span
            className={`grid size-8 place-items-center rounded-full text-sm font-extrabold transition ${i < aktif ? "bg-emerald-500 text-white" : i === aktif ? "bg-matur-500 text-white ring-4 ring-matur-100" : "bg-stone-200 text-stone-500"}`}
            aria-current={i === aktif ? "step" : undefined}
          >
            {i < aktif ? "✓" : i + 1}
          </span>
          <span className={`hidden text-sm font-semibold sm:inline ${i === aktif ? "text-kopi-900" : "text-stone-400"}`}>{l}</span>
          {i < daftar.length - 1 && <span className={`h-0.5 w-6 rounded sm:w-10 ${i < aktif ? "bg-emerald-400" : "bg-stone-200"}`} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

const tombolAngka = "grid h-16 place-items-center rounded-2xl bg-white text-2xl font-extrabold text-kopi-900 shadow-sm ring-1 ring-stone-200 transition active:scale-95 active:bg-matur-50 disabled:opacity-40";

function PapanAngka({ onAngka, onHapus, kiriBawah }: { onAngka: (d: string) => void; onHapus: () => void; kiriBawah?: { label: string; aksi: () => void } }) {
  return (
    <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className={tombolAngka} onClick={() => onAngka(d)}>
          {d}
        </button>
      ))}
      {kiriBawah ? (
        <button type="button" className={`${tombolAngka} !text-lg`} onClick={kiriBawah.aksi}>
          {kiriBawah.label}
        </button>
      ) : (
        <span />
      )}
      <button type="button" className={tombolAngka} onClick={() => onAngka("0")}>
        0
      </button>
      <button type="button" className={`${tombolAngka} !text-xl`} onClick={onHapus} aria-label="Hapus">
        ⌫
      </button>
    </div>
  );
}

export function PosMulaiShift({ pilihan, outlet, sesiBerjalan }: { pilihan: PilihanShift[]; outlet: string; sesiBerjalan?: ShiftBaru | null }) {
  const router = useRouter();
  const lanjut = !!sesiBerjalan;
  const daftar = lanjut ? ["PIN outlet"] : ["Petugas", "PIN", "Modal", "Mulai"];
  const [langkah, setLangkah] = useState(0);
  const [pic, setPic] = useState<PilihanShift | null>(null);
  const [alasan, setAlasan] = useState("");
  const [pin, setPin] = useState("");
  const [modal, setModal] = useState("");
  const [pesan, setPesan] = useState("");
  const [goyang, setGoyang] = useState(false);
  const [busy, start] = useTransition();
  const request = useRef<string | null>(null);

  const salah = (m: string) => {
    setPesan(m);
    setPin("");
    setGoyang(true);
    setTimeout(() => setGoyang(false), 450);
  };
  const ke = (n: number) => {
    setPesan("");
    setLangkah(n);
  };

  const cekPin = () =>
    start(async () => {
      if (!navigator.onLine) return setPesan("Hubungkan internet untuk memulai shift.");
      try {
        if (lanjut) {
          const r = await prosesAlurShift({ request_id: (request.current ??= crypto.randomUUID()), aksi: "lanjut", shift_id: sesiBerjalan!.id, pin });
          if (r.error) return salah(r.error);
          request.current = null;
          router.refresh();
          return;
        }
        const r = await cekPinAlurShift(pin);
        if (r.error) return salah(r.error);
        ke(2);
      } catch {
        setPesan("Koneksi terputus. Coba lagi.");
      }
    });

  const mulai = () =>
    start(async () => {
      if (!navigator.onLine) return setPesan("Hubungkan internet untuk memulai shift.");
      try {
        const r = await prosesAlurShift({
          request_id: (request.current ??= crypto.randomUUID()),
          aksi: "mulai",
          shift_id: null,
          pic_id: pic!.id,
          pin,
          modal: Number(modal || 0),
          alasan: pic!.terjadwal ? "" : alasan,
        });
        if (r.error) {
          // PIN bisa berubah di antara langkah; kembali ke PIN bila ditolak
          if (/PIN/i.test(r.error)) {
            request.current = null;
            ke(1);
            return salah(r.error);
          }
          return setPesan(r.error);
        }
        request.current = null;
        router.refresh();
      } catch {
        setPesan("Belum ada konfirmasi server. Coba tekan Mulai shift lagi — tidak akan tercatat ganda.");
      }
    });

  const judul = lanjut
    ? "Lanjutkan shift berjalan"
    : ["Siapa yang bertugas?", "Masukkan PIN outlet", "Modal awal laci", "Siap mulai shift"][langkah];

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-start justify-center bg-gradient-to-b from-matur-50 to-orange-50/60 px-3 py-6 sm:items-center">
      <section className="pos-muncul w-full max-w-3xl rounded-[2rem] bg-white/90 p-5 shadow-[0_24px_60px_rgba(58,31,11,0.12)] backdrop-blur sm:p-8">
        <div className="mb-6 space-y-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-matur-600">🏪 {outlet}</p>
          {daftar.length > 1 && <Langkah aktif={langkah} daftar={daftar} />}
          <h1 className="text-2xl font-extrabold text-kopi-900 sm:text-3xl">{judul}</h1>
        </div>

        {/* 1. Pilih petugas */}
        {!lanjut && langkah === 0 && (
          <div className="space-y-4">
            {pilihan.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {pilihan.map((p) => (
                  <KartuPetugas
                    key={p.id}
                    p={p}
                    aktif={pic?.id === p.id}
                    onPilih={() => {
                      setPic(p);
                      if (p.terjadwal) ke(1);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-amber-50 p-4 text-center text-sm text-amber-900">Belum ada staf aktif di outlet ini. Minta HRD menambahkan penugasan staf.</p>
            )}
            {pic && !pic.terjadwal && (
              <div className="space-y-3 rounded-2xl bg-amber-50 p-4">
                <label className="block text-sm font-semibold text-amber-900">
                  {pic.nama} tidak terjadwal hari ini. Alasan menggantikan:
                  <input
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    maxLength={500}
                    placeholder="Contoh: menggantikan rekan yang sakit"
                    className="mt-2 block w-full rounded-xl border border-amber-200 bg-white px-3 py-3 text-base font-normal text-kopi-900 outline-none focus:border-matur-500"
                  />
                </label>
                <button
                  type="button"
                  disabled={alasan.trim().length < 3}
                  onClick={() => ke(1)}
                  className="w-full rounded-2xl bg-kopi-900 py-3.5 text-lg font-extrabold text-white disabled:opacity-40"
                >
                  Lanjut →
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. PIN (juga satu-satunya langkah saat melanjutkan kas berjalan) */}
        {(lanjut || langkah === 1) && (
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-3">
              <FotoPetugas p={lanjut ? { nama: sesiBerjalan!.nama } : pic!} />
              <div className="text-left">
                <p className="text-lg font-extrabold text-kopi-900">{lanjut ? sesiBerjalan!.nama : pic!.nama}</p>
                <p className="text-sm text-stone-500">{lanjut ? `Shift berjalan · kas awal ${rp(sesiBerjalan!.awal)}` : pic!.terjadwal ? pic!.label : "Pengganti"}</p>
              </div>
            </div>
            <div className={`flex justify-center gap-3 ${goyang ? "animate-[pin-salah_.4s]" : ""}`} aria-label={`${pin.length} angka PIN diisi`}>
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={`size-4 rounded-full transition ${i < pin.length ? "scale-110 bg-kopi-900" : "bg-stone-200"} ${i >= 4 && i >= pin.length ? "opacity-40" : ""}`} />
              ))}
            </div>
            <PapanAngka onAngka={(d) => { setPesan(""); if (pin.length < 6) setPin(pin + d); }} onHapus={() => setPin(pin.slice(0, -1))} kiriBawah={lanjut ? undefined : { label: "←", aksi: () => ke(0) }} />
            <button
              type="button"
              disabled={busy || pin.length < 4}
              onClick={cekPin}
              className="mx-auto block w-full max-w-xs rounded-2xl bg-gradient-to-r from-matur-500 to-orange-600 py-4 text-lg font-extrabold text-white shadow-lg shadow-orange-500/30 transition active:scale-[.98] disabled:opacity-40"
            >
              {busy ? "Memeriksa…" : lanjut ? "Lanjutkan shift" : "Cek PIN →"}
            </button>
          </div>
        )}

        {/* 3. Modal awal */}
        {!lanjut && langkah === 2 && (
          <div className="space-y-5">
            <div className="rounded-3xl bg-gradient-to-br from-kopi-900 to-kopi-700 p-5 text-center text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">Uang di laci saat mulai</p>
              <p className="mt-1 text-4xl font-black tabular-nums">{rp(Number(modal || 0))}</p>
              <p className="mt-1 text-xs text-white/70">Dicatat sekali untuk hari ini</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[100000, 200000, 300000, 500000].map((n) => (
                <button key={n} type="button" onClick={() => setModal(String(n))} className={`rounded-full px-4 py-2 text-sm font-bold ring-1 transition active:scale-95 ${Number(modal) === n ? "bg-matur-500 text-white ring-matur-500" : "bg-white text-kopi-900 ring-matur-200"}`}>
                  {rp(n)}
                </button>
              ))}
            </div>
            <PapanAngka
              onAngka={(d) => modal.length < 10 && setModal((modal === "0" ? "" : modal) + d)}
              onHapus={() => setModal(modal.slice(0, -1))}
              kiriBawah={{ label: "000", aksi: () => modal && modal.length < 8 && setModal(modal + "000") }}
            />
            <div className="mx-auto flex max-w-xs gap-2">
              <button type="button" onClick={() => ke(1)} className="rounded-2xl border border-stone-200 px-5 py-4 font-bold text-stone-700">
                ←
              </button>
              <button type="button" onClick={() => ke(3)} className="flex-1 rounded-2xl bg-kopi-900 py-4 text-lg font-extrabold text-white">
                Lanjut →
              </button>
            </div>
          </div>
        )}

        {/* 4. Konfirmasi & mulai */}
        {!lanjut && langkah === 3 && pic && (
          <div className="space-y-5">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl bg-matur-50 p-6 text-center">
              <span className="rounded-full bg-gradient-to-br from-matur-400 to-orange-600 p-1">
                <FotoPetugas p={pic} besar />
              </span>
              <div>
                <p className="text-xl font-extrabold text-kopi-900">{pic.nama}</p>
                <p className="text-sm text-stone-500">{pic.terjadwal ? pic.label : `Pengganti · ${alasan}`}</p>
              </div>
              <dl className="grid w-full grid-cols-2 gap-2 text-left text-sm">
                <div className="rounded-2xl bg-white p-3">
                  <dt className="text-xs text-stone-500">Modal awal</dt>
                  <dd className="font-extrabold tabular-nums text-kopi-900">{rp(Number(modal || 0))}</dd>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <dt className="text-xs text-stone-500">PIN outlet</dt>
                  <dd className="font-extrabold text-emerald-700">✓ Sesuai</dd>
                </div>
              </dl>
            </div>
            <div className="mx-auto flex max-w-md gap-2">
              <button type="button" disabled={busy} onClick={() => ke(2)} className="rounded-2xl border border-stone-200 px-5 py-4 font-bold text-stone-700">
                ←
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={mulai}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 py-4 text-xl font-extrabold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98] disabled:opacity-50"
              >
                {busy ? "Memulai…" : "▶ Mulai shift"}
              </button>
            </div>
          </div>
        )}

        {pesan && (
          <p role="alert" className="mx-auto mt-5 max-w-md rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
            {pesan}
          </p>
        )}
      </section>
    </div>
  );
}
