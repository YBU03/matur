"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDurasi, LABEL_STATUS, type BarisRekap, type RingkasStaf, type StatusHari } from "@/lib/jadwal/rekap";
import { BarisAngka, ChipHeader, HeaderHalaman, KartuAngka, Kartu, Kosong, isian, tabel, tombolAksi, tombolHeaderUtama } from "@/components/ui-halaman";
import { Modal } from "@/components/confirm-edit";
import { GrafikAbsensi } from "./grafik";
import type { Absen } from "@/lib/sdm";
import { editAbsensi, type Result } from "@/lib/sdm-actions";

export const WARNA_STATUS: Record<StatusHari, string> = {
  tepat: "bg-green-100 text-green-800",
  telat: "bg-amber-100 text-amber-900",
  tanpa_jadwal: "bg-sky-100 text-sky-800",
  tidak_absen: "bg-red-100 text-red-700",
  belum: "bg-stone-100 text-stone-600",
  izin: "bg-violet-100 text-violet-800",
  libur: "bg-violet-100 text-violet-800",
  sakit: "bg-violet-100 text-violet-800",
};

export const jamWib = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "–";
const tglPendek = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
const peta = (lat: number | null, lng: number | null) => (lat !== null && lng !== null ? `https://www.google.com/maps?q=${lat},${lng}` : null);

type Props = {
  outlets: { id: string; nama: string }[];
  outlet: { id: string; nama: string };
  dari: string;
  sampai: string;
  staf: string;
  daftarStaf: { id: string; nama: string }[];
  nama: Record<string, string>;
  rekap: { baris: BarisRekap[]; ringkas: RingkasStaf[] };
  hariIni: BarisRekap[];
  absensi: Record<string, Absen>;
  foto: Record<string, string>;
  /** tanggal awal riwayat harian (opsional, dari ?tgl=) */
  tgl?: string;
};

export function RekapView(p: Props) {
  const router = useRouter();
  const [f, setF] = useState({ outlet: p.outlet.id, dari: p.dari, sampai: p.sampai, staf: p.staf });
  const [busy, setBusy] = useState(false);
  const terapkan = (v: Record<string, string> = f) => router.push(`/absensi?${new URLSearchParams(Object.entries(v).filter(([, x]) => x) as [string, string][])}`);
  const n = (id: string) => p.nama[id] ?? "Staf";

  const ekspor = async () => {
    setBusy(true);
    try {
      const { eksporRekap } = await import("./ekspor");
      await eksporRekap({ outlet: p.outlet.nama, dari: p.dari, sampai: p.sampai, nama: p.nama, rekap: p.rekap, absensi: p.absensi });
    } finally {
      setBusy(false);
    }
  };

  const hadirSekarang = p.hariIni.filter((b) => b.absen && !b.absen.pulang_at).length;
  const telat = p.hariIni.filter((b) => b.status === "telat").length;
  const tidak = p.hariIni.filter((b) => b.status === "tidak_absen").length;

  // KPI periode terpilih dari ringkasan per staf
  const total = p.rekap.ringkas.reduce(
    (t, r) => ({ jadwal: t.jadwal + r.jadwal, hadir: t.hadir + r.hadir, telat: t.telat + r.telat, menitTelat: t.menitTelat + r.menitTelat, tidak: t.tidak + r.tidakAbsen, izin: t.izin + r.izin }),
    { jadwal: 0, hadir: 0, telat: 0, menitTelat: 0, tidak: 0, izin: 0 },
  );
  const persenHadir = total.jadwal ? Math.min(100, Math.round((total.hadir / total.jadwal) * 100)) : null;
  const tglFilter = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const ringkas = [...p.rekap.ringkas].sort((a, b) => n(a.pengguna_id).localeCompare(n(b.pengguna_id)));
  const detail = p.rekap.baris.filter((b) => b.status !== "belum");
  const th = `${tabel.th} text-right`;
  const td = `${tabel.td} text-right tabular-nums`;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <HeaderHalaman
        judul="Rekap Absensi"
        ikon="🕘"
        keterangan="Absen selfie kasir & barista (dari HP sendiri atau perangkat outlet), dibandingkan dengan jadwal terbit."
        aksi={
          <button disabled={busy} onClick={ekspor} className={`${tombolHeaderUtama} disabled:opacity-60`}>
            {busy ? "Menyiapkan…" : "⬇ Unduh Excel"}
          </button>
        }
      >
        <ChipHeader>🏪 {p.outlet.nama}</ChipHeader>
        <ChipHeader>
          📅 {tglFilter(p.dari)} – {tglFilter(p.sampai)}
        </ChipHeader>
        {p.staf && <ChipHeader>👤 {n(p.staf)}</ChipHeader>}
      </HeaderHalaman>

      <BarisAngka>
        <KartuAngka label="Persen hadir" nilai={persenHadir === null ? "–" : `${persenHadir}%`} ikon="✅" nada={persenHadir === null ? "netral" : persenHadir >= 90 ? "hijau" : persenHadir >= 75 ? "kuning" : "merah"} sub={`${total.hadir} dari ${total.jadwal} jadwal`} />
        <KartuAngka label="Jumlah telat" nilai={total.telat} ikon="⏰" nada="kuning" sub={total.menitTelat ? `total ${total.menitTelat} mnt` : "periode ini"} />
        <KartuAngka label="Tidak absen" nilai={total.tidak} ikon="🚫" nada="merah" sub="periode ini" />
        <KartuAngka label="Izin/sakit/libur" nilai={total.izin} ikon="📝" nada="ungu" sub="disetujui" />
      </BarisAngka>

      <GrafikAbsensi baris={p.rekap.baris} ringkas={p.rekap.ringkas} nama={p.nama} />

      <Kartu judul={`Hari ini · ${p.outlet.nama}`} keterangan="Diperbarui otomatis saat ada absen baru.">
        <div className="mb-3 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
          <Kotak label="Sedang bertugas" nilai={hadirSekarang} warna="text-emerald-700" latar="bg-emerald-50" />
          <Kotak label="Jadwal hari ini" nilai={p.hariIni.filter((b) => b.shift).length} />
          <Kotak label="Telat" nilai={telat} warna="text-amber-700" latar={telat ? "bg-amber-50" : undefined} />
          <Kotak label="Tidak absen" nilai={tidak} warna="text-red-600" latar={tidak ? "bg-red-50" : undefined} />
        </div>
        {p.hariIni.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {p.hariIni.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-kopi-900 sm:min-w-40">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-matur-100 text-xs font-bold text-matur-800">{n(b.pengguna_id).slice(0, 1).toUpperCase()}</span>
                  {n(b.pengguna_id)}
                </span>
                <span className="text-stone-500">{b.shift ? `${b.shift.nama} ${b.shift.jam_mulai}–${b.shift.jam_selesai}` : "Tanpa jadwal"}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${WARNA_STATUS[b.status]}`}>
                  {LABEL_STATUS[b.status]}
                  {b.status === "telat" && ` ${b.absen?.telat_menit} mnt`}
                </span>
                {b.absen && (
                  <span className="text-xs text-stone-500">
                    masuk {jamWib(b.absen.masuk_at)} · pulang {jamWib(b.absen.pulang_at)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-stone-50 px-3 py-4 text-center text-sm text-stone-500">Belum ada jadwal terbit maupun absen hari ini.</p>
        )}
      </Kartu>

      <div className="grid gap-2 rounded-2xl border border-matur-100 bg-white p-3 text-sm shadow-sm sm:flex sm:flex-wrap sm:items-end">
        {p.outlets.length > 1 && (
          <label className="text-xs font-medium text-stone-500">
            Outlet
            <select value={f.outlet} onChange={(e) => terapkan({ ...f, outlet: e.target.value, staf: "" })} className={`${isian} mt-0.5 block w-full`}>
              {p.outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <label className="text-xs font-medium text-stone-500">
            Dari
            <input type="date" value={f.dari} onChange={(e) => setF({ ...f, dari: e.target.value })} className={`${isian} mt-0.5 block w-full`} />
          </label>
          <label className="text-xs font-medium text-stone-500">
            Sampai
            <input type="date" value={f.sampai} onChange={(e) => setF({ ...f, sampai: e.target.value })} className={`${isian} mt-0.5 block w-full`} />
          </label>
        </div>
        <label className="text-xs font-medium text-stone-500">
          Staf
          <select value={f.staf} onChange={(e) => setF({ ...f, staf: e.target.value })} className={`${isian} mt-0.5 block w-full`}>
            <option value="">Semua staf</option>
            {p.daftarStaf.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => terapkan()} className="rounded-xl bg-matur-500 px-4 py-2 font-bold text-white shadow-sm hover:bg-matur-600">
          Tampilkan
        </button>
      </div>

      <section>
        <h2 className="mb-2 font-bold text-kopi-900">Ringkasan per staf</h2>
        <div className={tabel.bungkus}>
          <table className={`${tabel.tabel} min-w-[680px]`}>
            <thead className={tabel.kepala}>
              <tr>
                <th className={`${tabel.th} sticky left-0 z-10 bg-matur-50`}>Nama</th>
                <th className={th}>Jadwal</th>
                <th className={th}>Hadir</th>
                <th className={th}>Tepat</th>
                <th className={th}>Telat</th>
                <th className={th}>Tidak absen</th>
                <th className={th}>Izin/sakit/libur</th>
                <th className={th}>Jam kerja</th>
              </tr>
            </thead>
            <tbody>
              {ringkas.map((r) => (
                <tr key={r.pengguna_id} className={`${tabel.baris} group`}>
                  <td className={`${tabel.td} sticky left-0 z-10 max-w-40 truncate bg-white font-semibold text-kopi-900 shadow-[1px_0_0_#f5f5f4] group-hover:bg-matur-50 sm:max-w-none`}>{n(r.pengguna_id)}</td>
                  <td className={td}>{r.jadwal}</td>
                  <td className={td}>{r.hadir}</td>
                  <td className={`${td} text-emerald-700`}>{r.tepat}</td>
                  <td className={td}>
                    {r.telat > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {r.telat}
                        {r.menitTelat ? <span className="font-normal">({r.menitTelat} mnt)</span> : null}
                      </span>
                    ) : (
                      <span className="text-stone-400">0</span>
                    )}
                  </td>
                  <td className={td}>
                    {r.tidakAbsen > 0 ? <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{r.tidakAbsen}</span> : <span className="text-stone-400">0</span>}
                  </td>
                  <td className={td}>{r.izin}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDurasi(r.menitKerja)}</td>
                </tr>
              ))}
              {!ringkas.length && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-stone-500">
                    Belum ada data di periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DetailHarian
        baris={detail}
        dari={p.dari}
        sampai={p.sampai}
        tglAwal={p.tgl}
        render={(b, i) => <Detail key={`${b.tanggal}-${b.pengguna_id}-${i}`} b={b} nama={n(b.pengguna_id)} a={b.absen ? p.absensi[b.absen.id] : undefined} foto={p.foto} />}
        pindahPeriode={(t) => terapkan({ ...f, dari: t < f.dari ? t : f.dari, sampai: t > f.sampai ? t : f.sampai, tgl: t })}
      />
    </div>
  );
}

function Kotak({ label, nilai, warna = "text-kopi-900", latar = "bg-matur-50" }: { label: string; nilai: number; warna?: string; latar?: string }) {
  return (
    <div className={`rounded-xl p-2.5 ${latar}`}>
      <p className={`text-2xl font-extrabold tabular-nums ${warna}`}>{nilai}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

function Detail({ b, nama, a, foto }: { b: BarisRekap; nama: string; a?: Absen; foto: Record<string, string> }) {
  const [lihat, setLihat] = useState(false);
  const [edit, setEdit] = useState(false);
  const fotoMasuk = a?.masuk_foto ? foto[a.masuk_foto] : undefined;
  const fotoPulang = a?.pulang_foto ? foto[a.pulang_foto] : undefined;
  const adaFoto = !!(fotoMasuk || fotoPulang);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-matur-100 bg-white p-3 text-sm shadow-sm transition hover:border-matur-200 hover:shadow">
      <button
        type="button"
        onClick={() => adaFoto && setLihat(true)}
        disabled={!adaFoto}
        className="relative shrink-0 disabled:cursor-default"
        aria-label={adaFoto ? `Lihat foto absen ${nama}` : "Tanpa foto"}
      >
        {fotoMasuk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoMasuk} alt="" className="size-12 rounded-full object-cover ring-2 ring-white shadow" />
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-matur-100 text-sm font-bold text-matur-800">{inisialNama(nama)}</span>
        )}
        {fotoPulang && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoPulang} alt="" className="absolute -bottom-1 -right-1 size-6 rounded-full object-cover ring-2 ring-white" />
        )}
      </button>
      <div className="min-w-48 flex-1">
        <p className="flex flex-wrap items-center gap-x-2">
          <b className="text-kopi-900">{nama}</b>
          <span className="text-xs text-stone-500">
            {tglPendek(b.tanggal)}
            {b.shift && ` · ${b.shift.nama} ${b.shift.jam_mulai}–${b.shift.jam_selesai}`}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-600">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${WARNA_STATUS[b.status]}`}>
            {LABEL_STATUS[b.status]}
            {b.status === "telat" && ` ${a?.telat_menit} mnt`}
          </span>
          {a && (
            <>
              <span className="tabular-nums">
                🟢 {jamWib(a.masuk_at)} → 🔴 {jamWib(a.pulang_at)} · {formatDurasi(b.menitKerja)}
              </span>
              <span>{a.perangkat === "outlet" ? "📟 Perangkat outlet" : "📱 HP sendiri"}</span>
            </>
          )}
        </p>
        {a?.catatan && <p className="mt-1 text-xs italic text-stone-600">Catatan: {a.catatan}</p>}
      </div>
      {a && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setLihat(true)} className={tombolAksi.lihat} title="Lihat foto, lokasi & catatan">
            👁 Lihat
          </button>
          <button type="button" onClick={() => setEdit(true)} className={tombolAksi.edit}>
            ✏️ Edit
          </button>
        </div>
      )}
      {lihat && a && <PopupAbsen a={a} b={b} nama={nama} masuk={fotoMasuk} pulang={fotoPulang} onClose={() => setLihat(false)} onEdit={() => { setLihat(false); setEdit(true); }} />}
      {edit && a && <EditAbsensi a={a} nama={nama} onClose={() => setEdit(false)} />}
    </div>
  );
}

const inisialNama = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? "").join("") || "?";

function PopupAbsen({ a, b, nama, masuk, pulang, onClose, onEdit }: { a: Absen; b: BarisRekap; nama: string; masuk?: string; pulang?: string; onClose: () => void; onEdit: () => void }) {
  const [besar, setBesar] = useState<string | null>(null);
  const kartu = (judul: string, src: string | undefined, jam: string | null, lat: number | null, lng: number | null, catatan: string | null | undefined, valid: boolean | null | undefined) => (
    <div className="overflow-hidden rounded-2xl border border-matur-100 bg-stone-50">
      {src ? (
        <button type="button" onClick={() => setBesar(src)} className="block w-full" aria-label={`Perbesar ${judul}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={judul} className="aspect-[3/4] w-full object-cover" />
        </button>
      ) : (
        <div className="grid aspect-[3/4] place-items-center text-sm text-stone-400">{jam ? "Tanpa foto" : "Belum absen"}</div>
      )}
      <div className="space-y-0.5 p-2.5 text-xs">
        <p className="font-bold text-kopi-900">
          {judul} · <span className="tabular-nums">{jamWib(jam)}</span>
        </p>
        {peta(lat, lng) ? (
          <a href={peta(lat, lng)!} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:underline">
            📍 Buka lokasi di peta
          </a>
        ) : (
          <p className="text-stone-400">📍 Lokasi tidak tersedia</p>
        )}
        {valid === false && <p className="text-amber-700">Titik/radius outlet belum diatur.</p>}
        {catatan && <p className="text-stone-600">💬 {catatan}</p>}
      </div>
    </div>
  );
  return (
    <Modal title={`Absen ${nama}`} onClose={onClose} scrollable>
      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-stone-600">
        {tglPendek(b.tanggal)}
        {b.shift && <span>· {b.shift.nama} {b.shift.jam_mulai}–{b.shift.jam_selesai}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${WARNA_STATUS[b.status]}`}>
          {LABEL_STATUS[b.status]}
          {b.status === "telat" && ` ${a.telat_menit} mnt`}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {kartu("Masuk", masuk, a.masuk_at, a.masuk_lat, a.masuk_lng, a.masuk_catatan, a.masuk_lokasi_valid)}
        {kartu("Pulang", pulang, a.pulang_at, a.pulang_lat, a.pulang_lng, a.pulang_catatan, a.pulang_lokasi_valid)}
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Durasi kerja {formatDurasi(b.menitKerja)} · {a.perangkat === "outlet" ? "📟 perangkat outlet" : "📱 HP sendiri"}
        {a.catatan && ` · Catatan HRD: ${a.catatan}`}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={tombolAksi.netral}>Tutup</button>
        <button type="button" onClick={onEdit} className={tombolAksi.edit}>✏️ Edit absen</button>
      </div>
      {besar && (
        <div role="dialog" aria-label="Foto diperbesar" onClick={() => setBesar(null)} className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={besar} alt="" className="max-h-full max-w-full rounded-xl" />
          <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold">✕ Tutup</span>
        </div>
      )}
    </Modal>
  );
}

function EditAbsensi({ a, nama, onClose }: { a: Absen; nama: string; onClose: () => void }) {
  const router = useRouter();
  const lokal = (s: string | null) => (s ? new Date(Date.parse(s) + 7 * 3600_000).toISOString().slice(0, 16) : "");
  const [masuk, setMasuk] = useState(lokal(a.masuk_at));
  const [pulang, setPulang] = useState(lokal(a.pulang_at));
  const [catatan, setCatatan] = useState(a.catatan ?? "");
  const [alasan, setAlasan] = useState("");
  const [msg, setMsg] = useState<Result>({});
  const [pending, start] = useTransition();
  const jalankan = (hapus: boolean) =>
    start(async () => {
      const r = await editAbsensi(a.id, {
        masuk: hapus ? a.masuk_at : new Date(masuk + ":00+07:00").toISOString(),
        pulang: !hapus && pulang ? new Date(pulang + ":00+07:00").toISOString() : null,
        catatan,
        alasan,
        hapus,
      });
      setMsg(r);
      if (!r.error) {
        onClose();
        router.refresh();
      }
    });
  const label = "text-xs font-medium text-stone-500";
  return (
    <Modal title={`Edit absen · ${nama}`} onClose={onClose} scrollable>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          jalankan(false);
        }}
      >
        <p className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 sm:col-span-2">
          Jam dalam WIB. Status dan menit telat dihitung ulang. Gaji final mengunci perubahan; draft gaji perlu dihitung ulang.
        </p>
        <label className={label}>
          Jam masuk
          <input required type="datetime-local" value={masuk} onChange={(e) => setMasuk(e.target.value)} className={`${isian} mt-0.5 block w-full`} />
        </label>
        <label className={label}>
          Jam pulang
          <input type="datetime-local" value={pulang} onChange={(e) => setPulang(e.target.value)} className={`${isian} mt-0.5 block w-full`} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Catatan
          <input maxLength={300} value={catatan} onChange={(e) => setCatatan(e.target.value)} className={`${isian} mt-0.5 block w-full`} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Alasan perubahan / hapus (wajib)
          <input required minLength={3} maxLength={300} value={alasan} onChange={(e) => setAlasan(e.target.value)} className={`${isian} mt-0.5 block w-full`} />
        </label>
        {msg.error && <p role="alert" className="rounded-xl bg-red-50 p-2 text-xs text-red-700 sm:col-span-2">{msg.error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 sm:col-span-2">
          <button
            type="button"
            disabled={pending || alasan.trim().length < 3}
            onClick={() => {
              if (confirm(`Hapus absensi ${nama}? Kehadiran dan perhitungan gaji akan berubah.`) && prompt(`Ketik HAPUS untuk menghapus absensi ${nama}`) === "HAPUS") jalankan(true);
            }}
            className={tombolAksi.hapus}
          >
            🗑 Hapus absensi
          </button>
          <span className="flex gap-2">
            <button type="button" onClick={onClose} className={tombolAksi.netral}>Batal</button>
            <button disabled={pending} className={tombolAksi.utama}>{pending ? "Menyimpan…" : "💾 Simpan"}</button>
          </span>
        </div>
      </form>
    </Modal>
  );
}

const geserTgl = (t: string, n: number) => new Date(Date.parse(t + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
const labelHari = (t: string) => new Date(t + "T00:00:00Z").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Riwayat absensi per hari: panah ‹ › ke hari sebelum/sesudah atau pilih tanggal. */
function DetailHarian({ baris, dari, sampai, render, pindahPeriode, tglAwal }: { tglAwal?: string; baris: BarisRekap[]; dari: string; sampai: string; render: (b: BarisRekap, i: number) => React.ReactNode; pindahPeriode: (tgl: string) => void }) {
  const hari = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const awal = tglAwal && tglAwal >= dari && tglAwal <= sampai ? tglAwal : hari >= dari && hari <= sampai ? hari : sampai;
  const [tgl, setTgl] = useState(awal);
  const pilih = (t: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return;
    if (t < dari || t > sampai) return pindahPeriode(t);
    setTgl(t);
  };
  const isi = baris.filter((b) => b.tanggal === tgl);
  const hitung = (st: string[]) => isi.filter((b) => st.includes(b.status)).length;
  const btn = "grid size-10 place-items-center rounded-xl border border-matur-200 bg-white text-lg font-bold text-kopi-900 hover:bg-matur-50 disabled:opacity-30";
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm">
        <button type="button" className={btn} onClick={() => pilih(geserTgl(tgl, -1))} aria-label="Hari sebelumnya">‹</button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Riwayat absensi</p>
          <p className="truncate text-base font-bold capitalize text-kopi-900">{labelHari(tgl)}</p>
        </div>
        <button type="button" className={btn} onClick={() => pilih(geserTgl(tgl, 1))} disabled={tgl >= hari} aria-label="Hari berikutnya">›</button>
        <label className="w-full text-xs font-medium text-stone-500 sm:w-auto">
          Pilih tanggal
          <input type="date" value={tgl} max={hari} onChange={(e) => pilih(e.target.value)} className={`${isian} mt-0.5 block w-full sm:w-44`} />
        </label>
        {tgl !== hari && (
          <button type="button" onClick={() => pilih(hari)} className={tombolAksi.netral}>
            Hari ini
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
        <Kotak label="Hadir" nilai={hitung(["tepat", "telat", "tanpa_jadwal"])} warna="text-emerald-700" latar="bg-emerald-50" />
        <Kotak label="Telat" nilai={hitung(["telat"])} warna="text-amber-700" latar="bg-amber-50" />
        <Kotak label="Tidak absen" nilai={hitung(["tidak_absen"])} warna="text-red-600" latar="bg-red-50" />
        <Kotak label="Izin/sakit/libur" nilai={hitung(["izin", "sakit", "libur"])} warna="text-violet-700" latar="bg-violet-50" />
      </div>
      {isi.length ? (
        <div className="space-y-2">{isi.map((b, i) => render(b, i))}</div>
      ) : (
        <Kosong ikon="🕘" judul="Tidak ada absensi di tanggal ini." />
      )}
    </section>
  );
}
