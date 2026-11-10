"use client";

// Kunci Matoer untuk BNI Direct API (sandbox): buat kunci + sertifikat X.509 (private key ke Vault), lalu buat Token Signature.
import { useEffect, useState, useTransition } from "react";
import { Copy, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { bniAction } from "@/lib/snap-sandbox-actions";

const CLIENT_KEY_AWAL = "9b1d880a-de13-466d-b522-4cd4104934b6";
const sekarangWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 19) + "+07:00";
const kotak = "w-full min-w-0 rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";

function Salin({ teks, label }: { teks: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(teks).then(() => (setOk(true), setTimeout(() => setOk(false), 1500))).catch(() => {})}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-matur-200 bg-white px-3 py-1.5 text-xs font-semibold text-kopi-800 hover:border-matur-400"
    >
      <Copy size={13} /> {ok ? "Tersalin" : label}
    </button>
  );
}

export function BniPanel() {
  const [info, setInfo] = useState<{ ada: boolean; sertifikat?: string; dibuat_at?: string; oauth?: { ada: boolean; client_id?: string; diubah_at?: string } } | null>(null);
  const [oauthId, setOauthId] = useState(CLIENT_KEY_AWAL);
  const [oauthSecret, setOauthSecret] = useState("");
  const [lihatSecret, setLihatSecret] = useState(false);
  const [tes, setTes] = useState<{ ok: boolean; status: number; durasiMs: number; respons?: Record<string, unknown>; pesan?: string; expires_in?: number | null } | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [clientKey, setClientKey] = useState(CLIENT_KEY_AWAL);
  const [ts, setTs] = useState("");
  const [sig, setSig] = useState<{ signature: string; timestamp: string; stringToSign: string } | null>(null);
  const [konfirmasiGanti, setKonfirmasiGanti] = useState(false);

  useEffect(() => {
    setTs(sekarangWib());
    bniAction("bni-kunci").then((r) => (r.error ? setErr(r.error) : setInfo(r.data as typeof info)));
  }, []);

  const buat = (ganti: boolean) =>
    start(async () => {
      setErr("");
      const r = await bniAction("bni-kunci-buat", { ganti });
      if (r.error) return setErr(r.error);
      setInfo(r.data as typeof info);
      setKonfirmasiGanti(false);
      setSig(null);
    });
  const simpanOauth = () =>
    start(async () => {
      setErr("");
      const r = await bniAction("bni-oauth-simpan", { clientId: oauthId, clientSecret: oauthSecret });
      if (r.error) return setErr(r.error);
      setOauthSecret("");
      setInfo(r.data as typeof info);
    });
  const tesToken = () =>
    start(async () => {
      setErr("");
      setTes(null);
      const r = await bniAction("bni-token-tes");
      if (r.error) return setErr(r.error);
      setTes(r.data as typeof tes);
    });
  const tandatangan = () =>
    start(async () => {
      setErr("");
      setSig(null);
      const r = await bniAction("bni-signature", { clientKey, timestamp: ts });
      if (r.error) return setErr(r.error);
      setSig(r.data as typeof sig);
    });

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-matur-100 text-matur-700">
            <ShieldCheck size={18} />
          </span>
          <div className="mr-auto min-w-0">
            <h2 className="font-bold text-kopi-900">Sertifikat Matoer untuk BNI</h2>
            <p className="text-xs text-stone-500">Private key disimpan terenkripsi di Vault Matoer, tidak pernah ditampilkan atau dikirim ke browser.</p>
          </div>
          {info?.ada && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">● Kunci tersedia</span>}
        </div>

        {info === null && !err && <p className="text-sm text-stone-500">Memuat…</p>}
        {info && !info.ada && (
          <div className="space-y-2 rounded-xl bg-matur-50 p-3 text-sm">
            <p>Belum ada kunci. Klik tombol di bawah untuk membuat pasangan kunci RSA 2048 dan sertifikat X.509 (berlaku 1 tahun).</p>
            <button type="button" disabled={pending} onClick={() => buat(false)} className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <KeyRound size={15} className="mr-1 inline" /> Buat kunci & sertifikat
            </button>
          </div>
        )}
        {info?.ada && info.sertifikat && (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-700">
              <li>
                Salin sertifikat di bawah, lalu di portal BNI buka <b>Aplikasi Matoer → Autentikasi → Kredensial OAuth → Aksi → Ubah</b>.
              </li>
              <li>
                Ganti seluruh isi kolom <b>X.509 certificate</b> dengan sertifikat ini, lalu <b>Simpan Perubahan</b>.
              </li>
            </ol>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-stone-500">Dibuat {info.dibuat_at ? new Date(info.dibuat_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB" : ""}</p>
              <Salin teks={info.sertifikat} label="Salin sertifikat" />
            </div>
            <textarea readOnly rows={8} value={info.sertifikat} className={`${kotak} font-mono text-[11px]`} onFocus={(e) => e.currentTarget.select()} />
            {!konfirmasiGanti ? (
              <button type="button" onClick={() => setKonfirmasiGanti(true)} className="text-xs font-semibold text-stone-500 underline">
                Buat ulang kunci (ganti)
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                <span className="mr-auto">Kunci lama tidak berlaku lagi. Sertifikat di portal BNI juga harus diganti dengan yang baru.</span>
                <button type="button" disabled={pending} onClick={() => buat(true)} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
                  Ya, ganti kunci
                </button>
                <button type="button" onClick={() => setKonfirmasiGanti(false)} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold">
                  Batal
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-bold text-kopi-900">Token OAuth BNI (sandbox)</h2>
          {info?.oauth?.ada && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">● Secret tersimpan</span>}
        </div>
        <p className="text-xs text-stone-500">
          Sesuai dokumentasi BNI: <span className="font-mono">POST https://sandbox.bni.co.id/api/oauth/token</span>, Basic auth (Client ID:Client Secret), body <span className="font-mono">grant_type=client_credentials</span>. Ambil Client Secret dari portal BNI → Kredensial OAuth → <b>Lihat rahasia</b>. Disimpan terenkripsi di Vault.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-stone-600">
            Client ID OAuth
            <input id="bni-oauth-id" value={oauthId} onChange={(e) => setOauthId(e.target.value.trim())} className={`${kotak} mt-1 font-mono text-xs`} />
          </label>
          <label className="block text-xs font-semibold text-stone-600">
            Client Secret {info?.oauth?.ada ? "(kosongkan bila tidak diganti)" : ""}
            <span className="mt-1 flex gap-1.5">
              <input id="bni-oauth-secret" type={lihatSecret ? "text" : "password"} autoComplete="off" value={oauthSecret} onChange={(e) => setOauthSecret(e.target.value)} className={`${kotak} font-mono text-xs`} />
              <button type="button" onClick={() => setLihatSecret(!lihatSecret)} className="shrink-0 rounded-xl border border-matur-200 bg-white px-2.5 text-xs font-semibold text-kopi-800">
                {lihatSecret ? "Tutup" : "Lihat"}
              </button>
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending || !oauthId || oauthSecret.length < 8} onClick={simpanOauth} className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
            Simpan Client Secret
          </button>
          <button type="button" disabled={pending || !info?.oauth?.ada} onClick={tesToken} className="rounded-xl bg-matur-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
            {pending ? "Memproses…" : "Tes token BNI (sandbox)"}
          </button>
        </div>
        {tes && (
          <div className={`space-y-1.5 rounded-xl p-3 text-sm ${tes.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
            <p className="font-bold">
              {tes.ok ? `✓ Token BNI berhasil didapat${tes.expires_in ? ` · berlaku ${Math.round(Number(tes.expires_in) / 60)} menit` : ""}` : `✗ Gagal${tes.status ? ` (HTTP ${tes.status})` : ""}`}
              <span className="ml-2 text-xs font-normal opacity-70">{tes.durasiMs} ms</span>
            </p>
            {tes.pesan && <p className="text-xs">{tes.pesan}</p>}
            {tes.respons && <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white/70 p-2 text-[11px]">{JSON.stringify(tes.respons, null, 2)}</pre>}
            <p className="text-[11px] opacity-70">Token disamarkan. Bila gagal, kirim tangkapan layar respons ini ke tim BNI.</p>
          </div>
        )}
      </section>

      {info?.ada && (
        <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
          <h2 className="font-bold text-kopi-900">Token Signature (untuk Sandbox BNI)</h2>
          <p className="text-xs text-stone-500">Isi X-CLIENT-KEY dan X-TIMESTAMP persis seperti di halaman Sandbox BNI, lalu buat signature dan tempel ke kolom <b>Token Signature</b>.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-stone-600">
              X-CLIENT-KEY (Klien ID OAuth)
              <input value={clientKey} onChange={(e) => setClientKey(e.target.value.trim())} className={`${kotak} mt-1 font-mono text-xs`} />
            </label>
            <label className="block text-xs font-semibold text-stone-600">
              X-TIMESTAMP
              <span className="mt-1 flex gap-1.5">
                <input value={ts} onChange={(e) => setTs(e.target.value.trim())} className={`${kotak} font-mono text-xs`} />
                <button type="button" onClick={() => setTs(sekarangWib())} title="Pakai jam sekarang" className="shrink-0 rounded-xl border border-matur-200 bg-white px-2.5 text-kopi-800">
                  <RefreshCw size={14} />
                </button>
              </span>
            </label>
          </div>
          <button type="button" disabled={pending || !clientKey || !ts} onClick={tandatangan} className="rounded-xl bg-matur-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {pending ? "Memproses…" : "Buat Token Signature"}
          </button>
          {sig && (
            <div className="space-y-2 rounded-xl bg-emerald-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-emerald-900">Token Signature</p>
                <Salin teks={sig.signature} label="Salin signature" />
              </div>
              <textarea readOnly rows={4} value={sig.signature} className={`${kotak} font-mono text-[11px]`} onFocus={(e) => e.currentTarget.select()} />
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-mono text-[11px] text-emerald-900">X-TIMESTAMP: {sig.timestamp}</p>
                <Salin teks={sig.timestamp} label="Salin timestamp" />
              </div>
              <p className="text-[11px] text-emerald-800">Pakai X-TIMESTAMP yang sama persis di halaman Sandbox BNI. Bila timestamp diubah, buat signature baru.</p>
            </div>
          )}
        </section>
      )}
      {err && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </p>
      )}
    </div>
  );
}
