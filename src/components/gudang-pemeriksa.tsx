"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gudangRpc } from "@/lib/gudang-revisi-actions";
export function PemeriksaKiriman({
  id,
  nama,
}: {
  id: string;
  nama: string | null;
}) {
  const [v, setV] = useState(nama ?? ""),
    [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="my-3 flex flex-wrap items-end gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const r = await gudangRpc("atur_pemeriksa_kiriman", {
              p_id: id,
              p_nama: v,
            });
            setMsg(r.error ?? r.ok ?? "");
            if (!r.error) router.refresh();
          } catch {
            setMsg("Belum tersimpan. Periksa koneksi lalu coba lagi.");
          }
        });
      }}
    >
      <label>
        Diperiksa oleh
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          required
          minLength={2}
          maxLength={100}
          className="mt-1 block rounded-lg border p-2"
        />
      </label>
      <button disabled={busy} className="rounded-lg border px-3 py-2">
        {busy ? "Menyimpan…" : "Simpan pemeriksa"}
      </button>
      {msg && (
        <p role="status" className="w-full">
          {msg}
        </p>
      )}
    </form>
  );
}
