"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarCheck, Camera, Clock3, LogIn, LogOut, MapPin, ScanFace, Timer } from "lucide-react";
import { Kartu, KartuAngka, KepalaKartu, Kosong, Lencana, Pesan, tombol } from "@/components/staf/ui";
import { compressImage } from "@/lib/compress-image";
import { formatDurasi, formatDurasiPendek, menitKerja } from "@/lib/jadwal/rekap";
import type { Absen } from "@/lib/sdm";
import { absen, type Result } from "@/lib/sdm-actions";

type Shift = { nama: string; jam_mulai: string; jam_selesai: string };
type Lokasi = { lat: number; lng: number; akurasi: number } | null;

const jam = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "--:--");
const tgl = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

function ambilLokasi(): Promise<Lokasi> {
  return new Promise((ok) => {
    if (!("geolocation" in navigator)) return ok(null);
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, akurasi: Math.round(p.coords.accuracy) }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

function StatusAbsen({ a }: { a: Absen }) {
  if (a.status === "telat") return <Lencana nada="kuning">Telat {a.telat_menit} mnt</Lencana>;
  if (a.status === "tepat") return <Lencana nada="hijau">Tepat waktu</Lencana>;
  return <Lencana nada="netral">Tanpa jadwal</Lencana>;
}

export function PanelAbsen({
  kartu,
  tanpaJadwal,
  terbukaId,
  foto,
  ringkas,
  riwayat,
}: {
  kartu: { id: string; shift: Shift; absen: Absen | null }[];
  tanpaJadwal: Absen[];
  terbukaId: string | null;
  foto: Record<string, string>;
  ringkas: { jadwal: number; hadir: number; tepat: number; telat: number; menit: number };
  riwayat: Absen[];
}) {
  const router = useRouter();
  const kamera = useRef<HTMLInputElement>(null);
  const lokasi = useRef<Promise<Lokasi> | null>(null);
  const jenis = useRef<"masuk" | "pulang">("masuk");
  const [proses, setProses] = useState("");
  const [hasil, setHasil] = useState<(Result & { tanpaLokasi?: boolean }) | null>(null);
  const [sekarang, setSekarang] = useState<Date | null>(null);

  useEffect(() => {
    setSekarang(new Date());
    const t = setInterval(() => setSekarang(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const mulai = (j: "masuk" | "pulang") => {
    jenis.current = j;
    setHasil(null);
    lokasi.current = ambilLokasi(); // izin lokasi diminta bersamaan dengan kamera
    kamera.current?.click();
  };

  const kirim = async (file: File | undefined) => {
    if (!file) return;
    setProses("Memproses foto…");
    try {
      const blob = await compressImage(file, 960, 0.75);
      setProses("Mengambil lokasi…");
      const loc = await (lokasi.current ?? ambilLokasi());
      setProses(jenis.current === "masuk" ? "Mencatat absen masuk…" : "Mencatat absen pulang…");
      const fd = new FormData();
      fd.set("jenis", jenis.current);
      fd.set("foto", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      fd.set("perangkat", "hp");
      if (loc) {
        fd.set("lat", String(loc.lat));
        fd.set("lng", String(loc.lng));
        fd.set("akurasi", String(loc.akurasi));
      }
      const r = await absen(fd);
      setHasil({ ...r, tanpaLokasi: !loc });
      if (r.ok) router.refresh();
    } catch {
      setHasil({ error: "Gagal memproses foto. Coba lagi." });
    } finally {
      setProses("");
      if (kamera.current) kamera.current.value = "";
    }
  };

  const Garis = ({ a }: { a: Absen }) => (
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-krem p-3">
      {(["masuk", "pulang"] as const).map((k) => {
        const f = k === "masuk" ? a.masuk_foto : a.pulang_foto;
        const lat = k === "masuk" ? a.masuk_lat : a.pulang_lat;
        return (
          <div key={k} className="flex items-center gap-2.5">
            {f && foto[f] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto[f]} alt="" className="size-11 rounded-xl object-cover" />
            ) : (
              <span className="grid size-11 place-items-center rounded-xl bg-white text-redup">
                <Camera className="size-4" aria-hidden />
              </span>
            )}
            <span>
              <span className="block text-[11px] font-semibold text-redup">{k === "masuk" ? "Masuk" : "Pulang"}</span>
              <span className="tabular block text-sm font-bold text-kopi-900">{jam(k === "masuk" ? a.masuk_at : a.pulang_at)}</span>
              {(k === "masuk" || a.pulang_at) && (
                <span className="flex items-center gap-0.5 text-[10px] text-redup">
                  <MapPin className="size-3" aria-hidden />
                  {lat !== null ? "lokasi tercatat" : "tanpa lokasi"}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );

  const Tombol = ({ a }: { a: Absen | null }) =>
    !a ? (
      <button disabled={!!proses || !!terbukaId} onClick={() => mulai("masuk")} className={`${tombol.utama} mt-4 w-full !min-h-12`}>
        <LogIn className="size-4" aria-hidden /> Absen masuk
      </button>
    ) : !a.pulang_at && a.id === terbukaId ? (
      <button disabled={!!proses} onClick={() => mulai("pulang")} className={`${tombol.utama} mt-4 w-full !min-h-12 !bg-kopi-900 hover:!bg-kopi-700`}>
        <LogOut className="size-4" aria-hidden /> Absen pulang
      </button>
    ) : a.pulang_at ? (
      <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-[13px] font-semibold text-emerald-700">Selesai · {formatDurasi(menitKerja(a))} kerja. Terima kasih!</p>
    ) : null;

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[1fr_340px] lg:gap-5 lg:space-y-0">
      <input ref={kamera} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => kirim(e.target.files?.[0])} />
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-[var(--radius-kartu)] bg-kopi-900 p-5 text-white shadow-[var(--shadow-melayang)]">
          <span className="grid size-12 place-items-center rounded-full bg-white/15">
            <Clock3 className="size-6" aria-hidden />
          </span>
          <div>
            <p className="tabular text-3xl font-extrabold leading-none">{sekarang ? sekarang.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" }) : "--.--.--"}</p>
            <p className="mt-1 text-[12px] text-white/75">{sekarang ? sekarang.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : ""} · WIB</p>
          </div>
        </div>

        {(proses || hasil) && (proses ? <p className="rounded-2xl bg-matur-100 px-4 py-3 text-sm font-semibold text-matur-700">{proses}</p> : <Pesan hasil={hasil} />)}
        {hasil?.ok && hasil.tanpaLokasi && <p className="text-[12px] text-redup">Lokasi tidak diizinkan — absen tetap tersimpan, ditandai tanpa lokasi.</p>}

        {kartu.map((k) => (
          <Kartu key={k.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-kopi-900">{k.shift.nama}</p>
                <p className="tabular mt-0.5 text-[13px] text-redup">
                  {k.shift.jam_mulai} – {k.shift.jam_selesai} WIB
                </p>
              </div>
              {k.absen ? <StatusAbsen a={k.absen} /> : <Lencana nada="oranye">Belum absen</Lencana>}
            </div>
            {k.absen && <Garis a={k.absen} />}
            <Tombol a={k.absen} />
          </Kartu>
        ))}

        {tanpaJadwal.map((a) => (
          <Kartu key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-bold text-kopi-900">Absen tanpa jadwal</p>
              <StatusAbsen a={a} />
            </div>
            <Garis a={a} />
            <Tombol a={a} />
          </Kartu>
        ))}

        {!kartu.length && !tanpaJadwal.length && (
          <Kartu>
            <p className="text-sm font-semibold text-kopi-900">Tidak ada jadwal terbit hari ini</p>
            <p className="mt-1 text-[13px] text-redup">Kalau diminta masuk mendadak, tetap absen — tercatat sebagai “tanpa jadwal”.</p>
            <button disabled={!!proses || !!terbukaId} onClick={() => mulai("masuk")} className={`${tombol.lembut} mt-4 w-full`}>
              <LogIn className="size-4" aria-hidden /> Absen masuk tanpa jadwal
            </button>
          </Kartu>
        )}
        {!!terbukaId && !kartu.some((k) => k.absen?.id === terbukaId) && !tanpaJadwal.some((a) => a.id === terbukaId) && (
          <Kartu>
            <p className="text-sm text-kopi-900">Anda masih tercatat bertugas sejak kemarin.</p>
            <button disabled={!!proses} onClick={() => mulai("pulang")} className={`${tombol.utama} mt-3 w-full`}>
              <LogOut className="size-4" aria-hidden /> Absen pulang
            </button>
          </Kartu>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <KartuAngka label="Hadir bulan ini" nilai={`${ringkas.hadir}/${ringkas.jadwal}`} ikon={CalendarCheck} nada="oranye" catatan="hadir / jadwal" />
          <KartuAngka label="Jam kerja" nilai={formatDurasiPendek(ringkas.menit)} ikon={Clock3} nada="kopi" />
          <KartuAngka label="Tepat waktu" nilai={ringkas.tepat} ikon={ScanFace} nada="hijau" />
          <KartuAngka label="Telat" nilai={ringkas.telat} ikon={Timer} nada="kuning" />
        </div>
        <Kartu>
          <KepalaKartu judul="Riwayat terakhir" />
          {riwayat.length ? (
            <ul className="divide-y divide-garis">
              {riwayat.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <span>
                    <span className="block text-sm font-semibold capitalize text-kopi-900">{tgl(a.tanggal)}</span>
                    <span className="tabular block text-[12px] text-redup">
                      {jam(a.masuk_at)} – {a.pulang_at ? jam(a.pulang_at) : "…"} {a.pulang_at && `· ${formatDurasi(menitKerja(a))}`}
                    </span>
                  </span>
                  <StatusAbsen a={a} />
                </li>
              ))}
            </ul>
          ) : (
            <Kosong ikon={CalendarCheck} judul="Belum ada absen" />
          )}
        </Kartu>
      </div>
    </div>
  );
}
