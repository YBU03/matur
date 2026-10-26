"use client";
import { PosRiwayatShift } from "./pos-riwayat-shift";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aturAlurShift } from "@/lib/pos-alur-actions";
import type { AturanShift } from "@/lib/pos-alur";
export function PosAturanShift({ outlets }: { outlets: AturanShift[] }) {
  return (
    <div className="space-y-3">
      <section
        aria-labelledby="panduan-alur-shift"
        className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"
      >
        <h2 id="panduan-alur-shift" className="text-lg font-bold">
          Pengaturan Alur Shift POS
        </h2>
        <p className="text-sm">
          Pilih cara masuk POS untuk masing-masing outlet. Warna dan tulisan
          pada tombol menunjukkan pilihan pengaturan; klik Simpan dan konfirmasi
          agar perubahan tersimpan.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border-2 border-red-200 bg-white p-4">
            <h3 className="font-bold text-red-800">
              NONAKTIF · Akses Langsung
            </h3>
            <p className="text-sm">
              Setelah login menggunakan username dan password outlet, kasir
              langsung dapat menggunakan POS. Tidak perlu memilih petugas atau
              memasukkan PIN shift.
            </p>
            <p className="text-sm font-semibold">
              Cocok untuk training. Semua transaksi tetap tercatat pada data
              outlet.
            </p>
          </div>
          <div className="space-y-2 rounded-xl border-2 border-green-200 bg-white p-4">
            <h3 className="font-bold text-green-800">
              AKTIF · Gunakan Alur Shift
            </h3>
            <p className="text-sm">
              Pada pembukaan kas baru, pilih petugas, masukkan PIN bersama
              outlet, lalu isi modal awal laci. Jika kas sudah berjalan,
              masukkan PIN outlet untuk melanjutkan kas yang sama.
            </p>
            <p className="text-sm">
              Saat berganti petugas, buka menu Kas → Selesai &amp; Serah Terima
              Shift. Hitung uang fisik yang diserahkan; jumlah tersebut menjadi
              saldo awal petugas berikutnya. Modal tidak diinput ulang.
            </p>
            <p className="text-sm">
              Pada petugas terakhir, pilih Tutup operasional hari ini untuk
              menyelesaikan kas dan menyiapkan laporan.
            </p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <h3 className="font-bold">Cara menyimpan pengaturan</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Pilih outlet, lalu klik tombol status untuk memilih Nonaktif atau
              Aktif.
            </li>
            <li>
              Jika baru mengaktifkan, isi PIN outlet 4–6 angka. Jika PIN sudah
              tersedia dan tetap digunakan, kolom PIN boleh dikosongkan.
            </li>
            <li>
              Klik Simpan, periksa pilihan dan nama outlet, lalu klik Ya, simpan
              pengaturan.
            </li>
          </ol>
          <p className="rounded-xl border border-amber-300 bg-white p-3">
            <strong>Kapan mulai berlaku?</strong> Perubahan status berlaku mulai
            kas berikutnya setelah kas berjalan ditutup. Kas yang sedang
            digunakan tetap mengikuti alur sebelumnya. Pergantian PIN langsung
            berlaku pada proses masuk atau serah terima berikutnya.
          </p>
        </div>
      </section>
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
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
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
          className={`inline-flex max-w-full items-center gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-bold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kopi-900 disabled:opacity-60 ${aktif ? "border-green-900 bg-green-700 hover:bg-green-800" : "border-red-900 bg-red-700 hover:bg-red-800"}`}
        >
          <span aria-hidden="true" className="text-lg">
            {aktif ? "✓" : "✕"}
          </span>
          <span>
            {aktif ? "AKTIF · Gunakan Alur Shift" : "NONAKTIF · Akses Langsung"}
          </span>
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
