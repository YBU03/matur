"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gabungTim } from "@/lib/pos-tim-actions";
type Data = {
  jadwal: {
    id: string;
    nama: string;
    shift: string;
    mulai: string;
    selesai: string;
    hadir: boolean;
    pulang: boolean;
  }[];
  sesi: { id: string; nama: string; anggota: string[]; pembuka: string } | null;
};
export function GabungTim({ data, saya }: { data: Data; saya: string }) {
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      {data.jadwal.map((j, i) => (
        <div
          key={`${j.id}:${i}`}
          className="flex justify-between gap-2 border-b py-2 text-sm"
        >
          <span>
            <b>{j.nama}</b>
            {j.id === saya && " (saya)"}
            <br />
            <span className="text-xs text-stone-500">
              {j.shift} · {j.mulai}–{j.selesai}
            </span>
          </span>
          <span
            className={`text-xs ${j.pulang ? "text-stone-500" : j.hadir ? "text-green-700" : "text-amber-700"}`}
          >
            {j.pulang
              ? "Sudah pulang"
              : j.hadir
                ? "Sudah hadir"
                : "Belum absen"}
          </span>
        </div>
      ))}
      {!data.jadwal.length && (
        <p className="text-sm text-stone-500">
          Belum ada jadwal terbit hari ini.
        </p>
      )}
      {data.sesi && (
        <div className="rounded-xl bg-matur-50 p-3 text-sm">
          <p>
            POS tim sudah dibuka oleh <b>{data.sesi.pembuka}</b>.
          </p>
          <p className="text-xs text-stone-500">
            Satu sesi kas untuk tim. Tidak perlu membuka POS kedua.
          </p>
          {!data.sesi.anggota.includes(saya) && (
            <button
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await gabungTim(data.sesi!.id);
                  setMsg(r.error ?? r.ok ?? "");
                  if (!r.error) router.refresh();
                })
              }
              className="mt-2 rounded-lg border bg-white p-2 text-xs font-bold"
            >
              Konfirmasi saya bergabung tim
            </button>
          )}
        </div>
      )}
      {msg && (
        <p role="status" className="text-xs">
          {msg}
        </p>
      )}
    </div>
  );
}
