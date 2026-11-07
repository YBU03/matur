import { Suspense } from "react";
import Image from "next/image";
import { CalendarClock, Camera, Users, Zap } from "lucide-react";
import { MitraJadwal } from "./jadwal";
import { DataTertutup } from "./data-tertutup";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { hariIni } from "@/lib/jadwal/waktu";
import { awalMingguMitra, statusJadwalMitra, type DataJadwalMitra, type JadwalMitra } from "@/lib/mitra-jadwal";

type Staf = {
  id: string;
  nama: string;
  outlet_id: string;
  outlet: string;
  peran: string[] | null;
  foto_path: string | null;
  alamat: string | null;
  no_wa: string | null;
  tgl_masuk: string | null;
};
const PERAN: Record<string, { label: string; warna: string; strip: string }> = {
  spv: { label: "SPV / Kepala Outlet", warna: "bg-violet-100 text-violet-800", strip: "from-violet-400 to-violet-600" },
  kasir: { label: "Kasir", warna: "bg-sky-100 text-sky-800", strip: "from-sky-400 to-sky-600" },
  barista: { label: "Barista", warna: "bg-amber-100 text-amber-800", strip: "from-matur-400 to-matur-600" },
};
const peranUtama = (p: string[] | null) => ((p ?? []).includes("spv") ? "spv" : (p ?? []).includes("kasir") ? "kasir" : "barista");
// nomor ditampilkan tersamar; nomor lengkap hanya diambil dari server saat ikon mata diketuk
const samarkan = (n: string | null) => {
  const d = (n ?? "").replace(/\D/g, "");
  if (d.length < 6) return d ? "•••• ••••" : null;
  return `${d.slice(0, 4)} •••• ••${d.slice(-2)}`;
};
const lamaBergabung = (tgl: string | null, hari: string) => {
  if (!tgl) return null;
  const bln = (Number(hari.slice(0, 4)) - Number(tgl.slice(0, 4))) * 12 + Number(hari.slice(5, 7)) - Number(tgl.slice(5, 7));
  if (bln < 1) return "Baru bergabung";
  if (bln < 12) return `Bergabung ${bln} bulan`;
  const th = Math.floor(bln / 12);
  return `Bergabung ${th} tahun${bln % 12 ? ` ${bln % 12} bulan` : ""}`;
};
const tglPendek = (t: string) => new Date(`${t}T00:00:00Z`).toLocaleDateString("id-ID", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const jamWib = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
const jamShift = (r: JadwalMitra) => (r.mulai && r.selesai ? `${r.mulai.slice(0, 5)}–${r.selesai.slice(0, 5)}` : "");

// Mitra: tim outletnya (foto, jabatan, shift & absen hari ini, WA/alamat tertutup ikon mata) + jadwal shift hanya lihat.
export default async function KaryawanMitra({ searchParams }: { searchParams: Promise<{ mitra_tanggal?: string; mitra_outlet?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s?.active?.role !== "mitra") notFound();
  const supabase = await supabaseServer();
  const today = hariIni();
  const [{ data, error }, { data: jd }] = await Promise.all([
    supabase.rpc("karyawan_outlet_saya"),
    supabase.rpc("jadwal_mitra_mingguan", { p_awal: awalMingguMitra(today, today) }),
  ]);
  if (error) throw new Error("Daftar karyawan belum dapat dimuat. Silakan coba kembali.");
  const staf = (data ?? []) as Staf[];
  const jadwal = (jd ?? { outlets: [], jadwal: [], aktif: [] }) as DataJadwalMitra;
  const paths = staf.map((x) => x.foto_path).filter((x): x is string => !!x);
  const { data: urls } = paths.length ? await supabase.storage.from("profil").createSignedUrls(paths, 3600) : { data: [] };
  const foto = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
  const perOutlet = [...new Map(staf.map((x) => [x.outlet_id, x.outlet])).entries()];

  const kunci = (outlet: string, nama: string) => `${outlet}|${nama.trim().toLowerCase()}`;
  const aktif = new Set(jadwal.aktif.map((a) => kunci(a.outlet_id, a.nama)));
  const hariIniPer = new Map<string, JadwalMitra[]>();
  const berikutPer = new Map<string, JadwalMitra>();
  for (const r of jadwal.jadwal) {
    const k = kunci(r.outlet_id, r.nama);
    if (r.tanggal === today) hariIniPer.set(k, [...(hariIniPer.get(k) ?? []), r]);
    else if (r.tanggal > today && r.shift && !["libur", "izin", "sakit"].includes(r.status) && !berikutPer.has(k)) berikutPer.set(k, r);
  }
  const jumlahPeran = (p: string) => staf.filter((x) => peranUtama(x.peran) === p).length;
  const berfoto = staf.filter((x) => x.foto_path).length;
  const bertugas = staf.filter((x) => aktif.has(kunci(x.outlet_id, x.nama)));
  const shiftHariIni = new Set(jadwal.jadwal.filter((r) => r.tanggal === today && r.shift).map((r) => kunci(r.outlet_id, r.nama))).size;
  const fotoDari = (x: Staf) => (x.foto_path ? foto.get(x.foto_path) ?? null : null);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-kopi-900 via-kopi-700 to-matur-700 p-5 text-white sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Users size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">Tim Outlet</h1>
            <p className="text-sm text-white/75">{perOutlet.map(([, n]) => n).join(" · ") || "Outlet Anda"} · data karyawan hanya untuk dilihat</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Statistik ikon={<Users size={15} />} label="Anggota tim" nilai={`${staf.length} orang`} catatan={["spv", "kasir", "barista"].map((p) => (jumlahPeran(p) ? `${jumlahPeran(p)} ${PERAN[p].label.split(" ")[0]}` : "")).filter(Boolean).join(" · ") || "-"} />
          <Statistik ikon={<Zap size={15} />} label="Bertugas sekarang" nilai={`${bertugas.length} orang`} catatan="sudah absen masuk" />
          <Statistik ikon={<CalendarClock size={15} />} label="Shift hari ini" nilai={`${shiftHariIni} orang`} catatan="sesuai jadwal terbit" />
          <Statistik ikon={<Camera size={15} />} label="Foto profil" nilai={`${berfoto}/${staf.length}`} catatan={berfoto === staf.length ? "lengkap ✓" : "belum lengkap"} />
        </div>
        {bertugas.length > 0 && (
          <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/15">
            <div className="flex -space-x-2">
              {bertugas.slice(0, 6).map((x) => (
                <Avatar key={x.id} url={fotoDari(x)} nama={x.nama} className="size-9 rounded-full ring-2 ring-kopi-900" />
              ))}
            </div>
            <p className="min-w-0 text-xs text-white/90">
              <span className="font-semibold text-emerald-300">● Sedang bertugas:</span> {bertugas.map((x) => x.nama).join(", ")}
            </p>
          </div>
        )}
      </section>

      {!staf.length && (
        <div className="rounded-3xl border border-dashed border-matur-300 bg-white py-12 text-center">
          <Image src="/mascot/karyawan.png" alt="" width={72} height={72} className="mx-auto rounded-2xl opacity-80" />
          <p className="mt-3 font-semibold text-kopi-900">Belum ada karyawan terdaftar</p>
          <p className="text-sm text-stone-500">Karyawan muncul di sini setelah HRD menugaskannya ke outlet Anda.</p>
        </div>
      )}

      {perOutlet.map(([id, nama]) => {
        const list = staf.filter((x) => x.outlet_id === id).sort((a, b) => Number(aktif.has(kunci(b.outlet_id, b.nama))) - Number(aktif.has(kunci(a.outlet_id, a.nama))) || "spv kasir barista".indexOf(peranUtama(a.peran)) - "spv kasir barista".indexOf(peranUtama(b.peran)));
        return (
          <section key={id} className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <h2 className="text-lg font-bold text-kopi-900">{nama}</h2>
              <span className="rounded-full bg-matur-50 px-2.5 py-0.5 text-xs font-semibold text-kopi-700">{list.length} orang</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((x) => {
                const p = PERAN[peranUtama(x.peran)];
                const k = kunci(x.outlet_id, x.nama);
                const sedang = aktif.has(k);
                const rows = hariIniPer.get(k) ?? [];
                const utama = rows.find((r) => r.shift) ?? rows[0];
                const absen = rows.filter((r) => r.masuk_at).sort((a, b) => (b.masuk_at ?? "").localeCompare(a.masuk_at ?? ""))[0];
                const st = utama ? statusJadwalMitra(absen && !utama.masuk_at ? absen : utama) : null;
                const lanjut = berikutPer.get(k);
                const lama = lamaBergabung(x.tgl_masuk, today);
                return (
                  <article key={x.id} className="group relative overflow-hidden rounded-3xl border border-matur-100 bg-white shadow-sm transition hover:shadow-md">
                    <div className={`h-1.5 bg-gradient-to-r ${p.strip}`} aria-hidden />
                    <div className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <Avatar url={fotoDari(x)} nama={x.nama} className="size-16 rounded-2xl ring-1 ring-matur-100" />
                          {sedang && <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-500 ring-2 ring-white" title="Sedang bertugas" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-bold capitalize leading-tight text-kopi-900">{x.nama.toLowerCase()}</p>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.warna}`}>{p.label}</span>
                          {lama && <p className="mt-1 text-[11px] text-stone-500">{lama}</p>}
                          {!x.foto_path && <p className="mt-1 text-[11px] text-amber-700">Foto profil belum dipasang</p>}
                        </div>
                      </div>

                      <div className={`rounded-2xl px-3 py-2 text-xs ${sedang ? "bg-emerald-50 text-emerald-900" : "bg-stone-50 text-stone-700"}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Hari ini</p>
                        {sedang ? (
                          <p className="font-semibold">● Sedang bertugas{absen?.shift ? ` · ${absen.shift} ${jamShift(absen)}` : absen?.status === "tanpa_jadwal" ? " · masuk tanpa jadwal" : ""}</p>
                        ) : utama ? (
                          <p className="flex flex-wrap items-center gap-1.5">
                            {utama.shift && <span className="font-semibold">{utama.shift} {jamShift(utama)}</span>}
                            {st && <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${st.warna}`}>{st.teks}</span>}
                          </p>
                        ) : (
                          <p className="text-stone-500">Tidak ada jadwal</p>
                        )}
                        {absen && (
                          <p className="mt-1 text-[11px] opacity-80">
                            Absen masuk {jamWib(absen.masuk_at!)}
                            {absen.telat_menit > 0 ? ` (telat ${absen.telat_menit} mnt)` : ""}
                            {absen.pulang_at ? ` · pulang ${jamWib(absen.pulang_at)}` : " · belum absen pulang"}
                          </p>
                        )}
                        {!absen && utama?.shift && !["libur", "izin", "sakit"].includes(utama.status) && (
                          <p className="mt-1 text-[11px] text-stone-500">Belum absen masuk</p>
                        )}
                        {lanjut && (
                          <p className="mt-1 text-[11px] text-stone-500">
                            Shift berikutnya: <b className="text-kopi-700">{tglPendek(lanjut.tanggal)}</b> · {lanjut.shift} {jamShift(lanjut)}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <DataTertutup id={x.id} jenis="wa" samaran={samarkan(x.no_wa)} />
                        <DataTertutup id={x.id} jenis="alamat" samaran={x.alamat?.trim() ? "•••••• •••••• ••••" : null} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-matur-50 motion-reduce:animate-none" aria-label="Menyiapkan jadwal shift" />}>
        <MitraJadwal tanggal={sp.mitra_tanggal} outlet={sp.mitra_outlet} />
      </Suspense>
    </div>
  );
}

function Statistik({ ikon, label, nilai, catatan }: { ikon: React.ReactNode; label: string; nilai: string; catatan: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
        {ikon}
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold tabular-nums">{nilai}</p>
      <p className="truncate text-[11px] text-white/60">{catatan}</p>
    </div>
  );
}

function Avatar({ url, nama, className }: { url: string | null; nama: string; className: string }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element -- foto profil dari Storage bertanda tangan
    return <img src={url} alt={nama} className={`${className} bg-matur-50 object-cover`} />;
  const inisial = nama.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return <span className={`${className} grid shrink-0 place-items-center bg-gradient-to-br from-matur-100 to-amber-200 text-lg font-extrabold text-matur-700`} aria-label={nama}>{inisial}</span>;
}
