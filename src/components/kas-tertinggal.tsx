"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/format";
import {
  hitungKasOtomatis,
  tutupKasTertinggal,
} from "@/lib/kas-tertinggal-actions";

export type KasTertinggal = {
  id: string;
  outlet: string;
  nama: string;
  tanggal: string;
  dibuka_at: string;
  batas_at: string;
  lewat_batas: boolean;
  pic: string | null;
  pesanan_aktif: number;
  kas: {
    modal: number;
    tunai: number;
    non_tunai: number;
    laci: number;
    keluar: number;
    transaksi: number;
    seharusnya: number;
  };
};

const wib = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Daftar kas POS tersangkut + form tutup (uang fisik & alasan) untuk Owner / SPV / Admin Gudang. */
export function KasTertinggalPanel({ list }: { list: KasTertinggal[] }) {
  if (!list.length) return null;
  return (
    <section
      id="tertinggal"
      className="scroll-mt-20 space-y-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4"
    >
      <div>
        <h2 className="text-lg font-bold text-red-800">
          ⚠️ Kas POS tertinggal ({list.length})
        </h2>
        <p className="text-sm text-red-900/80">
          Kas ini lewat batas shift sehingga tidak bisa ditutup dari tablet dan
          menghalangi kas hari berikutnya. Hitung uang di laci, lalu tutup di
          sini. Riwayat transaksi tidak berubah.
        </p>
      </div>
      {list.map((k) => (
        <Kartu key={k.id} k={k} />
      ))}
    </section>
  );
}

function Kartu({ k }: { k: KasTertinggal }) {
  const router = useRouter();
  const [fisik, setFisik] = useState(String(k.kas.seharusnya));
  const [alasan, setAlasan] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, start] = useTransition();
  const aktual = Number(fisik.replace(/\D/g, "") || 0);
  const selisih = aktual - k.kas.seharusnya;
  return (
    <article className="space-y-3 rounded-xl border border-red-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{k.outlet}</p>
          <p className="text-xs text-stone-500">
            {k.nama} · tgl {k.tanggal} · dibuka {wib(k.dibuka_at)} · batas{" "}
            {wib(k.batas_at)} {k.pic ? `· PIC ${k.pic}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
          {k.lewat_batas ? "lewat batas shift" : "izin tablet habis"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ["Modal", k.kas.modal],
          ["Tunai masuk", k.kas.tunai],
          ["Keluar laci", k.kas.laci + k.kas.keluar],
          ["Seharusnya di laci", k.kas.seharusnya],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-stone-50 p-2">
            <dt className="text-xs text-stone-500">{l}</dt>
            <dd className="font-bold tabular-nums">
              {formatRupiah(v as number)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-stone-500">
        {k.kas.transaksi} transaksi · non-tunai {formatRupiah(k.kas.non_tunai)}
        {k.pesanan_aktif > 0 && (
          <b className="text-amber-700">
            {" "}
            · {k.pesanan_aktif} pesanan masih di antrean
          </b>
        )}
      </p>
      <form
        className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            selisih !== 0 &&
            !confirm(
              `Uang fisik berbeda ${formatRupiah(selisih)} dari seharusnya. Lanjut tutup?`,
            )
          )
            return;
          start(async () => {
            const r = await tutupKasTertinggal(k.id, aktual, alasan);
            setMsg(r);
            if (!r.error) router.refresh();
          });
        }}
      >
        <label className="text-xs font-semibold">
          Uang fisik di laci
          <input
            inputMode="numeric"
            value={aktual.toLocaleString("id-ID")}
            onChange={(e) => setFisik(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-right text-base font-bold tabular-nums"
          />
        </label>
        <label className="text-xs font-semibold">
          Alasan / catatan
          <input
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            required
            minLength={5}
            placeholder="mis. kasir lupa tutup shift, uang sudah dihitung SPV"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <button
          disabled={busy}
          className="self-end rounded-lg bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50"
        >
          {busy ? "Menutup…" : "Tutup kas"}
        </button>
      </form>
      {selisih !== 0 && (
        <p className="text-xs font-semibold text-amber-700">
          Selisih {formatRupiah(selisih)} akan tercatat.
        </p>
      )}
      {(msg.error || msg.ok) && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}
    </article>
  );
}

export type KasOtomatis = {
  id: string;
  outlet: string;
  tanggal: string | null;
  dibuka_at: string;
  ditutup_at: string;
  pic: string | null;
  modal: number;
  seharusnya: number;
  fisik: number | null;
  selisih: number | null;
  transaksi: number;
  dihitung_at: string | null;
  dihitung_oleh: string | null;
  catatan: string | null;
};

/** Riwayat kas yang ditutup otomatis oleh sistem (60 hari) + isi hitungan uang fisik yang belum dihitung. */
export function RiwayatKasOtomatis({ list }: { list: KasOtomatis[] }) {
  if (!list.length) return null;
  const belum = list.filter((k) => !k.dihitung_at).length;
  return (
    <section id="riwayat-kas" className="scroll-mt-20 space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-bold">🕛 Riwayat kas ditutup otomatis</h2>
        <p className="text-sm text-stone-500">
          Kas yang tidak ditutup kasir sampai berganti hari ditutup sistem (tiap
          jam).{" "}
          {belum ? (
            <b className="text-amber-700">
              {belum} belum dihitung — isi uang fisik di laci.
            </b>
          ) : (
            "Semua sudah dihitung."
          )}
        </p>
      </div>
      <ul className="divide-y">
        {list.map((k) => (
          <BarisOtomatis key={k.id} k={k} />
        ))}
      </ul>
    </section>
  );
}

function BarisOtomatis({ k }: { k: KasOtomatis }) {
  const router = useRouter();
  const [fisik, setFisik] = useState(String(k.seharusnya ?? 0));
  const [catatan, setCatatan] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, start] = useTransition();
  const aktual = Number(fisik.replace(/\D/g, "") || 0);
  return (
    <li className="space-y-2 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {k.outlet} · shift {k.tanggal}
          </p>
          <p className="text-xs text-stone-500">
            dibuka {wib(k.dibuka_at)} · ditutup sistem {wib(k.ditutup_at)} ·{" "}
            {k.transaksi} transaksi {k.pic ? `· PIC ${k.pic}` : ""}
          </p>
        </div>
        {k.dihitung_at ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${k.selisih ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}
          >
            {k.selisih ? `selisih ${formatRupiah(k.selisih)}` : "sesuai"} ·
            dihitung {k.dihitung_oleh ?? ""}
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            belum dihitung
          </span>
        )}
      </div>
      <p className="text-xs">
        Seharusnya di laci <b>{formatRupiah(k.seharusnya)}</b> (modal{" "}
        {formatRupiah(k.modal)})
        {k.fisik !== null && (
          <>
            {" "}
            · fisik <b>{formatRupiah(k.fisik)}</b>
          </>
        )}
      </p>
      {!k.dihitung_at && (
        <form
          className="grid gap-2 sm:grid-cols-[160px_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await hitungKasOtomatis(k.id, aktual, catatan);
              setMsg(r);
              if (!r.error) router.refresh();
            });
          }}
        >
          <input
            inputMode="numeric"
            aria-label="Uang fisik di laci"
            value={aktual.toLocaleString("id-ID")}
            onChange={(e) => setFisik(e.target.value)}
            className="rounded-lg border px-3 py-2 text-right font-bold tabular-nums"
          />
          <input
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan (wajib bila ada selisih)"
            className="rounded-lg border px-3 py-2"
          />
          <button
            disabled={busy}
            className="rounded-lg bg-kopi-900 px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            {busy ? "Menyimpan…" : "Simpan hitungan"}
          </button>
        </form>
      )}
      {(msg.error || msg.ok) && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {msg.error ?? msg.ok}
        </p>
      )}
    </li>
  );
}
