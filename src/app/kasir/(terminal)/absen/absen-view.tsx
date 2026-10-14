"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/compress-image";
import { formatDurasi, menitKerja } from "@/lib/jadwal/rekap";
import { absen, type Result } from "@/lib/sdm-actions";
import { KameraSelfie } from "./kamera-selfie";

type Shift = { nama: string; jam_mulai: string; jam_selesai: string };
type Riwayat = { id: string; tanggal: string; masuk_at: string; pulang_at: string | null; status: string; telat_menit: number };
type Lokasi = { lat: number; lng: number; akurasi: number } | null;

const KUNCI_PERANGKAT = "matoer_perangkat_absen";
const jam = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "–");
const STATUS: Record<string, string> = { tepat: "Tepat waktu", telat: "Telat", tanpa_jadwal: "Tanpa jadwal" };

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

export function AbsenView({ nama, outletNama, jadwalHariIni, terbuka, riwayat }: { nama: string; outletNama: string; jadwalHariIni: { id: string; shift: Shift; sudah: boolean }[]; terbuka: { masuk_at: string } | null; riwayat: Riwayat[] }) {
  const router = useRouter();
  const kamera = useRef<HTMLInputElement>(null);
  const lokasi = useRef<Promise<Lokasi> | null>(null);
  const [mode, setMode] = useState<"saya" | "lain">("saya");
  const [perangkat, setPerangkat] = useState<"hp" | "outlet">("hp");
  const [jenis, setJenis] = useState<"masuk" | "pulang">("masuk");
  const [kode, setKode] = useState({ login: "", pin: "" });
  const [preview, setPreview] = useState<string | null>(null);
  const [proses, setProses] = useState("");
  const [hasil, setHasil] = useState<(Result & { lokasiKosong?: boolean }) | null>(null);
  const [kameraBuka, setKameraBuka] = useState(false);
  // bila kamera langsung tidak bisa dipakai, jatuh ke pemilih foto bawaan perangkat
  const pakaiPemilih = useCallback(() => {
    setKameraBuka(false);
    kamera.current?.click();
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KUNCI_PERANGKAT);
      if (v === "outlet" || v === "hp") setPerangkat(v);
    } catch {}
  }, []);
  const simpanPerangkat = (v: "hp" | "outlet") => {
    setPerangkat(v);
    try {
      localStorage.setItem(KUNCI_PERANGKAT, v);
    } catch {}
  };

  const mulai = (j: "masuk" | "pulang") => {
    if (mode === "lain" && (!kode.login || !/^\d{4,6}$/.test(kode.pin))) {
      setHasil({ error: "Isi kode staf dan PIN (4–6 angka) dulu." });
      return;
    }
    setJenis(j);
    setHasil(null);
    lokasi.current = ambilLokasi(); // minta izin lokasi bersamaan dengan membuka kamera
    if (typeof navigator.mediaDevices?.getUserMedia === "function") setKameraBuka(true);
    else kamera.current?.click();
  };

  const kirim = async (file: File | undefined) => {
    if (!file) return;
    setProses("Memproses foto…");
    try {
      const blob = await compressImage(file, 960, 0.75);
      setPreview(URL.createObjectURL(blob));
      setProses("Mengambil lokasi…");
      const loc = await (lokasi.current ?? ambilLokasi());
      setProses("Menyimpan absen…");
      const fd = new FormData();
      fd.set("jenis", jenis);
      fd.set("foto", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      fd.set("perangkat", mode === "lain" ? "outlet" : perangkat);
      if (loc) {
        fd.set("lat", String(loc.lat));
        fd.set("lng", String(loc.lng));
        fd.set("akurasi", String(loc.akurasi));
      }
      if (mode === "lain") {
        fd.set("login", kode.login);
        fd.set("pin", kode.pin);
      }
      const r = await absen(fd);
      setHasil({ ...r, lokasiKosong: !loc });
      if (r.ok) {
        setKode({ login: "", pin: "" });
        router.refresh();
      }
    } catch {
      setHasil({ error: "Gagal memproses foto. Coba lagi." });
    } finally {
      setProses("");
      if (kamera.current) kamera.current.value = "";
    }
  };

  const tombol = "flex-1 rounded-2xl py-5 text-lg font-bold text-white shadow disabled:opacity-50";
  return (
    <div className="mx-auto max-w-md space-y-4">
      <input ref={kamera} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => kirim(e.target.files?.[0])} />
      {kameraBuka && (
        <KameraSelfie
          jenis={jenis}
          nama={mode === "lain" ? `Kode staf: ${kode.login}` : nama}
          onAmbil={(f) => {
            setKameraBuka(false);
            kirim(f);
          }}
          onBatal={() => setKameraBuka(false)}
          onGagal={pakaiPemilih}
        />
      )}
      <div className="flex rounded-xl bg-matur-50 p-1 text-sm font-semibold">
        {(["saya", "lain"] as const).map((m) => (
          <button key={m} onClick={() => {
            setMode(m);
            setHasil(null);
          }} className={`flex-1 rounded-lg py-2 ${mode === m ? "bg-white shadow" : "text-stone-500"}`}>
            {m === "saya" ? `Absen saya` : "Staf lain (kode + PIN)"}
          </button>
        ))}
      </div>

      {mode === "saya" ? (
        <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
          <p className="font-semibold">
            {nama} · {outletNama}
          </p>
          {jadwalHariIni.length ? (
            <ul className="text-sm">
              {jadwalHariIni.map((j) => (
                <li key={j.id}>
                  Jadwal hari ini: <b>{j.shift.nama}</b> {j.shift.jam_mulai}–{j.shift.jam_selesai} {j.sudah && <span className="text-green-700">✓ sudah absen</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Tidak ada jadwal terbit hari ini. Absen tetap bisa, tercatat “tanpa jadwal”.</p>
          )}
          {terbuka && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Sedang bertugas sejak {jam(terbuka.masuk_at)} WIB.</p>}
          <div className="flex gap-2 text-xs">
            {(["hp", "outlet"] as const).map((v) => (
              <button key={v} onClick={() => simpanPerangkat(v)} className={`flex-1 rounded-lg border px-2 py-1.5 ${perangkat === v ? "border-matur-500 bg-matur-50 font-semibold" : "text-stone-500"}`}>
                {v === "hp" ? "📱 Ini HP saya" : "📟 Ini perangkat outlet"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {terbuka ? (
              <button disabled={!!proses} onClick={() => mulai("pulang")} className={`${tombol} bg-kopi-700`}>
                📸 Clock Out (pulang)
              </button>
            ) : (
              <button disabled={!!proses} onClick={() => mulai("masuk")} className={`${tombol} bg-green-700`}>
                📸 Clock In (masuk)
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
          <p className="text-sm text-stone-500">Untuk rekan yang absen di perangkat ini. Sesi kasir yang sedang aktif tidak berubah.</p>
          <label className="block text-sm font-medium">
            Kode staf
            <input value={kode.login} onChange={(e) => setKode({ ...kode, login: e.target.value })} autoCapitalize="none" autoComplete="off" className="mt-1 w-full rounded-xl border px-3 py-3 text-lg" />
          </label>
          <label className="block text-sm font-medium">
            PIN
            <input value={kode.pin} onChange={(e) => setKode({ ...kode, pin: e.target.value })} type="password" inputMode="numeric" autoComplete="off" className="mt-1 w-full rounded-xl border px-3 py-3 text-lg tracking-[0.5em]" />
          </label>
          <div className="flex gap-2">
            <button disabled={!!proses} onClick={() => mulai("masuk")} className={`${tombol} bg-green-700`}>
              Clock In
            </button>
            <button disabled={!!proses} onClick={() => mulai("pulang")} className={`${tombol} bg-kopi-700`}>
              Clock Out
            </button>
          </div>
        </section>
      )}

      {(proses || hasil) && (
        <section className={`flex items-center gap-3 rounded-2xl p-4 ${hasil?.error ? "bg-red-50 text-red-700" : hasil ? "bg-green-50 text-green-800" : "bg-matur-50"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover" />}
          <div className="text-sm">
            <p className="font-semibold">{proses || hasil?.error || hasil?.ok}</p>
            {hasil?.ok && hasil.lokasiKosong && <p className="text-xs">Lokasi tidak diizinkan — absen tetap tersimpan, ditandai tanpa lokasi.</p>}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-bold">Riwayat 2 minggu saya</h2>
        <ul className="divide-y rounded-2xl border border-matur-200 bg-white text-sm">
          {riwayat.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
              <span>{new Date(r.tanggal + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</span>
              <span className="text-stone-600">
                {jam(r.masuk_at)} – {jam(r.pulang_at)} · {r.pulang_at ? formatDurasi(menitKerja(r)) : "belum pulang"}
              </span>
              <span className={r.status === "telat" ? "text-amber-700" : r.status === "tepat" ? "text-green-700" : "text-sky-700"}>
                {STATUS[r.status]}
                {r.status === "telat" && ` ${r.telat_menit} mnt`}
              </span>
            </li>
          ))}
          {!riwayat.length && <li className="px-3 py-4 text-center text-stone-500">Belum ada absen.</li>}
        </ul>
      </section>
    </div>
  );
}
