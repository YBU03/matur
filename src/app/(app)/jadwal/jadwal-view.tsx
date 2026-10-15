"use client";

import { hariLibur, rekapLibur } from "@/lib/jadwal/hari-libur";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { defaultScope, resolveGenerateRange, type GenerateScope } from "@/lib/jadwal/range";
import { eachDate, hariIni, monthLabel, monthRange, monthWeeks, shiftMonth, weekdayIndex, WEEKDAY_LABELS } from "@/lib/jadwal/waktu";
import type { AturanSdm, Izin, Jadwal, Shift, Staf } from "@/lib/sdm";
import { Modal } from "@/components/confirm-edit";
import {
  aturJatahLibur,
  aturSdm,
  batalIzinAtasan,
  catatIzinStaf,
  generateJadwal,
  hapusDraft,
  hapusJadwal,
  isiShiftStandar,
  simpanShift,
  putusIzin,
  tambahJadwal,
  terbitkanJadwal,
  ubahJadwal,
  type Result,
} from "@/lib/sdm-actions";

type Props = {
  outlets: { id: string; nama: string }[];
  outlet: { id: string; nama: string; jam: string | null };
  bulan: string;
  tab: string;
  shifts: Shift[];
  staf: Staf[];
  jadwal: Jadwal[];
  izin: Izin[];
  aturan: AturanSdm;
  bisaAturan: boolean;
};

const JENIS_IZIN: Record<string, string> = { izin: "Izin", libur: "Libur", sakit: "Sakit" };
const namaDepan = (n: string) => n.split(" ")[0];

export function JadwalView(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result & { kurang?: { tanggal: string; shift: string; ada: number; butuh: number }[] } | null>(null);
  const href = (q: Record<string, string>) => `/jadwal?${new URLSearchParams({ outlet: p.outlet.id, bulan: p.bulan, ...(p.tab !== "kalender" ? { tab: p.tab } : {}), ...q })}`;
  const jalankan = (f: () => Promise<Result & { kurang?: { tanggal: string; shift: string; ada: number; butuh: number }[] }>) =>
    start(async () => {
      const r = await f();
      setMsg(r);
      router.refresh();
    });

  const tabs = [
    { id: "kalender", label: "Kalender" },
    { id: "shift", label: `Shift (${p.shifts.filter((s) => s.aktif).length})` },
    { id: "staf", label: `Staf (${p.staf.length})` },
    ...(p.bisaAturan ? [{ id: "aturan", label: "Aturan" }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Jadwal Shift</h1>
        <p className="text-sm text-stone-500">Susun draft otomatis, periksa & ubah, lalu terbitkan agar terlihat oleh kasir & barista.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {p.outlets.length > 1 && (
          <select value={p.outlet.id} onChange={(e) => router.push(`/jadwal?outlet=${e.target.value}&bulan=${p.bulan}`)} className="rounded-lg border bg-white px-3 py-2 text-sm">
            {p.outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center rounded-lg border bg-white text-sm">
          <Link href={href({ bulan: shiftMonth(p.bulan, -1) })} className="px-3 py-2 hover:bg-matur-50" aria-label="Bulan sebelumnya">‹</Link>
          <span className="min-w-32 text-center font-semibold capitalize">{monthLabel(p.bulan)}</span>
          <Link href={href({ bulan: shiftMonth(p.bulan, 1) })} className="px-3 py-2 hover:bg-matur-50" aria-label="Bulan berikutnya">›</Link>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-matur-200">
        {tabs.map((t) => (
          <Link key={t.id} href={href({ tab: t.id })} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${p.tab === t.id ? "border-matur-500 text-kopi-900" : "border-transparent text-stone-500"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
          {msg.error ?? msg.ok}
          {!!msg.kurang?.length && (
            <ul className="mt-1 list-inside list-disc text-amber-800">
              {msg.kurang.slice(0, 8).map((k) => (
                <li key={k.tanggal + k.shift}>
                  {k.tanggal} · {k.shift}: {k.ada}/{k.butuh} orang
                </li>
              ))}
              {msg.kurang.length > 8 && <li>dan {msg.kurang.length - 8} lainnya (tanda merah di kalender)</li>}
            </ul>
          )}
        </div>
      )}
      {p.tab === "shift" ? (
        <ShiftTab {...p} pending={pending} jalankan={jalankan} />
      ) : p.tab === "staf" ? (
        <StafTab {...p} pending={pending} jalankan={jalankan} />
      ) : p.tab === "aturan" && p.bisaAturan ? (
        <AturanTab aturan={p.aturan} pending={pending} jalankan={jalankan} />
      ) : (
        <Kalender {...p} pending={pending} jalankan={jalankan} />
      )}
    </div>
  );
}

type Aksi = { pending: boolean; jalankan: (f: () => Promise<Result>) => void };

function Kalender(p: Props & Aksi) {
  const today = hariIni();
  const [scope, setScope] = useState<GenerateScope>(defaultScope(p.bulan, today));
  const [minggu, setMinggu] = useState(1);
  const [tambah, setTambah] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ j: Jadwal; shiftId: string; penggunaId: string } | null>(null);
  const [izinAksi, setIzinAksi] = useState<{ i: Izin; alasan: string } | null>(null);
  const aktif = p.shifts.filter((s) => s.aktif);
  const { start, end } = monthRange(p.bulan);
  const dates = eachDate(start, end);
  const nama = new Map(p.staf.map((s) => [s.id, s.nama]));
  const byCell = new Map<string, Jadwal[]>();
  for (const j of p.jadwal) {
    const k = `${j.tanggal}|${j.shift_id}`;
    byCell.set(k, [...(byCell.get(k) ?? []), j]);
  }
  const izinHari = new Map<string, Izin[]>();
  for (const i of p.izin) izinHari.set(i.tanggal, [...(izinHari.get(i.tanggal) ?? []), i]);
  const draft = p.jadwal.filter((j) => j.status === "draft").length;
  // jadwal bulan ini sudah diterbitkan (tanpa draft): tambahan orang langsung ikut terbit
  const sudahTerbit = draft === 0 && p.jadwal.some((j) => j.status === "terbit");
  const namaShift = new Map(p.shifts.map((x) => [x.id, x.nama]));
  // hari libur gaya Makaryo: staf tanpa shift pada hari yang sudah dijadwalkan (bukan izin/sakit)
  const libur = hariLibur(p.staf.map((x) => x.id), p.jadwal, p.izin);
  const rekap = rekapLibur(p.staf.map((x) => x.id), p.jadwal, p.izin);
  const range = resolveGenerateRange({ month: p.bulan, scope, weekIndex: minggu, today });
  const shiftLama = new Set(p.jadwal.map((j) => j.shift_id).filter((id) => !aktif.some((s) => s.id === id)));
  const tampilShift = [...aktif, ...p.shifts.filter((s) => shiftLama.has(s.id))];

  if (!p.shifts.length)
    return (
      <p className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Outlet ini belum punya shift. Buka tab <Link className="font-semibold underline" href={`/jadwal?outlet=${p.outlet.id}&bulan=${p.bulan}&tab=shift`}>Shift</Link> untuk mengaturnya.
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-matur-200 bg-white p-3">
        <label className="text-sm">
          <span className="block text-xs text-stone-500">Cakupan susun otomatis</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as GenerateScope)} className="mt-1 rounded-lg border px-2 py-2">
            <option value="sisa-bulan">Sisa bulan (mulai hari ini)</option>
            <option value="bulan">Satu bulan penuh</option>
            <option value="minggu-ini">Minggu ini</option>
            <option value="minggu">Minggu ke-…</option>
          </select>
        </label>
        {scope === "minggu" && (
          <select value={minggu} onChange={(e) => setMinggu(Number(e.target.value))} className="rounded-lg border px-2 py-2 text-sm">
            {monthWeeks(p.bulan).map((w) => (
              <option key={w.index} value={w.index}>
                Minggu {w.index} ({w.start.slice(8)}–{w.end.slice(8)})
              </option>
            ))}
          </select>
        )}
        <button
          disabled={p.pending || !range}
          onClick={() => range && p.jalankan(() => generateJadwal(p.outlet.id, range.start, range.end))}
          className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {p.pending ? "Memproses…" : "Susun draft otomatis"}
        </button>
        <button
          disabled={p.pending || !draft}
          onClick={() => confirm(`Terbitkan ${draft} jadwal draft bulan ini? Staf akan melihatnya.`) && p.jalankan(() => terbitkanJadwal(p.outlet.id, start, end))}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Terbitkan{draft ? ` (${draft})` : ""}
        </button>
        {!!draft && (
          <button disabled={p.pending} onClick={() => confirm("Hapus semua draft bulan ini?") && p.jalankan(() => hapusDraft(p.outlet.id, start, end))} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700">
            Hapus draft
          </button>
        )}
        {!range && <p className="w-full text-xs text-stone-500">Cakupan ini tidak berlaku untuk bulan yang dipilih.</p>}
      </div>
      <p className="flex flex-wrap gap-3 text-xs text-stone-500">
        <span><span className="inline-block h-3 w-3 rounded border border-green-600 bg-green-50 align-middle" /> terbit</span>
        <span><span className="inline-block h-3 w-3 rounded border border-dashed border-matur-500 bg-matur-50 align-middle" /> draft</span>
        <span><span className="inline-block h-3 w-3 rounded bg-red-100 align-middle" /> kurang orang</span>
        <span>Ketuk nama untuk ubah shift / ganti orang / libur / hapus · ketuk izin untuk setujui atau batalkan · + untuk menambah{sudahTerbit ? " (langsung terbit)" : " (sebagai draft)"}.</span>
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {Array.from({ length: weekdayIndex(dates[0]) }).map((_, i) => (
          <div key={`k${i}`} className="hidden lg:block" />
        ))}
        {dates.map((d) => {
          const izinD = izinHari.get(d) ?? [];
          return (
            <div key={d} className={`rounded-xl border bg-white p-2 text-xs ${d === today ? "border-matur-500 ring-2 ring-matur-200" : "border-matur-100"}`}>
              <p className="mb-1 font-bold text-kopi-900">
                {WEEKDAY_LABELS[weekdayIndex(d)]} {Number(d.slice(8))}
              </p>
              {tampilShift.map((s) => {
                const isi = byCell.get(`${d}|${s.id}`) ?? [];
                const kurang = s.aktif && isi.length < s.min_orang;
                const k = `${d}|${s.id}`;
                const calon = p.staf.filter((st) => !isi.some((j) => j.pengguna_id === st.id) && !izinD.some((i) => i.pengguna_id === st.id && i.status === "disetujui"));
                return (
                  <div key={s.id} className={`mb-1 rounded-lg p-1 ${kurang ? "bg-red-50" : ""}`}>
                    <p className="flex items-center justify-between text-[11px] text-stone-500">
                      <span>
                        {s.nama} {s.jam_mulai}
                        {!s.aktif && " (nonaktif)"}
                      </span>
                      <span className={kurang ? "font-bold text-red-600" : ""}>
                        {isi.length}/{s.min_orang}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {isi.map((j) => (
                        <button
                          key={j.id}
                          disabled={p.pending}
                          title={`${nama.get(j.pengguna_id) ?? "?"} · ${j.status} — ketuk untuk ubah`}
                          onClick={() => setEdit({ j, shiftId: j.shift_id, penggunaId: j.pengguna_id })}
                          className={`rounded-md border px-1.5 py-0.5 ${j.status === "terbit" ? "border-green-600 bg-green-50 text-green-900" : "border-dashed border-matur-500 bg-matur-50"}`}
                        >
                          {namaDepan(nama.get(j.pengguna_id) ?? "?")}
                        </button>
                      ))}
                      {tambah === k ? (
                        <select
                          autoFocus
                          defaultValue=""
                          onBlur={() => setTambah(null)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTambah(null);
                            if (v) p.jalankan(() => tambahJadwal(p.outlet.id, s.id, v, d, sudahTerbit));
                          }}
                          className="max-w-full rounded border px-1 py-0.5"
                        >
                          <option value="">Pilih…</option>
                          {calon.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nama}
                            </option>
                          ))}
                        </select>
                      ) : (
                        s.aktif && !!calon.length && (
                          <button onClick={() => setTambah(k)} className="rounded-md border border-stone-300 px-1.5 py-0.5 text-stone-500" aria-label="Tambah orang">
                            +
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
              {!!libur.get(d)?.length && (
                <p className="mt-1 text-[11px]">
                  <span className="mr-1 inline-block rounded bg-emerald-50 px-1 font-semibold text-emerald-800">🌴 Libur:</span>
                  {libur.get(d)!.map((id) => namaDepan(nama.get(id) ?? "?")).join(", ")}
                </p>
              )}
              {!!izinD.length && (
                <p className="mt-1 text-[11px] text-stone-500">
                  {izinD.map((i) => (
                    <button key={i.id} onClick={() => setIzinAksi({ i, alasan: "" })} className={`mr-1 mb-0.5 inline-block rounded px-1 ${i.status === "disetujui" ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800 ring-1 ring-amber-300"}`}>
                      {JENIS_IZIN[i.jenis]}: {namaDepan(nama.get(i.pengguna_id) ?? "?")}
                      {i.status === "menunggu" && " ?"}
                    </button>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {p.jadwal.length > 0 && (
        <section className="rounded-2xl border border-matur-200 bg-white p-3">
          <h3 className="mb-1 font-bold">🌴 Jadwal libur bulan ini</h3>
          <p className="mb-2 text-xs text-stone-500">Hari tanpa shift pada tanggal yang sudah dijadwalkan (izin/sakit dihitung terpisah). Jatah libur diatur di tab Staf.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="py-1">Staf</th>
                  <th>Hari libur</th>
                  <th className="text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {p.staf.map((st) => {
                  const xs = rekap.get(st.id) ?? [];
                  return (
                    <tr key={st.id} className="border-t align-top">
                      <td className="whitespace-nowrap py-1.5 pr-3 font-medium">{st.nama}</td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {xs.map((t) => (
                            <span key={t} className="rounded bg-emerald-50 px-1.5 text-xs text-emerald-800">
                              {WEEKDAY_LABELS[weekdayIndex(t)]} {Number(t.slice(8))}
                            </span>
                          ))}
                          {!xs.length && <span className="text-xs text-stone-400">—</span>}
                        </div>
                      </td>
                      <td className="text-right tabular-nums">{xs.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {edit && (
        <Modal title={`Ubah jadwal · ${nama.get(edit.j.pengguna_id) ?? "?"} · ${WEEKDAY_LABELS[weekdayIndex(edit.j.tanggal)]} ${Number(edit.j.tanggal.slice(8))}`}>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-stone-500">
              Sekarang: <b>{namaShift.get(edit.j.shift_id)}</b> · {edit.j.status === "terbit" ? "sudah terbit (staf melihat perubahan)" : "draft"}
            </p>
            <label className="block font-semibold">
              Pindah ke shift
              <div className="mt-1 flex flex-wrap gap-1.5">
                {aktif.map((x) => (
                  <button key={x.id} onClick={() => setEdit({ ...edit, shiftId: x.id })} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${edit.shiftId === x.id ? "border-kopi-900 bg-kopi-900 text-white" : "border-stone-300"}`}>
                    {x.nama} {x.jam_mulai}–{x.jam_selesai}
                  </button>
                ))}
              </div>
            </label>
            <label className="block font-semibold">
              Orang yang bertugas (ganti / pengganti)
              <select value={edit.penggunaId} onChange={(e) => setEdit({ ...edit, penggunaId: e.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal">
                {p.staf.map((st) => {
                  const izinSt = (izinHari.get(edit.j.tanggal) ?? []).find((i) => i.pengguna_id === st.id && i.status === "disetujui");
                  const lain = p.jadwal.filter((x) => x.tanggal === edit.j.tanggal && x.pengguna_id === st.id && x.id !== edit.j.id).map((x) => namaShift.get(x.shift_id));
                  return (
                    <option key={st.id} value={st.id} disabled={!!izinSt}>
                      {st.nama}
                      {izinSt ? ` — ${JENIS_IZIN[izinSt.jenis].toLowerCase()}` : lain.length ? ` — sudah di shift ${lain.join(", ")}` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => setEdit(null)} className="rounded-lg border px-4 py-2">
                Batal
              </button>
              <button
                disabled={p.pending || (edit.shiftId === edit.j.shift_id && edit.penggunaId === edit.j.pengguna_id)}
                onClick={() => {
                  const e = edit;
                  setEdit(null);
                  p.jalankan(() => ubahJadwal(e.j.id, e.shiftId, e.penggunaId));
                }}
                className="rounded-lg bg-kopi-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                Simpan perubahan
              </button>
            </div>
            <div className="border-t pt-3">
              <p className="mb-1.5 text-xs font-semibold text-stone-500">Atau</p>
              <div className="flex flex-wrap gap-1.5">
                {(["libur", "izin", "sakit"] as const).map((jn) => (
                  <button
                    key={jn}
                    disabled={p.pending}
                    onClick={() => {
                      const e = edit;
                      if (!confirm(`Tandai ${nama.get(e.j.pengguna_id)} ${JENIS_IZIN[jn].toLowerCase()} pada ${e.j.tanggal}? Semua shift orang itu di tanggal tsb dilepas.`)) return;
                      setEdit(null);
                      p.jalankan(() => catatIzinStaf(p.outlet.id, e.j.pengguna_id, jn, e.j.tanggal, jn === "libur" ? "" : `Dicatat HRD/SPV`));
                    }}
                    className="rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700"
                  >
                    🌴 Tandai {JENIS_IZIN[jn].toLowerCase()}
                  </button>
                ))}
                <button
                  disabled={p.pending}
                  onClick={() => {
                    const e = edit;
                    if (!confirm(`Hapus ${nama.get(e.j.pengguna_id)} dari ${namaShift.get(e.j.shift_id)} ${e.j.tanggal}?`)) return;
                    setEdit(null);
                    p.jalankan(() => hapusJadwal(e.j.id));
                  }}
                  className="ml-auto rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                >
                  🗑 Hapus dari jadwal
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {izinAksi && (
        <Modal title={`${JENIS_IZIN[izinAksi.i.jenis]} · ${nama.get(izinAksi.i.pengguna_id) ?? "?"} · ${izinAksi.i.tanggal}`}>
          <div className="space-y-3 text-sm">
            <p>
              Status: <b>{izinAksi.i.status === "menunggu" ? "menunggu persetujuan" : "disetujui"}</b>
              {izinAksi.i.alasan && <span className="block text-xs text-stone-500">Alasan: {izinAksi.i.alasan}</span>}
            </p>
            {izinAksi.i.status === "menunggu" && (
              <input value={izinAksi.alasan} onChange={(e) => setIzinAksi({ ...izinAksi, alasan: e.target.value })} placeholder="Alasan bila ditolak" className="w-full rounded-lg border px-3 py-2" />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => setIzinAksi(null)} className="rounded-lg border px-4 py-2">
                Tutup
              </button>
              {izinAksi.i.status === "menunggu" ? (
                <>
                  <button
                    disabled={p.pending || !izinAksi.alasan.trim()}
                    onClick={() => {
                      const x = izinAksi;
                      setIzinAksi(null);
                      p.jalankan(() => putusIzin(x.i.id, false, x.alasan));
                    }}
                    className="rounded-lg border border-red-300 px-4 py-2 text-red-700 disabled:opacity-40"
                  >
                    Tolak
                  </button>
                  <button
                    disabled={p.pending}
                    onClick={() => {
                      const x = izinAksi;
                      setIzinAksi(null);
                      p.jalankan(() => putusIzin(x.i.id, true, ""));
                    }}
                    className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white"
                  >
                    Setujui
                  </button>
                </>
              ) : (
                <button
                  disabled={p.pending}
                  onClick={() => {
                    const x = izinAksi;
                    if (!confirm("Batalkan izin/libur ini? Jadwalnya perlu ditambahkan lagi bila orang itu jadi masuk.")) return;
                    setIzinAksi(null);
                    p.jalankan(() => batalIzinAtasan(x.i.id));
                  }}
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-700"
                >
                  Batalkan {JENIS_IZIN[izinAksi.i.jenis].toLowerCase()}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ShiftTab(p: Props & Aksi) {
  const [baru, setBaru] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">
        Jam operasional {p.outlet.nama}: <b>{p.outlet.jam ?? "belum diisi"}</b>. Shift tidak dihapus, cukup dinonaktifkan agar riwayat jadwal tetap utuh. Jam selesai lebih kecil dari jam mulai berarti selesai keesokan hari.
      </p>
      {!p.shifts.length && (
        <button disabled={p.pending} onClick={() => p.jalankan(() => isiShiftStandar(p.outlet.id))} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          Isi 3 shift standar dari jam operasional
        </button>
      )}
      <div className="space-y-2">
        {p.shifts.map((s) => (
          <BarisShift key={s.id + s.jam_mulai + s.jam_selesai + s.min_orang + s.aktif + s.nama} outletId={p.outlet.id} s={s} {...p} />
        ))}
        {baru && <BarisShift outletId={p.outlet.id} s={{ id: "", nama: "", jam_mulai: "08:00", jam_selesai: "16:00", min_orang: 1, urutan: p.shifts.length + 1, aktif: true }} {...p} onDone={() => setBaru(false)} />}
      </div>
      {!baru && (
        <button onClick={() => setBaru(true)} className="rounded-lg border border-matur-300 px-4 py-2 text-sm font-semibold hover:bg-matur-50">
          + Tambah shift
        </button>
      )}
    </div>
  );
}

function BarisShift({ outletId, s, pending, jalankan, onDone }: { outletId: string; s: Shift; onDone?: () => void } & Aksi) {
  const [v, setV] = useState(s);
  const ubah = JSON.stringify(v) !== JSON.stringify(s) || !s.id;
  const cls = "mt-1 w-full rounded-lg border px-2 py-1.5";
  return (
    <div className={`grid grid-cols-2 items-end gap-2 rounded-xl border bg-white p-3 text-sm sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] ${v.aktif ? "border-matur-200" : "border-stone-200 opacity-70"}`}>
      <label className="col-span-2 sm:col-span-1">
        <span className="text-xs text-stone-500">Nama</span>
        <input value={v.nama} onChange={(e) => setV({ ...v, nama: e.target.value })} placeholder="mis. Pagi" className={cls} />
      </label>
      <label>
        <span className="text-xs text-stone-500">Mulai</span>
        <input type="time" value={v.jam_mulai} onChange={(e) => setV({ ...v, jam_mulai: e.target.value })} className={cls} />
      </label>
      <label>
        <span className="text-xs text-stone-500">Selesai</span>
        <input type="time" value={v.jam_selesai} onChange={(e) => setV({ ...v, jam_selesai: e.target.value })} className={cls} />
      </label>
      <label>
        <span className="text-xs text-stone-500">Min. orang</span>
        <input type="number" min={0} max={50} value={v.min_orang} onChange={(e) => setV({ ...v, min_orang: Number(e.target.value) })} className={cls} />
      </label>
      <label className="flex items-center gap-2 pb-2">
        <input type="checkbox" checked={v.aktif} onChange={(e) => setV({ ...v, aktif: e.target.checked })} /> Aktif
      </label>
      <div className="col-span-2 flex gap-2 sm:col-span-1">
        <button
          disabled={pending || !ubah}
          onClick={() => {
            jalankan(() => simpanShift(outletId, { ...v, id: s.id || undefined }));
            onDone?.();
          }}
          className="rounded-lg bg-matur-500 px-3 py-1.5 font-semibold text-white disabled:opacity-40"
        >
          Simpan
        </button>
        {onDone && (
          <button onClick={onDone} className="rounded-lg px-2 text-stone-500">
            Batal
          </button>
        )}
      </div>
    </div>
  );
}

function StafTab(p: Props & Aksi) {
  const jumlah = new Map<string, number>();
  for (const j of p.jadwal) jumlah.set(j.pengguna_id, (jumlah.get(j.pengguna_id) ?? 0) + 1);
  if (!p.staf.length)
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Belum ada kasir/barista aktif di {p.outlet.nama}. Tambahkan lewat menu <Link href="/pengguna" className="font-semibold underline">Akun Kasir & Barista</Link>.
      </p>
    );
  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-500">Jatah libur per minggu dipakai saat menyusun draft. Bawaan perusahaan: {p.aturan.jatah_libur_default} hari/minggu.</p>
      {p.staf.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-matur-200 bg-white p-3 text-sm">
          <div className="min-w-40 flex-1">
            <p className="font-semibold">{s.nama}</p>
            <p className="text-xs capitalize text-stone-500">{s.peran.replaceAll(",", " · ")} · {jumlah.get(s.id) ?? 0} shift bulan ini</p>
          </div>
          <label className="text-xs text-stone-500">
            Libur/minggu{" "}
            <select
              defaultValue={String(s.jatah_libur)}
              disabled={p.pending}
              onChange={(e) => p.jalankan(() => aturJatahLibur(p.outlet.id, s.id, e.target.value === "" ? null : Number(e.target.value)))}
              className="ml-1 rounded-lg border px-2 py-1 text-sm text-stone-900"
            >
              <option value="">Bawaan ({p.aturan.jatah_libur_default})</option>
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} hari
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
    </div>
  );
}

function AturanTab({ aturan, pending, jalankan }: { aturan: AturanSdm } & Aksi) {
  const [v, setV] = useState({ toleransi: aturan.toleransi_telat_menit, jatah: aturan.jatah_libur_default, izinMin: aturan.izin_min_hari, liburDibuka: aturan.libur_mingguan_dibuka });
  const cls = "mt-1 w-full rounded-lg border px-3 py-2";
  return (
    <div className="max-w-lg space-y-3 rounded-2xl border border-matur-200 bg-white p-4 text-sm">
      <p className="text-stone-500">Berlaku untuk semua outlet.</p>
      <label className="block">
        Toleransi telat (menit)
        <input type="number" min={0} max={120} value={v.toleransi} onChange={(e) => setV({ ...v, toleransi: Number(e.target.value) })} className={cls} />
        <span className="text-xs text-stone-500">Absen masuk lewat dari jam mulai + toleransi dihitung telat.</span>
      </label>
      <label className="block">
        Jatah libur bawaan (hari/minggu)
        <input type="number" min={0} max={6} value={v.jatah} onChange={(e) => setV({ ...v, jatah: Number(e.target.value) })} className={cls} />
      </label>
      <label className="block">
        Izin mendadak minimal H-…
        <input type="number" min={0} max={30} value={v.izinMin} onChange={(e) => setV({ ...v, izinMin: Number(e.target.value) })} className={cls} />
        <span className="text-xs text-stone-500">Sakit boleh diajukan untuk hari ini. HRD/SPV tetap bisa mencatat izin kapan saja.</span>
      </label>
      <label className="flex items-start gap-2 rounded-lg bg-matur-50 p-3">
        <input type="checkbox" checked={v.liburDibuka} onChange={(e) => setV({ ...v, liburDibuka: e.target.checked })} className="mt-1" />
        <span>
          <b>Buka pengajuan libur mingguan</b>
          <br />
          <span className="text-xs text-stone-500">Nyalakan saat menyusun jadwal bulan depan, agar staf bisa memilih hari liburnya. Libur yang disetujui menjadi masukan susun otomatis.</span>
        </span>
      </label>
      <button disabled={pending} onClick={() => jalankan(() => aturSdm(v))} className="rounded-lg bg-matur-500 px-4 py-2 font-bold text-white disabled:opacity-50">
        Simpan aturan
      </button>
    </div>
  );
}
