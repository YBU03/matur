"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  aturTablet,
  aturPinPos,
  lihatPinPos,
  aksesPosStaf,
  aturOutletPos,
  perpanjangPos,
  tutupPosLama,
  emailLoginStaf,
  type PosHasil,
} from "@/lib/pos-tim-actions";
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
  pusat: boolean;
  staf: Staf[];
  devices: {
    id: string;
    outlet_id: string;
    nama: string;
    mode?: string;
    status: string;
    created_at: string;
  }[];
  outlets: Outlet[];
  sessions: {
    id: string;
    outlet_id: string;
    nama: string;
    buka_at: string;
    batas_at: string | null;
    legacy: boolean;
    ditutup_at: string | null;
    status: string;
    pending: number;
    aktual: number | null;
    selisih: number | null;
    anggota: { nama: string; gabung_at: string; keluar_at: string | null }[];
  }[];
};
const cls = "mt-1 w-full rounded-lg border bg-white p-2 text-sm";
const wib = (s: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "—";
export function PanelPos({ data: d, role }: { data: PanelData; role: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<PosHasil>({});
  const [tab, setTab] = useState(d.pusat ? "staf" : "sesi");
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
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">POS Tim & Akses Karyawan</h1>
        <p className="text-sm text-stone-500">
          PIN terpisah dari password akun. Tablet harus disetujui; satu sesi kas
          untuk satu tim.
        </p>
      </div>
      <nav className="flex gap-2 overflow-auto">
        {[
          ...(d.pusat
            ? [
                ["staf", "Kode Staf & PIN"],
                ["tablet", "Tablet Outlet"],
                ["aturan", "Aturan Shift & Lokasi"],
              ]
            : []),
          ["sesi", "Sesi Kas Tim"],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold ${tab === k ? "bg-kopi-900 text-white" : "bg-white"}`}
          >
            {l}
          </button>
        ))}
      </nav>
      {(msg.error || msg.ok) && (
        <p
          role="status"
          className={`rounded-xl p-3 ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}
      {tab === "staf" && d.pusat && (
        <section className="space-y-3">
          <input
            aria-label="Cari staf"
            placeholder="Cari nama / email / kode staf"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            className={cls}
          />
          <p className="text-xs text-stone-500">
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
      {tab === "tablet" && d.pusat && (
        <section className="space-y-3">
          <p className="text-sm text-stone-500">
            Cara baru: buka <b>/pos</b> di tablet outlet, masuk dengan akun
            admin/SPV, pilih outlet & fungsi (Kasir / Antrean saja). Tablet
            langsung aktif dengan akun tablet tersembunyi. Mencabut perangkat
            memblokir transaksi baru, sinkronisasi, dan akun tablet tersebut
            sampai disetujui kembali.
          </p>
          {d.devices.map((v) => (
            <article key={v.id} className="rounded-2xl border bg-white p-4">
              <div className="flex flex-wrap justify-between">
                <b>
                  {v.nama} · {nama(v.outlet_id)}
                  {v.mode === "antrean" ? " · Antrean saja" : " · Kasir"}
                </b>
                <span className="text-xs font-bold">{v.status}</span>
              </div>
              <p className="my-2 text-xs text-stone-500">
                Diminta {wib(v.created_at)} WIB · ID {v.id.slice(0, 8)}
              </p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  run(() =>
                    aturTablet(
                      v.id,
                      v.status !== "aktif",
                      String(fd.get("alasan")),
                    ),
                  );
                }}
              >
                <input
                  name="alasan"
                  required
                  minLength={3}
                  placeholder="Alasan persetujuan / pencabutan"
                  className={cls}
                />
                <button
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-kopi-900 px-3 text-sm text-white"
                >
                  {v.status === "aktif" ? "Cabut akses" : "Setujui tablet"}
                </button>
              </form>
            </article>
          ))}
          {!d.devices.length && (
            <p className="rounded-xl border bg-white p-5 text-sm">
              Belum ada permintaan tablet.
            </p>
          )}
        </section>
      )}
      {tab === "aturan" && d.pusat && (
        <div className="grid gap-3 lg:grid-cols-2">
          {d.outlets.map((o) => (
            <form
              key={o.id}
              className="grid grid-cols-2 gap-3 rounded-2xl border bg-white p-4"
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
              <h2 className="col-span-2 font-bold">{o.nama}</h2>
              <label className="text-xs">
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
              <label className="text-xs">
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
              <label className="text-xs">
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
              <label className="text-xs">
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
              <label className="text-xs">
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
              <p className="self-center text-xs text-stone-500">
                Jika titik belum diisi, GPS tetap wajib dicatat tetapi jarak
                belum dapat diverifikasi. Isi koordinat lokasi outlet
                sebenarnya.
              </p>
              <button
                disabled={busy}
                className="col-span-2 rounded-xl bg-matur-500 p-2 font-bold text-white"
              >
                Simpan aturan outlet
              </button>
            </form>
          ))}
        </div>
      )}
      {tab === "sesi" && (
        <section className="space-y-3">
          {d.sessions.map((s) => (
            <article
              key={s.id}
              className="space-y-2 rounded-2xl border bg-white p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <b>
                  {nama(s.outlet_id)} · {s.nama ?? "Sesi kas"}
                </b>
                <span className="rounded-full bg-matur-50 px-3 py-1 text-xs font-bold">
                  {s.ditutup_at ? s.status : "Masih buka"}
                  {s.legacy ? " · skema lama" : ""}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Buka {wib(s.buka_at)} · batas {wib(s.batas_at)} WIB
              </p>
              <p className="text-sm">
                Tim:{" "}
                {s.anggota
                  .map(
                    (a) =>
                      `${a.nama}${a.keluar_at ? ` (pulang ${wib(a.keluar_at)})` : " (bertugas)"}`,
                  )
                  .join(" · ") || "Belum tercatat pada sesi lama"}
              </p>
              {s.ditutup_at && (
                <p className="text-sm">
                  Uang fisik {s.aktual === null ? "—" : rp(s.aktual)} · selisih{" "}
                  {s.selisih === null ? "—" : rp(s.selisih)} · {s.pending}{" "}
                  transaksi tertunda
                </p>
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
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      name="menit"
                      type="number"
                      min="1"
                      max="180"
                      defaultValue="30"
                      required
                      aria-label="Menit perpanjangan"
                      className="w-24 rounded-lg border p-2 text-sm"
                    />
                    <input
                      name="alasan"
                      required
                      minLength={3}
                      placeholder="Alasan perpanjangan SPV"
                      className="min-w-40 flex-1 rounded-lg border p-2 text-sm"
                    />
                    <button
                      disabled={busy}
                      className="rounded-lg bg-kopi-900 px-3 py-2 text-sm text-white"
                    >
                      Perpanjang sesi
                    </button>
                  </form>
                )}
              {!s.ditutup_at && s.legacy && ["owner", "spv"].includes(role) && (
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
                  className="flex flex-wrap gap-2"
                >
                  <input
                    name="aktual"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Uang fisik termasuk modal"
                    required
                    className="rounded-lg border p-2 text-sm"
                  />
                  <input
                    name="alasan"
                    required
                    minLength={3}
                    placeholder="Catatan pemeriksaan/serah terima"
                    className="min-w-40 flex-1 rounded-lg border p-2 text-sm"
                  />
                  <button
                    disabled={busy}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Tutup sesi lama
                  </button>
                </form>
              )}
            </article>
          ))}
          {!d.sessions.length && (
            <p className="rounded-xl border bg-white p-4 text-sm">
              Belum ada sesi kas.
            </p>
          )}
        </section>
      )}
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
    <article className="rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <b>{s.nama}</b>
          <p className="text-xs text-stone-500">
            {s.email} · {s.status}
          </p>
        </div>
        <span className="rounded-lg bg-stone-50 p-2 font-mono tracking-widest">
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
          className="rounded-lg border p-2"
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
        <label className="text-xs">
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
        <label className="text-xs">
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
        <button
          disabled={busy}
          className="self-end rounded-lg bg-kopi-900 px-3 py-2 text-sm text-white"
        >
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
              className={`rounded-lg border p-2 text-xs ${kasir || spv ? "bg-green-50 text-green-800" : ""}`}
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
        <details className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
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
              className="flex-1 rounded-lg border p-2"
            />
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="Password awal (min. 8)"
              className="flex-1 rounded-lg border p-2"
            />
            <button disabled={busy} className="rounded-lg border bg-white p-2">
              Hubungkan
            </button>
          </form>
        </details>
      )}
    </article>
  );
}
