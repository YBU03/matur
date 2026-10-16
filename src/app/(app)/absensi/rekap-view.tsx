"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDurasi, LABEL_STATUS, type BarisRekap, type RingkasStaf, type StatusHari } from "@/lib/jadwal/rekap";
import { BarisAngka, ChipHeader, HeaderHalaman, KartuAngka, Kartu, Kosong, isian, tabel, tombolHeaderUtama } from "@/components/ui-halaman";
import type { Absen } from "@/lib/sdm";
import { editAbsensi, ubahAbsensi, type Result } from "@/lib/sdm-actions";

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
};

export function RekapView(p: Props) {
  const router = useRouter();
  const [f, setF] = useState({ outlet: p.outlet.id, dari: p.dari, sampai: p.sampai, staf: p.staf });
  const [busy, setBusy] = useState(false);
  const terapkan = (v = f) => router.push(`/absensi?${new URLSearchParams(Object.entries(v).filter(([, x]) => x) as [string, string][])}`);
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

      <section>
        <h2 className="mb-2 font-bold text-kopi-900">
          Detail <span className="text-sm font-normal text-stone-500">({detail.length})</span>
        </h2>
        {detail.length ? (
          <div className="space-y-2">
            {detail.map((b, i) => (
              <Detail key={i} b={b} nama={n(b.pengguna_id)} a={b.absen ? p.absensi[b.absen.id] : undefined} foto={p.foto} />
            ))}
          </div>
        ) : (
          <Kosong ikon="🕘" judul="Belum ada absensi di periode ini." />
        )}
      </section>
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
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [catatan, setCatatan] = useState(a?.catatan ?? "");
  const [pulang, setPulang] = useState("");
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const simpan = () =>
    a &&
    start(async () => {
      // jam pulang diisi dalam WIB; lebih awal dari jam masuk berarti keesokan harinya
      let t: Date | null = null;
      if (pulang) {
        t = new Date(`${a.tanggal}T${pulang}:00+07:00`);
        if (t < new Date(a.masuk_at)) t.setUTCDate(t.getUTCDate() + 1);
      }
      const r = await ubahAbsensi(a.id, { catatan, pulang: t?.toISOString() ?? null });
      setMsg(r);
      if (r.ok) {
        setEdit(false);
        router.refresh();
      }
    });
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-matur-100 bg-white p-3 text-sm shadow-sm">
      <div className="flex gap-1">
        {[a?.masuk_foto, a?.pulang_foto].map((f, i) =>
          f && foto[f] ? (
            <a key={i} href={foto[f]} target="_blank" rel="noreferrer" title={i ? "Selfie pulang" : "Selfie masuk"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto[f]} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-matur-100" />
            </a>
          ) : null,
        )}
      </div>
      <div className="min-w-48 flex-1">
        <p>
          <b>{nama}</b> · {tglPendek(b.tanggal)} {b.shift && <span className="text-stone-500">· {b.shift.nama} {b.shift.jam_mulai}–{b.shift.jam_selesai}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-600">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${WARNA_STATUS[b.status]}`}>
            {LABEL_STATUS[b.status]}
            {b.status === "telat" && ` ${a?.telat_menit} mnt`}
          </span>
          {a && (
            <>
              <span>
                Masuk {jamWib(a.masuk_at)} · Pulang {jamWib(a.pulang_at)} · {formatDurasi(b.menitKerja)}
              </span>
              <span>{a.perangkat === "outlet" ? "📟 perangkat outlet" : "📱 HP sendiri"}</span>
              {peta(a.masuk_lat, a.masuk_lng) ? (
                <a href={peta(a.masuk_lat, a.masuk_lng)!} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  lokasi masuk
                </a>
              ) : (
                <span className="text-stone-400">lokasi tidak diizinkan</span>
              )}
              {peta(a.pulang_lat, a.pulang_lng) && (
                <a href={peta(a.pulang_lat, a.pulang_lng)!} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  lokasi pulang
                </a>
              )}
            </>
          )}
        </p>
        {a?.masuk_catatan&&<p className="mt-1 text-xs text-stone-600">Catatan Clock In: {a.masuk_catatan}</p>}
        {a?.pulang_catatan&&<p className="mt-1 text-xs text-stone-600">Catatan Clock Out: {a.pulang_catatan}</p>}
        {a?.masuk_lokasi_valid===false&&<p className="mt-1 text-xs text-amber-700">Koordinat masuk tercatat; titik/radius outlet belum diatur.</p>}
        {a?.pulang_lokasi_valid===false&&<p className="mt-1 text-xs text-amber-700">Koordinat pulang tercatat; titik/radius outlet belum diatur.</p>}
        {a?.catatan && !edit && <p className="mt-1 text-xs italic text-stone-600">Catatan: {a.catatan}</p>}
        {edit && a && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs">
              Catatan
              <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className="mt-1 block w-full rounded-lg border border-matur-200 px-2 py-1 text-sm sm:w-56" />
            </label>
            {!a.pulang_at && (
              <label className="text-xs">
                Isi jam pulang (WIB)
                <input type="time" value={pulang} onChange={(e) => setPulang(e.target.value)} className="mt-1 block rounded-lg border px-2 py-1 text-sm" />
              </label>
            )}
            <button disabled={pending} onClick={simpan} className="rounded-lg bg-matur-500 px-3 py-1.5 text-xs font-bold text-white">
              Simpan
            </button>
          </div>
        )}
        {msg?.error && <p className="mt-1 text-xs text-red-600">{msg.error}</p>}
      </div>
      {a && <EditAbsensi a={a} nama={nama} />}
      {a && !edit && (
        <button onClick={() => setEdit(true)} className="text-xs text-matur-700 underline">
          Koreksi
        </button>
      )}
    </div>
  );
}

function EditAbsensi({ a, nama }: { a: Absen; nama: string }) {
  const router = useRouter();
  const lokal = (s: string | null) => s ? new Date(Date.parse(s) + 7 * 3600_000).toISOString().slice(0,16) : "";
  const [open, setOpen] = useState(false);
  const [masuk, setMasuk] = useState(lokal(a.masuk_at));
  const [pulang, setPulang] = useState(lokal(a.pulang_at));
  const [catatan, setCatatan] = useState(a.catatan ?? "");
  const [alasan, setAlasan] = useState("");
  const [msg, setMsg] = useState<Result>({});
  const [pending, start] = useTransition();
  const jalankan = (hapus: boolean) => start(async () => {
    const r = await editAbsensi(a.id, { masuk: hapus ? a.masuk_at : new Date(masuk + ":00+07:00").toISOString(), pulang: !hapus && pulang ? new Date(pulang + ":00+07:00").toISOString() : null, catatan, alasan, hapus });
    setMsg(r); if (!r.error) { setOpen(false); router.refresh(); }
  });
  return <div className="w-full">
    <button onClick={() => setOpen(!open)} className="mr-3 text-xs text-matur-700 underline">Edit / Hapus</button>
    {open && <form className="mt-2 grid gap-2 rounded-xl bg-stone-50 p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); jalankan(false); }}>
      <p className="text-xs text-stone-600 sm:col-span-2">{nama} · Jam WIB. Status dan menit telat dihitung ulang. Gaji final mengunci perubahan; draft gaji perlu dihitung ulang.</p>
      <label>Masuk<input required type="datetime-local" value={masuk} onChange={(e) => setMasuk(e.target.value)} className="block w-full rounded border p-2" /></label>
      <label>Pulang<input type="datetime-local" value={pulang} onChange={(e) => setPulang(e.target.value)} className="block w-full rounded border p-2" /></label>
      <label>Catatan<input maxLength={300} value={catatan} onChange={(e) => setCatatan(e.target.value)} className="block w-full rounded border p-2" /></label>
      <label>Alasan perubahan / hapus<input required minLength={3} maxLength={300} value={alasan} onChange={(e) => setAlasan(e.target.value)} className="block w-full rounded border p-2" /></label>
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button disabled={pending} className="rounded-lg bg-matur-500 px-3 py-2 font-semibold text-white">Simpan edit</button>
        <button type="button" disabled={pending || alasan.trim().length < 3} onClick={() => { if (confirm(`Hapus absensi ${nama}? Kehadiran dan perhitungan gaji akan berubah.`) && prompt(`Ketik HAPUS untuk menghapus absensi ${nama}`) === "HAPUS") jalankan(true); }} className="rounded-lg border border-red-300 px-3 py-2 text-red-700 disabled:opacity-40">Hapus absensi</button>
        <button type="button" onClick={() => setOpen(false)}>Batal</button>
      </div>
    </form>}
    {(msg.error || msg.ok) && <p role="status" className={`mt-1 text-xs ${msg.error ? "text-red-700" : "text-green-700"}`}>{msg.error ?? msg.ok}</p>}
  </div>;
}
