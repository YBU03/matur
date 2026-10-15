"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/compress-image";
import { formatDurasi, menitKerja } from "@/lib/jadwal/rekap";
import { absen } from "@/lib/sdm-actions";
import { KameraSelfie } from "./kamera-selfie";
type Lokasi = { lat: number; lng: number; akurasi: number };
type Riwayat = {
  id: string;
  tanggal: string;
  masuk_at: string;
  pulang_at: string | null;
  status: string;
  telat_menit: number;
  masuk_foto?: string | null;
  pulang_foto?: string | null;
  masuk_catatan?: string | null;
  pulang_catatan?: string | null;
};
const jam = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      })
    : "—";
const status: Record<string, string> = {
  tepat: "Tepat waktu",
  telat: "Terlambat",
  tanpa_jadwal: "Tanpa jadwal",
};
async function lokasiBaru(): Promise<Lokasi> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error("Perangkat tidak mendukung lokasi."));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          akurasi: Math.round(p.coords.accuracy),
        }),
      () =>
        reject(
          new Error(
            "Lokasi belum terbaca. Aktifkan izin lokasi/GPS lalu coba lagi.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
export function AbsenView({
  nama,
  outletNama,
  jadwalHariIni,
  terbuka,
  riwayat,
  foto = {},
}: {
  nama: string;
  outletNama: string;
  jadwalHariIni: {
    id: string;
    shift: { nama: string; jam_mulai: string; jam_selesai: string };
    sudah: boolean;
  }[];
  terbuka: { masuk_at: string } | null;
  riwayat: Riwayat[];
  foto?: Record<string, string>;
}) {
  const router = useRouter();
  const [jenis, setJenis] = useState<"masuk" | "pulang">("masuk");
  const [panel, setPanel] = useState(false);
  const [camera, setCamera] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loc, setLoc] = useState<Lokasi | null>(null);
  const [gps, setGps] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    error?: string;
    ok?: string;
    lokasiValid?: boolean;
  }>({});
  const client = useRef(crypto.randomUUID());
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const ambilGps = async () => {
    setGps(true);
    setLoc(null);
    try {
      const l = await lokasiBaru();
      if (l.akurasi > 200)
        throw new Error(
          `Akurasi lokasi ±${l.akurasi} m. Pindah ke tempat yang sinyal GPS-nya lebih baik.`,
        );
      setLoc(l);
    } catch (e) {
      setMsg({ error: (e as Error).message });
    } finally {
      setGps(false);
    }
  };
  const gagalKamera = useCallback(() => {
    setCamera(false);
    setMsg({
      error:
        "Kamera belum dapat dibuka. Izinkan kamera pada browser, lalu ambil foto langsung.",
    });
  }, []);
  const mulai = () => {
    if (!navigator.onLine)
      return setMsg({
        error:
          "Absensi membutuhkan internet agar waktu dan hasil tersimpan di server.",
      });
    setJenis(terbuka ? "pulang" : "masuk");
    setPanel(true);
    setMsg({});
    setFile(null);
    setPreview("");
    setNote("");
    client.current = crypto.randomUUID();
    setCamera(true);
    void ambilGps();
  };
  const kirim = async () => {
    if (busy) return;
    if (!navigator.onLine || !file || !loc)
      return setMsg({
        error:
          "Pastikan internet aktif, foto baru sudah diambil, dan lokasi terbaca.",
      });
    setBusy(true);
    setMsg({});
    try {
      const d = new FormData();
      d.set("jenis", jenis);
      d.set("foto", file);
      d.set("lat", String(loc.lat));
      d.set("lng", String(loc.lng));
      d.set("akurasi", String(loc.akurasi));
      d.set("catatan", note);
      d.set("client_id", client.current);
      const res = await absen(d);
      setMsg(res);
      if (!res.error) {
        setPanel(false);
        router.refresh();
      }
    } catch {
      setMsg({
        error:
          "Koneksi terputus. Coba kirim kembali; permintaan yang sama tidak dicatat dua kali.",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-matur-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Absensi hari ini</h2>
            <p className="text-xs text-stone-500">
              {nama} · {outletNama}
            </p>
          </div>
          <span className="rounded-full bg-matur-50 px-3 py-1 text-xs font-semibold">
            Foto + GPS
          </span>
        </div>
        <div className="my-4 space-y-2">
          {jadwalHariIni.map((j) => (
            <p key={j.id} className="rounded-xl bg-stone-50 p-3 text-sm">
              <b>{j.shift.nama}</b> · {j.shift.jam_mulai}–{j.shift.jam_selesai}
              {j.sudah && " · sudah absen"}
            </p>
          ))}
          {!jadwalHariIni.length && (
            <p className="text-sm text-amber-700">
              Belum ada jadwal terbit hari ini. Kehadiran tanpa jadwal akan
              ditandai untuk diperiksa HRD.
            </p>
          )}
        </div>
        {terbuka && (
          <p className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">
            ✓ Sedang bertugas · masuk {jam(terbuka.masuk_at)} WIB
          </p>
        )}
        <button
          disabled={busy || panel}
          onClick={mulai}
          className={`w-full rounded-2xl py-4 text-lg font-bold text-white disabled:opacity-50 ${terbuka ? "bg-kopi-900" : "bg-green-700"}`}
        >
          {terbuka ? "Clock Out · Absen Pulang" : "Clock In · Absen Masuk"}
        </button>
        <p className="mt-2 text-xs text-stone-500">
          Absen dengan akun sendiri. Waktu tercatat dari server.
        </p>
      </section>
      {camera && (
        <KameraSelfie
          jenis={jenis}
          nama={nama}
          onBatal={() => setCamera(false)}
          onGagal={gagalKamera}
          onAmbil={async (f) => {
            setCamera(false);
            const blob = await compressImage(f, 960, 0.8);
            setFile(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
            setPreview(URL.createObjectURL(blob));
          }}
        />
      )}
      {panel && (
        <section className="space-y-3 rounded-2xl border border-matur-300 bg-white p-4">
          <h3 className="font-bold">
            Konfirmasi {jenis === "masuk" ? "Clock In" : "Clock Out"}
          </h3>
          {preview && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Pratinjau foto absensi"
                className="h-48 w-48 rounded-2xl object-cover"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => setCamera(true)}
              className="flex-1 rounded-lg border p-2 text-sm"
            >
              {file ? "Ambil ulang foto" : "Ambil foto"}
            </button>
            <button
              disabled={gps || busy}
              onClick={() => void ambilGps()}
              className="flex-1 rounded-lg border p-2 text-sm"
            >
              {gps ? "Membaca GPS…" : "Perbarui lokasi"}
            </button>
          </div>
          {loc && (
            <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-800">
              📍 {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)} · akurasi ±
              {loc.akurasi} m
            </p>
          )}
          <label className="block text-sm font-semibold">
            Catatan (opsional)
            <textarea
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                jenis === "masuk"
                  ? "Misalnya alasan terlambat atau kondisi saat datang"
                  : "Misalnya pulang lebih awal karena sakit"
              }
              className="mt-1 w-full rounded-xl border p-3 font-normal"
            />
          </label>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => setPanel(false)}
              className="rounded-xl border px-4 py-3"
            >
              Batal
            </button>
            <button
              disabled={busy || gps || !file || !loc}
              onClick={() => void kirim()}
              className="flex-1 rounded-xl bg-matur-500 px-4 py-3 font-bold text-white disabled:opacity-40"
            >
              {busy ? "Menyimpan…" : "Kirim Absensi"}
            </button>
          </div>
        </section>
      )}
      {(msg.error || msg.ok) && (
        <section
          role="status"
          aria-live="polite"
          className={`rounded-2xl p-4 ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}
        >
          <p className="text-lg font-bold">
            {msg.error ? "Absensi belum berhasil" : "✅ Absensi berhasil"}
          </p>
          <p className="mt-1 text-sm">{msg.error ?? msg.ok}</p>
          {msg.ok && msg.lokasiValid === false && (
            <p className="mt-2 text-xs">
              Lokasi sudah tercatat. Titik/radius outlet belum diatur admin,
              sehingga jarak belum diverifikasi.
            </p>
          )}
        </section>
      )}
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-bold">Riwayat kehadiran saya</h2>
        <div className="max-h-96 space-y-3 overflow-auto">
          {riwayat.map((a) => (
            <article key={a.id} className="rounded-xl border p-3 text-sm">
              <div className="flex justify-between gap-2">
                <b>{a.tanggal}</b>
                <span
                  className={
                    a.status === "telat" ? "text-amber-700" : "text-green-700"
                  }
                >
                  {status[a.status]}
                  {a.status === "telat" && ` ${a.telat_menit} menit`}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {jam(a.masuk_at)}–{jam(a.pulang_at)} WIB ·{" "}
                {a.pulang_at ? formatDurasi(menitKerja(a)) : "Belum Clock Out"}
              </p>
              <div className="mt-2 flex gap-2">
                {[
                  [a.masuk_foto, "Foto masuk"],
                  [a.pulang_foto, "Foto pulang"],
                ].map(([path, l]) =>
                  path && foto[path] ? (
                    <a
                      key={l}
                      href={foto[path]}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold underline"
                    >
                      {l}
                    </a>
                  ) : null,
                )}
              </div>
              {a.masuk_catatan && (
                <p className="mt-1 text-xs">Catatan masuk: {a.masuk_catatan}</p>
              )}
              {a.pulang_catatan && (
                <p className="mt-1 text-xs">
                  Catatan pulang: {a.pulang_catatan}
                </p>
              )}
            </article>
          ))}
          {!riwayat.length && (
            <p className="text-sm text-stone-500">
              Belum ada absensi pada rentang ini.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
