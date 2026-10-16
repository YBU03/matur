"use client";
import {
  Badge,
  Kartu,
  Kosong,
  isian,
  tabKelas,
  tabel,
} from "@/components/ui-halaman";
import { AksesOutletPanel, type AksesOutlet } from "./akses-outlet";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  aturPinPos,
  lihatPinPos,
  aksesPosStaf,
  aturOutletPos,
  perpanjangPos,
  tutupPosLama,
  emailLoginStaf,
  type PosHasil,
} from "@/lib/pos-tim-actions";
import { PerangkatPanel, type Pindah } from "./perangkat";
import { formatRupiah as rp } from "@/lib/format";
type Staf = {
  id: string;
  nama: string;
  email: string;
  status: string;
  kode: string | null;
  ada_pin: boolean;
  tugas: { outlet_id: string; peran: string }[];
};
type Outlet = {
  id: string;
  nama: string;
  awal: number;
  offline: number;
  lat: number | null;
  lng: number | null;
  radius: number;
};
export type PanelData = {
  serah?: {
    id: string;
    sesi_id: string;
    outlet_id: string;
    pic: string;
    sebelum: string | null;
    shift: string;
    mulai_at: string;
    selesai_at: string | null;
    fisik: number;
    seharusnya: number;
    catatan: string;
  }[];
  pusat: boolean;
  perangkat_admin?: boolean;
  pindah?: Pindah[];
  staf: Staf[];
  devices: {
    id: string;
    outlet_id: string;
    nama: string;
    mode?: string;
    status: string;
    created_at: string;
    info_perangkat?: string | null;
    login_nama?: string | null;
    login_at?: string | null;
    operator_nama?: string | null;
    terlihat_at?: string | null;
    antrean_at?: string | null;
    antrean_jumlah?: number | null;
    pembuka_nama?: string | null;
  }[];
  outlets: Outlet[];
  sessions: {
    id: string;
    outlet_id: string;
    nama: string;
    perangkat_id?: string;
    pembuka_nama?: string;
    buka_at: string;
    batas_at: string | null;
    legacy: boolean;
    ditutup_at: string | null;
    status: string;
    pending: number;
    pindah_menunggu?: number;
    aktual: number | null;
    selisih: number | null;
    anggota: { nama: string; gabung_at: string; keluar_at: string | null }[];
  }[];
};
const cls = `mt-1 w-full ${isian}`;
const tombolUtama =
  "rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-kopi-700 disabled:opacity-50";
const tombolGaris =
  "rounded-xl border border-matur-200 bg-white px-4 py-2 text-sm font-semibold text-kopi-900 hover:bg-matur-50 disabled:opacity-50";
const wib = (s: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "—";
const nadaStatus = (v: string) =>
  v === "aktif"
    ? "hijau"
    : v === "menunggu"
      ? "kuning"
      : ["dicabut", "nonaktif", "ditolak", "keluar"].includes(v)
        ? "merah"
        : "netral";
function BadgeSelisih({ nilai }: { nilai: number | null }) {
  if (nilai === null) return <Badge>—</Badge>;
  return (
    <Badge nada={nilai < 0 ? "merah" : nilai > 0 ? "kuning" : "hijau"}>
      {nilai > 0 ? "+" : ""}
      {rp(nilai)}
    </Badge>
  );
}
export function PanelPos({
  data: d,
  role,
  akses,
}: {
  data: PanelData;
  role: string;
  akses: AksesOutlet[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<PosHasil>({});
  const [tab, setTab] = useState(akses.length ? "akses" : "sesi");
  const [cari, setCari] = useState("");
  const run = (f: () => Promise<PosHasil>) =>
    start(async () => {
      try {
        const r = await f();
        setMsg(r);
        if (!r.error) router.refresh();
      } catch {
        setMsg({
          error: "Permintaan belum berhasil. Periksa koneksi lalu coba lagi.",
        });
      }
    });
  const nama = (id: string) =>
    d.outlets.find((o) => o.id === id)?.nama ?? "Outlet";
  return (
    <div className="space-y-4">
      <nav className={tabKelas.wadah} aria-label="Bagian pengaturan POS">
        {[
          ...(akses.length ? [["akses", "🔐 Akun POS Outlet"]] : []),
          ...(d.pusat ? [["aturan", "⏱️ Aturan Shift & Lokasi"]] : []),
          ...(d.perangkat_admin
            ? [["tablet", "📱 Perangkat & Pindah POS"]]
            : []),
          ["sesi", "💵 Kas Harian"],
          ["serah", "🤝 Riwayat Serah Terima"],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={tab === k ? tabKelas.aktif : tabKelas.pasif}
          >
            {l}
          </button>
        ))}
      </nav>
      {(msg.error || msg.ok) && (
        <p
          role="status"
          className={`rounded-xl border p-3 text-sm font-medium ${msg.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {msg.error ? "⚠️ " : "✅ "}
          {msg.error ?? msg.ok}
        </p>
      )}
      {tab === "serah" &&
        (d.serah?.length ? (
          <div className={tabel.bungkus}>
            <table className={tabel.tabel}>
              <thead className={tabel.kepala}>
                <tr>
                  <th className={tabel.th}>Outlet · Shift</th>
                  <th className={tabel.th}>Serah terima</th>
                  <th className={tabel.th}>Mulai</th>
                  <th className={`${tabel.th} text-right`}>Fisik diterima</th>
                  <th className={`${tabel.th} text-right`}>Seharusnya</th>
                  <th className={`${tabel.th} text-right`}>Selisih</th>
                  <th className={tabel.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.serah.map((x) => (
                  <tr key={x.id} className={`${tabel.baris} align-top`}>
                    <td className={tabel.td}>
                      <p className="font-semibold text-kopi-900">
                        {nama(x.outlet_id)}
                      </p>
                      <p className="text-xs text-stone-500">{x.shift}</p>
                    </td>
                    <td className={tabel.td}>
                      <p>
                        {x.sebelum ? (
                          <>
                            {x.sebelum}{" "}
                            <span className="text-stone-400">→</span>{" "}
                          </>
                        ) : (
                          <span className="text-stone-500">
                            Pembukaan kas ·{" "}
                          </span>
                        )}
                        <b className="text-kopi-900">{x.pic}</b>
                      </p>
                      {x.catatan && (
                        <p className="mt-0.5 max-w-xs text-xs text-stone-500">
                          {x.catatan}
                        </p>
                      )}
                    </td>
                    <td
                      className={`${tabel.td} whitespace-nowrap text-xs text-stone-500`}
                    >
                      {wib(x.mulai_at)}
                    </td>
                    <td
                      className={`${tabel.td} whitespace-nowrap text-right tabular-nums`}
                    >
                      {rp(x.fisik)}
                    </td>
                    <td
                      className={`${tabel.td} whitespace-nowrap text-right tabular-nums text-stone-500`}
                    >
                      {rp(x.seharusnya)}
                    </td>
                    <td className={`${tabel.td} text-right`}>
                      <BadgeSelisih nilai={x.fisik - x.seharusnya} />
                    </td>
                    <td className={tabel.td}>
                      {x.selesai_at ? (
                        <Badge>Selesai</Badge>
                      ) : (
                        <Badge nada="hijau">PIC aktif</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Kosong ikon="🤝" judul="Belum ada serah terima">
            Belum ada serah terima kas harian dalam 7 hari terakhir.
          </Kosong>
        ))}
      {tab === "akses" && <AksesOutletPanel outlets={akses} />}
      {tab === "staf" && d.pusat && (
        <section className="space-y-3">
          <input
            aria-label="Cari staf"
            placeholder="🔍 Cari nama / email / kode staf"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            className={`w-full ${isian}`}
          />
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            PIN lama yang hanya disimpan sebagai hash perlu ditetapkan ulang
            sebelum bisa dilihat. Tampilkan hanya saat diperlukan; semua akses
            melihat PIN tercatat.
          </p>
          {d.staf
            .filter((s) =>
              `${s.nama} ${s.email} ${s.kode}`
                .toLowerCase()
                .includes(cari.toLowerCase()),
            )
            .map((s) => (
              <PinCard
                key={`${s.id}:${s.kode}:${s.ada_pin}:${JSON.stringify(s.tugas)}`}
                staf={s}
                outlets={d.outlets}
                run={run}
                busy={busy}
              />
            ))}
        </section>
      )}
      {tab === "tablet" && d.perangkat_admin && <PerangkatPanel data={d} />}
      {tab === "aturan" &&
        d.pusat &&
        (d.outlets.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {d.outlets.map((o) => (
              <form
                key={o.id}
                className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  run(() =>
                    aturOutletPos(
                      o.id,
                      Number(f.get("awal")),
                      Number(f.get("offline")),
                      String(f.get("lat")).trim() ? Number(f.get("lat")) : null,
                      String(f.get("lng")).trim() ? Number(f.get("lng")) : null,
                      Number(f.get("radius")),
                    ),
                  );
                }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-kopi-900">
                    🏪 {o.nama}
                  </h2>
                  {o.lat !== null && o.lng !== null ? (
                    <Badge nada="hijau">📍 Titik lokasi terisi</Badge>
                  ) : (
                    <Badge nada="kuning">📍 Titik belum diisi</Badge>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-stone-600">
                    Boleh buka sebelum shift (menit)
                    <input
                      className={cls}
                      type="number"
                      name="awal"
                      min="0"
                      max="120"
                      defaultValue={o.awal}
                      required
                    />
                  </label>
                  <label className="text-xs font-medium text-stone-600">
                    Batas izin offline (menit)
                    <input
                      className={cls}
                      type="number"
                      name="offline"
                      min="1"
                      max="120"
                      defaultValue={o.offline}
                      required
                    />
                  </label>
                  <label className="text-xs font-medium text-stone-600">
                    Latitude titik outlet
                    <input
                      className={cls}
                      type="number"
                      step="any"
                      name="lat"
                      min="-90"
                      max="90"
                      defaultValue={o.lat ?? ""}
                    />
                  </label>
                  <label className="text-xs font-medium text-stone-600">
                    Longitude titik outlet
                    <input
                      className={cls}
                      type="number"
                      step="any"
                      name="lng"
                      min="-180"
                      max="180"
                      defaultValue={o.lng ?? ""}
                    />
                  </label>
                  <label className="text-xs font-medium text-stone-600">
                    Radius absensi (meter)
                    <input
                      className={cls}
                      type="number"
                      name="radius"
                      min="20"
                      max="5000"
                      defaultValue={o.radius}
                      required
                    />
                  </label>
                  <p className="self-center rounded-xl bg-matur-50/70 p-2.5 text-xs text-stone-600">
                    Jika titik belum diisi, GPS tetap wajib dicatat tetapi jarak
                    belum dapat diverifikasi. Isi koordinat lokasi outlet
                    sebenarnya.
                  </p>
                </div>
                <button
                  disabled={busy}
                  className="mt-4 w-full rounded-xl bg-matur-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-matur-600 disabled:opacity-50"
                >
                  Simpan aturan outlet
                </button>
              </form>
            ))}
          </div>
        ) : (
          <Kosong ikon="🏪" judul="Belum ada outlet" />
        ))}
      {tab === "sesi" &&
        (d.sessions.length ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {d.sessions.map((s) => (
              <Kartu
                key={s.id}
                className="space-y-3"
                judul={
                  <>
                    {nama(s.outlet_id)}{" "}
                    <span className="font-medium text-stone-400">·</span>{" "}
                    {s.nama ?? "Sesi kas"}
                  </>
                }
                keterangan={`Buka ${wib(s.buka_at)} · batas ${wib(s.batas_at)} WIB`}
                aksi={
                  <div className="flex flex-wrap gap-1.5">
                    {s.ditutup_at ? (
                      <Badge nada={nadaStatus(s.status)}>{s.status}</Badge>
                    ) : (
                      <Badge nada="hijau">● Masih buka</Badge>
                    )}
                    {s.legacy && <Badge nada="ungu">Skema lama</Badge>}
                  </div>
                }
              >
                <div className="text-sm">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Tim
                  </p>
                  {s.anggota.length ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {s.anggota.map((a, i) => (
                        <li
                          key={`${a.nama}:${a.gabung_at}:${i}`}
                          className="rounded-full border border-matur-100 bg-matur-50/60 px-2.5 py-1 text-xs"
                        >
                          <b className="text-kopi-900">{a.nama}</b>{" "}
                          <span className="text-stone-500">
                            {a.keluar_at
                              ? `(pulang ${wib(a.keluar_at)})`
                              : "(bertugas)"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-stone-500">
                      Belum tercatat pada sesi lama
                    </p>
                  )}
                </div>
                {!!s.pindah_menunggu && (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    ⏳ Rekap sementara: {s.pindah_menunggu} perangkat asal belum
                    melaporkan antrean bersih.
                  </p>
                )}
                {s.ditutup_at && (
                  <dl className="grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-sm">
                    <div>
                      <dt className="text-xs text-stone-500">Uang fisik</dt>
                      <dd className="font-semibold tabular-nums text-kopi-900">
                        {s.aktual === null ? "—" : rp(s.aktual)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">Selisih</dt>
                      <dd>
                        <BadgeSelisih nilai={s.selisih} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">Tertunda</dt>
                      <dd className="font-semibold tabular-nums text-kopi-900">
                        {s.pending} transaksi
                      </dd>
                    </div>
                  </dl>
                )}
                {!s.ditutup_at &&
                  !s.legacy &&
                  ["owner", "spv"].includes(role) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        run(() =>
                          perpanjangPos(
                            s.id,
                            Number(f.get("menit")),
                            String(f.get("alasan")),
                          ),
                        );
                      }}
                      className="flex flex-wrap gap-2 border-t border-stone-100 pt-3"
                    >
                      <input
                        name="menit"
                        type="number"
                        min="1"
                        max="180"
                        defaultValue="30"
                        required
                        aria-label="Menit perpanjangan"
                        className={`w-24 ${isian}`}
                      />
                      <input
                        name="alasan"
                        required
                        minLength={3}
                        placeholder="Alasan perpanjangan SPV"
                        className={`min-w-0 flex-1 basis-40 ${isian}`}
                      />
                      <button disabled={busy} className={tombolUtama}>
                        Perpanjang sesi
                      </button>
                    </form>
                  )}
                {!s.ditutup_at &&
                  s.legacy &&
                  ["owner", "spv"].includes(role) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        if (
                          confirm(
                            "Tutup sesi lama sesuai uang fisik yang telah diperiksa?",
                          )
                        )
                          run(() =>
                            tutupPosLama(
                              s.id,
                              Number(f.get("aktual")),
                              String(f.get("alasan")),
                            ),
                          );
                      }}
                      className="flex flex-wrap gap-2 border-t border-stone-100 pt-3"
                    >
                      <input
                        name="aktual"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Uang fisik termasuk modal"
                        required
                        className={`min-w-0 flex-1 basis-40 ${isian}`}
                      />
                      <input
                        name="alasan"
                        required
                        minLength={3}
                        placeholder="Catatan pemeriksaan/serah terima"
                        className={`min-w-0 flex-1 basis-40 ${isian}`}
                      />
                      <button disabled={busy} className={tombolGaris}>
                        Tutup sesi lama
                      </button>
                    </form>
                  )}
              </Kartu>
            ))}
          </section>
        ) : (
          <Kosong ikon="💵" judul="Belum ada sesi kas" />
        ))}
    </div>
  );
}
function PinCard({
  staf: s,
  outlets,
  run,
  busy,
}: {
  staf: Staf;
  outlets: Outlet[];
  run: (f: () => Promise<PosHasil>) => void;
  busy: boolean;
}) {
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lihat, setLihat] = useState(false);
  useEffect(() => {
    if (!pin) return;
    const t = setTimeout(() => setPin(null), 20000);
    return () => clearTimeout(t);
  }, [pin]);
  const ol = [...new Set(s.tugas.map((t) => t.outlet_id))];
  return (
    <article className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <b className="text-kopi-900">{s.nama}</b>
            <Badge nada={nadaStatus(s.status)}>{s.status}</Badge>
            {s.ada_pin ? (
              <Badge nada="biru">PIN diatur</Badge>
            ) : (
              <Badge nada="kuning">PIN belum diatur</Badge>
            )}
          </p>
          <p className="break-all text-xs text-stone-500">{s.email}</p>
        </div>
        <span className="rounded-xl border border-matur-100 bg-matur-50/60 px-3 py-2 font-mono tracking-widest text-kopi-900">
          {pin ?? "••••••"}
        </span>
        <button
          type="button"
          disabled={lihat || busy}
          aria-label={pin ? "Sembunyikan PIN POS" : "Lihat PIN POS"}
          onClick={async () => {
            if (pin) return setPin(null);
            setLihat(true);
            setError("");
            try {
              const r = await lihatPinPos(s.id);
              if (r.error) setError(r.error);
              else setPin(r.pin ?? null);
            } catch {
              setError("PIN belum dapat ditampilkan.");
            } finally {
              setLihat(false);
            }
          }}
          className="rounded-xl border border-matur-200 bg-white px-3 py-2 hover:bg-matur-50 disabled:opacity-50"
        >
          {lihat ? "…" : "👁"}
        </button>
      </div>
      {error && (
        <p role="status" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setPin(null);
          run(() =>
            aturPinPos(s.id, String(f.get("kode")), String(f.get("pin"))),
          );
        }}
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label className="text-xs font-medium text-stone-600">
          Kode staf
          <input
            name="kode"
            required
            minLength={3}
            maxLength={60}
            defaultValue={s.kode ?? ""}
            className={cls}
          />
        </label>
        <label className="text-xs font-medium text-stone-600">
          PIN POS baru
          <input
            name="pin"
            required
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,6}"
            autoComplete="new-password"
            className={cls}
            placeholder={s.ada_pin ? "Isi untuk mengganti" : "PIN belum diatur"}
          />
        </label>
        <button disabled={busy} className={`self-end ${tombolUtama}`}>
          Simpan PIN
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {ol.map((id) => {
          const spv = s.tugas.some(
            (t) => t.outlet_id === id && t.peran === "spv",
          );
          const kasir = s.tugas.some(
            (t) => t.outlet_id === id && t.peran === "kasir",
          );
          return (
            <button
              key={id}
              disabled={busy || spv}
              onClick={() => run(() => aksesPosStaf(s.id, id, !kasir))}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-70 ${kasir || spv ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-matur-200 bg-white text-kopi-900 hover:bg-matur-50"}`}
            >
              {outlets.find((o) => o.id === id)?.nama ?? "Outlet"} ·{" "}
              {spv
                ? "Akses POS via SPV"
                : kasir
                  ? "Akses POS aktif · cabut"
                  : "Aktifkan akses POS"}
            </button>
          );
        })}
      </div>
      {s.email.endsWith("@pin.matur.id") && (
        <details className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">
            Hubungkan email login HP ke akun lama
          </summary>
          <p className="my-2 text-xs">
            Tetap menggunakan identitas yang sama. Riwayat tidak dipindah atau
            dihapus. Admin menyerahkan email/password awal secara pribadi.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(() =>
                emailLoginStaf(
                  s.id,
                  String(f.get("email")),
                  String(f.get("password")),
                ),
              );
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="Email pribadi karyawan"
              className={`min-w-0 flex-1 basis-48 ${isian}`}
            />
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="Password awal (min. 8)"
              className={`min-w-0 flex-1 basis-48 ${isian}`}
            />
            <button disabled={busy} className={tombolGaris}>
              Hubungkan
            </button>
          </form>
        </details>
      )}
    </article>
  );
}
