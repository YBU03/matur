"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tanya } from "@/components/dialog-tanya";
import {
  kelolaLaporanLanjut,
  uploadBuktiLaporan,
  bukaBuktiLaporan,
} from "@/lib/laporan-lanjut-actions";
import {
  ringkasBayar,
  rupiahLaporan as rp,
  type HakBayar,
  type Bayar,
  type Meeting,
} from "@/lib/laporan-rekap";
import { namaBulan, type Laporan } from "@/lib/laporan";
export type History = {
  id: string;
  aktor?: string;
  alasan: string;
  created_at: string;
  sebelum: unknown;
  sesudah: unknown;
};
const local = (s: string) =>
  new Date(Date.parse(s) + 7 * 3600000).toISOString().slice(0, 16);
const today = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const cls = "block w-full rounded-xl border border-stone-300 bg-white p-2.5";
export function TindakLanjutView({
  laporan: l,
  hak,
  bayar,
  meetings,
  peserta,
  user,
  pusat,
  bisaMeeting,
  riwayat,
}: {
  laporan: Laporan;
  hak: HakBayar[];
  bayar: Bayar[];
  meetings: Meeting[];
  peserta: { id: string; nama: string }[];
  user: string;
  pusat: boolean;
  bisaMeeting: boolean;
  riwayat: History[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const request = useRef<{ hash: string; id: string } | null>(null);
  const uploaded = useRef<string | null>(null);
  const [msg, setMsg] = useState("");
  const [buktiUrl, setBuktiUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pay, setPay] = useState<{
    id?: string;
    versi?: number;
    key: string;
    jumlah: string;
    pembulatan: string;
    tanggal: string;
    metode: string;
    bukti: string | null;
    alasan: string;
  } | null>(null);
  const [meet, setMeet] = useState<{
    id?: string;
    versi?: number;
    judul: string;
    agenda: string;
    jenis: string;
    waktu: string;
    durasi: string;
    lokasi: string;
    peserta: string[];
    ulang: string;
    alasan: string;
  } | null>(null);
  const [note, setNote] = useState<{
    m: Meeting;
    notulen: string;
    tindak_lanjut: string;
    alasan: string;
  } | null>(null);
  const [reason, setReason] = useState<{
    aksi: string;
    id: string;
    versi: number;
    alasan: string;
  } | null>(null);
  async function send(p: Record<string, unknown>) {
    const hash = JSON.stringify(p);
    if (request.current?.hash !== hash)
      request.current = { hash, id: crypto.randomUUID() };
    const r = await kelolaLaporanLanjut({
      ...p,
      laporan_id: l.id,
      request_id: request.current.id,
    });
    if (r.error) {
      setMsg(r.error);
      return false;
    }
    setMsg(r.ok ?? "Tersimpan");
    request.current = null;
    router.refresh();
    return true;
  }
  function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      setMsg("");
      try {
        await action();
      } catch {
        setMsg(
          "Hasil penyimpanan belum dapat dipastikan. Coba lagi dengan isian yang sama agar tidak tercatat dua kali.",
        );
      } finally {
        busy.current = false;
      }
    });
  }
  const openPay = (h: HakBayar, b?: Bayar) => {
    uploaded.current = null;
    setFile(null);
    setPay({
      id: b?.id,
      versi: b?.versi,
      key: h.key,
      jumlah: b ? String(b.jumlah) : "",
      pembulatan: String(b?.pembulatan ?? 0),
      tanggal: b?.tanggal ?? today(),
      metode: b?.metode ?? "transfer",
      bukti: b?.bukti ?? null,
      alasan: "",
    });
  };
  const openMeet = (m?: Meeting) =>
    setMeet({
      id: m?.id,
      versi: m?.versi,
      judul:
        m?.judul ??
        `Pembahasan ${l.outlet?.nama ?? l.nama_outlet} · ${namaBulan(l.periode)}`,
      agenda: m?.agenda ?? "",
      jenis: m?.jenis ?? "online",
      waktu: m ? local(m.waktu) : "",
      durasi: String(m?.durasi ?? 60),
      lokasi: m?.lokasi ?? "",
      peserta: m?.peserta ?? [user],
      ulang: "1",
      alasan: "",
    });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Pembayaran & Pembahasan Laporan</h1>
      <p>
        {l.outlet?.nama ?? l.nama_outlet} · {namaBulan(l.periode)} ·{" "}
        <Link className="underline" href={`/laporan/${l.id}`}>
          Buka laporan
        </Link>
      </p>
      {msg && (
        <p role="status" className="rounded-xl border bg-amber-50 p-3">
          {msg}
        </p>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Hak & pembayaran aktual</h2>
        {buktiUrl && (
          <p className="rounded-xl bg-sky-50 p-3 text-sm">
            Jika bukti belum terbuka,{" "}
            <a
              className="font-semibold underline"
              href={buktiUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              klik untuk membuka bukti
            </a>
            . Tautan berlaku singkat; gunakan Lihat bukti lagi jika kedaluwarsa.
          </p>
        )}
        <p className="text-sm text-stone-500">
          Belum tercatat berarti belum ada catatan pembayaran di fitur ini,
          bukan kesimpulan bahwa pembayaran lama belum dilakukan. Akunting dapat
          memasukkan pembayaran terdahulu dengan tanggal sebenarnya dan
          buktinya. Tidak menambah biaya operasional.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {hak.map((h) => {
            const s = ringkasBayar(h, bayar);
            return (
              <article
                key={h.key}
                className="rounded-2xl border bg-white p-4 space-y-2"
              >
                <h3 className="font-bold">{h.nama}</h3>
                <p className="text-sm text-stone-500">
                  {h.jenis} · {[h.bank, h.rekening].filter(Boolean).join(" ")}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt>Hak sesuai laporan</dt>
                  <dd className="text-right font-semibold">
                    {rp(Number(h.jumlah))}
                  </dd>
                  <dt>Pembayaran tercatat</dt>
                  <dd className="text-right">{rp(s.dibayar)}</dd>
                  {s.pembulatan !== 0 && (
                    <>
                      <dt>Penyesuaian pembulatan</dt>
                      <dd className="text-right">{rp(s.pembulatan)}</dd>
                    </>
                  )}
                  <dt>Sisa pencatatan</dt>
                  <dd className="text-right">{rp(s.sisa)}</dd>
                </dl>
                <p
                  className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${s.status === "Lunas" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
                >
                  {s.status}
                </p>
                {s.perluCek && (
                  <p className="text-red-700">
                    Hak sumber berbeda dari catatan pembayaran. Minta Akunting
                    memeriksa sebelum menambah pembayaran.
                  </p>
                )}
                {pusat && (
                  <button
                    disabled={pending}
                    className="block rounded-lg border px-3 py-2 font-semibold"
                    onClick={() => openPay(h)}
                  >
                    + Catat pembayaran
                  </button>
                )}
              </article>
            );
          })}
        </div>
        {pay && (
          <form
            className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const h = hak.find((h) => h.key === pay.key)!;
                if (
                  !(await tanya(
                    `Simpan pembayaran ${rp(Number(pay.jumlah))} untuk ${h.nama}, tanggal ${pay.tanggal}, penyesuaian pembulatan ${rp(Number(pay.pembulatan))}?`,
                    { judul: "Konfirmasi pembayaran", ya: "Simpan catatan" },
                  ))
                )
                  return;
                let path = pay.bukti;
                if (file && !uploaded.current) {
                  const fd = new FormData();
                  fd.set("file", file);
                  fd.set("laporan_id", l.id);
                  const r = await uploadBuktiLaporan(fd);
                  if (r.error) {
                    setMsg(r.error);
                    return;
                  }
                  uploaded.current = r.path ?? null;
                }
                path = uploaded.current ?? path;
                if (
                  await send({
                    aksi: "bayar",
                    id: pay.id ?? null,
                    versi: pay.versi ?? null,
                    penerima_key: pay.key,
                    hak_snapshot: h,
                    jumlah: Number(pay.jumlah),
                    pembulatan: Number(pay.pembulatan),
                    tanggal: pay.tanggal,
                    metode: pay.metode,
                    bukti: path,
                    alasan: pay.alasan,
                  })
                ) {
                  setPay(null);
                  setFile(null);
                  uploaded.current = null;
                }
              });
            }}
          >
            <h3 className="font-bold sm:col-span-2">
              {pay.id ? "Koreksi" : "Catat"} pembayaran —{" "}
              {hak.find((h) => h.key === pay.key)?.nama}
            </h3>
            <label>
              Nominal
              <input
                required
                type="number"
                min="0.01"
                max="1000000000000"
                step="any"
                className={cls}
                value={pay.jumlah}
                onChange={(e) => setPay({ ...pay, jumlah: e.target.value })}
              />
            </label>
            <label>
              Penyesuaian pembulatan (opsional, maks. ±Rp1)
              <input
                type="number"
                min="-1"
                max="1"
                step="any"
                required
                className={cls}
                value={pay.pembulatan}
                onChange={(e) => setPay({ ...pay, pembulatan: e.target.value })}
              />
              <span className="text-xs text-stone-500">
                Jumlah transfer dikurangi penyesuaian ini menjadi alokasi
                terhadap hak. Isi hanya jika ada pembulatan pembayaran; angka
                sumber laporan tetap.
              </span>
            </label>
            <label>
              Tanggal pembayaran
              <input
                required
                type="date"
                max={today()}
                className={cls}
                value={pay.tanggal}
                onChange={(e) => setPay({ ...pay, tanggal: e.target.value })}
              />
            </label>
            <label>
              Metode
              <select
                className={cls}
                value={pay.metode}
                onChange={(e) => setPay({ ...pay, metode: e.target.value })}
              >
                <option value="transfer">Transfer</option>
                <option value="tunai">Tunai</option>
              </select>
            </label>
            <label>
              Bukti transfer (JPG/PNG/WebP/PDF ≤5 MB)
              <input
                className={cls}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                required={pay.metode === "transfer" && !pay.bukti && !file}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  uploaded.current = null;
                }}
              />
            </label>
            <label className="sm:col-span-2">
              Catatan / alasan koreksi
              <textarea
                required
                minLength={3}
                maxLength={2000}
                className={cls}
                value={pay.alasan}
                onChange={(e) => setPay({ ...pay, alasan: e.target.value })}
              />
            </label>
            <button
              disabled={pending}
              className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
            >
              {pending ? "Menyimpan…" : "Simpan pembayaran"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setPay(null)}
            >
              Batal
            </button>
          </form>
        )}
        <div className="overflow-x-auto rounded-2xl border bg-white p-4">
          <h3 className="mb-2 font-bold">Riwayat pembayaran</h3>
          {!bayar.length ? (
            <p className="text-sm">Belum ada catatan pembayaran aktual.</p>
          ) : (
            <table className="w-full min-w-[650px] text-sm">
              <thead className="text-left">
                <tr>
                  {[
                    "Tanggal",
                    "Penerima",
                    "Jumlah",
                    "Status / catatan",
                    "Bukti / tindakan",
                  ].map((x) => (
                    <th key={x} className="p-2">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bayar.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-2">
                      {b.tanggal}
                      <p>{b.metode}</p>
                    </td>
                    <td className="p-2">{b.hak_snapshot.nama}</td>
                    <td className="p-2">
                      {rp(Number(b.jumlah))}
                      {Number(b.pembulatan ?? 0) !== 0 && (
                        <p className="text-xs">
                          Pembulatan {rp(Number(b.pembulatan))}
                        </p>
                      )}
                    </td>
                    <td className="p-2">
                      {b.status}
                      <p className="text-xs">{b.catatan}</p>
                    </td>
                    <td className="p-2 space-x-3">
                      {b.bukti && (
                        <button
                          disabled={pending}
                          className="underline"
                          onClick={() =>
                            run(async () => {
                              const r = await bukaBuktiLaporan(b.bukti!);
                              if (r.url) {
                                setBuktiUrl(r.url);
                                window.open(
                                  r.url,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                              } else
                                setMsg(r.error ?? "Bukti belum dapat dibuka");
                            })
                          }
                        >
                          Lihat bukti
                        </button>
                      )}
                      {pusat && b.status === "tercatat" && (
                        <>
                          <button
                            disabled={pending}
                            className="underline"
                            onClick={() =>
                              openPay(
                                hak.find((h) => h.key === b.penerima_key) ??
                                  b.hak_snapshot,
                                b,
                              )
                            }
                          >
                            Koreksi
                          </button>
                          <button
                            disabled={pending}
                            className="text-red-700 underline"
                            onClick={() =>
                              setReason({
                                aksi: "batal_bayar",
                                id: b.id,
                                versi: b.versi,
                                alasan: "",
                              })
                            }
                          >
                            Batalkan catatan
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-lg font-bold">
            Meeting pembahasan laporan
          </h2>
          {bisaMeeting && (
            <button
              disabled={pending}
              className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
              onClick={() => openMeet()}
            >
              + {pusat ? "Undang meeting" : "Ajukan pembahasan"}
            </button>
          )}
        </div>
        <p className="text-sm text-stone-500">
          Online atau tatap muka. Usulan perlu disetujui pihak penerima setelah
          waktu dan tautan/lokasi lengkap. Notifikasi dikirim di aplikasi, bukan
          WhatsApp otomatis.
        </p>
        {meet && (
          <form
            className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (
                  !(await tanya(
                    "Kirim usulan jadwal dan notifikasi kepada peserta yang dipilih?",
                  ))
                )
                  return;
                if (
                  await send({
                    aksi: meet.id ? "jadwal" : "meeting",
                    id: meet.id ?? null,
                    versi: meet.versi ?? null,
                    judul: meet.judul,
                    agenda: meet.agenda,
                    jenis: meet.jenis,
                    waktu: new Date(meet.waktu + "+07:00").toISOString(),
                    durasi: Number(meet.durasi),
                    lokasi: meet.lokasi,
                    peserta: meet.peserta,
                    ulang: Number(meet.ulang),
                    alasan: meet.alasan,
                  })
                )
                  setMeet(null);
              });
            }}
          >
            <label className="sm:col-span-2">
              Judul
              <input
                required
                minLength={3}
                maxLength={160}
                className={cls}
                value={meet.judul}
                onChange={(e) => setMeet({ ...meet, judul: e.target.value })}
              />
            </label>
            <label className="sm:col-span-2">
              Agenda / pertanyaan
              <textarea
                required
                minLength={3}
                maxLength={4000}
                className={cls}
                value={meet.agenda}
                onChange={(e) => setMeet({ ...meet, agenda: e.target.value })}
              />
            </label>
            <label>
              Jenis
              <select
                className={cls}
                value={meet.jenis}
                onChange={(e) => setMeet({ ...meet, jenis: e.target.value })}
              >
                <option value="online">Online</option>
                <option value="tatap_muka">Tatap muka</option>
              </select>
            </label>
            <label>
              Waktu (WIB)
              <input
                required
                type="datetime-local"
                className={cls}
                value={meet.waktu}
                onChange={(e) => setMeet({ ...meet, waktu: e.target.value })}
              />
            </label>
            <label>
              Durasi (menit)
              <input
                required
                type="number"
                min={15}
                max={480}
                className={cls}
                value={meet.durasi}
                onChange={(e) => setMeet({ ...meet, durasi: e.target.value })}
              />
            </label>
            <label>
              {meet.jenis === "online"
                ? "Tautan HTTPS (boleh dilengkapi Akunting)"
                : "Lokasi (boleh dilengkapi Akunting)"}
              <input
                type={meet.jenis === "online" ? "url" : "text"}
                maxLength={1000}
                className={cls}
                value={meet.lokasi}
                onChange={(e) => setMeet({ ...meet, lokasi: e.target.value })}
              />
            </label>
            <fieldset className="sm:col-span-2 rounded-xl border p-3">
              <legend>Peserta (pilih Mitra dan Akunting/Pengelola)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {peserta.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={p.id === user}
                      checked={meet.peserta.includes(p.id)}
                      onChange={(e) =>
                        setMeet({
                          ...meet,
                          peserta: e.target.checked
                            ? [...meet.peserta, p.id]
                            : meet.peserta.filter((id) => id !== p.id),
                        })
                      }
                    />
                    {p.nama}
                    {p.id === user ? " (Anda)" : ""}
                  </label>
                ))}
              </div>
            </fieldset>
            {pusat && !meet.id && (
              <>
                <label>
                  Jadwal bulanan (1 = sekali)
                  <input
                    required
                    type="number"
                    min={1}
                    max={12}
                    className={cls}
                    value={meet.ulang}
                    onChange={(e) =>
                      setMeet({ ...meet, ulang: e.target.value })
                    }
                  />
                </label>
                <p className="self-center text-xs text-stone-500">
                  Membuat 1–12 usulan bulanan. Masing-masing perlu persetujuan;
                  tetap merujuk laporan ini.
                </p>
              </>
            )}
            <label className="sm:col-span-2">
              Catatan pengajuan / alasan perubahan
              <textarea
                required
                minLength={3}
                maxLength={2000}
                className={cls}
                value={meet.alasan}
                onChange={(e) => setMeet({ ...meet, alasan: e.target.value })}
              />
            </label>
            <button
              disabled={pending}
              className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
            >
              Kirim usulan
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMeet(null)}
            >
              Batal
            </button>
          </form>
        )}
        <div className="grid gap-3">
          {!meetings.length && (
            <p className="rounded-xl border bg-white p-4">
              Belum ada meeting yang dapat Anda akses.
            </p>
          )}
          {meetings.map((m) => (
            <article
              key={m.id}
              className="space-y-2 rounded-2xl border bg-white p-4"
            >
              <div className="flex flex-wrap gap-2">
                <h3 className="mr-auto font-bold">{m.judul}</h3>
                <span className="rounded-full bg-matur-50 px-3 py-1 text-sm">
                  {m.status.replaceAll("_", " ")}
                </span>
              </div>
              <p>
                {new Date(m.waktu).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                WIB · {m.durasi} menit ·{" "}
                {m.jenis === "online" ? "Online" : "Tatap muka"}
              </p>
              <p className="whitespace-pre-wrap text-sm">{m.agenda}</p>
              <p className="text-xs text-stone-500">
                Usulan dari{" "}
                {peserta.find((p) => p.id === m.diusulkan_oleh)?.nama ??
                  "Peserta terdahulu"}
              </p>
              <p className="text-sm">
                Peserta:{" "}
                {m.peserta
                  .map(
                    (id) =>
                      peserta.find((p) => p.id === id)?.nama ??
                      "Peserta terdahulu",
                  )
                  .join(", ")}
              </p>
              {m.jenis === "online" && /^https:\/\//.test(m.lokasi) ? (
                <a
                  className="inline-block font-semibold text-blue-700 underline"
                  href={m.lokasi}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buka tautan meeting
                </a>
              ) : (
                <p>{m.lokasi || "Tautan/lokasi belum dilengkapi"}</p>
              )}
              {m.notulen && (
                <div className="rounded-xl bg-matur-50 p-3">
                  <h4 className="font-semibold">Notulen</h4>
                  <p className="whitespace-pre-wrap">{m.notulen}</p>
                  <h4 className="mt-2 font-semibold">Tindak lanjut</h4>
                  <p className="whitespace-pre-wrap">
                    {m.tindak_lanjut || "Tidak dicatat"}
                  </p>
                </div>
              )}
              {bisaMeeting && !["selesai", "batal"].includes(m.status) && (
                <div className="flex flex-wrap gap-3 text-sm">
                  {["diajukan", "jadwal_pengganti"].includes(m.status) &&
                    pusat !== m.pengusul_pusat && (
                      <button
                        disabled={pending}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-white"
                        onClick={() =>
                          setReason({
                            aksi: "setuju",
                            id: m.id,
                            versi: m.versi,
                            alasan: "",
                          })
                        }
                      >
                        Setujui jadwal
                      </button>
                    )}
                  <button
                    disabled={pending}
                    className="underline"
                    onClick={() => openMeet(m)}
                  >
                    Usulkan jadwal / lengkapi lokasi
                  </button>
                  {pusat && m.status === "terjadwal" && (
                    <button
                      disabled={pending}
                      className="underline"
                      onClick={() =>
                        setNote({
                          m,
                          notulen: "",
                          tindak_lanjut: "",
                          alasan: "",
                        })
                      }
                    >
                      Isi notulen & selesaikan
                    </button>
                  )}
                  <button
                    disabled={pending}
                    className="text-red-700 underline"
                    onClick={() =>
                      setReason({
                        aksi: "batal_meeting",
                        id: m.id,
                        versi: m.versi,
                        alasan: "",
                      })
                    }
                  >
                    Batalkan meeting
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {note && (
          <form
            className="space-y-3 rounded-2xl border bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (
                  !(await tanya("Simpan notulen dan tandai meeting selesai?"))
                )
                  return;
                if (
                  await send({
                    aksi: "notulen",
                    id: note.m.id,
                    versi: note.m.versi,
                    notulen: note.notulen,
                    tindak_lanjut: note.tindak_lanjut,
                    alasan: note.alasan,
                  })
                )
                  setNote(null);
              });
            }}
          >
            <h3 className="font-bold">Notulen — {note.m.judul}</h3>
            <label>
              Hasil pembahasan
              <textarea
                required
                minLength={3}
                maxLength={12000}
                className={cls}
                value={note.notulen}
                onChange={(e) => setNote({ ...note, notulen: e.target.value })}
              />
            </label>
            <label>
              Keputusan & tindak lanjut
              <textarea
                maxLength={12000}
                className={cls}
                value={note.tindak_lanjut}
                onChange={(e) =>
                  setNote({ ...note, tindak_lanjut: e.target.value })
                }
              />
            </label>
            <label>
              Catatan pencatatan
              <input
                required
                minLength={3}
                maxLength={2000}
                className={cls}
                value={note.alasan}
                onChange={(e) => setNote({ ...note, alasan: e.target.value })}
              />
            </label>
            <button
              disabled={pending}
              className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
            >
              Simpan notulen
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setNote(null)}
              className="ml-3"
            >
              Batal
            </button>
          </form>
        )}
      </section>
      {reason && (
        <form
          className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (
                !(await tanya(
                  `Konfirmasi ${reason.aksi.replaceAll("_", " ")}?`,
                  { bahaya: reason.aksi.startsWith("batal") },
                ))
              )
                return;
              if (await send(reason)) setReason(null);
            });
          }}
        >
          <h3 className="font-bold">{reason.aksi.replaceAll("_", " ")}</h3>
          <label>
            Alasan / catatan
            <textarea
              autoFocus
              required
              minLength={3}
              maxLength={2000}
              className={cls}
              value={reason.alasan}
              onChange={(e) => setReason({ ...reason, alasan: e.target.value })}
            />
          </label>
          <button
            disabled={pending}
            className="rounded-xl bg-kopi-900 px-4 py-2 text-white"
          >
            Konfirmasi
          </button>
          <button
            type="button"
            disabled={pending}
            className="ml-3"
            onClick={() => setReason(null)}
          >
            Batal
          </button>
        </form>
      )}
      <details className="rounded-2xl border bg-white p-4">
        <summary className="cursor-pointer font-semibold">
          Riwayat koreksi & perubahan ({riwayat.length})
        </summary>
        <ul className="divide-y">
          {[...riwayat]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((r) => (
              <li key={r.id} className="py-3">
                <p className="font-semibold">
                  {new Date(r.created_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  WIB ·{" "}
                  {peserta.find((p) => p.id === r.aktor)?.nama ??
                    "Petugas terdahulu"}{" "}
                  · {r.alasan}
                </p>
                <details>
                  <summary className="text-sm underline">
                    Lihat nilai sebelum / sesudah
                  </summary>
                  <RiwayatNilai
                    before={r.sebelum}
                    after={r.sesudah}
                    peserta={peserta}
                  />
                </details>
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}

function RiwayatNilai({
  before,
  after,
  peserta,
}: {
  before: unknown;
  after: unknown;
  peserta: { id: string; nama: string }[];
}) {
  const a = (before ?? {}) as Record<string, unknown>,
    b = (after ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {
    jumlah: "Nominal pembayaran",
    pembulatan: "Penyesuaian pembulatan",
    tanggal: "Tanggal",
    metode: "Metode",
    status: "Status",
    catatan: "Catatan",
    judul: "Judul meeting",
    agenda: "Agenda",
    jenis: "Jenis meeting",
    waktu: "Waktu meeting",
    durasi: "Durasi (menit)",
    lokasi: "Lokasi / tautan",
    peserta: "Peserta",
    notulen: "Notulen",
    tindak_lanjut: "Tindak lanjut",
  };
  const text = (k: string, v: unknown) =>
    v == null
      ? "—"
      : Array.isArray(v)
        ? v
            .map(
              (id) =>
                peserta.find((p) => p.id === id)?.nama ?? "Peserta terdahulu",
            )
            .join(", ")
        : ["jumlah", "pembulatan"].includes(k)
          ? rp(Number(v))
          : k === "waktu"
            ? new Date(String(v)).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              }) + " WIB"
            : String(v).replaceAll("_", " ");
  return (
    <div className="overflow-x-auto">
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Bagian</th>
            <th>Sebelum</th>
            <th>Sesudah</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(fields)
            .filter(([k]) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
            .map(([k, n]) => (
              <tr key={k} className="border-t align-top">
                <td className="p-2">{n}</td>
                <td className="p-2 whitespace-pre-wrap break-words">
                  {text(k, a[k])}
                </td>
                <td className="p-2 whitespace-pre-wrap break-words">
                  {text(k, b[k])}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
