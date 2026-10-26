"use client";
import { PosRiwayatShift } from "./pos-riwayat-shift";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aturAlurShift } from "@/lib/pos-alur-actions";
import type { AturanShift } from "@/lib/pos-alur";
export function PosAturanShift({ outlets }: { outlets: AturanShift[] }) {
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-amber-50 p-4 text-sm">
        Switch mati: akun outlet langsung masuk kasir. Switch hidup: pilih
        petugas → PIN outlet → mulai shift. Perubahan berlaku mulai kas
        berikutnya, tanpa memutus transaksi pada kas berjalan.
      </p>
      {outlets.map((o) => (
        <div key={o.id + ":" + o.versi} className="space-y-2">
          <Aturan o={o} />
          <PosRiwayatShift outlet={o.id} />
        </div>
      ))}
    </div>
  );
}
function Aturan({ o }: { o: AturanShift }) {
  const [aktif, setAktif] = useState(o.aktif),
    [pin, setPin] = useState(""),
    [konfirmasi, setKonfirmasi] = useState(false),
    [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="space-y-3 rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!konfirmasi) {
          setKonfirmasi(true);
          return;
        }
        start(async () => {
          try {
            const r = await aturAlurShift(o.id, aktif, pin, o.versi);
            setMsg(r.error ?? r.ok ?? "");
            if (!r.error) {
              setPin("");
              setKonfirmasi(false);
              router.refresh();
            }
          } catch {
            setMsg("Belum tersimpan. Periksa koneksi lalu coba lagi.");
          }
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{o.nama}</h2>
        <button
          type="button"
          role="switch"
          aria-checked={aktif}
          aria-label={"Gunakan Alur Shift " + o.nama}
          disabled={busy}
          onClick={() => {
            setAktif(!aktif);
            setKonfirmasi(false);
          }}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${aktif ? "bg-green-700 text-white" : "bg-stone-100"}`}
        >
          {aktif ? "Aktif" : "Nonaktif"}
        </button>
      </div>
      <p className="text-sm">
        Gunakan Alur Shift · PIN outlet{" "}
        {o.ada_pin ? "sudah tersedia" : "belum diatur"}
      </p>
      <label className="block text-sm">
        {o.ada_pin ? "Ganti PIN outlet (opsional)" : "PIN outlet"}
        <input
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setKonfirmasi(false);
          }}
          type="password"
          autoComplete="new-password"
          inputMode="numeric"
          pattern="[0-9]{4,6}"
          minLength={4}
          maxLength={6}
          required={aktif && !o.ada_pin}
          className="mt-1 block w-full max-w-sm rounded-xl border p-3"
        />
      </label>
      {konfirmasi && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm">
          Simpan pengaturan {aktif ? "aktif" : "nonaktif"} untuk {o.nama}? Kas
          berjalan tetap memakai alur sebelumnya sampai ditutup. PIN baru
          langsung berlaku untuk pergantian petugas berikutnya.
        </p>
      )}
      <button
        disabled={busy}
        className="rounded-xl bg-kopi-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? "Menyimpan…" : konfirmasi ? "Ya, simpan pengaturan" : "Simpan"}
      </button>
      {msg && (
        <p role="status" className="text-sm">
          {msg}
        </p>
      )}
    </form>
  );
}
